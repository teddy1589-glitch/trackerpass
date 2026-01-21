import { NextRequest, NextResponse } from "next/server";
import { AmoCRMClient } from "@/lib/amocrm";
import { getOrderByLeadId, upsertOrder } from "@/lib/db";
import { calcPermitReadyAt, resolvePermitType } from "@/lib/deadline";
import { generateCarImage } from "@/lib/openai";

interface AmoWebhookEvent {
  leads?: {
    add?: Array<{ id: number }>;
    update?: Array<{ id: number }>;
  };
}

type PassApiEntry = {
  number?: string;
  grz?: string;
  startdate?: string;
  validitydate?: string;
  allowedzona?: string;
  passstatus?: string;
  tip?: string;
  typepassvalidityperiod?: string;
};

type PassApiResponse = {
  status?: number;
  list?: PassApiEntry[];
  error?: string;
  message?: string;
};

const PASS_CHECK_API_TOKEN = process.env.PASS_CHECK_API_TOKEN;
const PASS_CHECK_API_URL =
  process.env.PASS_CHECK_API_URL ??
  "https://api-cloud.ru/api/transportMos.php";
const STATUS_PASS_RELEASED = 41138695;

function parsePassDate(value?: string): number {
  if (!value) {
    return 0;
  }
  const [datePart, timePart] = value.trim().split(" ");
  const [day, month, year] = datePart.split(".").map(Number);
  if (!day || !month || !year) {
    return 0;
  }
  let hours = 0;
  let minutes = 0;
  if (timePart) {
    const [hh, mm] = timePart.split(":").map(Number);
    hours = Number.isFinite(hh) ? hh : 0;
    minutes = Number.isFinite(mm) ? mm : 0;
  }
  return new Date(year, month - 1, day, hours, minutes).getTime();
}

function selectPassInfo(list: PassApiEntry[] = []): PassApiEntry | null {
  if (list.length === 0) {
    return null;
  }
  const issued = list.filter(
    (item) => item.passstatus?.toLowerCase() === "выдан",
  );
  const candidates = issued.length > 0 ? issued : list;
  return candidates.sort(
    (a, b) => parsePassDate(b.validitydate) - parsePassDate(a.validitydate),
  )[0];
}

async function fetchPassInfo(regNumber: string): Promise<PassApiEntry | null> {
  const url = `${PASS_CHECK_API_URL}?type=pass&regNumber=${encodeURIComponent(
    regNumber,
  )}&token=${PASS_CHECK_API_TOKEN}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Pass API error ${response.status}`);
  }
  const data = (await response.json()) as PassApiResponse;
  if (data.error || data.status !== 200) {
    const message = data.message ?? data.error ?? "Unknown pass API error";
    throw new Error(message);
  }
  return selectPassInfo(data.list ?? []);
}

function extractLeadIds(event: AmoWebhookEvent): number[] {
  const ids: number[] = [];
  if (event.leads?.add) {
    ids.push(...event.leads.add.map((lead) => lead.id));
  }
  if (event.leads?.update) {
    ids.push(...event.leads.update.map((lead) => lead.id));
  }
  return ids;
}

function mapCustomFields(
  fields: Array<{
    field_id: number;
    field_name: string;
    values: Array<{ value: string | number }>;
  }> = [],
): { carInfo: Record<string, unknown>; permitInfo: Record<string, unknown> } {
  const carInfo: Record<string, unknown> = {};
  const permitInfo: Record<string, unknown> = {};

  for (const field of fields) {
    const value = field.values?.[0]?.value;
    if (value === undefined) {
      continue;
    }
    switch (field.field_id) {
      case 1043841: // Тип пропуска (Временный / 6 месяцев / 12 месяцев)
        permitInfo.pass_type = value;
        break;
      case 744115: // Зона
        permitInfo.zone = value;
        break;
      case 744117: // Тип пропуска
        permitInfo.pass_type = value;
        break;
      case 924745: // VIN
        carInfo.vin = value;
        break;
      case 924747: // Марка модель
        carInfo.brand_model = value;
        break;
      case 1175381: // Диагностическая карта
        carInfo.diagnostic_card = value;
        break;
      case 1175385: // Дата действия ДК
        carInfo.diagnostic_card_valid_until = value;
        break;
      default:
        // Store unmapped fields for future reference
        carInfo[field.field_name || `field_${field.field_id}`] = value;
        break;
    }
  }

  return { carInfo, permitInfo };
}

async function processLead(
  leadId: number,
  oldStatusId?: number,
): Promise<void> {
  const client = new AmoCRMClient();
  const lead = await client.getLead(leadId);
  if (!lead) {
    console.warn(`Webhook: lead ${leadId} not found in AmoCRM`);
    return;
  }

  const { carInfo, permitInfo } = mapCustomFields(lead.custom_fields_values);

  const shouldCreateLink =
    lead.status_id === 41138302 || lead.status_id === 41138689;
  const existingOrder = await getOrderByLeadId(lead.id);
  const hasExistingSlug = Boolean(existingOrder?.hash_slug);
  const existingCarInfo =
    typeof existingOrder?.car_info === "string"
      ? JSON.parse(existingOrder.car_info)
      : (existingOrder?.car_info ?? {});
  const existingPermitInfo =
    typeof existingOrder?.permit_info === "string"
      ? JSON.parse(existingOrder.permit_info)
      : (existingOrder?.permit_info ?? {});
  const existingImageUrl =
    typeof existingCarInfo === "object" && existingCarInfo
      ? (existingCarInfo as { image_url?: string }).image_url
      : null;
  if (!carInfo.image_url && existingImageUrl) {
    carInfo.image_url = existingImageUrl;
    console.log("Webhook: reused stored image", {
      lead_id: lead.id,
      image_url: existingImageUrl,
    });
  }

  const transitionedToPassReleased =
    lead.status_id === STATUS_PASS_RELEASED &&
    oldStatusId !== undefined &&
    oldStatusId !== STATUS_PASS_RELEASED;
  const existingPassNumber =
    typeof existingPermitInfo === "object" && existingPermitInfo
      ? (existingPermitInfo as { pass_number?: string }).pass_number
      : null;
  const existingPassValidity =
    typeof existingPermitInfo === "object" && existingPermitInfo
      ? (existingPermitInfo as { pass_validity_date?: string }).pass_validity_date
      : null;
  const hasPassData = Boolean(
    permitInfo.pass_number ||
      permitInfo.pass_validity_date ||
      existingPassNumber ||
      existingPassValidity,
  );
  if (transitionedToPassReleased && !hasPassData) {
    try {
      const regNumber = String(lead.name || "").trim();
      if (!regNumber) {
        console.warn("Webhook: missing regNumber for pass check", {
          lead_id: lead.id,
        });
      } else if (!PASS_CHECK_API_TOKEN) {
        console.warn("Webhook: PASS_CHECK_API_TOKEN is not set", {
          lead_id: lead.id,
        });
      } else {
        const passInfo = await fetchPassInfo(regNumber);
        if (passInfo) {
          permitInfo.pass_number = passInfo.number ?? null;
          permitInfo.pass_start_date = passInfo.startdate ?? null;
          permitInfo.pass_validity_date = passInfo.validitydate ?? null;
          permitInfo.pass_expiry = passInfo.validitydate ?? null;
          permitInfo.zone = passInfo.allowedzona ?? permitInfo.zone ?? null;
          permitInfo.pass_type = passInfo.tip ?? permitInfo.pass_type ?? null;
          permitInfo.pass_validity_period =
            passInfo.typepassvalidityperiod ?? null;
          permitInfo.pass_raw = passInfo;
          console.log("Webhook: pass info saved", {
            lead_id: lead.id,
            number: passInfo.number,
            zone: passInfo.allowedzona,
          });
        } else {
          console.warn("Webhook: pass info not found", {
            lead_id: lead.id,
            reg_number: regNumber,
          });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      console.warn("Webhook: pass check failed", err);
    }
  } else if (transitionedToPassReleased) {
    console.log("Webhook: skipping pass check, data already set", {
      lead_id: lead.id,
      has_payload_pass: Boolean(
        permitInfo.pass_number || permitInfo.pass_validity_date,
      ),
      has_stored_pass: Boolean(existingPassNumber || existingPassValidity),
    });
  }

  if (lead.status_id === 41138692) {
    const type = resolvePermitType(permitInfo.pass_type as string);
    if (type) {
      const submittedAt = new Date(
        (lead.updated_at ?? Date.now() / 1000) * 1000,
      );
      const { readyAtMsk } = await calcPermitReadyAt(submittedAt, type);
      permitInfo.ready_at = readyAtMsk;
    }
  }

  console.log(
    "Webhook: fetched lead (filtered)",
    JSON.stringify(
      {
        id: lead.id,
        name: lead.name,
        status_id: lead.status_id,
        responsible_user_id: lead.responsible_user_id,
        car_info: carInfo,
        permit_info: permitInfo,
        ready_at: permitInfo.ready_at ?? null,
      },
      null,
      2,
    ),
  );

  let managerContact: Record<string, unknown> = {};
  if (lead.responsible_user_id) {
    const user = await client.getUser(lead.responsible_user_id);
    if (user) {
      managerContact = { id: user.id, name: user.name };
    } else {
      managerContact = { id: lead.responsible_user_id };
    }
  }

  const saved = await upsertOrder({
    amo_lead_id: lead.id,
    status_id: lead.status_id,
    status_label: lead.name,
    car_info: carInfo,
    permit_info: permitInfo,
    manager_contact: managerContact,
  });

  console.log(
    "Webhook: order upserted",
    JSON.stringify(
      {
        amo_lead_id: lead.id,
        hash_slug: saved?.hash_slug ?? null,
        status_step: saved?.status_step ?? null,
      },
      null,
      2,
    ),
  );

  const shouldGenerateImage = Boolean(
    carInfo.brand_model && !carInfo.image_url && !existingImageUrl,
  );
  if (shouldGenerateImage) {
    try {
      console.log("Webhook: generating image", {
        lead_id: lead.id,
        model: carInfo.brand_model,
      });
      const imageUrl = await generateCarImage(String(carInfo.brand_model));
      carInfo.image_url = imageUrl;
      await upsertOrder({
        amo_lead_id: lead.id,
        status_id: lead.status_id,
        status_label: lead.name,
        car_info: carInfo,
        permit_info: permitInfo,
        manager_contact: managerContact,
      });
      console.log("Webhook: image generated", imageUrl);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      console.warn("Webhook: image generation failed", err);
    }
  } else {
    console.log("Webhook: skipping image generation", {
      lead_id: lead.id,
      has_model: Boolean(carInfo.brand_model),
      payload_image: Boolean(carInfo.image_url),
      stored_image: Boolean(existingImageUrl),
    });
  }

  if (shouldCreateLink && saved?.hash_slug && !hasExistingSlug) {
    const base = process.env.TRACK_BASE_URL ?? "http://89.44.86.30:3000/track";
    const link = `${base}/${saved.hash_slug}`;
    await client.addLeadNote(
      lead.id,
      `Ссылка на трекинг: ${link}`,
    );
    console.log("Webhook: tracking link note added", link);
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json({ message: "Empty payload" }, { status: 200 });
    }

    console.log("Webhook content-type:", contentType);
    console.log("Webhook raw body (first 500):", rawBody.slice(0, 500));

    let payload: AmoWebhookEvent | null = null;
    let statusLeadId: number | null = null;
    let oldStatusId: number | null = null;

    if (contentType.includes("application/json")) {
      payload = JSON.parse(rawBody) as AmoWebhookEvent;
      const statusBlock =
        (payload as { leads?: { status?: Array<{ id?: number; old_status_id?: number }> } })
          ?.leads?.status?.[0] ?? null;
      if (statusBlock?.id) {
        statusLeadId = Number(statusBlock.id);
      }
      if (statusBlock?.old_status_id) {
        oldStatusId = Number(statusBlock.old_status_id);
      }
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const leadIds: number[] = [];
      try {
        const params = new URLSearchParams(rawBody);
        const addId = params.get("leads[add][0][id]");
        const updateId = params.get("leads[update][0][id]");
        const statusId = params.get("leads[status][0][id]");
        const oldStatus = params.get("leads[status][0][old_status_id]");
        if (addId) leadIds.push(Number(addId));
        if (updateId) leadIds.push(Number(updateId));
        if (statusId) {
          statusLeadId = Number(statusId);
          leadIds.push(Number(statusId));
        }
        if (oldStatus) {
          oldStatusId = Number(oldStatus);
        }
      } catch {
        // ignore, fallback to regex below
      }

      const addRegex = /leads\[add]\[\d+]\[id]\D+(\d+)/g;
      const updateRegex = /leads\[update]\[\d+]\[id]\D+(\d+)/g;
      const statusRegex = /leads\[status]\[\d+]\[id]\D+(\d+)/g;
      const oldStatusRegex = /leads\[status]\[\d+]\[old_status_id]\D+(\d+)/g;
      let match: RegExpExecArray | null;
      while ((match = addRegex.exec(rawBody)) !== null) {
        leadIds.push(Number(match[1]));
      }
      while ((match = updateRegex.exec(rawBody)) !== null) {
        leadIds.push(Number(match[1]));
      }
      while ((match = statusRegex.exec(rawBody)) !== null) {
        statusLeadId = Number(match[1]);
        leadIds.push(Number(match[1]));
      }
      while ((match = oldStatusRegex.exec(rawBody)) !== null) {
        oldStatusId = Number(match[1]);
      }

      payload = { leads: { add: [], update: [] } };
      const uniqueIds = Array.from(new Set(leadIds)).filter(
        (id) => Number.isFinite(id),
      );
      for (const id of uniqueIds) {
        payload.leads!.update!.push({ id });
      }
    } else {
      // Fallback: try JSON anyway, then regex
      try {
        payload = JSON.parse(rawBody) as AmoWebhookEvent;
      } catch {
        const ids = rawBody.match(/\d{5,}/g) ?? [];
        if (ids.length > 0) {
          payload = { leads: { update: ids.map((id) => ({ id: Number(id) })) } };
        }
      }
    }

    if (!payload) {
      return NextResponse.json(
        { message: "Invalid payload" },
        { status: 200 },
      );
    }

    const leadIds = extractLeadIds(payload);
    if (statusLeadId) {
      leadIds.push(statusLeadId);
    }

    if (leadIds.length === 0) {
      return NextResponse.json(
        { message: "No leads in payload" },
        { status: 200 },
      );
    }

    const uniqueIds = Array.from(new Set(leadIds)).filter((id) =>
      Number.isFinite(id),
    );
    Promise.all(
      uniqueIds.map((id) =>
        processLead(id, id === statusLeadId ? oldStatusId ?? undefined : undefined),
      ),
    ).catch((error) => {
      console.error("Webhook processing error:", error);
    });

    return NextResponse.json(
      { message: "Webhook accepted", leadIds },
      { status: 200 },
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { message: "Webhook error", error: "Invalid payload" },
      { status: 200 },
    );
  }
}
