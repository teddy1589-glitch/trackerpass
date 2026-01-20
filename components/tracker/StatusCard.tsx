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
  const normalizedTitle = (title || "").toLowerCase();
  const isSuccessFinal =
    statusId === 41138695 || normalizedTitle.includes("пропуск вышел");
  return (
    <section className="rounded-3xl bg-transparent p-0">
      <div className="flex flex-col gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
          Текущий статус
        </p>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < activeStep;
          const isActive = stepNumber === activeStep;
          const isFinalSuccess = isActive && isSuccessFinal && stepNumber === 4;
          const isFinalRejected = isActive && statusId === 41138698 && stepNumber === 4;
          return (
            <div
              key={label}
              className={`rounded-2xl border px-4 py-4 ${
                isFinalSuccess
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : isFinalRejected
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : isActive
                      ? "border-brand/30 bg-brand/10 text-slate-900"
                      : isCompleted
                        ? "border-slate-200 bg-slate-100 text-slate-500"
                        : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-inherit">
                <span className="text-base leading-none">•</span>
                <span>Шаг {stepNumber}</span>
              </div>
              <p className="text-xs uppercase tracking-[0.2em]">
                {isFinalSuccess ? "Успешно" : isFinalRejected ? "Отказ" : "Этап"}
              </p>
              <p className="mt-2 text-sm font-semibold">{label}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
