import { PlatformLoginGate } from "@/components/platform-login-gate"
import { cookies } from "next/headers"
import { LOCALE_COOKIE_KEY, type Locale } from "@/lib/bilingual-ui"

export const dynamic = "force-dynamic"

export default async function Page() {
  const cookieStore = await cookies()
  const storedLocale = cookieStore.get(LOCALE_COOKIE_KEY)?.value
  const initialLocale: Locale = storedLocale === "en" ? "en" : "zh"
  return <PlatformLoginGate initialLocale={initialLocale} />
}
