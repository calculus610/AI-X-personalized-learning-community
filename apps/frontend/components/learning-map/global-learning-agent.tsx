"use client"

import { useEffect, useState } from "react"
import type { Locale } from "@/lib/bilingual-ui"
import {
  UnifiedLearningAgent,
  type LearningAgentContext,
  type LearningAgentHelpRequest,
} from "./unified-learning-agent"

export function GlobalLearningAgent({ locale, identity }: { locale: Locale; identity: string }) {
  const [context, setContext] = useState<LearningAgentContext | null>(null)
  const [helpRequest, setHelpRequest] = useState<LearningAgentHelpRequest | null>(null)

  useEffect(() => {
    setContext(null)
    setHelpRequest(null)
  }, [identity])

  useEffect(() => {
    const updateContext = (event: Event) => {
      const detail = (event as CustomEvent<{ context?: LearningAgentContext | null }>).detail
      setContext(detail?.context ?? null)
      if (!detail?.context) setHelpRequest(null)
    }
    const requestHelp = (event: Event) => {
      const detail = (event as CustomEvent<LearningAgentHelpRequest>).detail
      if (detail?.id && detail.message) setHelpRequest(detail)
    }
    window.addEventListener("personalized-secure:course-context-change", updateContext)
    window.addEventListener("personalized-secure:agent-help-request", requestHelp)
    return () => {
      window.removeEventListener("personalized-secure:course-context-change", updateContext)
      window.removeEventListener("personalized-secure:agent-help-request", requestHelp)
    }
  }, [])

  return <UnifiedLearningAgent context={context} helpRequest={helpRequest} locale={locale} />
}
