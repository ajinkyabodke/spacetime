import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Space-Time Fabric Simulator',
  description: 'A 3D simulation of the space-time fabric with planets and black holes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
} 