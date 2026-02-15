import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'UnfoldYou — Express. Connect. Unfold.',
  description: 'A social discovery platform where strangers unfold into real connections — anonymously, psychologically, authentically.',
  keywords: ['social', 'connections', 'anonymous', 'dating', 'psychology', 'unfold'],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a0f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-container">
          {children}
        </div>
      </body>
    </html>
  )
}
