import Image from "next/image";

export function BrandHeader() {
  return (
    <header className="flex w-full items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-6 py-5 shadow-premium backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/10 shadow-brand">
          <Image
            src="/logo.png"
            alt="RTE-Consult"
            width={40}
            height={40}
          />
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brand-muted">
            RTE-Consult
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Статус пропуска
          </h1>
        </div>
      </div>
      <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-wider text-brand-muted">
        RTE
      </span>
    </header>
  );
}
