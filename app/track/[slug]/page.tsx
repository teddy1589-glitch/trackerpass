import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { StatusCard } from "@/components/tracker/StatusCard";
import { InfoCard } from "@/components/tracker/InfoCard";
import { FieldRow } from "@/components/tracker/FieldRow";
import { getOrderBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function parsePermitDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const [datePart, timePart] = value.trim().split(" ");
  const [day, month, year] = datePart.split(".").map(Number);
  if (!day || !month || !year) {
    return null;
  }
  let hours = 0;
  let minutes = 0;
  if (timePart) {
    const [hh, mm] = timePart.split(":").map(Number);
    hours = Number.isFinite(hh) ? hh : 0;
    minutes = Number.isFinite(mm) ? mm : 0;
  }
  return new Date(year, month - 1, day, hours, minutes);
}

function normalizeDate(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function buildPermitValidity(
  startValue: string | null,
  endValue: string | null,
) {
  if (!startValue && !endValue) {
    return {
      dateText: null,
      daysText: null,
      daysClassName: undefined,
      status: "unknown",
    };
  }
  const startLabel = startValue ?? "—";
  const endLabel = endValue ?? "—";
  const startDate = parsePermitDate(startValue);
  const endDate = parsePermitDate(endValue);
  const today = normalizeDate(new Date());
  let daysText: string | null = null;
  let daysClassName: string | undefined;
  let status: "active" | "expired" | "unknown" = "unknown";
  if (startDate && endDate) {
    const startNorm = normalizeDate(startDate);
    const endNorm = normalizeDate(endDate);
    const totalDays =
      Math.floor((endNorm.getTime() - startNorm.getTime()) / 86_400_000) + 1;
    const remainingDays =
      Math.floor((endNorm.getTime() - today.getTime()) / 86_400_000) + 1;
    if (endNorm.getTime() < today.getTime()) {
      daysText = "Пропуск закончился";
      daysClassName = "text-rose-600";
      status = "expired";
    } else if (remainingDays > 0) {
      daysText = `Осталось ${remainingDays} дн.`;
      daysClassName = "text-emerald-600";
      status = "active";
    }
    if (!daysText && totalDays > 0) {
      daysText = `Действует ${totalDays} дн.`;
      daysClassName = "text-emerald-600";
      status = "active";
    }
  } else if (endDate) {
    const endNorm = normalizeDate(endDate);
    const remainingDays =
      Math.floor((endNorm.getTime() - today.getTime()) / 86_400_000) + 1;
    if (endNorm.getTime() < today.getTime()) {
      daysText = "Пропуск закончился";
      daysClassName = "text-rose-600";
      status = "expired";
    } else if (remainingDays > 0) {
      daysText = `Осталось ${remainingDays} дн.`;
      daysClassName = "text-emerald-600";
      status = "active";
    }
  }
  return {
    dateText: `${startLabel} - ${endLabel}`.trim(),
    daysText,
    daysClassName,
    status,
  };
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
  const hasDiagnosticCard = Boolean(
    carInfo.diagnostic_card || carInfo.diagnostic_card_valid_until,
  );
  const passStart = asString(permitInfo.pass_start_date);
  const passEnd = asString(permitInfo.pass_validity_date ?? permitInfo.pass_expiry);
  const passValidity = buildPermitValidity(passStart, passEnd);
  const permitCardClass =
    passValidity.status === "active"
      ? "border-2 border-emerald-400"
      : passValidity.status === "expired"
        ? "border-2 border-rose-400"
        : "border border-transparent";
  const expectedReadyAt = asString(permitInfo.ready_at);
  const managerName = asString(managerInfo.full_name ?? managerInfo.name);
  const managerAvatar = asString(managerInfo.avatar_url);
  const managerPhone = asString(managerInfo.phone);
  const managerEmail = asString(managerInfo.email);
  const managerWhatsapp = asString(managerInfo.whatsapp);
  const managerTelegram = asString(managerInfo.telegram);
  const managerSite = asString(managerInfo.site);
  const whatsappLink = managerWhatsapp
    ? managerWhatsapp.startsWith("http")
      ? managerWhatsapp
      : `https://wa.me/${managerWhatsapp.replace(/\D/g, "")}`
    : null;
  const telegramLink = managerTelegram
    ? managerTelegram.startsWith("http")
      ? managerTelegram
      : `https://t.me/${managerTelegram.replace(/^@/, "")}`
    : null;
  const siteLink = managerSite
    ? managerSite.startsWith("http")
      ? managerSite
      : `https://${managerSite}`
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <StatusCard
            title={order.status_label ?? "Статус формируется"}
            step={order.status_step ?? 1}
            statusId={order.status_id ?? null}
            readyAt={expectedReadyAt}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  Автомобиль
                </h3>
              </div>
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="flex items-center justify-center sm:justify-start">
                  {carInfo.image_url ? (
                    <div className="flex h-44 w-44 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={String(carInfo.image_url)}
                        alt="Изображение автомобиля"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-44 w-44 items-center justify-center rounded-full border border-dashed border-slate-200 text-sm text-slate-500">
                      Фото
                    </div>
                  )}
                </div>
                <div className="space-y-3 text-sm text-slate-600">
                  <FieldRow label="VIN" value={toDisplayValue(carInfo.vin)} />
                  <FieldRow
                    label="Марка / модель"
                    value={toDisplayValue(carInfo.brand_model)}
                  />
                  {hasDiagnosticCard ? (
                    <>
                      <FieldRow
                        label="Диагностическая карта"
                        value={toDisplayValue(carInfo.diagnostic_card)}
                      />
                      <FieldRow
                        label="Действует до"
                        value={toDisplayValue(carInfo.diagnostic_card_valid_until)}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <InfoCard title="Пропуск" className={permitCardClass}>
            {permitInfo.pass_check_status === "checking" ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                Проверяем пропуск в реестре...
              </div>
            ) : null}
            {permitInfo.pass_check_status === "error" ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-600">
                Не удалось проверить пропуск. Попробуем позже.
              </div>
            ) : null}
            <FieldRow
              label="Срок действия"
              value={
                passValidity.dateText ? (
                  <div className="flex flex-col items-end gap-1">
                    <span>{passValidity.dateText}</span>
                    {passValidity.daysText ? (
                      <span className={passValidity.daysClassName}>
                        {passValidity.daysText}
                      </span>
                    ) : null}
                  </div>
                ) : null
              }
            />
            <FieldRow
              label="Серия и номер"
              value={toDisplayValue(
                permitInfo.pass_series || permitInfo.series || permitInfo.pass_number || permitInfo.number
                  ? `${permitInfo.pass_series ?? permitInfo.series ?? ""}${permitInfo.pass_series || permitInfo.series ? " " : ""}${permitInfo.pass_number ?? permitInfo.number ?? ""}`.trim()
                  : null,
              )}
            />
            <FieldRow label="Зона" value={toDisplayValue(permitInfo.zone)} />
            <FieldRow
              label="Тип пропуска"
              value={toDisplayValue(permitInfo.pass_type)}
            />
            <FieldRow
              label="Период действия"
              value={toDisplayValue(permitInfo.pass_validity_period)}
            />
            <FieldRow
              label="Выход пропуска"
              value={toDisplayValue(permitInfo.ready_at)}
            />
          </InfoCard>

          <InfoCard title="Менеджер" className="lg:col-span-2">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                  {managerAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={managerAvatar}
                      alt="Фото менеджера"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-slate-400">Фото</span>
                  )}
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">
                    {managerName ?? "Менеджер"}
                  </div>
                  {managerPhone ? (
                    <div className="text-sm text-slate-600">{managerPhone}</div>
                  ) : null}
                  {siteLink ? (
                    <a
                      href={siteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-brand hover:underline"
                    >
                      {managerSite}
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"
                  >
                    WhatsApp
                  </a>
                ) : null}
                {telegramLink ? (
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700"
                  >
                    Telegram
                  </a>
                ) : null}
                {managerEmail ? (
                  <a
                    href={`mailto:${managerEmail}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"
                  >
                    {managerEmail}
                  </a>
                ) : null}
              </div>
            </div>
          </InfoCard>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
          <span className="text-slate-500">RTE-Consult</span>
          <span>Данные обновляются автоматически</span>
        </div>
      </div>
    </main>
  );
}
