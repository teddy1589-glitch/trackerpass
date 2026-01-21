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
    <div className="flex items-center justify-between gap-6">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`text-sm font-semibold ${valueClassName ?? "text-slate-900"}`}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}
