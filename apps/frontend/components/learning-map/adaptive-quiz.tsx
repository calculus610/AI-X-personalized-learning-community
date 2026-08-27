"use client"

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCcw,
  Sparkles,
  Square,
  X,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { AdaptiveQuizResult, AdaptiveSupportLevel } from "@/lib/adaptive-learning-contract"
import type { PersonalizedRouteStep } from "@/lib/learning-map-utils"
import {
  startPlatformQuiz,
  submitPlatformQuiz,
  type PlatformQuizResult,
  type PlatformQuizSession,
} from "@/lib/personalization-api"
import { cn } from "@/lib/utils"
import type { Locale } from "@/lib/bilingual-ui"

type AdaptiveQuizProps = {
  routeStep: PersonalizedRouteStep
  nextRouteStep: PersonalizedRouteStep | null
  routeId: string
  locale: Locale
  onContinue: (result: AdaptiveQuizResult) => void
  onClose: () => void
}

class QuizRenderBoundary extends Component<{
  locale: Locale
  onClose: () => void
  children: ReactNode
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("adaptive_quiz_render_failed", error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return createPortal(
      <div className="adaptive-quiz-backdrop" role="alert">
        <section className="adaptive-quiz-card adaptive-quiz-fallback">
          <XCircle />
          <h1>{this.props.locale === "en" ? "The Quiz display needs to be reloaded" : "Quiz 显示需要重新加载"}</h1>
          <p>{this.props.locale === "en" ? "Your course progress has not been cleared." : "你的课程进度不会被清除。"}</p>
          <Button onClick={() => window.location.reload()}>{this.props.locale === "en" ? "Reload Quiz" : "重新加载 Quiz"}</Button>
          <Button variant="outline" onClick={this.props.onClose}>{this.props.locale === "en" ? "Return to course" : "返回课程"}</Button>
        </section>
      </div>,
      document.body,
    )
  }
}

function questionTypeLabel(type: string, locale: Locale) {
  if (type === "multiple_choice") return locale === "en" ? "Multiple choice" : "多选题"
  if (type === "true_false") return locale === "en" ? "True or false" : "判断题"
  return locale === "en" ? "Single choice" : "单选题"
}

function supportLevel(percentage: number): AdaptiveSupportLevel {
  if (percentage < 60) return "detailed"
  if (percentage < 85) return "standard"
  return "compact"
}

function supportLabel(level: AdaptiveSupportLevel, locale: Locale) {
  if (level === "detailed") return locale === "en" ? "Detailed guidance" : "强化讲解"
  if (level === "standard") return locale === "en" ? "Standard guidance" : "标准支架"
  return locale === "en" ? "Compact guidance" : "精简支架"
}

function answerText(value: string | string[]) {
  return Array.isArray(value) ? value.join(", ") : value
}

function quizErrorMessage(error: unknown, locale: Locale, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error ?? "")
  if (/unauthorized/i.test(raw)) return locale === "en" ? "Your session has expired. Sign in again before starting the Quiz." : "登录状态已过期，请重新登录后再开始 Quiz。"
  if (/route_step_not_found/i.test(raw)) return locale === "en" ? "The course context changed. Return to your route and open this course again." : "当前课程上下文已变化，请返回学习路径后重新进入本课。"
  if (/course_content_not_enough_for_quiz/i.test(raw)) return locale === "en" ? "This course does not yet have enough published content to generate a Quiz." : "本课程当前发布的内容不足，暂时无法生成 Quiz。"
  if (/quiz_not_found/i.test(raw)) return locale === "en" ? "This Quiz session has expired. Reload the Quiz to continue." : "本次 Quiz 会话已失效，请重新加载。"
  if (/quiz_answers_incomplete/i.test(raw)) return locale === "en" ? "Some questions are unanswered. Complete every question before submitting." : "还有题目未作答，请全部完成后再提交。"
  return raw || fallback
}

function AdaptiveQuizContent({
  routeStep,
  nextRouteStep,
  routeId,
  locale,
  onContinue,
  onClose,
}: AdaptiveQuizProps) {
  const [session, setSession] = useState<PlatformQuizSession | null>(null)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [result, setResult] = useState<PlatformQuizResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const loadRequestId = useRef(0)
  const answeredCount = useMemo(() => Object.values(answers).filter((value) => value.length).length, [answers])
  const loadingMessage = locale === "en"
    ? elapsedSeconds < 8
      ? "Reading this course's knowledge points"
      : elapsedSeconds < 20
        ? "Generating questions from your learning record"
        : "Checking question count and removing duplicates"
    : elapsedSeconds < 8
      ? "正在读取本课知识点"
      : elapsedSeconds < 20
        ? "正在结合你的学习记录生成题目"
        : "正在完成题目去重与数量校验"

  const loadQuiz = useCallback(() => {
    const requestId = ++loadRequestId.current
    setLoading(true)
    setElapsedSeconds(0)
    setError("")
    setSession(null)
    setAnswers({})
    setResult(null)
    startPlatformQuiz({ lessonId: routeStep.lessonId, routeId, routeStepId: routeStep.id, locale })
      .then((nextSession) => {
        if (loadRequestId.current !== requestId) return
        const normalizedQuestions = (Array.isArray(nextSession.questions) ? nextSession.questions : []).map((question, questionIndex) => ({
          ...question,
          question_id: String(question.question_id ?? `question-${questionIndex + 1}`),
          question_text: String(question.question_text ?? ""),
          options: (Array.isArray(question.options) ? question.options : []).map((option, optionIndex) => ({
            id: String(option?.id ?? `option-${optionIndex + 1}`),
            text: String(option?.text ?? ""),
          })),
        }))
        setSession({ ...nextSession, questions: normalizedQuestions, question_count: normalizedQuestions.length })
      })
      .catch((loadError: Error) => {
        if (loadRequestId.current === requestId) setError(quizErrorMessage(loadError, locale, locale === "en" ? "The Quiz could not be loaded." : "Quiz 加载失败。"))
      })
      .finally(() => {
        if (loadRequestId.current === requestId) setLoading(false)
      })
  }, [locale, routeId, routeStep.id, routeStep.lessonId])

  useEffect(() => {
    loadQuiz()
    return () => { loadRequestId.current += 1 }
  }, [loadQuiz])

  useEffect(() => {
    if (!loading) return
    const timer = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [loading])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  function choose(questionId: string, optionId: string, multiple: boolean) {
    const key = String(questionId)
    const selectedOptionId = String(optionId)
    setAnswers((current) => {
      if (!multiple) return { ...current, [key]: [selectedOptionId] }
      const existing = current[key] ?? []
      return {
        ...current,
        [key]: existing.includes(selectedOptionId)
          ? existing.filter((item) => item !== selectedOptionId)
          : [...existing, selectedOptionId].sort(),
      }
    })
  }

  async function submit() {
    if (!session || submitting || answeredCount !== session.questions.length) return
    setSubmitting(true)
    setError("")
    try {
      const quizResult = await submitPlatformQuiz({
        quizSessionId: session.quiz_session_id,
        lessonId: routeStep.lessonId,
        routeId,
        routeStepId: routeStep.id,
        answers: session.questions.map((question) => ({
          questionId: question.question_id,
          selectedAnswer: question.question_type === "multiple_choice"
            ? (answers[String(question.question_id)] ?? [])
            : (answers[String(question.question_id)] ?? [])[0],
        })),
        locale,
      })
      setResult(quizResult)
    } catch (submitError) {
      setError(quizErrorMessage(submitError, locale, locale === "en" ? "The Quiz could not be submitted." : "Quiz 提交失败。"))
    } finally {
      setSubmitting(false)
    }
  }

  function continueWithResult() {
    if (!result || !session) return
    const level = supportLevel(result.percentage)
    onContinue({
      quizId: `main-${session.quiz_session_id}`,
      score: result.correct_count,
      total: result.total,
      knowledgeResults: result.question_results.map((item) => ({
        knowledgePointId: item.knowledge_point_name,
        knowledgePointLabel: item.knowledge_point_name,
        correct: item.is_correct,
        selectedOptionId: answerText(item.selected_answer),
        correctOptionId: answerText(item.correct_answer),
        explanation: item.explanation,
        masteryScore: item.is_correct ? 1 : 0,
        masteryLevel: item.is_correct ? "strong" : "weak",
      })),
      nextRecommendation: nextRouteStep ? {
        routeStepId: nextRouteStep.id,
        level,
        label: supportLabel(level, locale),
        reason: result.student_visible_message,
        score: result.correct_count,
        total: result.total,
        weakKnowledgeLabels: result.weak_tags,
        strongKnowledgeLabels: result.question_results.filter((item) => item.is_correct).map((item) => item.knowledge_point_name),
        sourceRouteStepId: routeStep.id,
        sourceQuizTitle: session.quiz_title,
        updatedAt: new Date().toISOString(),
      } : null,
    })
  }

  if (typeof document === "undefined") return null

  return createPortal((
    <div className="adaptive-quiz-backdrop" role="dialog" aria-modal="true" aria-labelledby="adaptive-quiz-title">
      <section className="adaptive-quiz-card">
        <header className="adaptive-quiz-header">
          <span><Sparkles /></span>
          <div>
            <small>{locale === "en" ? "COURSE QUIZ · 10 QUESTIONS" : "课程 Quiz · 10题"}</small>
            <h1 id="adaptive-quiz-title">{session?.quiz_title ?? `${routeStep.title} · ${locale === "en" ? "Course Quiz" : "课程 Quiz"}`}</h1>
            <p>{locale === "en" ? "Questions use the course's official Quiz pipeline. Submission updates knowledge mastery, your learner profile and the guidance level for later content." : "题目来自课程正式 Quiz 链路，提交后更新知识点、六维画像和下一内容的讲解详细度。"}</p>
          </div>
          <button type="button" className="adaptive-quiz-close" onClick={onClose} aria-label={locale === "en" ? "Return to course" : "返回课程"}><X /></button>
        </header>

        {loading ? (
          <div className="adaptive-quiz-state quiz-loading-state">
            <div className="quiz-loader-orbit"><Loader2 className="spin" /><Sparkles /></div>
            <strong>{loadingMessage}</strong>
            <p>{locale === "en" ? `Waiting ${elapsedSeconds}s · Question generation usually takes 20–35 seconds` : `已等待 ${elapsedSeconds} 秒 · 真实出题通常需要 20–35 秒`}</p>
            <div className="quiz-load-progress" aria-hidden="true"><i style={{ width: `${Math.min(92, 10 + elapsedSeconds * 2.5)}%` }} /></div>
            <button type="button" onClick={onClose}>{locale === "en" ? "Return to the course and try later" : "返回课程，稍后再打开"}</button>
          </div>
        ) : error && !session ? (
          <div className="adaptive-quiz-state error" role="alert">
            <XCircle />
            <p>{error}</p>
            <div className="adaptive-quiz-recovery">
              <Button variant="outline" onClick={onClose}>{locale === "en" ? "Return to course" : "返回课程"}</Button>
              <Button variant="outline" onClick={loadQuiz}><RefreshCcw />{locale === "en" ? "Reload" : "重新加载"}</Button>
            </div>
          </div>
        ) : result ? (
          <div className="adaptive-result">
            <section className="adaptive-score-card">
              <div><CheckCircle2 /></div>
              <span>{locale === "en" ? "Your result" : "本次结果"}</span>
              <strong>{result.correct_count} / {result.total}</strong>
              <p>{result.student_visible_message}</p>
            </section>

            <div className="knowledge-result-list">
              {result.question_results.map((item, index) => (
                <article key={item.question_id} className={cn(item.is_correct ? "correct" : "incorrect")}>
                  {item.is_correct ? <Check /> : <XCircle />}
                  <div>
                    <strong>{index + 1}. {item.knowledge_point_name}</strong>
                    <p>{item.explanation}</p>
                  </div>
                  <span>{item.is_correct ? (locale === "en" ? "Correct" : "答对") : (locale === "en" ? "Review" : "待巩固")}</span>
                </article>
              ))}
            </div>

            {nextRouteStep && (
              <section className={cn("next-detail-preview", supportLevel(result.percentage))}>
                <small>{locale === "en" ? "Later content will use" : "下一内容将使用"}</small>
                <strong>{supportLabel(supportLevel(result.percentage), locale)}</strong>
                <p>{nextRouteStep.title}</p>
              </section>
            )}

            <footer className="adaptive-quiz-actions result-actions">
              <span>{locale === "en" ? "Answers, knowledge evidence and learner-profile updates have been saved." : "逐题答案、知识点和学习画像已写入学习记录"}</span>
              <Button size="lg" onClick={continueWithResult}>
                {nextRouteStep ? (locale === "en" ? "Apply and continue" : "应用并进入下一内容") : (locale === "en" ? "Complete this course" : "完成本课")}
                <ArrowRight data-icon="inline-end" />
              </Button>
            </footer>
          </div>
        ) : session ? (
          <div className="adaptive-quiz-session">
            <div className="adaptive-question-list">
              {session.questions.map((question, index) => {
                const selectedAnswers = answers[String(question.question_id)] ?? []
                const multiple = question.question_type === "multiple_choice"
                return (
                  <fieldset key={question.question_id}>
                    <legend>
                      <span>{index + 1}</span>
                      <div><small>{questionTypeLabel(question.question_type, locale)}</small>{question.question_text}</div>
                    </legend>
                    <div>
                      {question.options.map((option) => {
                        const selected = selectedAnswers.includes(option.id)
                        return (
                          <label key={option.id} className={cn(selected && "selected")}>
                            <input
                              type={multiple ? "checkbox" : "radio"}
                              name={String(question.question_id)}
                              value={option.id}
                              checked={selected}
                              onChange={() => choose(question.question_id, option.id, multiple)}
                            />
                            <span>{selected ? <Check /> : multiple ? <Square /> : <Circle />}</span>
                            <strong>{option.text}</strong>
                          </label>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
            </div>
            {error && <p className="adaptive-quiz-error" role="alert">{error}</p>}
            <footer className="adaptive-quiz-actions">
              <span>{locale === "en" ? "Answered" : "已答"} {answeredCount} / {session.questions.length}</span>
              <Button
                size="lg"
                disabled={submitting || answeredCount !== session.questions.length}
                onClick={() => void submit()}
              >
                {submitting ? <Loader2 className="spin" /> : <Sparkles />}
                {submitting ? (locale === "en" ? "Updating your profile…" : "正在更新画像…") : (locale === "en" ? "Submit Quiz" : "提交 Quiz")}
              </Button>
            </footer>
          </div>
        ) : null}
      </section>
    </div>
  ), document.body)
}

export function AdaptiveQuiz(props: AdaptiveQuizProps) {
  return <QuizRenderBoundary locale={props.locale} onClose={props.onClose}><AdaptiveQuizContent {...props} /></QuizRenderBoundary>
}
