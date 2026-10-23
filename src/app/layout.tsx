import type { Metadata, Viewport } from 'next'
import { Archivo } from 'next/font/google'
import InstallPrompt from '@/components/InstallPrompt'
import { APP_NAME } from '@/lib/config'
import './globals.css'

const archivo = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-archivo', display: 'swap' })

export const metadata: Metadata = {
  title: { default: `${APP_NAME} : un bricoleur chez vous aujourd’hui`, template: `%s | ${APP_NAME}` },
  description: 'Petite plomberie, parquet, montage, luminaire : un intervenant vérifié le jour même, prix à l’heure affiché.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  themeColor: '#F5C400',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={archivo.variable}>
      <body className="min-h-dvh font-sans antialiased">
        {children}
        <InstallPrompt />
      </body>
    </html>
  )
}
