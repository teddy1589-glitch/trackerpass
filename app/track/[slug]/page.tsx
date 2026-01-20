import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BrandHeader } from "@/components/tracker/BrandHeader";
import { StatusCard } from "@/components/tracker/StatusCard";
import { InfoCard } from "@/components/tracker/InfoCard";
import { FieldRow } from "@/components/tracker/FieldRow";
import { getOrderBySlug } from "@/lib/db";

interface OrderRow {
  status_id?: number | null;
  status_step?: number | null;
  status_label?: string | null;
  car_info?: Record<string, unknown> | string | null;
  permit_info?: Record<string, unknown> | string | null;
  manager_contact?: Record<string, unknown> | string | null;
  hash_slug?: string | null;
  updated_at?: string | null;
}

function ensureObject(value: Record<string, unknown> | string | null | undefined) {
  if (!value) {
    return {};
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value;
}

function toDisplayValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().replace("T", " ").slice(0, 16);
  }
  return value as string | number | null | undefined;
}

function extractSlugFromPath(pathname?: string | null) {
  if (!pathname) {
    return null;
  }
  const clean = pathname.split("?")[0];
  const marker = "/track/";
  const index = clean.indexOf(marker);
  if (index === -1) {
    return null;
  }
  const slug = clean.slice(index + marker.length);
  return slug || null;
}

async function getSlugFromHeaders() {
  const requestHeaders = await headers();
  const candidates = [
    requestHeaders.get("x-nextjs-pathname"),
    requestHeaders.get("x-invoke-path"),
    requestHeaders.get("x-forwarded-uri"),
    requestHeaders.get("x-original-url"),
    requestHeaders.get("x-rewrite-url"),
  ];
  for (const candidate of candidates) {
    const slug = extractSlugFromPath(candidate);
    if (slug) {
      return slug;
    }
  }
  return null;
}

export default async function TrackPage({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug ?? (await getSlugFromHeaders());
  if (!slug) {
    notFound();
  }

  const order = (await getOrderBySlug(slug)) as OrderRow | null;
  if (!order) {
    notFound();
  }

  const carInfo = ensureObject(order.car_info);
  const permitInfo = ensureObject(order.permit_info);
  const managerInfo = ensureObject(order.manager_contact);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_45%),_radial-gradient(circle_at_right,_rgba(59,130,246,0.25),_transparent_40%),_radial-gradient(circle_at_left,_rgba(16,185,129,0.18),_transparent_45%)] px-4 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <BrandHeader />

        <StatusCard
          title={order.status_label ?? "Статус формируется"}
          step={order.status_step ?? 1}
          statusId={order.status_id ?? null}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <InfoCard title="Автомобиль">
            <FieldRow label="VIN" value={toDisplayValue(carInfo.vin)} />
            <FieldRow
              label="Марка / модель"
              value={toDisplayValue(carInfo.brand_model)}
            />
          </InfoCard>

          <InfoCard title="Пропуск">
            <FieldRow
              label="Срок действия"
              value={toDisplayValue(permitInfo.pass_expiry)}
            />
            <FieldRow label="Зона" value={toDisplayValue(permitInfo.zone)} />
            <FieldRow
              label="Тип пропуска"
              value={toDisplayValue(permitInfo.pass_type)}
            />
            <FieldRow
              label="Выход пропуска"
              value={toDisplayValue(permitInfo.ready_at)}
            />
          </InfoCard>

          <InfoCard title="Диагностическая карта">
            <FieldRow
              label="Номер"
              value={toDisplayValue(carInfo.diagnostic_card)}
            />
            <FieldRow
              label="Действует до"
              value={toDisplayValue(carInfo.diagnostic_card_valid_until)}
            />
          </InfoCard>

          <InfoCard title="Менеджер">
            <FieldRow label="Имя" value={toDisplayValue(managerInfo.name)} />
            <FieldRow label="ID" value={toDisplayValue(managerInfo.id)} />
          </InfoCard>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-xs uppercase tracking-[0.2em] text-brand-muted">
          <span>RTE-Consult</span>
          <span>Обновлено: {order.updated_at ?? "—"}</span>
        </div>
      </div>
    </main>
  );
}
