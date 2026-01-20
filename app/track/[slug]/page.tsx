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

export default async function TrackPage({
  params,
}: {
  params: { slug: string };
}) {
  const order = (await getOrderBySlug(params.slug)) as OrderRow | null;
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
            <FieldRow label="VIN" value={carInfo.vin as string} />
            <FieldRow label="Марка / модель" value={carInfo.brand_model as string} />
          </InfoCard>

          <InfoCard title="Пропуск">
            <FieldRow label="Срок действия" value={permitInfo.pass_expiry as string} />
            <FieldRow label="Зона" value={permitInfo.zone as string} />
            <FieldRow label="Тип пропуска" value={permitInfo.pass_type as string} />
          </InfoCard>

          <InfoCard title="Диагностическая карта">
            <FieldRow label="Номер" value={carInfo.diagnostic_card as string} />
            <FieldRow
              label="Действует до"
              value={carInfo.diagnostic_card_valid_until as string}
            />
          </InfoCard>

          <InfoCard title="Менеджер">
            <FieldRow label="Имя" value={managerInfo.name as string} />
            <FieldRow label="ID" value={managerInfo.id as string} />
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
