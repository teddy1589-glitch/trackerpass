import { NextRequest, NextResponse } from "next/server";
import { AmoCRMClient } from "@/lib/amocrm";
import { getOrderByLeadId, upsertOrder } from "@/lib/db";
import { calcPermitReadyAt, resolvePermitType } from "@/lib/deadline";

interface AmoWebhookEvent {
  leads?: {
    add?: Array<{ id: number }>;
    update?: Array<{ id: number }>;
  };
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

async function processLead(leadId: number): Promise<void> {
  const client = new AmoCRMClient();
  const lead = await client.getLead(leadId);
  if (!lead) {
    console.warn(`Webhook: lead ${leadId} not found in AmoCRM`);
    return;
  }

  const { carInfo, permitInfo } = mapCustomFields(lead.custom_fields_values);

  const shouldCreateLink =
    lead.status_id === 41138302 || lead.status_id === 41138689;
  const existingOrder = shouldCreateLink
    ? await getOrderByLeadId(lead.id)
    : null;
  const hasExistingSlug = Boolean(existingOrder?.hash_slug);

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

    if (contentType.includes("application/json")) {
      payload = JSON.parse(rawBody) as AmoWebhookEvent;
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
        if (addId) leadIds.push(Number(addId));
        if (updateId) leadIds.push(Number(updateId));
      if (statusId) leadIds.push(Number(statusId));
      } catch {
        // ignore, fallback to regex below
      }

      const addRegex = /leads\[add]\[\d+]\[id]\D+(\d+)/g;
      const updateRegex = /leads\[update]\[\d+]\[id]\D+(\d+)/g;
      const statusRegex = /leads\[status]\[\d+]\[id]\D+(\d+)/g;
      let match: RegExpExecArray | null;
      while ((match = addRegex.exec(rawBody)) !== null) {
        leadIds.push(Number(match[1]));
      }
      while ((match = updateRegex.exec(rawBody)) !== null) {
        leadIds.push(Number(match[1]));
      }
      while ((match = statusRegex.exec(rawBody)) !== null) {
        leadIds.push(Number(match[1]));
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

    if (leadIds.length === 0) {
      return NextResponse.json(
        { message: "No leads in payload" },
        { status: 200 },
      );
    }

    Promise.all(leadIds.map((id) => processLead(id))).catch((error) => {
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
