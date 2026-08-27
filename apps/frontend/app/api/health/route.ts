import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "personalized-secure-frontend",
    courseSource: "mysql-api-only",
    checkedAt: new Date().toISOString(),
  })
}
