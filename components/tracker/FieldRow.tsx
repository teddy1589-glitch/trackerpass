interface FieldRowProps {
  label: string;
  value?: string | number | null;
}

export function FieldRow({ label, value }: FieldRowProps) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold text-slate-900">
        {value ?? "—"}
      </span>
    </div>
  );
}
