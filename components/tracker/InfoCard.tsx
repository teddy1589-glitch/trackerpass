import type { ReactNode } from "react";

interface InfoCardProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}

export function InfoCard({ title, icon, children }: InfoCardProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-premium backdrop-blur">
      <div className="mb-4 flex items-center gap-3">
        {icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
            {icon}
          </span>
        ) : null}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-brand-muted">{children}</div>
    </section>
  );
}
