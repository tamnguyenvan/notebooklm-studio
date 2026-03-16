import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NotebookLM Studio',
  description: 'Desktop client for Google NotebookLM',
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
