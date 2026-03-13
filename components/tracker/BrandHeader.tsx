import Image from "next/image";

export function BrandHeader() {
  return (
    <div className="flex w-full items-center justify-start px-2">
      <div className="flex h-16 w-auto items-center justify-center overflow-hidden rounded-2xl bg-white px-4 shadow-brand">
        <Image
          src="/logo.png"
          alt="RTE-Консалтинг"
          width={160}
          height={48}
          className="object-contain"
        />
      </div>
    </div>
  );
}
