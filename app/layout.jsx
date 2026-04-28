import './globals.css'

export const metadata = {
  title: 'Undangan Pernikahan Alul & Dewi',
  description: 'Selamat Datang di Undangan Pernikahan Kami',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
