export function PlantLoader() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
      <div className="relative grid size-14 place-items-center">
        <span className="absolute inset-0 rounded-full bg-accent-soft motion-safe:animate-ping" />
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="relative size-10" />
      </div>
      <p className="text-sm text-text-muted">Loading plant</p>
    </div>
  )
}
