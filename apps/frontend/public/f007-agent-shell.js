(function () {
  document.querySelectorAll(".f007-bot,.f007-panel").forEach((el) => el.remove())
  if (window.__F007_AGENT_SHELL_V3__) return
  window.__F007_AGENT_SHELL_V3__ = true

  const API_BASE = "/personalized-secure-api/v1"
  const SESSION_KEY = "f007_agent_shell_v3"
  const POSITION_KEY = "f007_agent_shell_position_v1"
  const LOCALE_KEY = "personalized-secure:locale:v1"
  function readLocale() {
    try {
      const params = new URLSearchParams(location.search)
      const urlLocale = params.get("lang") || params.get("locale")
      if (/^en/i.test(urlLocale || "")) return "en"
      if (/^zh/i.test(urlLocale || "")) return "zh"
      if (window.AppI18n && typeof window.AppI18n.getLang === "function") return window.AppI18n.getLang() === "en" ? "en" : "zh"
      return localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "zh"
    } catch {
      return "zh"
    }
  }
  let locale = readLocale()
  const L = (zh, en) => locale === "en" ? en : zh
  const ctx = { tracks: [], details: new Map(), active: null }
  let state = { open: false, loading: false, sessionId: "", conversationId: "", contextKey: "", messages: [] }
  let lastResolvedContextKey = ""
  let lastRenderedMessageCount = 0
  let dragState = null
  let botPosition = { x: window.innerWidth - 84, y: window.innerHeight - 84 }

  // The legacy shell remains useful before a student enters a course. Inside
  // CourseExecutor the React learning partner owns the exact course/stage
  // context, so showing both shells creates duplicate buttons and stale Agent
  // sessions. Keep exactly one entrance visible at a time.
  function syncWithUnifiedAgent() {
    const unified = Boolean(document.querySelector(".unified-agent-fab"))
    bot.hidden = unified
    panel.hidden = unified
    if (unified) state.open = false
  }

  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}")
    if (!saved.locale || saved.locale === locale) {
      state.sessionId = saved.sessionId || ""
      state.conversationId = saved.conversationId || ""
      state.contextKey = saved.contextKey || ""
    }
  } catch {}
  try {
    const savedPosition = JSON.parse(localStorage.getItem(POSITION_KEY) || "{}")
    if (Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)) botPosition = savedPosition
  } catch {}

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").replace(/[｜|·]/g, " ").trim().toLowerCase()
  }

  function readToken() {
    return String(localStorage.getItem("aix_token") || "").trim()
  }

  function clearAuthCache() {
    localStorage.removeItem("aix_token")
    localStorage.removeItem("aix_user")
    sessionStorage.removeItem("aix_token")
    sessionStorage.removeItem("aix_user")
    localStorage.removeItem(SESSION_KEY)
  }

  function invalidateAuth() {
    clearAuthCache()
    window.dispatchEvent(new CustomEvent("aix-auth-changed"))
  }

  async function verifyAuthOnLoad() {
    const token = readToken()
    if (!token) return
    try {
      const response = await fetch("/personalized-secure-api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.status !== 401) return
      invalidateAuth()
    } catch {
      // Do not block the page if the network is temporarily unavailable.
    }
  }

  function saveSession() {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionId: state.sessionId, conversationId: state.conversationId, contextKey: state.contextKey, locale }))
  }

  async function api(path, options = {}) {
    const token = readToken()
    if (!token) throw new Error("没有读取到登录态。请先登录 Personalized Secure，再刷新页面。")
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401) {
        invalidateAuth()
        throw new Error("登录态已失效，已清理本地旧登录缓存。请重新登录后再试。")
      }
      if (data.error === "agent_reply_failed") {
        const error = new Error("学习伙伴暂时连接失败，请稍后再试；你的问题已经记录到本次课程学习过程里。")
        error.code = data.error
        error.status = response.status
        throw error
      }
      const error = new Error(data.error || `请求失败 ${response.status}`)
      error.code = data.error || ""
      error.status = response.status
      throw error
    }
    return data
  }

  function visibleCourseTitle() {
    const contextual = document.querySelector("[data-agent-course-title]")
    const contextualTitle = contextual?.dataset?.agentCourseTitle?.trim() || ""
    if (contextualTitle) return contextualTitle
    const selectors = [
      ".executor-course-lockup strong",
      ".route-step-button.active strong",
      ".mode-gate h1",
      ".challenge-hero h1",
      ".course-executor h1",
    ]
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      const text = el && el.textContent ? el.textContent.trim() : ""
      if (text) return text
    }
    return ""
  }

  function pageCourseContext() {
    const element = document.querySelector("[data-agent-course-id]")
    if (!element) return null
    return {
      trackId: element.dataset.agentTrackId || "",
      routeStepId: element.dataset.agentRouteStepId || "",
      courseId: element.dataset.agentCourseId || "",
      title: element.dataset.agentCourseTitle || "",
    }
  }

  function isInsideCourse() {
    return Boolean(document.querySelector(".course-executor,.mode-gate,.self-directed-executor"))
  }

  function phaseFromText(text) {
    const t = String(text || "").toLowerCase()
    if (/build-smart-car|智能小车|desk-companion|m5stack|项目路演|机器人创造营/.test(t)) return "phase5"
    if (/embodied_projects|touch-interface|multi-actuator|ai-device-linkage|embodied-collaboration|触觉|触摸|反馈|多执行器|舵机|电机|联动控制|具身执行/.test(t)) return "phase4"
    if (/embedded_perception|ultrasonic|camera-vision|audio-edge-ai|edge-ai-training|multimodal-edge-ai|环境感知|感知|摄像头|图像识别|edge impulse|语音识别|传感器融合/.test(t)) return "phase3"
    if (/ai_manufacturing|ai-cad|blender|laser|uv|cam-toolpath|manufacturing-quality|新型硬件|3d打印|增材|激光|cnc|cam|arduino/.test(t)) return "phase2"
    if (/ai_agent|model-evaluation|agent-handoff|desktop-agent|device-gateway|国产人工智能|大模型|agent|prompt|esp32|云边协同|3d建模/.test(t)) return "phase1"
    if (/phase\s*1|phase1|第一阶段/.test(t)) return "phase1"
    if (/phase\s*2|phase2|第二阶段/.test(t)) return "phase2"
    if (/phase\s*3|phase3|phase\s*4|phase4|第三阶段|第四阶段/.test(t)) return "phase3"
    if (/phase\s*5|phase5|第五阶段/.test(t)) return "phase5"
    if (/电子|电路|硬件|边缘|传感|sensor|circuit|hardware|edge/.test(t)) return "phase3"
    if (/国产\s*ai|ai\s*应用|大模型|提示词|prompt|llm|模型/.test(t)) return "phase1"
    if (/机械|结构|运动|机器人|执行器|mechanical|robot|actuator/.test(t)) return "phase5"
    return "course"
  }

  function flattenCourses(detail) {
    const out = []
    for (const module of detail?.modules || []) {
      for (const node of module.courses || []) out.push({ ...node, moduleName: module.name })
    }
    return out
  }

  async function resolveContext() {
    if (!isInsideCourse()) {
      const error = new Error("COURSE_CONTEXT_REQUIRED")
      error.userMessage = "先进入学习路径中的一门课程，再向学习伙伴提问。"
      throw error
    }
    const pageContext = pageCourseContext()
    const title = pageContext?.title || visibleCourseTitle()
    const titleKey = normalize(title)
    const tracksResp = await api("/tracks")
    ctx.tracks = tracksResp.tracks || []
    const orderedTracks = [...ctx.tracks].sort((left, right) => {
      if (left.id === pageContext?.trackId) return -1
      if (right.id === pageContext?.trackId) return 1
      return 0
    })
    for (const track of orderedTracks.slice(0, 5)) {
      if (!ctx.details.has(track.id)) {
        const detail = await api(`/tracks/${encodeURIComponent(track.id)}`)
        ctx.details.set(track.id, detail)
      }
      const detail = ctx.details.get(track.id)
      const courses = flattenCourses(detail)
      let matched = null
      if (pageContext?.courseId) {
        matched = courses.find((node) => String(node.course_id) === String(pageContext.courseId))
      }
      if (titleKey) {
        matched = matched || courses.find((node) => normalize(node.title_snapshot || node.title).includes(titleKey) || titleKey.includes(normalize(node.title_snapshot || node.title)))
      }
      if (!matched) {
        matched = courses.find((node) => node.status === "AVAILABLE" || node.status === "IN_PROGRESS") || courses[0]
      }
      if (matched) {
        ctx.active = {
          trackId: track.id,
          routeStepId: matched.id,
          courseId: matched.course_id,
          moduleId: matched.module_id,
          title: title || matched.title_snapshot || matched.title || L("当前课程", "Current course"),
          moduleName: matched.moduleName || "",
          stageId: phaseFromText(`${matched.course_id || ""} ${matched.module_id || ""} ${title} ${matched.title_snapshot || ""}`),
        }
        return ctx.active
      }
    }
    const error = new Error("COURSE_CONTEXT_REQUIRED")
    error.userMessage = "我还没有识别到当前课程。请先生成学习路径，并进入其中一门课程后再提问。"
    throw error
  }

  const style = document.createElement("style")
  style.textContent = `
    .f007-bot{position:fixed;z-index:2147483640;width:58px;height:58px;border-radius:20px;border:1px solid rgba(132,204,255,.28);background:linear-gradient(135deg,#17213b,#28316b);color:#7dd3fc;box-shadow:0 20px 55px rgba(0,0,0,.38);cursor:grab;display:grid;place-items:center;pointer-events:auto;touch-action:none}
    .f007-bot:active{cursor:grabbing}
    .f007-bot svg{width:28px;height:28px}.f007-bot:hover{transform:translateY(-1px);border-color:rgba(167,139,250,.55)}
    .f007-panel{position:fixed;z-index:2147483639;width:min(420px,calc(100vw - 32px));height:min(620px,calc(100vh - 126px));display:none;flex-direction:column;overflow:hidden;border:1px solid rgba(139,92,246,.35);border-radius:26px;background:linear-gradient(180deg,#111827,#080b16);box-shadow:0 30px 100px rgba(0,0,0,.52);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e5e7eb;pointer-events:auto}
    .f007-panel[data-open="true"]{display:flex}.f007-head{height:82px;padding:18px 20px;display:flex;align-items:center;gap:14px;border-bottom:1px solid rgba(148,163,184,.16);background:linear-gradient(135deg,rgba(15,23,42,.98),rgba(20,31,52,.96));cursor:move;user-select:none}
    .f007-avatar{width:48px;height:48px;border-radius:16px;background:linear-gradient(135deg,#1f2a58,#15233b);display:grid;place-items:center;color:#67e8f9;box-shadow:inset 0 0 0 1px rgba(125,211,252,.15)}
    .f007-title{font-weight:800;font-size:18px;line-height:1}.f007-sub{margin-top:7px;font-size:12px;color:#9ca3af}.f007-close{margin-left:auto;width:34px;height:34px;border:0;border-radius:12px;background:transparent;color:#9ca3af;font-size:28px;cursor:pointer}.f007-close:hover{background:rgba(148,163,184,.12);color:#fff}
    .f007-context{display:flex;gap:10px;align-items:flex-start;padding:14px 18px;border-bottom:1px solid rgba(148,163,184,.12);background:rgba(30,27,75,.54)}.f007-context i{font-style:normal;color:#c084fc}.f007-context small{display:block;color:#a7a9be;font-size:12px}.f007-context strong{display:block;margin-top:3px;color:#f5f3ff;font-size:14px;line-height:1.35}
    .f007-log{flex:1;overflow-y:auto;overflow-x:hidden;padding:18px 18px 10px;background:#080b16;overscroll-behavior:contain;scrollbar-gutter:stable}.f007-msg{max-width:86%;margin:0 0 14px;padding:14px 15px;border-radius:20px;font-size:14px;line-height:1.62}.f007-msg.user{margin-left:auto;background:#132235;border:1px solid rgba(125,211,252,.28);color:#f8fafc;border-bottom-right-radius:6px;white-space:pre-wrap}.f007-msg.assistant{margin-right:auto;background:#151827;border:1px solid rgba(148,163,184,.18);color:#d9deea;border-bottom-left-radius:6px}.f007-msg.system{max-width:100%;background:rgba(120,53,15,.18);border:1px solid rgba(251,146,60,.36);color:#fed7aa;font-size:13px;white-space:pre-wrap}
    .f007-empty{min-height:100%;display:grid;place-items:center;padding:22px 10px}.f007-empty-card{width:100%;border:1px solid rgba(148,163,184,.18);border-radius:22px;background:#111827;padding:22px;text-align:left}.f007-empty-title{font-size:18px;font-weight:850;color:#f8fafc;margin-bottom:8px}.f007-empty-text{font-size:13px;line-height:1.7;color:#aeb8ca}
    .f007-msg.pending{display:flex;align-items:center;gap:10px;color:#cbd5e1}.f007-spinner{width:16px;height:16px;border-radius:999px;border:2px solid rgba(125,211,252,.18);border-top-color:#7dd3fc;animation:f007-spin .8s linear infinite;flex:0 0 auto}.f007-dots::after{content:"";animation:f007-dots 1.2s steps(4,end) infinite}@keyframes f007-spin{to{transform:rotate(360deg)}}@keyframes f007-dots{0%{content:""}25%{content:"."}50%{content:".."}75%,100%{content:"..."}}
    .f007-md{display:block}.f007-md>*:first-child{margin-top:0}.f007-md>*:last-child{margin-bottom:0}.f007-md p{margin:0 0 10px;color:#e5e7eb}.f007-md h1,.f007-md h2,.f007-md h3{margin:14px 0 8px;color:#f8fafc;line-height:1.35;font-weight:800}.f007-md h1{font-size:18px}.f007-md h2{font-size:16px}.f007-md h3{font-size:15px}.f007-md strong{font-weight:800;color:#fef3c7}.f007-md ul,.f007-md ol{margin:8px 0 12px;padding-left:22px}.f007-md li{margin:5px 0;color:#e5e7eb}.f007-md code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;background:rgba(125,211,252,.12);border:1px solid rgba(125,211,252,.18);border-radius:7px;padding:1px 5px;color:#bae6fd}.f007-md pre{white-space:pre-wrap;overflow:auto;background:#070a13;border:1px solid rgba(148,163,184,.18);border-radius:14px;padding:12px;margin:10px 0}.f007-md blockquote{margin:10px 0;padding:8px 12px;border-left:3px solid #8b5cf6;background:rgba(139,92,246,.1);border-radius:10px;color:#d8b4fe}
    .f007-foot{display:flex;gap:12px;align-items:flex-end;padding:14px 16px 18px;border-top:1px solid rgba(148,163,184,.14);background:#080b16}.f007-input{flex:1;height:64px;max-height:120px;resize:none;border-radius:18px;border:1px solid rgba(148,163,184,.2);background:#060913;color:#e5e7eb;padding:17px 18px;outline:none;font:14px/1.45 inherit}.f007-input:focus{border-color:rgba(125,211,252,.55);box-shadow:0 0 0 3px rgba(14,165,233,.12)}.f007-send{width:64px;height:58px;border:0;border-radius:18px;background:#456f7d;color:#06111a;display:grid;place-items:center;cursor:pointer}.f007-send:disabled{opacity:.55;cursor:not-allowed}.f007-send svg{width:27px;height:27px}
  `
  document.head.appendChild(style)

  const bot = document.createElement("button")
  bot.className = "f007-bot"
  bot.title = "学习伙伴"
  bot.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 4v4M8 13h.01M16 13h.01M9 18v2M15 18v2"/><path d="M4 12H2M22 12h-2"/></svg>'

  const panel = document.createElement("section")
  panel.className = "f007-panel"
  panel.innerHTML = `
    <div class="f007-head">
      <div class="f007-avatar">${bot.innerHTML}</div>
      <div><div class="f007-title">学习伙伴</div><div class="f007-sub">模型与 Agent 导师 · 已匹配当前内容</div></div>
      <button class="f007-close" type="button">×</button>
    </div>
    <div class="f007-context"><i>✧</i><div><small>学习路径助手</small><strong>进入具体课程后，我会自动匹配对应 Agent</strong></div></div>
    <div class="f007-log"></div>
    <div class="f007-foot"><textarea class="f007-input" placeholder="输入你的问题…"></textarea><button class="f007-send" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button></div>
  `

  document.body.appendChild(panel)
  document.body.appendChild(bot)

  const log = panel.querySelector(".f007-log")
  const input = panel.querySelector(".f007-input")
  const send = panel.querySelector(".f007-send")
  const close = panel.querySelector(".f007-close")
  const contextEl = panel.querySelector(".f007-context")
  const head = panel.querySelector(".f007-head")

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value))
  }

  function applyBotPosition(save = false) {
    const maxX = Math.max(16, window.innerWidth - 74)
    const maxY = Math.max(16, window.innerHeight - 74)
    botPosition.x = clamp(Number(botPosition.x) || maxX, 16, maxX)
    botPosition.y = clamp(Number(botPosition.y) || maxY, 16, maxY)
    bot.style.left = `${botPosition.x}px`
    bot.style.top = `${botPosition.y}px`
    bot.style.right = "auto"
    bot.style.bottom = "auto"
    if (save) localStorage.setItem(POSITION_KEY, JSON.stringify(botPosition))
    applyPanelPosition()
  }

  function applyPanelPosition() {
    const width = Math.min(420, window.innerWidth - 32)
    const height = Math.min(620, window.innerHeight - 126)
    const leftCandidate = botPosition.x + 58 + width + 16 <= window.innerWidth
      ? botPosition.x + 70
      : botPosition.x - width - 12
    const topCandidate = botPosition.y + 58 + height + 16 <= window.innerHeight
      ? botPosition.y
      : botPosition.y - height - 12
    panel.style.left = `${clamp(leftCandidate, 16, window.innerWidth - width - 16)}px`
    panel.style.top = `${clamp(topCandidate, 16, window.innerHeight - height - 16)}px`
    panel.style.right = "auto"
    panel.style.bottom = "auto"
  }

  function renderContext() {
    const active = ctx.active
    const title = active?.title || (isInsideCourse() ? visibleCourseTitle() : "") || L("先进入一门课程，再开始提问", "Enter a course before asking a question")
    const phase = active?.stageId && active.stageId !== "course" ? active.stageId.replace("phase", "Phase ") : L("课程 Agent", "Course Agent")
    const moduleName = active?.moduleName && (locale !== "en" || !/[\u3400-\u9fff]/.test(active.moduleName)) ? ` · ${active.moduleName}` : ""
    const prefix = isInsideCourse() ? `${L("带着学", "Guided")} · ${phase}${moduleName}` : L("还没有进入具体课程", "No course is open yet")
    const html = `<i>✧</i><div><small>${escapeHtml(prefix)}</small><strong>${escapeHtml(title)}</strong></div>`
    if (contextEl.dataset.rendered !== html) {
      contextEl.dataset.rendered = html
      contextEl.innerHTML = html
    }
  }

  function escapeHtml(text) {
    return String(text || "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]))
  }

  function inlineMarkdown(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n")
    const blocks = []
    let paragraph = []
    let list = []
    let ordered = false
    let code = []
    let inCode = false

    const flushParagraph = () => {
      if (!paragraph.length) return
      blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`)
      paragraph = []
    }
    const flushList = () => {
      if (!list.length) return
      const tag = ordered ? "ol" : "ul"
      blocks.push(`<${tag}>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${tag}>`)
      list = []
      ordered = false
    }
    const flushCode = () => {
      if (!code.length) return
      blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`)
      code = []
    }

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (/^```/.test(line)) {
        if (inCode) {
          flushCode()
          inCode = false
        } else {
          flushParagraph()
          flushList()
          inCode = true
        }
        continue
      }
      if (inCode) {
        code.push(rawLine)
        continue
      }
      if (!line) {
        flushParagraph()
        flushList()
        continue
      }
      const heading = line.match(/^(#{1,3})\s+(.+)$/)
      if (heading) {
        flushParagraph()
        flushList()
        blocks.push(`<h${heading[1].length}>${inlineMarkdown(heading[2])}</h${heading[1].length}>`)
        continue
      }
      const bullet = line.match(/^[-*•]\s+(.+)$/)
      if (bullet) {
        flushParagraph()
        if (ordered) flushList()
        list.push(bullet[1])
        ordered = false
        continue
      }
      const numbered = line.match(/^\d+[.)、]\s+(.+)$/)
      if (numbered) {
        flushParagraph()
        if (list.length && !ordered) flushList()
        list.push(numbered[1])
        ordered = true
        continue
      }
      const quote = line.match(/^>\s+(.+)$/)
      if (quote) {
        flushParagraph()
        flushList()
        blocks.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`)
        continue
      }
      paragraph.push(line)
    }
    flushParagraph()
    flushList()
    flushCode()
    return `<div class="f007-md">${blocks.join("")}</div>`
  }

  function renderMessages() {
    const wasNearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80
    const previousCount = lastRenderedMessageCount
    log.innerHTML = ""
    if (!state.messages.length) {
      log.innerHTML = `<div class="f007-empty"><div class="f007-empty-card">
        <div class="f007-empty-title">${state.loading ? L("正在连接课程助教", "Connecting to the course partner") : L("等待课程上下文", "Waiting for course context")}</div>
        <div class="f007-empty-text">${escapeHtml(state.loading ? L("正在匹配当前课程 Agent。", "Matching the current course Agent.") : L("进入具体课程后，打开 Agent 会自动匹配对应助教。", "Enter a course and the correct Agent will be matched automatically."))}</div>
      </div></div>`
      lastRenderedMessageCount = 0
      return
    }
    for (const msg of state.messages) {
      const el = document.createElement("div")
      el.className = `f007-msg ${msg.role === "user" ? "user" : msg.role === "system" ? "system" : "assistant"}`
      if (msg.pending) {
        el.classList.add("pending")
        el.innerHTML = `<span class="f007-spinner" aria-hidden="true"></span><span class="f007-dots">${escapeHtml(msg.text || L("学习伙伴正在结合当前课程思考", "The learning partner is using the current course context"))}</span>`
      } else if (msg.role === "assistant") {
        el.innerHTML = markdownToHtml(msg.text || "")
      } else {
        el.textContent = msg.text || ""
      }
      log.appendChild(el)
    }
    lastRenderedMessageCount = state.messages.length
    if (wasNearBottom || state.messages.length > previousCount || state.loading) log.scrollTop = log.scrollHeight
  }

  function render() {
    // Always keep the course Agent entry visible. Other floating widgets must not hide it.
    bot.style.display = "grid"
    panel.dataset.open = String(state.open)
    bot.title = L("学习伙伴", "Learning partner")
    panel.querySelector(".f007-title").textContent = L("学习伙伴", "Learning partner")
    panel.querySelector(".f007-sub").textContent = L("模型与 Agent 导师 · 已匹配当前内容", "Course Agent · matched to the current context")
    input.placeholder = L("输入你的问题…", "Type your question…")
    send.disabled = state.loading
    renderContext()
    renderMessages()
    applyBotPosition(false)
  }

  function resetSessionForContext(active) {
    const key = contextKeyFor(active)
    if ((state.contextKey && state.contextKey !== key) || (!state.contextKey && state.sessionId)) {
      state.sessionId = ""
      state.conversationId = ""
    }
    state.contextKey = key
    saveSession()
  }

  function contextKeyFor(active) {
    return active ? `${active.trackId}:${active.routeStepId}:${active.stageId}:${locale}` : ""
  }

  async function refreshContextFromPage({ announce = false } = {}) {
    const previousKey = lastResolvedContextKey || state.contextKey
    const active = await resolveContext()
    const nextKey = contextKeyFor(active)
    lastResolvedContextKey = nextKey
    if (previousKey && nextKey && previousKey !== nextKey) {
      state.sessionId = ""
      state.conversationId = ""
      state.contextKey = nextKey
      saveSession()
      if (announce && state.open) {
        state.messages = state.messages.filter((msg) => !msg.pending)
        state.messages = state.messages.filter((msg) => msg.kind !== "context-switch")
        state.messages.push({ role: "system", kind: "context-switch", text: L(`已切换到当前课程：${active.title}`, `Switched to the current course: ${active.title}`) })
      }
    }
    renderContext()
    return active
  }

  async function ensureSession(forceNew = false) {
    const active = await refreshContextFromPage()
    resetSessionForContext(active)
    renderContext()
    if (forceNew) {
      state.sessionId = ""
      state.conversationId = ""
      saveSession()
    }
    if (state.sessionId) return state.sessionId
    const created = await api("/agent/sessions", {
      method: "POST",
      body: JSON.stringify({
        trackId: active.trackId,
        routeStepId: active.routeStepId,
        courseId: active.courseId,
        stageId: active.stageId,
        locale,
        clientSentAt: new Date().toISOString(),
      }),
    })
    state.sessionId = created.session_id
    state.conversationId = created.conversation_id
    state.contextKey = contextKeyFor(active)
    saveSession()
    if (locale === "en") state.messages.push({ role: "assistant", text: "Ask me about the current course whenever you get stuck." })
    else if (created.agent?.opening_message) state.messages.push({ role: "assistant", text: created.agent.opening_message })
    return state.sessionId
  }

  async function startAgentConversation() {
    if (state.loading) return
    state.loading = true
    render()
    try {
      state.messages = []
      await ensureSession(true)
    } catch (error) {
      state.messages = [{ role: "system", text: error?.userMessage || error?.message || L("连接 Agent 失败。", "Could not connect to the course Agent.") }]
    } finally {
      state.loading = false
      render()
    }
  }

  async function sendMessage(retriedSession = false) {
    const text = input.value.trim()
    if (!text || state.loading) return
    input.value = ""
    state.messages.push({ role: "user", text })
    const pendingMessage = { role: "assistant", text: L("学习伙伴正在结合当前课程思考", "The learning partner is using the current course context"), pending: true }
    state.messages.push(pendingMessage)
    state.loading = true
    render()
    try {
      if (!isInsideCourse()) {
        state.messages = state.messages.filter((msg) => msg !== pendingMessage)
        state.messages.push({ role: "system", text: L("先进入具体课程，再向学习伙伴提问。", "Enter a course before asking the learning partner a question.") })
        return
      }
      const sessionId = await ensureSession()
      const reply = await api(`/agent/sessions/${encodeURIComponent(sessionId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: text, locale, clientSentAt: new Date().toISOString() }),
      })
      pendingMessage.pending = false
      pendingMessage.text = reply.answer || L("已返回，但回复为空。", "The Agent returned an empty response.")
    } catch (error) {
      if (!retriedSession && (error?.code === "agent_session_not_found" || /agent_session_not_found/i.test(error?.message || ""))) {
        state.sessionId = ""
        state.conversationId = ""
        saveSession()
        state.messages.push({ role: "system", text: L("刚才的学习伙伴会话已过期，我已经为当前课程重新连接。", "The previous Agent session expired. I reconnected it to the current course.") })
        render()
        const freshSessionId = await ensureSession(true)
        const retryReply = await api(`/agent/sessions/${encodeURIComponent(freshSessionId)}/messages`, {
          method: "POST",
          body: JSON.stringify({ message: text, locale, clientSentAt: new Date().toISOString() }),
        })
        pendingMessage.pending = false
        pendingMessage.text = retryReply.answer || L("已返回，但回复为空。", "The Agent returned an empty response.")
        return
      }
      const msg = error?.userMessage || error?.message || L("Agent 请求失败。", "The Agent request failed.")
      state.messages = state.messages.filter((item) => item !== pendingMessage)
      state.messages.push({ role: "system", text: msg })
      if (/登录态|unauthorized|401|not_found|session/i.test(msg)) {
        state.sessionId = ""
        state.conversationId = ""
        saveSession()
      }
    } finally {
      state.loading = false
      render()
    }
  }

  bot.addEventListener("click", async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (dragState?.moved) return
    state.open = !state.open
    render()
    if (state.open) {
      try {
        await refreshContextFromPage()
        if (!state.messages.length && isInsideCourse()) await startAgentConversation()
        render()
      } catch { render() }
    }
  })
  close.addEventListener("click", (event) => { event.preventDefault(); state.open = false; render() })
  window.addEventListener("personalized-secure:locale-change", async (event) => {
    locale = event.detail === "en" ? "en" : "zh"
    state.messages = []
    state.sessionId = ""
    state.conversationId = ""
    state.contextKey = ""
    saveSession()
    render()
    if (state.open && isInsideCourse()) await startAgentConversation()
  })
  send.addEventListener("click", (event) => { event.preventDefault(); void sendMessage() })
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  })

  function beginDrag(event, target) {
    if (event.button !== undefined && event.button !== 0) return
    const pointer = event.touches?.[0] || event
    const origin = target === "panel"
      ? { x: panel.getBoundingClientRect().left, y: panel.getBoundingClientRect().top }
      : { x: botPosition.x, y: botPosition.y }
    dragState = {
      target,
      startX: pointer.clientX,
      startY: pointer.clientY,
      originX: origin.x,
      originY: origin.y,
      moved: false,
    }
    event.preventDefault()
  }

  function moveDrag(event) {
    if (!dragState) return
    const pointer = event.touches?.[0] || event
    const dx = pointer.clientX - dragState.startX
    const dy = pointer.clientY - dragState.startY
    if (Math.abs(dx) + Math.abs(dy) > 4) dragState.moved = true
    if (dragState.target === "panel") {
      const width = panel.offsetWidth || Math.min(420, window.innerWidth - 32)
      const height = panel.offsetHeight || Math.min(620, window.innerHeight - 126)
      panel.style.left = `${clamp(dragState.originX + dx, 16, window.innerWidth - width - 16)}px`
      panel.style.top = `${clamp(dragState.originY + dy, 16, window.innerHeight - height - 16)}px`
    } else {
      botPosition = {
        x: clamp(dragState.originX + dx, 16, window.innerWidth - 74),
        y: clamp(dragState.originY + dy, 16, window.innerHeight - 74),
      }
      applyBotPosition(false)
    }
  }

  function endDrag() {
    if (!dragState) return
    if (dragState.target === "bot") localStorage.setItem(POSITION_KEY, JSON.stringify(botPosition))
    const moved = dragState.moved
    dragState = moved ? { moved: true } : null
    if (moved) window.setTimeout(() => { if (dragState?.moved) dragState = null }, 0)
  }

  bot.addEventListener("pointerdown", (event) => beginDrag(event, "bot"))
  head.addEventListener("pointerdown", (event) => {
    if (event.target?.closest?.(".f007-close")) return
    beginDrag(event, "panel")
  })
  window.addEventListener("pointermove", moveDrag, { passive: false })
  window.addEventListener("pointerup", endDrag)
  window.addEventListener("resize", () => applyBotPosition(true))

  let contextRenderTimer = 0
  const observer = new MutationObserver(() => {
    syncWithUnifiedAgent()
    if (!state.open) return
    window.clearTimeout(contextRenderTimer)
    contextRenderTimer = window.setTimeout(() => {
      void refreshContextFromPage({ announce: true }).catch(() => renderContext()).finally(() => render())
    }, 350)
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })

  function notifyRouteChange() {
    if (!state.open) return
    window.clearTimeout(contextRenderTimer)
    contextRenderTimer = window.setTimeout(() => {
      void refreshContextFromPage({ announce: true }).catch(() => renderContext()).finally(() => render())
    }, 450)
  }
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method]
    history[method] = function (...args) {
      const result = original.apply(this, args)
      window.dispatchEvent(new Event("f007-route-change"))
      return result
    }
  }
  window.addEventListener("popstate", notifyRouteChange)
  window.addEventListener("f007-route-change", notifyRouteChange)
  window.addEventListener("personalized-secure:course-context-change", notifyRouteChange)

  render()
  syncWithUnifiedAgent()
  window.setTimeout(() => void verifyAuthOnLoad(), 300)
})()
