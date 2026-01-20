import Image from "next/image";

export function BrandHeader() {
  return (
    <div className="flex w-full items-center justify-start px-2">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[32px] bg-white shadow-brand">
        <Image
          src="/logo.png"
          alt="RTE-Consult"
          width={72}
          height={72}
        />
      </div>
    </div>
  );
}
