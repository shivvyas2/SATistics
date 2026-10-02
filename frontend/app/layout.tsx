import type { Metadata } from 'next'
import { Bricolage_Grotesque, Instrument_Serif } from 'next/font/google'
import './globals.css'

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
  title: 'SATistics',
  description: 'Train for the SAT and GRE with arcade games built on real-format questions.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable}`}>
      <body className="font-display">{children}</body>
    </html>
  )
}
