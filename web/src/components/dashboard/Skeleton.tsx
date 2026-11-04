"use client";

export function Skel({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-line/70 ${className}`} />;
}

/** Esqueleto del dashboard mientras cargan los datos. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Cargando el dashboard" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skel key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skel className="h-72 xl:col-span-2" />
        <Skel className="h-72" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Skel className="h-80 xl:col-span-2" />
        <Skel className="h-80" />
      </div>
      <span className="sr-only">Cargando...</span>
    </div>
  );
}
