import Image from "next/image";

export function BrandHeader() {
  return (
    <div className="flex w-full items-center justify-start px-2">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-brand">
        <Image
          src="/logo.png"
          alt="RTE-Consult"
          width={56}
          height={56}
        />
      </div>
    </div>
  );
}
