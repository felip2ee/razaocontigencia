import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"

import { db } from "@/lib/db"
import { chip, device } from "@/lib/schema"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim()
  if (!id) return NextResponse.redirect(new URL("/", request.url))

  const [aparelho] = await db.select({ id: device.id }).from(device).where(eq(device.id, id))
  if (aparelho) return NextResponse.redirect(new URL(`/aparelho/${id}`, request.url))

  const [oChip] = await db.select({ id: chip.id }).from(chip).where(eq(chip.id, id))
  if (oChip) return NextResponse.redirect(new URL(`/chip/${id}`, request.url))

  return NextResponse.redirect(new URL(`/?nao-encontrado=${encodeURIComponent(id)}`, request.url))
}
