export function PinakMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M38 15H58C68 15 76 23 76 33C76 43 68 51 58 51H46V85H38V15Z"
        fill="var(--pinak-navy-900)"
      />
      <path
        d="M35 55C35 42 45 34 55 30L68 24L64 34L52 39C46 42 42 47 42 55V85H35V55Z"
        fill="var(--pinak-green-500)"
      />
    </svg>
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
