import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { AppSidebar } from "@/components/app-sidebar"
import { Busca } from "@/components/busca"
import { Relogio } from "@/components/relogio"
import { cn } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Contingência — Nova Digital",
  icons: { icon: "/nova-icone.png" },
}

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
        <div className="flex min-h-svh">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="bg-card border-border border-b">
              <div className="mx-auto flex w-full max-w-[1400px] items-center justify-end gap-6 px-6 py-3">
                <Busca />
                <Relogio />
              </div>
            </header>
            <main className="mx-auto w-full max-w-[1400px] flex-1 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
