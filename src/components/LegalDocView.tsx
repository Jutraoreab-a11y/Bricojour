import { COMPANY, LEGAL_DOCS, TERMS_VERSION } from '@/lib/legal'

/** Remplace {{cle}} par l'information société ; une valeur à compléter est surlignée. */
function Fill({ text }: { text: string }) {
  const parts = text.split(/(\{\{\w+\}\})/g)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\{\{(\w+)\}\}$/)
        if (!m) return part
        const value = COMPANY[m[1] as keyof typeof COMPANY] ?? part
        return value.startsWith('[')
          ? <mark key={i} className="rounded bg-hiviz/60 px-1 text-ink">{value}</mark>
          : <span key={i}>{value}</span>
      })}
    </>
  )
}

export default function LegalDocView({ doc }: { doc: keyof typeof LEGAL_DOCS }) {
  const d = LEGAL_DOCS[doc]
  return (
    <article className="pb-6">
      <h1 className="display text-3xl">{d.title}</h1>
      <p className="mt-2 text-sm text-mute">Version du {new Date(TERMS_VERSION).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      {d.sections.map((s) => (
        <section key={s.h} className="mt-7">
          <h2 className="text-lg font-bold">{s.h}</h2>
          {s.p.map((p, i) =>
            Array.isArray(p) ? (
              <ul key={i} className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
                {p.map((li) => <li key={li}><Fill text={li} /></li>)}
              </ul>
            ) : (
              <p key={i} className="mt-2 text-[15px] leading-relaxed"><Fill text={p} /></p>
            ),
          )}
        </section>
      ))}
    </article>
  )
}
