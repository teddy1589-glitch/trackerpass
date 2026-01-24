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
  const clean = value.replace(/\s*\(.*\)\s*$/, "").trim();
  if (clean.includes("-")) {
    const parsed = new Date(clean);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const [datePart, timePart] = clean.split(" ");
  const [day, month, yearRaw] = datePart.split(".").map(Number);
  if (!day || !month || !yearRaw) {
    return null;
  }
  const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
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

function hasTimeInSource(value: string): boolean {
  const clean = value.replace(/\s*\(.*\)\s*$/, "").trim();
  if (!clean) {
    return false;
  }
  if (/\b\d{1,2}:\d{2}\b/.test(clean)) {
    return true;
  }
  return clean.includes("T") && /\d{2}:\d{2}/.test(clean);
}

function formatDateParts(date: Date, includeTime: boolean): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear() % 100).padStart(2, "0");
  if (!includeTime) {
    return `${day}.${month}.${year}`;
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year}, ${hours}:${minutes}`;
}

function formatDateTime(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    const includeTime = value.getHours() !== 0 || value.getMinutes() !== 0;
    return formatDateParts(value, includeTime);
  }
  if (typeof value === "string" || typeof value === "number") {
    const rawValue = String(value);
    const parsed = parsePermitDate(rawValue);
    if (!parsed) {
      return typeof value === "string" ? value : String(value);
    }
    const includeTime =
      typeof value === "number" ? true : hasTimeInSource(rawValue);
    return formatDateParts(parsed, includeTime);
  }
  return null;
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
  const startLabel = formatDateTime(startValue) ?? "—";
  const endLabel = formatDateTime(endValue) ?? "—";
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

function buildDiagnosticCardStatus(validUntil: string | null) {
  if (!validUntil) {
    return {
      daysText: null,
      daysClassName: undefined,
      status: "unknown",
    };
  }
  const validUntilDate = parsePermitDate(validUntil);
  if (!validUntilDate) {
    return {
      daysText: null,
      daysClassName: undefined,
      status: "unknown",
    };
  }
  const today = normalizeDate(new Date());
  const endNorm = normalizeDate(validUntilDate);
  const remainingDays =
    Math.floor((endNorm.getTime() - today.getTime()) / 86_400_000) + 1;
  if (endNorm.getTime() < today.getTime()) {
    return {
      daysText: "Срок ДК истек",
      daysClassName: "text-rose-600",
      status: "expired",
    };
  }
  if (remainingDays > 0) {
    return {
      daysText: `Осталось ${remainingDays} дн.`,
      daysClassName: "text-emerald-600",
      status: "active",
    };
  }
  return {
    daysText: null,
    daysClassName: undefined,
    status: "unknown",
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
  const diagnosticValidUntil = asString(carInfo.diagnostic_card_valid_until);
  const diagnosticStatus = buildDiagnosticCardStatus(diagnosticValidUntil);
  const passStart = asString(permitInfo.pass_start_date);
  const passEnd = asString(permitInfo.pass_validity_date ?? permitInfo.pass_expiry);
  const hasPassValidity = Boolean(passStart && passEnd);
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
  const passType = asString(permitInfo.pass_type);
  const hasPassData = Boolean(
    permitInfo.pass_series ||
      permitInfo.series ||
      permitInfo.pass_number ||
      permitInfo.number ||
      permitInfo.pass_validity_date ||
      permitInfo.pass_expiry ||
      permitInfo.pass_start_date ||
      permitInfo.zone ||
      passType ||
      permitInfo.pass_validity_period,
  );
  const isDocsSubmitted = order.status_id === 41138692;
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
  const phoneHref = managerPhone
    ? `tel:${managerPhone.replace(/[^\d+]/g, "")}`
    : null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <StatusCard
            title={order.status_label ?? "Статус формируется"}
            step={order.status_step ?? 1}
            statusId={order.status_id ?? null}
            readyAt={formatDateTime(expectedReadyAt)}
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
                      {diagnosticValidUntil ? (
                        <FieldRow
                          label="Действует до"
                          value={
                            <div className="flex flex-col items-end gap-1">
                              <span>{formatDateTime(diagnosticValidUntil)}</span>
                              {diagnosticStatus.daysText ? (
                                <span className={diagnosticStatus.daysClassName}>
                                  {diagnosticStatus.daysText}
                                </span>
                              ) : null}
                            </div>
                          }
                        />
                      ) : null}
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
            {hasPassValidity && passValidity.dateText ? (
              <FieldRow
                label="Срок действия"
                value={
                  <div className="flex flex-col items-end gap-1">
                    <span>{passValidity.dateText}</span>
                    {passValidity.daysText ? (
                      <span className={passValidity.daysClassName}>
                        {passValidity.daysText}
                      </span>
                    ) : null}
                  </div>
                }
              />
            ) : null}
            {permitInfo.pass_series ||
            permitInfo.series ||
            permitInfo.pass_number ||
            permitInfo.number ? (
              <FieldRow
                label="Серия и номер"
                value={toDisplayValue(
                  `${permitInfo.pass_series ?? permitInfo.series ?? ""}${
                    permitInfo.pass_series || permitInfo.series ? " " : ""
                  }${permitInfo.pass_number ?? permitInfo.number ?? ""}`.trim(),
                )}
              />
            ) : null}
            {permitInfo.zone ? (
              <FieldRow label="Зона" value={toDisplayValue(permitInfo.zone)} />
            ) : null}
            {passType ? (
              <FieldRow
                label="Тип пропуска"
                value={toDisplayValue(passType)}
              />
            ) : null}
            {permitInfo.pass_validity_period ? (
              <FieldRow
                label="Период действия"
                value={toDisplayValue(permitInfo.pass_validity_period)}
              />
            ) : null}
            {isDocsSubmitted && !hasPassData && expectedReadyAt ? (
              <FieldRow
                label="Ожидаемая дата выхода"
                value={formatDateTime(expectedReadyAt)}
              />
            ) : null}
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
                  {managerPhone && phoneHref ? (
                    <a
                      href={phoneHref}
                      className="flex items-center gap-2 text-base text-slate-600"
                    >
                      <svg
                        aria-hidden="true"
                        className="h-[1.1rem] w-[1.1rem] text-slate-400"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M4.5 5.25c0-.414.336-.75.75-.75h2.424c.35 0 .658.243.734.584l.67 2.985a.75.75 0 0 1-.214.71l-1.37 1.37a11.202 11.202 0 0 0 5.36 5.36l1.37-1.37a.75.75 0 0 1 .71-.214l2.985.67c.34.076.584.384.584.734v2.424a.75.75 0 0 1-.75.75H17.25A12.75 12.75 0 0 1 4.5 5.25Z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{managerPhone}</span>
                    </a>
                  ) : null}
                  {siteLink ? (
                    <a
                      href={siteLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-base text-brand hover:underline"
                    >
                      <svg
                        aria-hidden="true"
                        className="h-[1.1rem] w-[1.1rem] text-brand"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M13.5 6.75h3.75V10.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M10.5 13.5 17.25 6.75"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 6.75h-1.5A2.25 2.25 0 0 0 5.25 9v7.5A2.25 2.25 0 0 0 7.5 18.75H15a2.25 2.25 0 0 0 2.25-2.25v-1.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
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
                    className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700 transition-all duration-200 hover:scale-105 hover:bg-emerald-100 hover:shadow-md active:scale-95"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span>WhatsApp</span>
                  </a>
                ) : null}
                {telegramLink ? (
                  <a
                    href={telegramLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sky-700 transition-all duration-200 hover:scale-105 hover:bg-sky-100 hover:shadow-md active:scale-95"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                    </svg>
                    <span>Telegram</span>
                  </a>
                ) : null}
                {managerEmail ? (
                  <a
                    href={`mailto:${managerEmail}`}
                    className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 transition-all duration-200 hover:scale-105 hover:bg-slate-100 hover:shadow-md active:scale-95"
                  >
                    <svg
                      aria-hidden="true"
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                      />
                    </svg>
                    <span>{managerEmail}</span>
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
