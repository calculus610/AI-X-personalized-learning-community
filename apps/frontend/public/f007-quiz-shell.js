(function () {
  if (window.__F007_SECURE_QUIZ_INTEGRATED_V2__) return
  window.__F007_SECURE_QUIZ_INTEGRATED_V2__ = true
  window.__F007_SECURE_QUIZ_INTEGRATED_V1__ = true

  const API_BASE = "/personalized-secure-api/v1"
  const state = {
    open: false,
    loading: false,
    submitting: false,
    context: null,
    quiz: null,
    answers: {},
    report: null,
    adaptiveSteps: null,
    lastAutoQuizAt: 0,
    pendingStepScope: null,
    triggerButton: null,
  }

  const I18N = {
    zh: {
      noToken: "没有读取到登录态，请先登录后再生成小练。",
      requestFailed: "请求失败",
      currentCourse: "当前课程",
      noPath: "没有找到当前学习路径。请先进入一门已解锁课程。",
      kicker: "课程小练",
      defaultTitle: "本课小练",
      reportTitle: "小练结果报告",
      questions: "题",
      answered: "已答",
      progress: "进度",
      submit: "提交小练",
      submitting: "正在提交...",
      loadingTitle: "正在生成小练",
      loadingText: "正在读取当前课程内容、最近学习记录和薄弱知识点，生成 10 道客观题。",
      empty: "还没有生成题目。",
      single: "单选",
      multiple: "多选",
      tf: "判断",
      scorePrefix: "得分",
      correct: "正确",
      wrong: "错误",
      noWeak: "暂无明显薄弱标签",
      yourAnswer: "你的答案",
      correctAnswer: "正确答案",
      noAnswer: "未作答",
      noAnalysis: "暂无解析",
      generationFailed: "小练生成失败",
      checkLogin: "请确认已经登录并进入已解锁课程。",
      submitFailed: "提交失败",
      generatingButton: "正在生成小练...",
      fallbackButton: "完成本课，继续路径",
      loadingStepCourse: "读取当前课程",
      loadingStepMemory: "匹配学习记录",
      loadingStepQuality: "检查题目质量",
      loadingStepAssemble: "整理题目结构",
      point: "，",
      separator: "、",
    },
    en: {
      noToken: "No login token was found. Please sign in before generating the quiz.",
      requestFailed: "Request failed",
      currentCourse: "Current course",
      noPath: "No active learning path was found. Please open an unlocked course first.",
      kicker: "Course Quiz",
      defaultTitle: "Course Check",
      reportTitle: "Quiz Report",
      questions: "questions",
      answered: "answered",
      progress: "Progress",
      submit: "Submit quiz",
      submitting: "Submitting...",
      loadingTitle: "Generating quiz",
      loadingText: "Reading the current course, recent learning records, and weak knowledge points to generate 10 objective questions.",
      empty: "No questions have been generated yet.",
      single: "Single",
      multiple: "Multiple",
      tf: "True / False",
      scorePrefix: "Score",
      correct: "Correct",
      wrong: "Wrong",
      noWeak: "No clear weak tags yet",
      yourAnswer: "Your answer",
      correctAnswer: "Correct answer",
      noAnswer: "Not answered",
      noAnalysis: "No explanation yet",
      generationFailed: "Quiz generation failed",
      checkLogin: "Please make sure you are signed in and inside an unlocked course.",
      submitFailed: "Submit failed",
      generatingButton: "Generating quiz...",
      fallbackButton: "Finish course and continue",
      loadingStepCourse: "Reading course",
      loadingStepMemory: "Matching records",
      loadingStepQuality: "Checking quality",
      loadingStepAssemble: "Assembling quiz",
      point: ", ",
      separator: ", ",
    },
  }

  function locale() {
    const qs = new URLSearchParams(location.search)
    const explicit = (qs.get("lang") || qs.get("locale") || "").toLowerCase()
    if (explicit.startsWith("en")) return "en"
    if (explicit.startsWith("zh") || explicit.includes("cn")) return "zh"
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase()
    if (htmlLang.startsWith("en")) return "en"
    if (htmlLang.startsWith("zh")) return "zh"
    for (const store of [localStorage, sessionStorage]) {
      for (const key of ["lang", "locale", "aix_lang", "preferredLanguage", "i18nextLng"]) {
        const value = String(store.getItem(key) || "").toLowerCase()
        if (value.startsWith("en")) return "en"
        if (value.startsWith("zh") || value.includes("cn")) return "zh"
      }
    }
    const bodyText = document.body?.innerText || ""
    if (/职业|课程|学习|完成本课|提交挑战|当前账号|连接我的兴趣/.test(bodyText)) return "zh"
    return "en"
  }

  function t(key) {
    return I18N[locale()][key] || I18N.zh[key] || key
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  function tokenFromValue(value) {
    if (!value) return ""
    if (typeof value === "string" && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim())) return value.trim()
    try {
      const obj = typeof value === "string" ? JSON.parse(value) : value
      return obj?.token || obj?.accessToken || obj?.access_token || obj?.session?.token || obj?.session?.accessToken || ""
    } catch {
      return ""
    }
  }

  function readToken() {
    const direct = tokenFromValue(localStorage.getItem("aix_token") || sessionStorage.getItem("aix_token"))
    if (direct) return direct
    for (const store of [localStorage, sessionStorage]) {
      for (let i = 0; i < store.length; i += 1) {
        const token = tokenFromValue(store.getItem(store.key(i)))
        if (token) return token
      }
    }
    return ""
  }

  async function api(path, options = {}) {
    const token = readToken()
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), options.timeout || 18000)
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {}),
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(res.status === 401 ? t("noToken") : (data.error || `${t("requestFailed")} ${res.status}`))
      return data
    } finally {
      window.clearTimeout(timer)
    }
  }

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").replace(/[｜|·]/g, " ").trim().toLowerCase()
  }

  function visibleCourseTitle() {
    const selectors = [
      ".executor-course-lockup strong",
      ".route-step-button.active strong",
      ".mode-gate h1",
      ".challenge-hero h1",
      ".course-executor h1",
      "h1",
      "h2",
    ]
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      const value = el?.textContent?.trim()
      if (value && !/学习路径|课程中心|个人中心|登录|Quiz|小练|分层|Learning Path|Course Center|Profile|Login|Layer/i.test(value)) return value
    }
    return ""
  }

  function phaseHint() {
    const value = new URLSearchParams(location.search).get("phase") || ""
    return value ? `phase${value}` : ""
  }

  function currentStepScope(triggerButton = null) {
    const scopeRoot = triggerButton?.closest?.("section,article,.step,.step-card,.course-step,.lesson-step,.executor-step,.mode-panel,.challenge-card,.course-executor,.mode-gate,main") || document
    const textBlock = String(scopeRoot?.textContent || "").replace(/\s+/g, " ").trim()
    const titleEl = scopeRoot?.querySelector?.("h1,h2,h3,h4,strong,.step-title,.f007-step-title,.executor-step-title")
    const rawTitle = titleEl?.textContent?.trim() || ""
    const stepMatch = textBlock.match(/Step\s*([0-9]+)\s*[:：]?\s*([^。\n]{2,80})/i)
      || textBlock.match(/步骤\s*([0-9]+)\s*[:：]?\s*([^。\n]{2,80})/)
    const stepIndex = stepMatch ? Math.max(0, Number(stepMatch[1]) - 1) : null
    const stepTitle = (stepMatch?.[2] || rawTitle || visibleCourseTitle()).replace(/^(Step\s*[0-9]+\s*[:：]?|步骤\s*[0-9]+\s*[:：]?)/i, "").trim()
    return {
      stepIndex,
      stepTitle: stepTitle.slice(0, 120),
      source: triggerButton ? "completion_button" : "page",
    }
  }

  function flattenTrack(detail) {
    const out = []
    for (const module of detail?.modules || []) {
      for (const node of module.courses || []) out.push({ ...node, moduleName: module.name })
    }
    return out
  }

  async function resolveContext() {
    const title = normalize(visibleCourseTitle())
    const phase = phaseHint()
    const tracks = (await api("/tracks")).tracks || []
    for (const track of tracks.slice(0, 8)) {
      const detail = await api(`/tracks/${encodeURIComponent(track.id)}`)
      const nodes = flattenTrack(detail)
      let node = null
      if (title) {
        node = nodes.find((item) => {
          const itemTitle = normalize(item.title_snapshot || item.title)
          return itemTitle.includes(title) || title.includes(itemTitle)
        })
      }
      if (!node && phase) node = nodes.find((item) => normalize(`${item.course_id} ${item.module_id} ${item.title_snapshot}`).includes(phase))
      if (!node) node = nodes.find((item) => item.status === "AVAILABLE" || item.status === "IN_PROGRESS") || nodes[0]
      if (node) {
        return {
          trackId: track.id,
          routeStepId: node.id,
          courseId: node.course_id,
          title: node.title_snapshot || node.title || visibleCourseTitle() || t("currentCourse"),
        }
      }
    }
    throw new Error(t("noPath"))
  }

  function ensureStyle() {
    if (document.getElementById("f007-quiz-integrated-style")) return
    const style = document.createElement("style")
    style.id = "f007-quiz-integrated-style"
    style.textContent = `
      .f007-quiz-mask{position:fixed;inset:0;z-index:2147483601;background:rgba(6,10,22,.58);backdrop-filter:blur(8px);display:none;align-items:center;justify-content:center;padding:26px}
      .f007-quiz-mask[data-open=true]{display:flex}
      .f007-quiz-modal{position:relative;width:min(980px,96vw);max-height:92vh;display:flex;flex-direction:column;border-radius:28px;background:#0b1020;color:#e5edf7;border:1px solid rgba(148,163,184,.22);box-shadow:0 34px 120px rgba(0,0,0,.46);overflow:hidden;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .f007-quiz-head{padding:24px 28px;background:linear-gradient(180deg,#11182b,#0b1020);border-bottom:1px solid rgba(148,163,184,.16);display:flex;gap:18px;align-items:flex-start}
      .f007-quiz-kicker{font-size:12px;font-weight:800;color:#9fb7ff;letter-spacing:.08em;text-transform:uppercase}
      .f007-quiz-title{font-size:24px;font-weight:900;margin:6px 0 8px;color:#f8fbff}
      .f007-quiz-meta{font-size:13px;color:#8ea0bc;line-height:1.5}
      .f007-quiz-close{margin-left:auto;border:1px solid rgba(148,163,184,.22);background:#121a2d;color:#cbd5e1;border-radius:14px;width:38px;height:38px;font-size:24px;cursor:pointer}
      .f007-quiz-body{overflow:auto;padding:24px 28px 120px}
      .f007-q-card{background:#10182a;border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:22px;margin:0 0 18px;box-shadow:0 12px 30px rgba(0,0,0,.16)}
      .f007-q-top{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}
      .f007-q-type{flex:0 0 auto;border-radius:999px;background:rgba(96,165,250,.14);color:#bfdbfe;font-size:12px;font-weight:900;padding:7px 10px}
      .f007-q-stem{font-size:17px;font-weight:850;line-height:1.55;padding-top:2px;color:#f8fbff}
      .f007-options{display:grid;gap:10px}
      .f007-option{display:flex;gap:12px;align-items:flex-start;border:1px solid rgba(148,163,184,.18);border-radius:16px;background:#0c1324;padding:14px 15px;cursor:pointer;line-height:1.5;color:#dce6f4}
      .f007-option:hover{background:#111d35;border-color:rgba(147,197,253,.48)}
      .f007-option input{margin-top:4px;transform:scale(1.15);pointer-events:none}
      .f007-option[data-checked=true]{background:#13213b;border-color:#7dd3fc}
      .f007-loading{min-height:280px;display:grid;place-items:center;text-align:center}
      .f007-loader-card{width:min(520px,100%);border:1px solid rgba(148,163,184,.18);border-radius:24px;background:#10182a;padding:34px 28px;box-shadow:0 18px 54px rgba(0,0,0,.2)}
      .f007-loader-ring{width:58px;height:58px;margin:0 auto 18px;border-radius:999px;border:4px solid rgba(199,255,79,.16);border-top-color:#c7ff4f;animation:f007-spin .9s linear infinite}
      .f007-loader-title{font-size:20px;font-weight:900;color:#f8fbff;margin-bottom:8px}
      .f007-loader-text{font-size:14px;color:#9fb0c8;line-height:1.7}
      .f007-progress-track{position:relative;height:10px;margin:22px 0 18px;border-radius:999px;background:rgba(148,163,184,.14);overflow:hidden}
      .f007-progress-fill{position:absolute;inset:0 auto 0 0;width:22%;border-radius:999px;background:linear-gradient(90deg,#5eead4,#c7ff4f);box-shadow:0 0 22px rgba(199,255,79,.34);animation:f007-progress 3.2s ease-in-out infinite}
      .f007-loader-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:left}
      .f007-loader-step{border:1px solid rgba(148,163,184,.16);background:#0c1324;border-radius:14px;padding:10px 9px;color:#aebbd0;font-size:12px;line-height:1.35}
      .f007-loader-step:before{content:"";display:inline-block;width:7px;height:7px;border-radius:999px;margin-right:7px;background:#5eead4;box-shadow:0 0 14px rgba(94,234,212,.55);vertical-align:1px;animation:f007-pulse 1.4s ease-in-out infinite}
      .f007-loader-step:nth-child(2):before{animation-delay:.25s}.f007-loader-step:nth-child(3):before{animation-delay:.5s}.f007-loader-step:nth-child(4):before{animation-delay:.75s}
      .f007-loader-bars{display:grid;gap:8px;margin-top:22px}
      .f007-loader-bars span{height:8px;border-radius:999px;background:linear-gradient(90deg,rgba(148,163,184,.14),rgba(199,255,79,.32),rgba(148,163,184,.14));background-size:220% 100%;animation:f007-shimmer 1.2s ease-in-out infinite}
      .f007-loader-bars span:nth-child(2){width:82%;animation-delay:.12s}.f007-loader-bars span:nth-child(3){width:68%;animation-delay:.24s}
      @keyframes f007-spin{to{transform:rotate(360deg)}}@keyframes f007-shimmer{0%{background-position:120% 0}100%{background-position:-120% 0}}@keyframes f007-progress{0%{width:18%}35%{width:48%}70%{width:78%}100%{width:94%}}@keyframes f007-pulse{0%,100%{opacity:.45;transform:scale(.86)}50%{opacity:1;transform:scale(1.08)}}
      .f007-quiz-foot{position:absolute;left:0;right:0;bottom:0;background:rgba(11,16,32,.96);border-top:1px solid rgba(148,163,184,.16);padding:16px 28px;display:flex;gap:14px;align-items:center}
      .f007-progress{color:#98a8c3;font-size:14px}
      .f007-submit{margin-left:auto;border:0;border-radius:16px;background:#c7ff4f;color:#07111f;font-weight:900;padding:14px 22px;cursor:pointer}
      .f007-submit:disabled{opacity:.55;cursor:not-allowed}
      .f007-report{background:#10182a;border:1px solid rgba(148,163,184,.18);border-radius:22px;padding:22px;margin-bottom:18px}
      .f007-score{font-size:34px;font-weight:950;color:#f8fbff}
      .f007-weak{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
      .f007-tag{font-size:12px;border-radius:999px;background:rgba(148,163,184,.14);color:#cbd5e1;padding:6px 9px}
      .f007-result-item{border-top:1px solid rgba(148,163,184,.12);padding:16px 0}
      .f007-ok{color:#86efac;font-weight:900}.f007-bad{color:#fca5a5;font-weight:900}
      .f007-analysis{margin-top:10px;background:#0c1324;border-radius:14px;padding:12px;color:#cbd5e1;line-height:1.65}
      .f007-complete-generating{opacity:.8;pointer-events:none}
      .f007-complete-button-fix{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:12px!important;min-width:246px!important;padding:16px 28px!important;line-height:1.25!important;white-space:nowrap!important;overflow:visible!important;border-radius:18px!important}
      .f007-complete-button-fix .f007-complete-arrow{display:inline-flex;align-items:center;justify-content:center;font-size:22px;line-height:1;transform:translateY(-1px)}
      .f007-complete-button-fix.f007-complete-generating .f007-complete-arrow{display:none}
      @media(max-width:720px){.f007-quiz-mask{padding:8px}.f007-quiz-modal{max-height:96vh;border-radius:22px}.f007-quiz-head{padding:18px}.f007-quiz-body{padding:18px 16px 112px}.f007-quiz-title{font-size:20px}}
    `
    document.head.appendChild(style)
  }

  function typeLabel(type) {
    return type === "multiple_choice" ? t("multiple") : type === "true_false" ? t("tf") : t("single")
  }

  function allAnswered() {
    const questions = state.quiz?.questions || []
    return questions.length > 0 && questions.every((q) => q.type === "multiple_choice"
      ? Array.isArray(state.answers[q.question_id]) && state.answers[q.question_id].length > 0
      : Boolean(state.answers[q.question_id]))
  }

  function answerText(answer) {
    return Array.isArray(answer) ? answer.join(t("separator")) : String(answer || t("noAnswer"))
  }

  function displayTitle() {
    if (state.report) return t("reportTitle")
    const title = state.quiz?.title || ""
    if (locale() === "zh" && /Course Check|Daily Quiz|Quiz Report/i.test(title)) return `${courseTitleForMeta()} ${t("defaultTitle")}`
    if (locale() === "en" && /今日|课程小练|小练|结果报告/.test(title)) return `${courseTitleForMeta()} ${t("defaultTitle")}`
    return title || t("defaultTitle")
  }

  function titleFromQuizForMeta() {
    const raw = state.quiz?.title || ""
    if (!raw) return ""
    let cleaned = raw
      .replace(/^Phase\s*\d+\s*[·\-]\s*/i, "")
      .replace(/\s*Course Check\s*$/i, "")
      .replace(/\s*课程小练\s*$/i, "")
      .trim()
    return cleaned
  }

  function courseTitleForMeta() {
    const raw = state.context?.title || ""
    if (locale() === "en" && /[\u4e00-\u9fff]/.test(raw)) {
      const fromQuiz = titleFromQuizForMeta()
      return fromQuiz && !/[\u4e00-\u9fff]/.test(fromQuiz) ? fromQuiz : t("currentCourse")
    }
    if (locale() === "zh" && /Course Check|Current course|AI-assisted|Practice|Fundamentals/i.test(raw)) {
      const fromQuiz = titleFromQuizForMeta()
      return fromQuiz && !/Course Check|Current course/i.test(fromQuiz) ? fromQuiz : t("currentCourse")
    }
    return raw || titleFromQuizForMeta() || t("currentCourse")
  }

  function render(options = {}) {
    ensureStyle()
    let mask = document.querySelector(".f007-quiz-mask")
    const previousScrollTop = document.querySelector(".f007-quiz-body")?.scrollTop || 0
    if (!mask) {
      mask = document.createElement("div")
      mask.className = "f007-quiz-mask"
      mask.innerHTML = `<section class="f007-quiz-modal" role="dialog" aria-modal="true"></section>`
      document.body.appendChild(mask)
    }
    mask.dataset.open = String(state.open)
    const modal = mask.querySelector(".f007-quiz-modal")
    const questions = state.quiz?.questions || []
    const answered = questions.filter((q) => q.type === "multiple_choice" ? (state.answers[q.question_id] || []).length : state.answers[q.question_id]).length
    modal.innerHTML = `
      <div class="f007-quiz-head">
        <div>
          <div class="f007-quiz-kicker">${escapeHtml(t("kicker"))}</div>
          <div class="f007-quiz-title">${escapeHtml(displayTitle())}</div>
          <div class="f007-quiz-meta">${escapeHtml(courseTitleForMeta())} · ${questions.length || 10} ${escapeHtml(t("questions"))} · ${escapeHtml(t("answered"))} ${answered}/${questions.length || 10}</div>
        </div>
        <button class="f007-quiz-close" type="button">×</button>
      </div>
      <div class="f007-quiz-body">${state.loading ? loadingHtml() : state.report ? reportHtml() : quizHtml()}</div>
      ${state.report ? "" : `<div class="f007-quiz-foot"><div class="f007-progress">${escapeHtml(t("progress"))} ${answered}/${questions.length || 10}</div><button class="f007-submit" type="button" ${!allAnswered() || state.submitting ? "disabled" : ""}>${escapeHtml(state.submitting ? t("submitting") : t("submit"))}</button></div>`}
    `
    modal.querySelector(".f007-quiz-close").onclick = () => { state.open = false; render() }
    modal.querySelector(".f007-submit")?.addEventListener("click", submitQuiz)
    modal.onclick = (event) => {
      const option = event.target?.closest?.("[data-qid][data-value]")
      if (!option) return
      event.preventDefault()
      event.stopPropagation()
      const qid = option.dataset.qid
      const value = option.dataset.value
      const type = option.dataset.type
      if (type === "multiple_choice") {
        const current = new Set(Array.isArray(state.answers[qid]) ? state.answers[qid] : [])
        current.has(value) ? current.delete(value) : current.add(value)
        state.answers[qid] = [...current].sort()
      } else {
        state.answers[qid] = value
      }
      render({ preserveScroll: true })
    }
    if (options.preserveScroll) {
      const body = modal.querySelector(".f007-quiz-body")
      if (body) body.scrollTop = previousScrollTop
    }
  }

  function loadingHtml() {
    const steps = [t("loadingStepCourse"), t("loadingStepMemory"), t("loadingStepQuality"), t("loadingStepAssemble")]
    return `<div class="f007-loading">
      <div class="f007-loader-card">
        <div class="f007-loader-ring"></div>
        <div class="f007-loader-title">${escapeHtml(t("loadingTitle"))}</div>
        <div class="f007-loader-text">${escapeHtml(t("loadingText"))}</div>
        <div class="f007-progress-track" aria-hidden="true"><div class="f007-progress-fill"></div></div>
        <div class="f007-loader-steps">${steps.map((item) => `<div class="f007-loader-step">${escapeHtml(item)}</div>`).join("")}</div>
        <div class="f007-loader-bars"><span></span><span></span><span></span></div>
      </div>
    </div>`
  }

  function quizHtml() {
    const questions = state.quiz?.questions || []
    if (!questions.length) return `<div class="f007-report">${escapeHtml(t("empty"))}</div>`
    return questions.map((q, index) => {
      const current = state.answers[q.question_id]
      return `<article class="f007-q-card">
        <div class="f007-q-top"><span class="f007-q-type">${escapeHtml(typeLabel(q.type))}</span><div class="f007-q-stem">${index + 1}. ${escapeHtml(q.stem)}</div></div>
        <div class="f007-options">${Object.entries(q.options || {}).map(([key, value]) => {
          const checked = q.type === "multiple_choice" ? Array.isArray(current) && current.includes(key) : current === key
          return `<label class="f007-option" data-qid="${escapeHtml(q.question_id)}" data-value="${escapeHtml(key)}" data-type="${escapeHtml(q.type)}" data-checked="${checked}">
            <input type="${q.type === "multiple_choice" ? "checkbox" : "radio"}" ${checked ? "checked" : ""} tabindex="-1" aria-hidden="true">
            <span><strong>${escapeHtml(key)}.</strong> ${escapeHtml(value)}</span>
          </label>`
        }).join("")}</div>
      </article>`
    }).join("")
  }

  function reportHtml() {
    const r = state.report || { score: 0, total: 0, scorePercent: 0, items: [] }
    return `<section class="f007-report">
      <div class="f007-score">${escapeHtml(r.score)}/${escapeHtml(r.total)}</div>
      <div class="f007-quiz-meta">${escapeHtml(t("scorePrefix"))} ${escapeHtml(r.scorePercent)}%${t("point")}${escapeHtml(t("correct"))} ${escapeHtml(r.score)} ${escapeHtml(t("questions"))}${t("point")}${escapeHtml(t("wrong"))} ${escapeHtml((r.total || 0) - (r.score || 0))} ${escapeHtml(t("questions"))}</div>
      <div class="f007-weak">${(r.weakTags || []).map((tag) => `<span class="f007-tag">${escapeHtml(tag)}</span>`).join("") || `<span class="f007-tag">${escapeHtml(t("noWeak"))}</span>`}</div>
    </section>
    <section class="f007-report">${(r.items || []).map((item, index) => `
      <div class="f007-result-item">
        <div>${item.correct ? `<span class="f007-ok">${escapeHtml(t("correct"))}</span>` : `<span class="f007-bad">${escapeHtml(t("wrong"))}</span>`} · ${index + 1}. ${escapeHtml(item.stem)}</div>
        <div class="f007-quiz-meta">${escapeHtml(t("yourAnswer"))}：${escapeHtml(answerText(item.userAnswer))}；${escapeHtml(t("correctAnswer"))}：${escapeHtml(answerText(item.correctAnswer))}</div>
        <div class="f007-analysis">${escapeHtml(item.analysis || t("noAnalysis"))}</div>
        <div class="f007-weak">${(item.tags || []).map((tag) => `<span class="f007-tag">${escapeHtml(tag)}</span>`).join("")}${item.abilityDimension ? `<span class="f007-tag">${escapeHtml(item.abilityDimension)}</span>` : ""}</div>
      </div>`).join("")}</section>`
  }

  async function startQuiz(triggerButton = null) {
    const now = Date.now()
    if (state.loading || state.submitting || now - state.lastAutoQuizAt < 1200) return
    state.lastAutoQuizAt = now
    const loadingStartedAt = Date.now()
    const originalText = triggerButton?.dataset?.f007ButtonLabel
      || (triggerButton?.textContent || "").replace(/[→›>]+$/g, "").trim()
    state.triggerButton = triggerButton || null
    try {
      if (triggerButton) {
        triggerButton.dataset.f007OriginalText = originalText || ""
        triggerButton.textContent = t("generatingButton")
        triggerButton.classList.add("f007-complete-generating")
      }
      state.open = true
      state.loading = true
      state.report = null
      state.quiz = null
      state.answers = {}
      render()
      state.context = await resolveContext()
      const data = await api("/quiz/start", {
        method: "POST",
        timeout: 22000,
        body: JSON.stringify({
          trackId: state.context.trackId,
          routeStepId: state.context.routeStepId,
          locale: locale(),
          ...(state.pendingStepScope || {}),
        }),
      })
      state.quiz = data.quiz
    } catch (err) {
      state.quiz = { title: t("generationFailed"), questions: [] }
      state.report = {
        score: 0,
        total: 0,
        scorePercent: 0,
        weakTags: [t("generationFailed")],
        items: [{ correct: false, stem: err.message, userAnswer: "", correctAnswer: "", analysis: t("checkLogin"), tags: [], abilityDimension: "" }],
      }
    } finally {
      const loadingElapsed = Date.now() - loadingStartedAt
      if (loadingElapsed < 900) {
        await new Promise((resolve) => setTimeout(resolve, 900 - loadingElapsed))
      }
      if (triggerButton) {
        triggerButton.textContent = triggerButton.dataset.f007OriginalText || originalText || t("fallbackButton")
        triggerButton.classList.remove("f007-complete-generating")
        polishCompletionButtons(triggerButton.parentElement || document)
      }
      state.loading = false
      render()
    }
  }

  async function submitQuiz() {
    if (!allAnswered() || !state.quiz?.quizId) return
    try {
      state.submitting = true
      render()
      const data = await api(`/quiz/${encodeURIComponent(state.quiz.quizId)}/submit`, {
        method: "POST",
        body: JSON.stringify({ answers: state.answers }),
      })
      state.report = data.report
      await loadAdaptiveSteps(false)
    } catch (err) {
      window.alert(`${t("submitFailed")}：${err.message}`)
    } finally {
      state.submitting = false
      render()
    }
  }

  async function loadAdaptiveSteps(applyDom = true) {
    try {
      state.context = state.context || await resolveContext()
      state.adaptiveSteps = await api(`/quiz/adaptive-steps?trackId=${encodeURIComponent(state.context.trackId)}&routeStepId=${encodeURIComponent(state.context.routeStepId)}`)
      if (applyDom) applyAdaptiveStepNote()
    } catch {
      // Step recommendation is an enhancement. Do not block the original page if it fails.
    }
  }

  function applyAdaptiveStepNote(){return}

  function isCompletionButton(el) {
    const label = (el?.textContent || "").replace(/\s+/g, "")
    if (!label) return false
    return /^(?:✓|√)?(?:完成本课[，,]?继续路径|提交挑战并完成本课)(?:→|->|›|>)?$/.test(label)
      || /^(?:✓|√)?(?:Completethislesson[,]?continuepath|Finishcourseandcontinue|Submitchallengeandcompletethislesson|Finishlesson[,]?continue)(?:→|->|›|>)?$/i.test(label)
  }

  function removeOldFloatingButtons() {
    document.querySelectorAll(".f007-quiz-btn,.f007-step-btn").forEach((el) => el.remove())
  }

  function polishCompletionButtons(root = document) {
    root.querySelectorAll?.("button,[role=button],a")?.forEach((el) => {
      if (!isCompletionButton(el)) return
      el.classList.add("f007-complete-button-fix")
      const localizedLabel = t("fallbackButton")
      el.dataset.f007ButtonLabel = localizedLabel
      if (!el.classList.contains("f007-complete-generating")) {
        el.textContent = localizedLabel
      }
      if (!el.querySelector(".f007-complete-arrow")) {
        const arrow = document.createElement("span")
        arrow.className = "f007-complete-arrow"
        arrow.setAttribute("aria-hidden", "true")
        arrow.textContent = "→"
        el.appendChild(arrow)
      }
    })
  }

  document.addEventListener("click", (event) => {
    const el = event.target?.closest?.("button,[role=button],a")
    if (!el || !location.pathname.startsWith("/personalized-secure")) return
    if (el.closest(".f007-quiz-modal")) return
    if (isCompletionButton(el)) {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation?.()
      state.pendingStepScope = currentStepScope(el)
      startQuiz(el)
    }
  }, true)

  ensureStyle()
  removeOldFloatingButtons()
  polishCompletionButtons()
  const f007Observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes?.forEach((node) => {
        if (node?.nodeType === 1) polishCompletionButtons(node)
      })
    }
  })
  f007Observer.observe(document.documentElement, { childList: true, subtree: true })
})()
