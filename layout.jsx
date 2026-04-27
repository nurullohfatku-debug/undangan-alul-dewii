import './globals.css'

export const metadata = {
  title: 'Undangan Pernikahan Alul & Dewi',
  description: 'Undangan Pernikahan Digital Nurulloh (Alul) & Dewi',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}