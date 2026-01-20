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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,59,79,0.12),_transparent_40%),_radial-gradient(circle_at_right,_rgba(154,89,255,0.12),_transparent_45%),_radial-gradient(circle_at_left,_rgba(47,107,255,0.12),_transparent_45%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <BrandHeader />

        <StatusCard
          title={order.status_label ?? "Статус формируется"}
          step={order.status_step ?? 1}
          statusId={order.status_id ?? null}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-premium">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Автомобиль
                </h2>
                {carInfo.image_url ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                    Фото
                  </span>
                ) : null}
              </div>
              {carInfo.image_url ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={String(carInfo.image_url)}
                    alt="Изображение автомобиля"
                    className="h-56 w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500">
                  Фото автомобиля будет добавлено
                </div>
              )}
              <div className="space-y-3 text-sm text-slate-600">
                <FieldRow label="VIN" value={toDisplayValue(carInfo.vin)} />
                <FieldRow
                  label="Марка / модель"
                  value={toDisplayValue(carInfo.brand_model)}
                />
                <FieldRow
                  label="Диагностическая карта"
                  value={toDisplayValue(carInfo.diagnostic_card)}
                />
                <FieldRow
                  label="Действует до"
                  value={toDisplayValue(carInfo.diagnostic_card_valid_until)}
                />
              </div>
            </div>
          </section>

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

          <InfoCard title="Менеджер">
            <FieldRow label="Имя" value={toDisplayValue(managerInfo.name)} />
            <FieldRow label="ID" value={toDisplayValue(managerInfo.id)} />
          </InfoCard>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs uppercase tracking-[0.2em] text-slate-500">
          <span className="text-slate-600">RTE-Consult</span>
          <span>Обновлено: {toDisplayValue(order.updated_at) ?? "—"}</span>
        </div>
      </div>
    </main>
  );
}
