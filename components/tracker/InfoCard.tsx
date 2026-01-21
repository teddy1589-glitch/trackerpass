import type { ReactNode } from "react";

interface InfoCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function InfoCard({ title, icon, children, className }: InfoCardProps) {
  return (
    <section
      className={`rounded-3xl border border-slate-200/80 bg-white p-6 shadow-premium ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center gap-3">
        {icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            {icon}
          </span>
        ) : null}
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-slate-600">{children}</div>
    </section>
  );
}
