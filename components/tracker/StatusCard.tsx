interface StatusCardProps {
  title: string;
  step: number;
  statusId?: number | null;
}

const defaultSteps = ["Подготовка", "Подать", "Подано", "Пропуск вышел"];

function getSteps(statusId?: number | null) {
  if (statusId === 41138698) {
    return ["Подготовка", "Подать", "Подано", "Отказ"];
  }
  return defaultSteps;
}

export function StatusCard({ title, step, statusId }: StatusCardProps) {
  const activeStep = Math.min(Math.max(step, 1), 4);
  const steps = getSteps(statusId);
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-premium backdrop-blur">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-brand-muted">
          Текущий статус
        </p>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber <= activeStep;
          return (
            <div
              key={label}
              className={`rounded-2xl border px-4 py-4 ${
                isActive
                  ? "border-brand/40 bg-brand/15 text-white"
                  : "border-white/10 bg-white/5 text-brand-muted"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.2em]">
                Шаг {stepNumber}
              </p>
              <p className="mt-2 text-sm font-semibold">{label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
