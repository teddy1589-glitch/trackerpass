import { StatusCard } from "@/components/tracker/StatusCard";
import { InfoCard } from "@/components/tracker/InfoCard";
import { FieldRow } from "@/components/tracker/FieldRow";

export default function TrackDemoPage() {
  const hasTimeInSource = (value: string) => {
    const clean = value.replace(/\s*\(.*\)\s*$/, "").trim();
    if (!clean) {
      return false;
    }
    if (/\b\d{1,2}:\d{2}\b/.test(clean)) {
      return true;
    }
    return clean.includes("T") && /\d{2}:\d{2}/.test(clean);
  };

  const parseDemoDate = (value: string) => {
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
  };

  const formatDateParts = (date: Date, includeTime: boolean) => {
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear() % 100).padStart(2, "0");
    if (!includeTime) {
      return `${day}.${month}.${year}`;
    }
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
  };

  const formatDateTime = (value: string | null) => {
    if (!value) {
      return null;
    }
    const parsed = parseDemoDate(value);
    if (!parsed) {
      return value;
    }
    const includeTime = hasTimeInSource(value);
    return formatDateParts(parsed, includeTime);
  };

  const normalizeDate = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate());

  const buildDiagnosticCardStatus = (validUntil: string | null) => {
    if (!validUntil) {
      return {
        daysText: null,
        daysClassName: undefined,
      };
    }
    const parsed = parseDemoDate(validUntil);
    if (!parsed) {
      return {
        daysText: null,
        daysClassName: undefined,
      };
    }
    const today = normalizeDate(new Date());
    const endNorm = normalizeDate(parsed);
    const remainingDays =
      Math.floor((endNorm.getTime() - today.getTime()) / 86_400_000) + 1;
    if (endNorm.getTime() < today.getTime()) {
      return {
        daysText: "Срок ДК истек",
        daysClassName: "text-rose-600",
      };
    }
    if (remainingDays > 0) {
      return {
        daysText: `Осталось ${remainingDays} дн.`,
        daysClassName: "text-emerald-600",
      };
    }
    return {
      daysText: null,
      daysClassName: undefined,
    };
  };

  const demo = {
    status_label: "Документы поданы",
    status_step: 3,
    status_id: 41138692,
    car_info: {
      vin: "WVWZZZ1KZ6W000001",
      brand_model: "Volkswagen Transporter T6",
      diagnostic_card: "DC-9081-772",
      diagnostic_card_valid_until: "2026-11-15",
      image_url:
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80",
    },
    permit_info: {
      pass_expiry: "2026-02-28",
      pass_start_date: "2026-01-24 10:00",
      pass_number: "77 1234567",
      zone: "СК",
      pass_type: "Годовой",
      ready_at: "2026-01-24 16:00 (МСК)",
    },
    manager_contact: {
      full_name: "Андрей Смирнов",
      phone: "+7 (495) 123-45-67",
      email: "smirnov@rte-consult.ru",
      whatsapp: "+79001234567",
      telegram: "rte_manager",
      site: "rte-consult.ru",
      avatar_url:
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    },
    updated_at: "2026-01-18 17:45",
  };
  const diagnosticCardStatus = buildDiagnosticCardStatus(
    demo.car_info.diagnostic_card_valid_until,
  );

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,59,79,0.12),_transparent_40%),_radial-gradient(circle_at_right,_rgba(154,89,255,0.12),_transparent_45%),_radial-gradient(circle_at_left,_rgba(47,107,255,0.12),_transparent_45%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <StatusCard
            title={demo.status_label}
            step={demo.status_step}
            statusId={demo.status_id}
            readyAt={formatDateTime(demo.permit_info.ready_at)}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <InfoCard title="Автомобиль">
            <FieldRow label="VIN" value={demo.car_info.vin} />
            <FieldRow label="Марка / модель" value={demo.car_info.brand_model} />
          </InfoCard>

          <InfoCard title="Пропуск">
            <FieldRow
              label="Срок действия"
              value={`${formatDateTime(demo.permit_info.pass_start_date)} - ${formatDateTime(
                demo.permit_info.pass_expiry,
              )}`}
            />
            <FieldRow label="Серия и номер" value={demo.permit_info.pass_number} />
            <FieldRow label="Зона" value={demo.permit_info.zone} />
            <FieldRow label="Тип пропуска" value={demo.permit_info.pass_type} />
          </InfoCard>

          <InfoCard title="Диагностическая карта">
            <FieldRow label="Номер" value={demo.car_info.diagnostic_card} />
            <FieldRow
              label="Действует до"
              value={
                <div className="flex flex-col items-end gap-1">
                  <span>
                    {formatDateTime(demo.car_info.diagnostic_card_valid_until)}
                  </span>
                  {diagnosticCardStatus.daysText ? (
                    <span
                      className={
                        diagnosticCardStatus.daysClassName
                      }
                    >
                      {diagnosticCardStatus.daysText}
                    </span>
                  ) : null}
                </div>
              }
            />
          </InfoCard>

          <InfoCard title="Менеджер" className="lg:col-span-2">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={demo.manager_contact.avatar_url}
                    alt="Фото менеджера"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div>
                  <div className="text-lg font-semibold text-slate-900">
                    {demo.manager_contact.full_name}
                  </div>
                  <a
                    href={`tel:${demo.manager_contact.phone.replace(/[^\d+]/g, "")}`}
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
                    <span>{demo.manager_contact.phone}</span>
                  </a>
                  <a
                    href={`https://${demo.manager_contact.site}`}
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
                    {demo.manager_contact.site}
                  </a>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <a
                  href={`https://wa.me/${demo.manager_contact.whatsapp.replace(/\D/g, "")}`}
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
                <a
                  href={`https://t.me/${demo.manager_contact.telegram.replace(/^@/, "")}`}
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
                <a
                  href={`mailto:${demo.manager_contact.email}`}
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
                  <span>{demo.manager_contact.email}</span>
                </a>
              </div>
            </div>
          </InfoCard>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-xs uppercase tracking-[0.2em] text-brand-muted">
          <span>RTE-Consult</span>
          <span>Обновлено: {demo.updated_at}</span>
        </div>
      </div>
    </main>
  );
}
