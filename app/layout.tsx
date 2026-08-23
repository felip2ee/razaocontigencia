import { Geist_Mono, Inter } from "next/font/google"
import Link from "next/link"

import "./globals.css"
import { Busca } from "@/components/busca"
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <header className="flex items-center gap-6 border-b px-6 py-3 text-sm">
          <Link href="/" className="font-medium">
            Contingência
          </Link>
          <nav className="flex gap-4">
            <Link href="/aquecimento">Aquecimento</Link>
            <Link href="/cadastro">Cadastro</Link>
          </nav>
          <Busca />
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}
