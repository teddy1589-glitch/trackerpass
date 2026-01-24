import type { ReactNode } from "react";

interface FieldRowProps {
  label: string;
  value?: ReactNode;
  valueClassName?: string;
}

export function FieldRow({
  label,
  value,
  valueClassName,
}: FieldRowProps) {
  return (
    <div className="flex items-start justify-between gap-6">
      <span className="text-sm text-slate-500">{label}</span>
      <div
        className={`text-sm font-semibold text-right ${valueClassName ?? "text-slate-900"}`}
      >
        {value ?? "—"}
      </div>
    </div>
  );
}
