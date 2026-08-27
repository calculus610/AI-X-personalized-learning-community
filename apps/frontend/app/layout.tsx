import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { cookies } from "next/headers"
import { LOCALE_COOKIE_KEY } from "@/lib/bilingual-ui"
import "./globals.css"

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await cookies()).get(LOCALE_COOKIE_KEY)?.value === "en" ? "en" : "zh"
  return {
    title: locale === "en" ? "AI+X Personalized Learning" : "AI+X 个性化学习",
    description: locale === "en"
      ? "Personalized knowledge graphs and learning routes from real interests and course content."
      : "从真实兴趣和课程内容生成个性化知识图谱与学习路径。",
    generator: "v0.app",
  }
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#080b16",
  width: "device-width",
  initialScale: 1,
  userScalable: true,
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await cookies()).get(LOCALE_COOKIE_KEY)?.value === "en" ? "en" : "zh"
  return (
    <html lang={locale === "en" ? "en" : "zh-CN"} className="dark bg-background">
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
