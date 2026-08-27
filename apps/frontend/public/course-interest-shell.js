(function () {
  "use strict"

  var previous = window.__CI_SHELL__
  if (previous && typeof previous.destroy === "function") {
    try { previous.destroy() } catch (error) { /* replace only our previous injection */ }
  }

  var API = "/personalized-secure-api/v1"
  var LOCALE_KEY = "personalized-secure:locale:v1"
  var LEGACY_RECOMMENDATION_KEY = "personalized-secure:last-career-recommendation:v1"
  var RECOMMENDATION_KEY_PREFIX = "personalized-secure:last-career-recommendation:v2:"
  var CAREER_EDIT_EVENT = "personalized-secure:career-edit-requested"
  var CAREER_EDIT_INTENT_PREFIX = "personalized-secure:career-edit-intent:v1:"
  var CAREER_EDIT_INTENT_TTL = 5 * 60 * 1000
  var AUTH_EVENT = "aix-auth-changed"
  var ROOT_ID = "ci-shell-career-step"
  var STYLE_ID = "ci-shell-career-style"
  var observer = null
  var observedRoot = null
  var mountTimer = null
  var autoSelectTimer = null
  var mountAttempts = 0
  var authListenersInstalled = false
  var requestController = null
  var bootstrapGeneration = 0
  var state = freshState()

  function freshState() {
    return {
      view: null,
      authUserId: null,
      currentCareerId: null,
      careerStatus: "idle",
      careerStatusError: null,
      careerRequirementReason: null,
      catalogStatus: "idle",
      categories: [],
      competencies: {},
      selectedCareerId: null,
      confirmedCareerId: null,
      recommendedCourseIds: [],
      recommendationResult: null,
      confirmedRecommendation: null,
      nativeFlowActive: false,
      applyRecommendationOnNativeEntry: false,
      autoSelectAttempts: 0,
      autoSelectedCourseIds: {},
      search: "",
      categoryId: "all",
      busy: false,
      status: null,
    }
  }

  var messages = {
    zh: {
      eyebrow: "步骤 1",
      title: "选择未来职业",
      help: "先了解职业方向与课程建议，再到原平台选择兴趣并生成学习路径。职业选择不是必填项。",
      search: "搜索职业",
      all: "全部分类",
      selected: "已选择",
      viewRecommendation: "查看课程推荐",
      skip: "跳过，继续选择兴趣",
      loading: "正在读取职业目录…",
      loadFailed: "职业目录加载失败，请稍后重试。",
      retry: "重试",
      chooseCareer: "请先选择一个职业。",
      recommendationTitle: "职业课程推荐",
      recommendationHelp: "推荐仅供参考，不会保存职业、修改兴趣或创建路径。",
      noRecommendation: "当前没有足够匹配的可用课程。你仍可以使用原平台选择兴趣和课程。",
      rank: "推荐排名",
      score: "综合分",
      careerMatch: "主要能力匹配：",
      coverageGain: "补充能力覆盖：",
      prerequisites: "原生路径会自动包含必要前置课程",
      useRecommendation: "使用该职业及推荐",
      backCareer: "返回修改职业",
      savingCareer: "正在保存职业…",
      confirmed: "职业偏好已保存。请在原平台继续选择兴趣与课程。",
      confirmedTitle: "已确认的职业推荐",
      changeCareer: "更换职业",
      continueNative: "继续选择兴趣与课程",
      nativeStep: "步骤 2：在原平台选择兴趣与课程",
      nativeHelp: "最终课程调整、画像保存和学习路径创建均由下方原生流程完成。",
      highlighted: "职业推荐",
      available: "可加入路径",
      mastered: "已掌握",
      masteredOnly: "与你选择的职业匹配的课程均已掌握。你仍可查看对应关系，或返回选择其他方向。",
      unauthorized: "登录状态已失效，请重新登录。",
      network: "网络请求失败，请稍后重试。",
      requestFailed: "请求失败，请稍后重试。",
      careerStatusTitle: "无法读取职业状态",
      careerStatusHelp: "暂时无法确认是否已经选择职业。请重试，或先进入兴趣选择。",
      continueWithoutCareerStatus: "暂时进入兴趣选择",
      unavailableCareer: "你之前选择的职业当前已不可用，请重新选择职业。",
      editTitle: "修改职业",
      editHelp: "选择新的职业方向，查看推荐后再决定是否保存。取消不会改变当前职业。",
      currentCareer: "当前职业：",
      currentCareerBadge: "当前职业",
      cancel: "取消",
      selectionLimit: "你已经选择了 5 个兴趣。如需加入新的职业推荐，请先取消一个现有选择。",
    },
    en: {
      eyebrow: "Step 1",
      title: "Choose a future career",
      help: "Review a career direction and course suggestions, then use the native platform to choose interests and create a learning path. Career selection is optional.",
      search: "Search careers",
      all: "All categories",
      selected: "Selected",
      viewRecommendation: "View course recommendations",
      skip: "Skip and continue to interests",
      loading: "Loading career catalog…",
      loadFailed: "Could not load the career catalog. Try again later.",
      retry: "Retry",
      chooseCareer: "Choose a career first.",
      recommendationTitle: "Career course recommendations",
      recommendationHelp: "Recommendations are advisory. Viewing them does not save a career, change interests, or create a path.",
      noRecommendation: "No sufficiently matched course is currently available. You can still use the native interest and course flow.",
      rank: "Rank",
      score: "Score",
      careerMatch: "Primary competency match: ",
      coverageGain: "Adds competency coverage: ",
      prerequisites: "The native path will include required prerequisites",
      useRecommendation: "Use this career and recommendation",
      backCareer: "Change career",
      savingCareer: "Saving career…",
      confirmed: "Career preference saved. Continue with the platform's native interest and course flow.",
      confirmedTitle: "Confirmed career recommendations",
      changeCareer: "Change career",
      continueNative: "Continue to interests and courses",
      nativeStep: "Step 2: Choose interests and courses in the platform",
      nativeHelp: "Final course changes, profile saving, and learning-path creation remain in the native flow below.",
      highlighted: "Career recommendation",
      available: "Available for this route",
      mastered: "Mastered",
      masteredOnly: "All courses matched to this career are already mastered. You can still review the mapping or choose another direction.",
      unauthorized: "Your session has expired. Sign in again.",
      network: "Network request failed. Try again later.",
      requestFailed: "Request failed. Try again later.",
      careerStatusTitle: "Could not load career status",
      careerStatusHelp: "We could not confirm whether you already selected a career. Retry, or continue to interests for now.",
      continueWithoutCareerStatus: "Continue to interests for now",
      unavailableCareer: "Your previously selected career is no longer available. Please choose another career.",
      editTitle: "Change career",
      editHelp: "Choose a new direction and review its recommendations before saving. Cancel keeps your current career.",
      currentCareer: "Current career: ",
      currentCareerBadge: "Current career",
      cancel: "Cancel",
      selectionLimit: "You already selected 5 interests. Remove one existing selection before adding another career recommendation.",
    },
  }

  function lang() { return localStorage.getItem(LOCALE_KEY) === "en" ? "en" : "zh" }
  function t(key) { return messages[lang()][key] || key }
  function token() { return localStorage.getItem("aix_token") || "" }
  function currentAuthUserId() {
    try {
      var user = JSON.parse(localStorage.getItem("aix_user") || "null")
      var id = user && (user.id ?? user.user_id)
      return id === null || id === undefined || id === "" ? null : String(id)
    } catch (error) { return null }
  }
  function recommendationKey(userId) { return userId ? RECOMMENDATION_KEY_PREFIX + userId : null }
  function careerEditIntentKey(userId) { return userId ? CAREER_EDIT_INTENT_PREFIX + userId : null }
  function clearCareerEditIntent(userId) {
    var key = careerEditIntentKey(userId)
    if (!key) return
    try { window.sessionStorage.removeItem(key) } catch (error) {}
  }
  function consumeCareerEditIntent(userId) {
    var key = careerEditIntentKey(userId)
    if (!key || currentAuthUserId() !== String(userId)) return false
    var saved = null
    try {
      saved = JSON.parse(window.sessionStorage.getItem(key) || "null")
      window.sessionStorage.removeItem(key)
    } catch (error) {
      try { window.sessionStorage.removeItem(key) } catch (ignored) {}
      return false
    }
    var requestedAt = Number(saved && saved.requestedAt)
    return Boolean(saved && String(saved.userId) === String(userId) && Number.isFinite(requestedAt) && requestedAt <= Date.now() + 5000 && Date.now() - requestedAt <= CAREER_EDIT_INTENT_TTL)
  }
  function clearAuth() {
    try {
      window.localStorage.removeItem("aix_token")
      window.localStorage.removeItem("aix_user")
    } catch (error) {}
    window.dispatchEvent(new CustomEvent(AUTH_EVENT))
  }
  function el(tag, className, text) {
    var node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = String(text)
    return node
  }
  function button(text, className, onClick) {
    var node = el("button", className, text)
    node.type = "button"
    node.addEventListener("click", onClick)
    return node
  }
  function localized(value) {
    return value && value[lang()] ? value[lang()] : value && value.zh ? value.zh : ""
  }
  function normalizeText(value) { return String(value || "").replace(/\s+/g, " ").trim() }
  function loginSurfacePresent() {
    return !!document.querySelector(".platform-auth-tabs,form input[name='username'][autocomplete='username']")
  }
  function authenticatedSurfaceReady() {
    if (!token() || loginSurfacePresent()) return false
    var main = document.querySelector("main")
    return !!(document.querySelector(".platform-account-area,.learning-space") || (main && !main.classList.contains("platform-session-loading")))
  }

  async function apiFetch(path, options) {
    options = options || {}
    var auth = token()
    if (!auth) throw apiError("unauthorized", 401)
    var headers = Object.assign({ Authorization: "Bearer " + auth }, options.headers || {})
    if (options.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json"
    var response
    try {
      response = await fetch(API + path, Object.assign({}, options, { headers: headers, signal: options.signal }))
    } catch (error) {
      if (error && error.name === "AbortError") throw error
      throw apiError("network", 0)
    }
    var payload = null
    var contentType = response.headers.get("content-type") || ""
    if (contentType.indexOf("application/json") >= 0) {
      try { payload = await response.json() } catch (error) { payload = null }
    }
    if (!response.ok) {
      var code = payload && payload.error ? payload.error : "request_failed"
      throw apiError(code, response.status, payload)
    }
    return payload
  }
  function apiError(code, status, payload) {
    var error = new Error(code)
    error.code = code
    error.status = status
    error.payload = payload
    return error
  }
  function friendly(error) {
    if (error && error.status === 401) return t("unauthorized")
    if (error && error.code === "network") return t("network")
    return t("requestFailed") + (error && error.code ? " (" + error.code + ")" : "")
  }

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return
    var style = el("style")
    style.id = STYLE_ID
    style.textContent = "#ci-shell-career-step{box-sizing:border-box;width:min(1180px,calc(100% - 40px));margin:24px auto 18px;padding:22px;border:1px solid rgba(150,169,211,.18);border-radius:22px;background:radial-gradient(circle at 8% 0,rgba(50,206,226,.12),transparent 34%),rgba(12,17,31,.82);box-shadow:0 24px 80px rgba(0,0,0,.26);color:#f4f7ff;font-family:Inter,system-ui,sans-serif}#ci-shell-career-step *{box-sizing:border-box}.ci-shell-career-heading-row{display:flex;gap:16px;align-items:flex-start}.ci-shell-career-eyebrow{color:#7fe7f4;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.ci-shell-career-title{margin:4px 0 0;font-size:clamp(22px,3vw,34px);line-height:1.15;font-weight:850}.ci-shell-career-help{max-width:760px;margin:8px 0 0;color:#a9b5d0;font-size:14px;line-height:1.65}.ci-shell-career-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0 14px}.ci-shell-career-input,.ci-shell-career-select{min-height:42px;border:1px solid rgba(150,169,211,.22);border-radius:12px;background:rgba(8,12,24,.78);color:#f4f7ff;padding:10px 12px}.ci-shell-career-input{flex:1;min-width:220px}.ci-shell-career-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:11px}.ci-shell-career-card{min-height:112px;border:1px solid rgba(150,169,211,.18);border-radius:16px;background:rgba(18,23,40,.76);color:#f4f7ff;padding:14px;text-align:left;cursor:pointer;transition:border-color .16s ease,background .16s ease,transform .16s ease}.ci-shell-career-card:hover{border-color:rgba(50,206,226,.55);transform:translateY(-1px)}.ci-shell-career-card[aria-pressed=true]{border-color:rgba(199,255,104,.8);background:radial-gradient(circle at 20% 0,rgba(199,255,104,.14),transparent 48%),rgba(28,39,35,.9);box-shadow:0 0 0 1px rgba(199,255,104,.08)}.ci-shell-career-card-title{font-size:15px;font-weight:760;line-height:1.4}.ci-shell-career-card-meta{margin-top:6px;color:#a9b5d0;font-size:12px;line-height:1.55}.ci-shell-career-selected{display:inline-flex;margin-top:8px;border-radius:999px;background:rgba(199,255,104,.12);color:#c7ff68;padding:3px 8px;font-size:10px;font-weight:800}.ci-shell-career-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:18px}.ci-shell-career-spacer{flex:1}.ci-shell-career-primary,.ci-shell-career-secondary{min-height:38px;border-radius:14px;padding:0 17px;font-size:14px;font-weight:650;cursor:pointer}.ci-shell-career-primary{border:1px solid transparent;background:#c7ff68;color:#0a1015}.ci-shell-career-secondary{border:1px solid rgba(150,169,211,.24);background:rgba(255,255,255,.04);color:#f4f7ff}.ci-shell-career-primary:disabled,.ci-shell-career-secondary:disabled{opacity:.5;cursor:not-allowed}.ci-shell-career-status{margin-top:14px;border-radius:13px;padding:11px 13px;font-size:13px;line-height:1.55}.ci-shell-career-status-error{border:1px solid rgba(248,113,113,.34);background:rgba(127,29,29,.2);color:#fecaca}.ci-shell-career-status-success{border:1px solid rgba(199,255,104,.34);background:rgba(52,72,24,.24);color:#e7ffc4}.ci-shell-career-status-info{border:1px solid rgba(50,206,226,.3);background:rgba(13,70,80,.22);color:#c9f8ff}.ci-shell-career-recommendations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:16px}.ci-shell-career-recommendation{border:1px solid rgba(255,120,189,.18);border-radius:13px;background:radial-gradient(circle at 98% 0,rgba(255,120,189,.08),transparent 38%),rgba(18,23,40,.76);padding:14px}.ci-shell-career-recommendation-title{font-weight:760;line-height:1.4}.ci-shell-career-recommendation-meta{margin-top:6px;color:#a9b5d0;font-size:12px;line-height:1.5}.ci-shell-career-reasons{margin:8px 0 0;padding-left:18px;color:#cbd5e9;font-size:12px;line-height:1.55}.ci-shell-career-native-step{margin-top:20px;padding-top:16px;border-top:1px solid rgba(150,169,211,.16);font-weight:760}.ci-shell-career-native-help{margin-top:5px;color:#a9b5d0;font-size:12px;font-weight:400}.ci-shell-career-native-mark{display:flex;align-items:center;gap:6px;margin:0 12px 12px;padding:7px 9px;border:1px solid rgba(199,255,104,.32);border-radius:10px;background:rgba(199,255,104,.09);color:#dfffaa;font:700 11px/1.35 Inter,system-ui,sans-serif}.ci-shell-career-native-reason{color:#c8d5ba;font-weight:500}.ci-shell-career-loading{padding:18px 0;color:#a9b5d0;font-size:13px}@media(max-width:760px){#ci-shell-career-step{width:calc(100% - 24px);margin:14px auto;padding:16px;border-radius:17px}.ci-shell-career-grid,.ci-shell-career-recommendations{grid-template-columns:1fr}.ci-shell-career-actions{align-items:stretch}.ci-shell-career-primary,.ci-shell-career-secondary{width:100%}.ci-shell-career-spacer{display:none}}"
    style.textContent = style.textContent.replace("#ci-shell-career-step{", "#ci-shell-career-step{max-height:calc(100dvh - 84px);overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;")
    style.textContent += "\nsection.interest-field .interest-bubble{animation:none!important;transition:border-color .16s ease,background .16s ease,box-shadow .16s ease!important;}"
    document.head.appendChild(style)
  }

  function interestField() { return document.querySelector("section.interest-field") }
  function observationRoot() { return document.querySelector("main.learning-space") || document.querySelector("main") }
  function removeLegacyParallelUi() {
    var entry = document.getElementById("ci-shell-entry")
    if (entry) entry.remove()
    var overlay = document.getElementById("ci-shell-modal")
    if (overlay) overlay.remove()
  }
  function removeRoot() {
    var root = document.getElementById(ROOT_ID)
    if (root) root.remove()
  }
  function resetNativeViewport() {
    var main = observationRoot()
    if (main && main.scrollTop !== 0) main.scrollTop = 0
  }
  function removeNativeMarks() {
    document.querySelectorAll(".ci-shell-career-native-mark").forEach(function (node) { node.remove() })
    document.querySelectorAll(".ci-shell-career-selection-limit").forEach(function (node) { node.remove() })
  }
  function cancelMount() {
    if (mountTimer) { clearTimeout(mountTimer); mountTimer = null }
    mountAttempts = 0
  }
  function cancelAutoSelect() {
    if (autoSelectTimer) { clearTimeout(autoSelectTimer); autoSelectTimer = null }
    state.autoSelectAttempts = 0
  }
  function scheduleMount() {
    if (!token() || mountTimer || mountAttempts >= 12) return
    mountTimer = setTimeout(function () {
      mountTimer = null
      mountAttempts += 1
      ensureMounted()
      startObserver()
      if (token() && mountAttempts < 12) scheduleMount()
    }, 250 + mountAttempts * 100)
  }
  function ensureMounted() {
    removeLegacyParallelUi()
    if (!authenticatedSurfaceReady()) {
      removeRoot()
      removeNativeMarks()
      return
    }
    installStyles()
    if (state.careerStatus === "loading" || state.careerStatus === "idle") {
      removeRoot()
      removeNativeMarks()
      return
    }
    var field = interestField()
    if (!field || state.careerStatus === "native-discover" || state.nativeFlowActive) {
      removeRoot()
      applyNativeRecommendationIfEnabled()
      return
    }
    var anchor = field
    if (!anchor || !anchor.parentElement) {
      if (field) scheduleMount()
      applyNativeRecommendationMarks()
      return
    }
    var root = document.getElementById(ROOT_ID)
    var needsRender = !root
    if (!root) root = el("section")
    root.id = ROOT_ID
    root.setAttribute("aria-labelledby", "ci-shell-career-heading")
    if (root.parentElement !== anchor.parentElement || root.nextElementSibling !== anchor) {
      anchor.parentElement.insertBefore(root, anchor)
      needsRender = true
    }
    if (needsRender) render()
    applyNativeRecommendationMarks()
  }
  function startObserver() {
    var root = observationRoot()
    if (!root) return
    if (observer && observedRoot === root) return
    stopObserver()
    observedRoot = root
    observer = new MutationObserver(function (mutations) {
      var injected = document.getElementById(ROOT_ID)
      var externalChange = mutations.some(function (mutation) {
        return !injected || (mutation.target !== injected && !injected.contains(mutation.target))
      })
      if (!externalChange) return
      ensureMounted()
      applyNativeRecommendationIfEnabled()
    })
    observer.observe(root, { childList: true, subtree: true })
  }
  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null }
    observedRoot = null
  }

  function handleAuthChange(event) {
    if (event && event.type === "storage" && event.key && event.key !== "aix_token" && event.key !== "aix_user" && event.key !== LOCALE_KEY) return
    if (event && event.type === "storage" && event.key === LOCALE_KEY) {
      handleLocaleChange()
      return
    }
    var previousUserId = state.authUserId
    bootstrapGeneration += 1
    var generation = bootstrapGeneration
    if (requestController) { requestController.abort(); requestController = null }
    cancelAutoSelect()
    removeRoot()
    removeNativeMarks()
    removeLegacyParallelUi()
    stopObserver()
    cancelMount()
    state = freshState()
    var nextUserId = token() ? currentAuthUserId() : null
    if (previousUserId && previousUserId !== nextUserId) clearCareerEditIntent(previousUserId)
    try { window.localStorage.removeItem(LEGACY_RECOMMENDATION_KEY) } catch (error) {}
    if (!token()) {
      return
    }
    state.authUserId = nextUserId
    state.careerStatus = "loading"
    ensureMounted()
    startObserver()
    scheduleMount()
    bootstrapCareerStatus(generation, state.authUserId)
  }
  function installAuthListeners() {
    if (authListenersInstalled) return
    window.addEventListener(AUTH_EVENT, handleAuthChange)
    window.addEventListener("storage", handleAuthChange)
    window.addEventListener("personalized-secure:locale-change", handleLocaleChange)
    window.addEventListener(CAREER_EDIT_EVENT, handleCareerEditRequested)
    authListenersInstalled = true
  }
  function removeAuthListeners() {
    if (!authListenersInstalled) return
    window.removeEventListener(AUTH_EVENT, handleAuthChange)
    window.removeEventListener("storage", handleAuthChange)
    window.removeEventListener("personalized-secure:locale-change", handleLocaleChange)
    window.removeEventListener(CAREER_EDIT_EVENT, handleCareerEditRequested)
    authListenersInstalled = false
  }
  function handleLocaleChange() {
    render()
    applyNativeRecommendationIfEnabled()
  }

  async function bootstrapCareerStatus(generation, userId) {
    if (!token() || !userId || generation !== bootstrapGeneration) {
      if (generation === bootstrapGeneration && token()) {
        state.careerStatus = "error"
        state.careerStatusError = apiError("authenticated_user_missing", 0)
        ensureMounted()
        render()
      }
      return
    }
    var controller = new AbortController()
    var timedOut = false
    var timeout = setTimeout(function () { timedOut = true; controller.abort() }, 8000)
    requestController = controller
    var loadCatalog = false
    try {
      var data = await apiFetch("/profile/career-preference", { signal: controller.signal })
      if (generation !== bootstrapGeneration || state.authUserId !== userId || currentAuthUserId() !== userId) return
      var primaryCareerId = data && typeof data.primaryCareerId === "string" && data.primaryCareerId ? data.primaryCareerId : null
      if (data && data.status === "selected" && primaryCareerId) {
        state.currentCareerId = primaryCareerId
        state.careerStatusError = null
        if (consumeCareerEditIntent(userId)) {
          state.careerStatus = "editing"
          state.selectedCareerId = primaryCareerId
          state.view = "career-selection"
          state.nativeFlowActive = false
          loadCatalog = true
        } else {
          state.careerStatus = "native-discover"
          continueToNative(false)
        }
      } else if (data && data.status === "not_selected" && data.primaryCareerId === null) {
        clearCareerEditIntent(userId)
        state.currentCareerId = null
        state.careerStatus = "required"
        state.careerStatusError = null
        state.careerRequirementReason = null
        state.view = "career-selection"
        loadCatalog = true
      } else if (data && data.status === "unavailable" && primaryCareerId) {
        clearCareerEditIntent(userId)
        state.currentCareerId = primaryCareerId
        state.careerStatus = "required"
        state.careerStatusError = null
        state.careerRequirementReason = "unavailable"
        state.view = "career-selection"
        loadCatalog = true
      } else {
        throw apiError("invalid_career_status_response", 0, data)
      }
    } catch (error) {
      if (generation !== bootstrapGeneration || state.authUserId !== userId || currentAuthUserId() !== userId) return
      if (error && error.status === 401) {
        clearAuth()
        return
      }
      if (error && error.name === "AbortError" && !timedOut) return
      state.careerStatus = "error"
      state.careerStatusError = timedOut ? apiError("career_status_timeout", 0) : error
      state.status = { kind: "error", text: friendly(state.careerStatusError) }
    } finally {
      clearTimeout(timeout)
      if (requestController === controller) requestController = null
    }
    if (generation !== bootstrapGeneration || state.authUserId !== userId || currentAuthUserId() !== userId) return
    ensureMounted()
    render()
    if (loadCatalog && state.catalogStatus === "idle") loadCareers()
  }

  function retryCareerStatus() {
    if (!token() || !state.authUserId) return clearAuth()
    if (requestController) { requestController.abort(); requestController = null }
    bootstrapGeneration += 1
    state.careerStatus = "loading"
    state.careerStatusError = null
    state.status = null
    removeRoot()
    bootstrapCareerStatus(bootstrapGeneration, state.authUserId)
  }

  function resetCareerChoiceView() {
    state.recommendationResult = null
    state.recommendedCourseIds = []
    state.confirmedRecommendation = null
    state.autoSelectedCourseIds = {}
    state.autoSelectAttempts = 0
    state.view = "career-selection"
    state.status = null
  }

  function enterCareerEditing() {
    if (!token() || !state.authUserId || !state.currentCareerId) return
    cancelAutoSelect()
    removeNativeMarks()
    state.careerStatus = "editing"
    state.nativeFlowActive = false
    state.applyRecommendationOnNativeEntry = false
    state.selectedCareerId = state.currentCareerId
    resetCareerChoiceView()
    ensureMounted()
    startObserver()
    scheduleMount()
    if (state.catalogStatus === "idle") loadCareers()
    else render()
  }

  function handleCareerEditRequested(event) {
    var requestedUserId = event && event.detail && event.detail.userId
    if (!requestedUserId || String(requestedUserId) !== String(state.authUserId) || currentAuthUserId() !== String(state.authUserId)) return
    if (state.careerStatus !== "native-discover" || !state.currentCareerId) return
    enterCareerEditing()
  }

  function cancelCareerEditing() {
    if (state.careerStatus !== "editing") return
    state.selectedCareerId = state.currentCareerId
    resetCareerChoiceView()
    continueToNative(false)
  }

  async function loadCareers() {
    if (requestController) return
    state.catalogStatus = "loading"
    state.status = null
    render()
    requestController = new AbortController()
    try {
      var data = await apiFetch("/careers", { signal: requestController.signal })
      state.categories = data.categories || []
      state.competencies = Object.fromEntries((data.competencies || []).map(function (item) { return [item.id, item] }))
      state.catalogStatus = "ready"
    } catch (error) {
      if (error.name === "AbortError") return
      state.catalogStatus = "error"
      state.status = { kind: "error", text: friendly(error) }
    } finally {
      requestController = null
      ensureMounted()
      render()
    }
  }

  function allCareers() {
    return state.categories.reduce(function (list, category) {
      return list.concat((category.careers || []).map(function (career) {
        return Object.assign({ categoryId: category.id, categoryName: category.name }, career)
      }))
    }, [])
  }
  function selectedCareer() {
    return allCareers().find(function (career) { return career.id === state.selectedCareerId }) || null
  }
  function currentCareer() {
    return allCareers().find(function (career) { return career.id === state.currentCareerId }) || null
  }
  function competencyName(id) {
    var item = state.competencies[id]
    return item ? localized(item.name) : id
  }
  function reasonText(reason) {
    if (!reason) return ""
    if (reason.type === "career-match") return t("careerMatch") + competencyName(reason.competencyId)
    if (reason.type === "coverage-gain") return t("coverageGain") + competencyName(reason.competencyId)
    if (reason.type === "prerequisites-included") return t("prerequisites")
    return ""
  }
  function heading(root, title, help) {
    var row = el("div", "ci-shell-career-heading-row")
    var copy = el("div")
    copy.appendChild(el("div", "ci-shell-career-eyebrow", t("eyebrow")))
    var titleNode = el("h2", "ci-shell-career-title", title)
    titleNode.id = "ci-shell-career-heading"
    copy.appendChild(titleNode)
    copy.appendChild(el("p", "ci-shell-career-help", help))
    row.appendChild(copy)
    root.appendChild(row)
  }
  function status(root) {
    if (!state.status) return
    root.appendChild(el("div", "ci-shell-career-status ci-shell-career-status-" + state.status.kind, state.status.text))
  }
  function nativeStep(root) {
    var step = el("div", "ci-shell-career-native-step", t("nativeStep"))
    step.appendChild(el("div", "ci-shell-career-native-help", t("nativeHelp")))
    root.appendChild(step)
  }

  function render() {
    var root = document.getElementById(ROOT_ID)
    if (!root) return
    root.textContent = ""
    if (state.careerStatus === "error") renderCareerStatusError(root)
    else if (state.view === "career-recommendation") renderRecommendation(root, false)
    else if (state.view === "career-confirmed") renderRecommendation(root, true)
    else renderCareerSelection(root)
  }
  function renderCareerStatusError(root) {
    heading(root, t("careerStatusTitle"), t("careerStatusHelp"))
    status(root)
    var actions = el("div", "ci-shell-career-actions")
    actions.appendChild(button(t("retry"), "ci-shell-career-secondary", retryCareerStatus))
    actions.appendChild(el("div", "ci-shell-career-spacer"))
    actions.appendChild(button(t("continueWithoutCareerStatus"), "ci-shell-career-primary", function () { continueToNative(false) }))
    root.appendChild(actions)
  }
  function renderCareerSelection(root) {
    var editing = state.careerStatus === "editing"
    heading(root, editing ? t("editTitle") : t("title"), editing ? t("editHelp") : t("help"))
    if (state.careerRequirementReason === "unavailable") {
      root.appendChild(el("div", "ci-shell-career-status ci-shell-career-status-info", t("unavailableCareer")))
    }
    if (state.catalogStatus === "loading" || state.catalogStatus === "idle") {
      root.appendChild(el("div", "ci-shell-career-loading", t("loading")))
      nativeStep(root)
      return
    }
    if (state.catalogStatus === "error") {
      status(root)
      var retryActions = el("div", "ci-shell-career-actions")
      retryActions.appendChild(button(t("retry"), "ci-shell-career-secondary", function () {
        state.catalogStatus = "idle"
        loadCareers()
      }))
      retryActions.appendChild(button(editing ? t("cancel") : t("skip"), "ci-shell-career-primary", editing ? cancelCareerEditing : continueToNative))
      root.appendChild(retryActions)
      nativeStep(root)
      return
    }
    var toolbar = el("div", "ci-shell-career-toolbar")
    var search = el("input", "ci-shell-career-input")
    search.type = "search"
    search.placeholder = t("search")
    search.value = state.search
    search.addEventListener("input", function () { state.search = search.value; render() })
    toolbar.appendChild(search)
    var category = el("select", "ci-shell-career-select")
    var all = el("option", null, t("all")); all.value = "all"; category.appendChild(all)
    state.categories.forEach(function (item) {
      var option = el("option", null, localized(item.name)); option.value = item.id; category.appendChild(option)
    })
    category.value = state.categoryId
    category.addEventListener("change", function () { state.categoryId = category.value; render() })
    toolbar.appendChild(category)
    root.appendChild(toolbar)

    var savedCareer = editing ? currentCareer() : null
    if (savedCareer) root.appendChild(el("div", "ci-shell-career-status ci-shell-career-status-info", t("currentCareer") + localized(savedCareer.name)))

    var query = normalizeText(state.search).toLowerCase()
    var careers = allCareers().filter(function (career) {
      if (state.categoryId !== "all" && career.categoryId !== state.categoryId) return false
      if (!query) return true
      return (localized(career.name) + " " + localized(career.description)).toLowerCase().indexOf(query) >= 0
    })
    var grid = el("div", "ci-shell-career-grid")
    careers.forEach(function (career) {
      var card = button("", "ci-shell-career-card", function () {
        state.selectedCareerId = career.id
        state.status = null
        render()
      })
      card.setAttribute("aria-pressed", String(state.selectedCareerId === career.id))
      card.appendChild(el("div", "ci-shell-career-card-title", localized(career.name)))
      card.appendChild(el("div", "ci-shell-career-card-meta", localized(career.description)))
      if (editing && state.currentCareerId === career.id) card.appendChild(el("span", "ci-shell-career-selected", t("currentCareerBadge")))
      else if (state.selectedCareerId === career.id) card.appendChild(el("span", "ci-shell-career-selected", t("selected")))
      grid.appendChild(card)
    })
    root.appendChild(grid)
    status(root)
    var actions = el("div", "ci-shell-career-actions")
    actions.appendChild(button(editing ? t("cancel") : t("skip"), "ci-shell-career-secondary", editing ? cancelCareerEditing : continueToNative))
    actions.appendChild(el("div", "ci-shell-career-spacer"))
    var recommend = button(t("viewRecommendation"), "ci-shell-career-primary", viewRecommendation)
    recommend.disabled = !state.selectedCareerId || state.busy
    actions.appendChild(recommend)
    root.appendChild(actions)
    nativeStep(root)
  }

  async function viewRecommendation() {
    if (!state.selectedCareerId) {
      state.status = { kind: "error", text: t("chooseCareer") }
      render()
      return
    }
    state.busy = true
    state.status = { kind: "info", text: t("loading") }
    render()
    requestController = new AbortController()
    try {
      var result = await apiFetch("/course-recommendations/by-career", {
        method: "POST",
        body: JSON.stringify({ careerId: state.selectedCareerId, limit: 5 }),
        signal: requestController.signal,
      })
      state.recommendationResult = result
      state.recommendedCourseIds = (result.recommendedCourses || []).map(function (item) { return item.courseId })
      state.autoSelectedCourseIds = {}
      state.autoSelectAttempts = 0
      state.view = "career-recommendation"
      state.status = null
    } catch (error) {
      if (error.name === "AbortError") return
      state.status = { kind: "error", text: friendly(error) }
    } finally {
      requestController = null
      state.busy = false
      if (!state.nativeFlowActive) render()
    }
  }

  function recommendationCards(root, recommendation) {
    var items = recommendation && recommendation.recommendedCourses || []
    if (!items.length) {
      root.appendChild(el("div", "ci-shell-career-status ci-shell-career-status-info", t("noRecommendation")))
      return
    }
    if (!items.some(function (item) { return item.completionStatus !== "MASTERED" })) {
      root.appendChild(el("div", "ci-shell-career-status ci-shell-career-status-info", t("masteredOnly")))
    }
    var grid = el("div", "ci-shell-career-recommendations")
    items.forEach(function (item) {
      var card = el("article", "ci-shell-career-recommendation")
      var courseTitle = item.course && localized(item.course.titleLocalized) || item.course && item.course.title || item.courseId
      var moduleTitle = item.course && localized(item.course.moduleNameLocalized) || item.course && item.course.moduleName || ""
      card.appendChild(el("div", "ci-shell-career-recommendation-title", courseTitle))
      card.appendChild(el("div", "ci-shell-career-recommendation-meta", moduleTitle + " · " + t("rank") + " " + item.rank + " · " + t("score") + " " + Number(item.score || 0).toFixed(3)))
      card.appendChild(el("span", "ci-shell-career-selected", item.completionStatus === "MASTERED" ? t("mastered") : t("available")))
      var reasons = el("ul", "ci-shell-career-reasons")
      ;(item.reasons || []).slice(0, 4).forEach(function (reason) {
        var text = reasonText(reason)
        if (text) reasons.appendChild(el("li", null, text))
      })
      card.appendChild(reasons)
      grid.appendChild(card)
    })
    root.appendChild(grid)
  }
  function renderRecommendation(root, confirmed) {
    var career = selectedCareer()
    heading(root, confirmed ? t("confirmedTitle") : t("recommendationTitle"), confirmed ? t("confirmed") : t("recommendationHelp"))
    if (career) root.appendChild(el("div", "ci-shell-career-status ci-shell-career-status-info", localized(career.name)))
    recommendationCards(root, confirmed ? state.confirmedRecommendation : state.recommendationResult)
    status(root)
    var actions = el("div", "ci-shell-career-actions")
    if (confirmed) {
      actions.appendChild(button(t("changeCareer"), "ci-shell-career-secondary", function () {
        state.view = "career-selection"
        state.status = null
        render()
      }))
      actions.appendChild(el("div", "ci-shell-career-spacer"))
      actions.appendChild(button(t("continueNative"), "ci-shell-career-primary", continueToNative))
    } else {
      actions.appendChild(button(t("backCareer"), "ci-shell-career-secondary", function () {
        state.view = "career-selection"
        state.status = null
        render()
      }))
      actions.appendChild(el("div", "ci-shell-career-spacer"))
      var use = button(state.busy ? t("savingCareer") : t("useRecommendation"), "ci-shell-career-primary", confirmCareer)
      use.disabled = state.busy
      actions.appendChild(use)
    }
    root.appendChild(actions)
    nativeStep(root)
  }

  async function confirmCareer() {
    if (!state.selectedCareerId || !state.recommendationResult) return
    state.busy = true
    state.status = null
    render()
    requestController = new AbortController()
    try {
      await apiFetch("/profile/career-preference", {
        method: "PATCH",
        body: JSON.stringify({ primaryCareerId: state.selectedCareerId }),
        signal: requestController.signal,
      })
      state.currentCareerId = state.selectedCareerId
      state.careerStatus = "native-discover"
      state.confirmedCareerId = state.selectedCareerId
      state.confirmedRecommendation = state.recommendationResult
      try {
        var cacheKey = recommendationKey(state.authUserId)
        if (cacheKey) window.localStorage.setItem(cacheKey, JSON.stringify({
          userId: state.authUserId,
          careerId: state.selectedCareerId,
          savedAt: Date.now(),
          recommendation: state.recommendationResult
        }))
      } catch (error) {}
      state.autoSelectedCourseIds = {}
      state.autoSelectAttempts = 0
      state.view = "career-confirmed"
      state.status = { kind: "success", text: t("confirmed") }
      // 保存职业后直接回到原生兴趣/课程流程，避免确认态渲染与 DOM 观察器互相触发。
      continueToNative(true)
    } catch (error) {
      if (error.name === "AbortError") return
      state.status = { kind: "error", text: friendly(error) }
    } finally {
      requestController = null
      state.busy = false
      if (!state.nativeFlowActive) render()
    }
  }

  function continueToNative(applyRecommendation) {
    state.nativeFlowActive = true
    state.careerStatus = "native-discover"
    state.applyRecommendationOnNativeEntry = applyRecommendation === true
    cancelMount()
    stopObserver()
    removeRoot()
    resetNativeViewport()
    window.requestAnimationFrame(function () {
      applyNativeRecommendationIfEnabled()
    })
  }

  function applyNativeRecommendationIfEnabled() {
    if (!state.applyRecommendationOnNativeEntry) {
      removeNativeMarks()
      return
    }
    applyNativeRecommendationMarks()
    autoSelectRecommendedCourses()
  }

  function recommendationItems() {
    var recommendation = state.confirmedRecommendation
    if (!recommendation && state.applyRecommendationOnNativeEntry) {
      try {
        var cacheKey = recommendationKey(state.authUserId)
        var saved = cacheKey ? JSON.parse(window.localStorage.getItem(cacheKey) || "null") : null
        if (saved && String(saved.userId) === String(state.authUserId) && saved.recommendation && Date.now() - Number(saved.savedAt || 0) < 24 * 60 * 60 * 1000) {
          recommendation = saved.recommendation
        }
      } catch (error) {}
    }
    return (recommendation && recommendation.recommendedCourses || []).filter(function (item) { return item.completionStatus !== "MASTERED" })
  }
  function recommendationByTitle() {
    return new Map(recommendationItems().map(function (item) { return [normalizeText(item.course && item.course.title), item] }))
  }
  function matchKey(value) {
    return normalizeText(value).toLowerCase()
  }
  function pushTerm(list, value) {
    var text = matchKey(value)
    if (text && list.indexOf(text) < 0) list.push(text)
  }
  function recommendationAliases(item) {
    var terms = []
    var course = item && item.course || {}
    pushTerm(terms, item && item.courseId)
    pushTerm(terms, course.title)
    pushTerm(terms, course.moduleName)
    ;(item && item.coveredCompetencyIds || []).forEach(function (id) {
      pushTerm(terms, id)
      pushTerm(terms, competencyName(id))
    })
    ;(item && item.matchedCompetencies || []).forEach(function (competency) {
      pushTerm(terms, competency && competency.id)
      pushTerm(terms, competencyName(competency && competency.id))
      pushTerm(terms, competency && competency.name)
    })
    var joined = terms.join(" ")
    var aliasGroups = [
      ["embedded", "perception", "sensor", "传感器", "感知", "环境", "dht", "oled", "i2c", "数据融合"],
      ["edge impulse", "视觉", "摄像头", "图像", "识别", "训练", "边缘 ai", "edge ai"],
      ["deploy", "deployment", "部署", "设备", "esp32", "小板", "云边", "api"],
      ["agent", "rag", "tool use", "工具", "桌面", "检索", "生成", "trace"],
      ["model", "evaluation", "评测", "模型", "路线", "prompt", "schema"],
      ["arduino", "电路", "led", "按钮", "接口", "io"],
      ["car", "motor", "servo", "小车", "电机", "舵机", "执行器"],
      ["manufacturing", "加工", "cnc", "刀路", "激光", "uv", "3d", "cad", "制造"],
      ["audio", "voice", "语音", "麦克风", "声音", "灯带"],
      ["robot", "机器人", "m5stack", "stackchan", "路演"]
    ]
    aliasGroups.forEach(function (group) {
      if (group.some(function (alias) { return joined.indexOf(matchKey(alias)) >= 0 })) {
        group.forEach(function (alias) { pushTerm(terms, alias) })
      }
    })
    return terms
  }
  function scoreNativeCard(text, item, rankIndex) {
    var normalized = matchKey(text)
    if (!normalized || !item) return 0
    var course = item.course || {}
    var title = matchKey(course.title)
    var moduleName = matchKey(course.moduleName)
    var score = 0
    if (title && normalized === title) score += 220
    else if (title && (normalized.indexOf(title) >= 0 || title.indexOf(normalized) >= 0)) score += 160
    if (moduleName && (normalized.indexOf(moduleName) >= 0 || moduleName.indexOf(normalized) >= 0)) score += 70
    recommendationAliases(item).forEach(function (term) {
      if (!term || term.length < 2) return
      if (normalized === term) score += 42
      else if (normalized.indexOf(term) >= 0 || term.indexOf(normalized) >= 0) score += term.length >= 4 ? 26 : 12
    })
    return score + Math.max(0, 8 - rankIndex)
  }
  function bestRecommendationForNativeCard(text) {
    var best = null
    recommendationItems().forEach(function (item, index) {
      var score = scoreNativeCard(text, item, index)
      if (score > 0 && (!best || score > best.score)) best = { item: item, score: score, rankIndex: index }
    })
    return best
  }
  function itemForNativeTitle(title, byTitle) {
    var normalized = normalizeText(title)
    if (!normalized) return null
    var exact = byTitle.get(normalized)
    if (exact) return exact
    var found = null
    byTitle.forEach(function (item, itemTitle) {
      if (found || !itemTitle) return
      if (normalized === itemTitle || normalized.indexOf(itemTitle) >= 0 || itemTitle.indexOf(normalized) >= 0) found = item
    })
    return found
  }
  function cardSelected(card) {
    var checkedInput = card.querySelector("input[type='checkbox']:checked,input[type='radio']:checked")
    return Boolean(
      checkedInput ||
      card.getAttribute("aria-pressed") === "true" ||
      card.getAttribute("aria-selected") === "true" ||
      card.getAttribute("data-selected") === "true" ||
      card.classList.contains("selected") ||
      card.classList.contains("is-selected") ||
      card.classList.contains("active")
    )
  }
  function isAllowedAutoSelectTarget(node) {
    var field = interestField()
    return Boolean(
      field &&
      node &&
      field.contains(node) &&
      node.matches("button.interest-bubble[aria-pressed]") &&
      !node.closest(".selection-tray,.top-actions,nav,[role='navigation']")
    )
  }
  function clickableForCard(card) {
    return isAllowedAutoSelectTarget(card) ? card : null
  }
  function nativeBubbleCandidates() {
    var field = interestField()
    if (!field) return []
    var nodes = Array.prototype.slice.call(field.querySelectorAll("button.interest-bubble[aria-pressed]"))
    return nodes.filter(function (node, index) {
      if (!node || node.closest("#" + ROOT_ID)) return false
      if (nodes.indexOf(node) !== index) return false
      if (!isAllowedAutoSelectTarget(node)) return false
      var rect = node.getBoundingClientRect()
      var text = normalizeText(node.textContent)
      return rect.width > 12 && rect.height > 12 && text.length >= 2 && text.length <= 80
    })
  }
  function showSelectionLimitNotice(show) {
    var old = document.querySelector(".ci-shell-career-selection-limit")
    if (!show) { if (old) old.remove(); return }
    if (old) return
    var field = interestField()
    if (!field) return
    var notice = el("div", "ci-shell-career-selection-limit", t("selectionLimit"))
    notice.setAttribute("role", "status")
    notice.style.cssText = "margin:12px 0;padding:10px 12px;border:1px solid rgba(251,191,36,.32);border-radius:12px;background:rgba(120,53,15,.18);color:#fde68a;font:650 12px/1.55 Inter,system-ui,sans-serif"
    field.appendChild(notice)
  }
  function autoSelectRecommendedCourses() {
    if (!state.nativeFlowActive && document.getElementById(ROOT_ID)) return
    var items = recommendationItems()
    if (!items.length) { showSelectionLimitNotice(false); return }
    var bubbleCards = nativeBubbleCandidates()
    var candidates = bubbleCards.map(function (card) {
      var match = bestRecommendationForNativeCard(card.textContent)
      return match ? { card: card, item: match.item, score: match.score, rankIndex: match.rankIndex } : null
    }).filter(Boolean).sort(function (a, b) {
      return b.score - a.score || a.rankIndex - b.rankIndex
    })
    var selectedCount = bubbleCards.filter(cardSelected).length
    var remainingSlots = Math.max(0, 5 - selectedCount)
    showSelectionLimitNotice(selectedCount >= 5 && candidates.some(function (entry) { return !cardSelected(entry.card) }))
    var clicked = 0
    var usedIds = {}
    function clickEntry(entry, allowDuplicateCourse) {
      if (clicked >= remainingSlots) return
      var card = entry.card
      var item = entry.item
      if (!item || state.autoSelectedCourseIds[item.courseId + "::" + matchKey(card.textContent)]) return
      if (!allowDuplicateCourse && usedIds[item.courseId]) return
      usedIds[item.courseId] = true
      if (cardSelected(card)) return
      var target = clickableForCard(card)
      if (!target || !target.isConnected || !isAllowedAutoSelectTarget(target) || target.disabled || target.getAttribute("aria-disabled") === "true") return
      state.autoSelectedCourseIds[item.courseId + "::" + matchKey(card.textContent)] = true
      target.click()
      clicked += 1
    }
    candidates.forEach(function (entry) {
      clickEntry(entry, false)
    })
    if (clicked < Math.min(4, remainingSlots)) {
      candidates.forEach(function (entry) {
        clickEntry(entry, true)
      })
    }
    applyNativeRecommendationMarks()
    if (clicked > 0 && state.autoSelectAttempts < 24) {
      state.autoSelectAttempts += 1
      if (autoSelectTimer) clearTimeout(autoSelectTimer)
      autoSelectTimer = setTimeout(autoSelectRecommendedCourses, 250)
    }
  }
  function applyNativeRecommendationMarks() {
    var items = recommendationItems()
    if (!items.length) return
    var byTitle = recommendationByTitle()
    document.querySelectorAll(".course-card").forEach(function (card) {
      var headingNode = card.querySelector("h1,h2,h3,h4,h5,h6")
      var item = headingNode ? itemForNativeTitle(headingNode.textContent, byTitle) : null
      var old = card.querySelector(".ci-shell-career-native-mark")
      if (!item) { if (old) old.remove(); return }
      if (old && old.getAttribute("data-course-id") === item.courseId) return
      if (old) old.remove()
      var mark = el("div", "ci-shell-career-native-mark")
      mark.setAttribute("data-course-id", item.courseId)
      mark.appendChild(el("span", null, t("highlighted") + " #" + item.rank))
      var firstReason = (item.reasons || []).map(reasonText).find(Boolean)
      if (firstReason) mark.appendChild(el("span", "ci-shell-career-native-reason", firstReason))
      card.appendChild(mark)
    })
  }

  window.__CI_SHELL__ = {
    ensureMounted: ensureMounted,
    destroy: function () {
      if (requestController) { requestController.abort(); requestController = null }
      stopObserver()
      cancelMount()
      cancelAutoSelect()
      removeAuthListeners()
      removeRoot()
      resetNativeViewport()
      removeNativeMarks()
      removeLegacyParallelUi()
      var style = document.getElementById(STYLE_ID)
      if (style) style.remove()
      delete window.__CI_SHELL__
    },
  }

  installAuthListeners()
  handleAuthChange()
})()
