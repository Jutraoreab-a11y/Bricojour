import Header from './Header'
import LegalFooter from './LegalFooter'

export default function Page({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-md px-5 pb-10 pt-5">{children}</main>
      <LegalFooter className="mx-auto max-w-md border-t border-line px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-5" />
    </>
  )
}
