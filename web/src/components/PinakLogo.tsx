import Image from "next/image";

/** Solo el isotipo: la "P" con la flecha de crecimiento. */
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

/** Versión horizontal para encabezados: isotipo + la palabra PINAK del logo. */
export function PinakWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <PinakMark size={30} />
      <Image
        src="/pinak-wordmark.png"
        alt="PINAK"
        width={100}
        height={16}
        style={{ height: 15, width: "auto" }}
        priority
      />
    </div>
  );
}

/** Logo completo (P + PINAK + "AI · Finance · Future") para pantallas de bienvenida. */
export function PinakLogoFull({ width = 200 }: { width?: number }) {
  return (
    <Image
      src="/pinak-logo.png"
      alt="PINAK — AI · Finance · Future"
      width={815}
      height={753}
      style={{ width, height: "auto" }}
      priority
    />
  );
}
