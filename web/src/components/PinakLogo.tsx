import Image from "next/image";

export function PinakMark({ size = 40 }: { size?: number }) {
  return (
    <Image
      src="/pinak-mark.png"
      alt="PINAK"
      width={size}
      height={size}
      style={{ objectFit: "contain", height: size, width: "auto" }}
      priority
    />
  );
}

export function PinakWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <PinakMark size={28} />
      <span className="font-display font-semibold text-lg tracking-tight text-navy-900">
        PINAK
      </span>
    </div>
  );
}
