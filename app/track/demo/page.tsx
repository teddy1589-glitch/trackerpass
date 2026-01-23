import { StatusCard } from "@/components/tracker/StatusCard";
import { InfoCard } from "@/components/tracker/InfoCard";
import { FieldRow } from "@/components/tracker/FieldRow";

export default function TrackDemoPage() {
  const formatDateTime = (value: string | null) => {
    if (!value) {
      return null;
    }
    const clean = value.replace(/\s*\(.*\)\s*$/, "").trim();
    const parsed = new Date(clean);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = String(parsed.getFullYear() % 100).padStart(2, "0");
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return `${day}.${month}.${year}, ${hours}:${minutes}`;
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
      pass_type: "Грузовой",
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
              value={formatDateTime(demo.car_info.diagnostic_card_valid_until)}
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
                  <div className="text-sm text-slate-600">
                    {demo.manager_contact.phone}
                  </div>
                  <a
                    href={`https://${demo.manager_contact.site}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-brand hover:underline"
                  >
                    {demo.manager_contact.site}
                  </a>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <a
                  href={`https://wa.me/${demo.manager_contact.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700"
                >
                  WhatsApp
                </a>
                <a
                  href={`https://t.me/${demo.manager_contact.telegram.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700"
                >
                  Telegram
                </a>
                <a
                  href={`mailto:${demo.manager_contact.email}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"
                >
                  {demo.manager_contact.email}
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
