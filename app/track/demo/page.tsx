import { BrandHeader } from "@/components/tracker/BrandHeader";
import { StatusCard } from "@/components/tracker/StatusCard";
import { InfoCard } from "@/components/tracker/InfoCard";
import { FieldRow } from "@/components/tracker/FieldRow";

export default function TrackDemoPage() {
  const demo = {
    status_label: "Отказ",
    status_step: 4,
    status_id: 41138698,
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
      zone: "СК",
      pass_type: "Грузовой",
      ready_at: "2026-01-24 16:00 (МСК)",
    },
    manager_contact: {
      name: "Андрей Смирнов",
      id: "MGR-204",
      phone: "+7 (495) 123-45-67",
      email: "manager@rte-consult.ru",
    },
    updated_at: "2026-01-18 17:45",
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_45%),_radial-gradient(circle_at_right,_rgba(59,130,246,0.25),_transparent_40%),_radial-gradient(circle_at_left,_rgba(16,185,129,0.18),_transparent_45%)] px-4 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <BrandHeader />

        <StatusCard
          title={demo.status_label}
          step={demo.status_step}
          statusId={demo.status_id}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <InfoCard title="Автомобиль">
            <FieldRow label="VIN" value={demo.car_info.vin} />
            <FieldRow label="Марка / модель" value={demo.car_info.brand_model} />
          </InfoCard>

          <InfoCard title="Пропуск">
            <FieldRow label="Срок действия" value={demo.permit_info.pass_expiry} />
            <FieldRow label="Зона" value={demo.permit_info.zone} />
            <FieldRow label="Тип пропуска" value={demo.permit_info.pass_type} />
          </InfoCard>

          <InfoCard title="Диагностическая карта">
            <FieldRow label="Номер" value={demo.car_info.diagnostic_card} />
            <FieldRow
              label="Действует до"
              value={demo.car_info.diagnostic_card_valid_until}
            />
          </InfoCard>

          <InfoCard title="Менеджер">
            <FieldRow label="Имя" value={demo.manager_contact.name} />
            <FieldRow label="ID" value={demo.manager_contact.id} />
            <FieldRow label="Телефон" value={demo.manager_contact.phone} />
            <FieldRow label="Email" value={demo.manager_contact.email} />
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
