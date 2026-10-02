import type { Metadata } from 'next'
import { Bricolage_Grotesque, Instrument_Serif } from 'next/font/google'
import './globals.css'
import { CREATOR, SITE_DESCRIPTION, SITE_NAME, SITE_URL, creatorPerson, jsonLd } from '@/lib/site'

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
})

const serif = Instrument_Serif({
  weight: '400',
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-serif',
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'SATistics: SAT & GRE practice games by Shiv Vyas', template: '%s | SATistics' },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: CREATOR.name, url: CREATOR.url }],
  creator: CREATOR.name,
  publisher: CREATOR.name,
  keywords: ['SAT practice', 'GRE practice', 'SAT games', 'GRE prep', 'test prep games', 'SATistics', 'Shiv Vyas', 'shivvyas', 'shivvyas.com'],
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: 'SATistics: SAT & GRE practice games',
    description: SITE_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: 'SATistics: SAT & GRE practice games', description: SITE_DESCRIPTION },
}

// Site-wide structured data: the app, its site, and its creator
const siteGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      author: { '@id': CREATOR.id },
      publisher: { '@id': CREATOR.id },
    },
    {
      '@type': 'WebApplication',
      '@id': `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@id': CREATOR.id },
      creator: { '@id': CREATOR.id },
    },
    creatorPerson,
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable}`}>
      <body className="font-display">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(siteGraph)} />
        {children}
      </body>
    </html>
  )
}
