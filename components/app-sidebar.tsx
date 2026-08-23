"use client"

import { LayoutDashboard, PlusCircle, Thermometer } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

const GRUPOS = [
  {
    rotulo: "Principal",
    itens: [{ href: "/", nome: "Painel", Icone: LayoutDashboard }],
  },
  {
    rotulo: "Operação",
    itens: [
      { href: "/aquecimento", nome: "Aquecimento", Icone: Thermometer },
      { href: "/cadastro", nome: "Cadastro", Icone: PlusCircle },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="bg-sidebar border-sidebar-border flex w-56 shrink-0 flex-col border-r">
      <div className="px-5 py-6">
        <Link href="/" aria-label="Nova Digital — ir para o painel">
          <Image
            src="/nova-digital-wordmark.png"
            alt="Nova Digital"
            width={1219}
            height={253}
            priority
            className="h-6 w-auto"
          />
        </Link>
      </div>

      <nav className="flex flex-col gap-6 px-3 py-2">
        {GRUPOS.map((grupo) => (
          <div key={grupo.rotulo} className="flex flex-col gap-1">
            <div className="text-sidebar-foreground/60 px-2 pb-1 text-[0.6875rem] font-medium tracking-wider uppercase">
              {grupo.rotulo}
            </div>
            {grupo.itens.map(({ href, nome, Icone }) => {
              const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={ativo ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                    ativo
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icone className="size-4 shrink-0" />
                  {nome}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}
