import Image from "next/image";

interface StatusCardProps {
  title: string;
  step: number;
  statusId?: number | null;
  readyAt?: string | null;
}

const defaultSteps = [
  "Проверка документов",
  "Подготовка к подаче в ДТ",
  "Документы поданы",
  "Пропуск вышел",
];

function getSteps(statusId?: number | null) {
  if (statusId === 41138698) {
    return [
      "Проверка документов",
      "Подготовка к подаче в ДТ",
      "Документы поданы",
      "Отказ",
    ];
  }
  return defaultSteps;
}

const localizedTitles: Record<number, string> = {
  41138302: "Проверка документов",
  41138689: "Подготовка к подаче в ДТ",
  41138692: "Документы поданы",
  41138695: "Пропуск вышел",
  41138698: "Отказ",
};

export function StatusCard({ title, step, statusId, readyAt }: StatusCardProps) {
  const activeStep = Math.min(Math.max(step, 1), 4);
  const steps = getSteps(statusId);
  const normalizedTitle = (title || "").toLowerCase();
  const isSuccessFinal =
    statusId === 41138695 || normalizedTitle.includes("пропуск вышел");
  const displayTitle =
    (statusId && localizedTitles[statusId]) || title || "Статус формируется";
  return (
    <section className="rounded-3xl bg-transparent p-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Текущий статус
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">
            {displayTitle}
          </h2>
        </div>
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Image src="/logo.png" alt="RTE-Consult" width={40} height={40} />
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < activeStep;
          const isActive = stepNumber === activeStep;
          const isFinalSuccess = isActive && isSuccessFinal && stepNumber === 4;
          const isFinalRejected = isActive && statusId === 41138698 && stepNumber === 4;
          const isDocCheckActive = isActive && stepNumber === 1;
          const showExpectedReadyAt =
            label === "Документы поданы" && Boolean(readyAt);
          return (
            <div
              key={label}
              className={`rounded-2xl border px-4 py-4 ${
                isFinalSuccess
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : isFinalRejected
                    ? "border-rose-300 bg-rose-50 text-rose-900"
                    : isDocCheckActive
                      ? "border-amber-300 bg-amber-50 text-amber-900"
                      : isActive
                        ? "border-brand/30 bg-brand/10 text-slate-900"
                      : isCompleted
                        ? "border-slate-200 bg-slate-100 text-slate-500"
                        : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-inherit">
                <span className="text-base leading-none">•</span>
                <span>Этап {stepNumber}</span>
              </div>
              <p className="mt-2 text-sm font-semibold">{label}</p>
              {showExpectedReadyAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Ожидаем выход пропуска: {readyAt}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
