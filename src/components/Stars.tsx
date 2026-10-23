export default function Stars({ value, count }: { value: number; count?: number }) {
  if (!count) return <span className="text-sm text-mute">Nouveau</span>
  return (
    <span className="text-sm font-semibold" aria-label={`Note ${value.toFixed(1)} sur 5`}>
      <span className="text-[#C99F00]" aria-hidden>★</span> {value.toFixed(1).replace('.', ',')}
      <span className="font-normal text-mute"> ({count} avis)</span>
    </span>
  )
}
