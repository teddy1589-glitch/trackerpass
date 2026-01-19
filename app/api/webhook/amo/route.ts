import { NextRequest, NextResponse } from "next/server";
import { AmoCRMClient } from "@/lib/amocrm";
import { upsertOrder } from "@/lib/db";

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
      case 1043841: // Срок действия пропуска
        permitInfo.pass_expiry = value;
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

  console.log(
    "Webhook: fetched lead",
    JSON.stringify(
      {
        id: lead.id,
        name: lead.name,
        status_id: lead.status_id,
        responsible_user_id: lead.responsible_user_id,
        custom_fields_count: lead.custom_fields_values?.length ?? 0,
      },
      null,
      2,
    ),
  );

  const { carInfo, permitInfo } = mapCustomFields(lead.custom_fields_values);

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
    status_step: 1,
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
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return NextResponse.json(
        { message: "Empty payload" },
        { status: 200 },
      );
    }

    let payload: AmoWebhookEvent;
    try {
      payload = JSON.parse(rawBody) as AmoWebhookEvent;
    } catch (parseError) {
      console.warn("Webhook received non-JSON payload");
      return NextResponse.json(
        { message: "Ignored non-JSON payload" },
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
