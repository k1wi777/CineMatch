// Marcadores de carga. Se muestran con el mismo tamaño que el contenido real para no saltar al cargar.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-telon ${className}`} />;
}

export function SkeletonCartel() {
  return (
    <div role="status" aria-label="Cargando" className="space-y-3">
      <Skeleton className="aspect-[2/3] w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}
