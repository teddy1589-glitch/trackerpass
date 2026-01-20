import { Pool } from "pg";
import { createHash } from "crypto";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const globalForDb = globalThis as typeof globalThis & {
  __dbPool?: Pool;
};

const pool =
  globalForDb.__dbPool ??
  new Pool({
    connectionString,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__dbPool = pool;
}

export async function getOrderBySlug(slug: string) {
  const { rows } = await pool.query(
    "select * from rte.orders where hash_slug = $1 limit 1",
    [slug],
  );
  return rows[0] ?? null;
}

export interface UpsertOrderData {
  amo_lead_id: number;
  status_id?: number | null;
  status_step?: number | null;
  status_label?: string | null;
  car_info?: Record<string, unknown> | null;
  permit_info?: Record<string, unknown> | null;
  manager_contact?: Record<string, unknown> | null;
}

function generateHashSlug(amoLeadId: number): string {
  return createHash("sha256")
    .update(`amo_lead_${amoLeadId}`)
    .digest("hex")
    .slice(0, 16);
}

function mapStatusToStep(statusId: number | null | undefined): number {
  if (!statusId) {
    return 1;
  }
  if (statusId === 41138689) {
    return 2;
  }
  if (statusId === 41138692) {
    return 3;
  }
  if (statusId === 41138695) {
    return 4;
  }
  if (statusId === 41138698) {
    return 4;
  }
  return 1;
}

function shouldGenerateHash(statusId: number | null | undefined): boolean {
  return statusId === 41138689;
}

export async function upsertOrder(data: UpsertOrderData) {
  const statusStep = data.status_step ?? mapStatusToStep(data.status_id);
  const hashSlug = shouldGenerateHash(data.status_id)
    ? generateHashSlug(data.amo_lead_id)
    : null;
  const { rows } = await pool.query(
    `insert into rte.orders (
      amo_lead_id,
      hash_slug,
      status_step,
      status_label,
      car_info,
      permit_info,
      manager_contact
    ) values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (amo_lead_id) do update
    set status_step = excluded.status_step,
        status_label = excluded.status_label,
        car_info = excluded.car_info,
        permit_info = excluded.permit_info,
        manager_contact = excluded.manager_contact,
        hash_slug = coalesce(rte.orders.hash_slug, excluded.hash_slug),
        updated_at = now()
    returning *`,
    [
      data.amo_lead_id,
      hashSlug,
      statusStep,
      data.status_label ?? null,
      JSON.stringify(data.car_info ?? {}),
      JSON.stringify(data.permit_info ?? {}),
      JSON.stringify(data.manager_contact ?? {}),
    ],
  );
  return rows[0] ?? null;
}

export interface AmoTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number | null;
  updated_at?: string;
}

export async function getAmoTokens(): Promise<AmoTokens | null> {
  const { rows } = await pool.query(
    "select access_token, refresh_token, expires_in, updated_at from rte.amocrm_tokens limit 1",
  );
  return rows[0] ?? null;
}

export async function upsertAmoTokens(tokens: AmoTokens): Promise<void> {
  await pool.query(
    `insert into rte.amocrm_tokens (id, access_token, refresh_token, expires_in)
     values (true, $1, $2, $3)
     on conflict (id) do update
     set access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_in = excluded.expires_in,
         updated_at = now()`,
    [tokens.access_token, tokens.refresh_token, tokens.expires_in],
  );
}
