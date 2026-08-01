import './globals.css'

export const metadata = {
  title: 'Atlas — AI Operating System for Restoration',
  description: 'The intelligent operating system for insurance restoration companies.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="atlas-bg min-h-screen text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
