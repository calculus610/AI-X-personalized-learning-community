import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const shell = readFileSync(new URL("../../frontend/public/course-interest-shell.js", import.meta.url), "utf8")
const enhance = readFileSync(new URL("../../frontend/public/platform-enhance.js", import.meta.url), "utf8")

function between(source, start, end) {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  assert.notEqual(from, -1, `missing start marker: ${start}`)
  assert.notEqual(to, -1, `missing end marker: ${end}`)
  return source.slice(from, to)
}

test("E1 authenticated account owns one change-career entry and unauthenticated state removes it", () => {
  const body = between(enhance, "function ensureCareerEditEntry", "window.addEventListener(\"aix-auth-changed\"")
  assert.match(body, /document\.querySelector\("\.platform-account-inline"\)/)
  assert.match(body, /!token\(\)\|\|!userId\|\|!account/)
  assert.match(body, /if\(existing\)existing\.remove\(\)/)
  assert.match(body, /careerEditText\("修改职业","Change career"\)/)
})

test("E2 repeated enhancement is idempotent and binds only on creation", () => {
  const body = between(enhance, "function ensureCareerEditEntry", "window.addEventListener(\"aix-auth-changed\"")
  assert.match(body, /document\.getElementById\(CAREER_EDIT_BUTTON_ID\)/)
  assert.match(body, /if\(!existing\)\{/)
  assert.equal((body.match(/addEventListener\("click",requestCareerEdit\)/g) || []).length, 1)
})

test("E3 discover edit event enters CAREER_EDITING with the current career selected", () => {
  const request = between(enhance, "function requestCareerEdit", "function ensureCareerEditEntry")
  const enter = between(shell, "function enterCareerEditing", "function handleCareerEditRequested")
  assert.match(request, /sourcePage==="discover"\)dispatchCareerEdit\(userId\)/)
  assert.match(enter, /state\.careerStatus = "editing"/)
  assert.match(enter, /state\.selectedCareerId = state\.currentCareerId/)
})

test("E4 cancel returns to native discover without PATCH, recommendation, or bubble mutation", () => {
  const body = between(shell, "function cancelCareerEditing", "async function loadCareers")
  assert.match(body, /continueToNative\(false\)/)
  assert.doesNotMatch(body, /apiFetch|PATCH|autoSelectRecommendedCourses|target\.click/)
})

test("E5 A to B continues through recommendation, existing PATCH, and opt-in merge", () => {
  const recommend = between(shell, "async function viewRecommendation", "function recommendationCards")
  const confirm = between(shell, "async function confirmCareer", "function continueToNative")
  assert.match(recommend, /course-recommendations\/by-career/)
  assert.match(confirm, /method: "PATCH"/)
  assert.match(confirm, /state\.currentCareerId = state\.selectedCareerId/)
  assert.match(confirm, /continueToNative\(true\)/)
})

test("E6 reselecting A is allowed and uses the same confirmed recommendation path", () => {
  const recommend = between(shell, "async function viewRecommendation", "function recommendationCards")
  const confirm = between(shell, "async function confirmCareer", "function continueToNative")
  assert.doesNotMatch(recommend, /selectedCareerId === currentCareerId|same.career/)
  assert.match(confirm, /continueToNative\(true\)/)
})

test("E7 PATCH failure cannot update currentCareerId, cache, or navigation before success", () => {
  const confirm = between(shell, "async function confirmCareer", "function continueToNative")
  const awaitPatch = confirm.indexOf('await apiFetch("/profile/career-preference"')
  assert.ok(awaitPatch >= 0)
  assert.ok(confirm.indexOf("state.currentCareerId = state.selectedCareerId") > awaitPatch)
  assert.ok(confirm.indexOf("window.localStorage.setItem") > awaitPatch)
  assert.ok(confirm.indexOf("continueToNative(true)") > awaitPatch)
  const failureStart = confirm.indexOf("\n    } catch (error) {", confirm.indexOf("continueToNative(true)"))
  const failure = confirm.slice(failureStart, confirm.indexOf("\n    } finally", failureStart))
  assert.ok(failureStart >= 0)
  assert.doesNotMatch(failure, /currentCareerId =|localStorage\.setItem|continueToNative/)
})

test("E8 ordinary selected-career bootstrap never reapplies a recommendation", () => {
  const bootstrap = between(shell, "async function bootstrapCareerStatus", "function retryCareerStatus")
  const selected = bootstrap.slice(bootstrap.indexOf('data.status === "selected"'), bootstrap.indexOf('data.status === "not_selected"'))
  assert.match(selected, /continueToNative\(false\)/)
  assert.doesNotMatch(selected, /recommendationItems|autoSelectRecommendedCourses|RECOMMENDATION_KEY_PREFIX/)
})

test("E9 active edit recommendations merge by selecting only currently unselected bubbles", () => {
  const auto = between(shell, "function autoSelectRecommendedCourses", "function applyNativeRecommendationMarks")
  assert.match(auto, /if \(cardSelected\(card\)\) return/)
  assert.match(auto, /target\.click\(\)/)
  assert.doesNotMatch(auto, /removeAttribute\("aria-pressed"\)|aria-pressed.*false|classList\.remove/)
})

test("E10 five selected bubbles block additions and show guidance without replacement", () => {
  const auto = between(shell, "function autoSelectRecommendedCourses", "function applyNativeRecommendationMarks")
  assert.match(auto, /remainingSlots = Math\.max\(0, 5 - selectedCount\)/)
  assert.match(auto, /clicked >= remainingSlots/)
  assert.match(auto, /showSelectionLimitNotice\(selectedCount >= 5/)
  assert.match(shell, /你已经选择了 5 个兴趣/)
})

test("E11 auto-click remains restricted to native interest bubbles with a second gate", () => {
  assert.match(shell, /querySelectorAll\("button\.interest-bubble\[aria-pressed\]"\)/)
  assert.match(shell, /node\.matches\("button\.interest-bubble\[aria-pressed\]"\)/)
  assert.match(shell, /isAllowedAutoSelectTarget\(target\)/)
  assert.doesNotMatch(shell, /querySelectorAll\("button,\[role='button'\]"\)/)
})

test("E12 change-career account button cannot be an auto-select candidate", () => {
  assert.match(enhance, /id=CAREER_EDIT_BUTTON_ID/)
  assert.match(enhance, /document\.querySelector\("\.platform-account-inline"\)/)
  assert.match(shell, /field\.contains\(node\)/)
  assert.match(shell, /node\.matches\("button\.interest-bubble\[aria-pressed\]"\)/)
})

test("E13 graph route and lesson use confirmation, session intent, and safe navigation without synthetic clicks", () => {
  const sourcePage = between(enhance, "function careerEditSourcePage", "function closeCareerEditConfirm")
  const navigate = between(enhance, "function continueCareerEditFromOtherPage", "function openCareerEditConfirm")
  const request = between(enhance, "function requestCareerEdit", "function ensureCareerEditEntry")
  assert.match(sourcePage, /return"route"/)
  assert.match(sourcePage, /return"lesson"/)
  assert.match(sourcePage, /return"graph"/)
  assert.match(request, /openCareerEditConfirm\(userId,sourcePage\)/)
  assert.match(navigate, /storeCareerEditIntent/)
  assert.match(navigate, /window\.location\.assign\("\/personalized-secure"\)/)
  assert.doesNotMatch(navigate + request, /\.click\(\)|dispatchEvent\(new MouseEvent/)
})

test("E14 edit intent is removed before its single bootstrap decision", () => {
  const consume = between(shell, "function consumeCareerEditIntent", "function clearAuth")
  assert.match(consume, /sessionStorage\.getItem\(key\)/)
  assert.match(consume, /sessionStorage\.removeItem\(key\)/)
  assert.ok(consume.indexOf("removeItem(key)") < consume.indexOf("return Boolean"))
})

test("E15 expired or future-invalid intents are removed and rejected", () => {
  const consume = between(shell, "function consumeCareerEditIntent", "function clearAuth")
  assert.match(shell, /CAREER_EDIT_INTENT_TTL = 5 \* 60 \* 1000/)
  assert.match(consume, /Date\.now\(\) - requestedAt <= CAREER_EDIT_INTENT_TTL/)
  assert.match(consume, /requestedAt <= Date\.now\(\) \+ 5000/)
})

test("E16 intent and recommendation cache are isolated by authenticated user ID", () => {
  assert.match(enhance, /CAREER_EDIT_INTENT_PREFIX\+userId/)
  assert.match(shell, /String\(saved\.userId\) === String\(userId\)/)
  assert.match(shell, /RECOMMENDATION_KEY_PREFIX \+ userId/)
  assert.match(shell, /String\(saved\.userId\) === String\(state\.authUserId\)/)
})

test("E17 selected Phase 1 bootstrap remains native unless a valid intent is consumed", () => {
  const bootstrap = between(shell, "async function bootstrapCareerStatus", "function retryCareerStatus")
  assert.match(bootstrap, /if \(consumeCareerEditIntent\(userId\)\)/)
  assert.match(bootstrap, /else \{[\s\S]*state\.careerStatus = "native-discover"[\s\S]*continueToNative\(false\)/)
})

test("E18 no-career Phase 1 bootstrap remains required and clears edit intent", () => {
  const bootstrap = between(shell, "async function bootstrapCareerStatus", "function retryCareerStatus")
  const branch = bootstrap.slice(bootstrap.indexOf('data.status === "not_selected"'), bootstrap.indexOf('data.status === "unavailable"'))
  assert.match(branch, /clearCareerEditIntent\(userId\)/)
  assert.match(branch, /state\.careerStatus = "required"/)
  assert.match(branch, /loadCatalog = true/)
})

test("E19 unavailable Phase 1 bootstrap remains required with its warning", () => {
  const bootstrap = between(shell, "async function bootstrapCareerStatus", "function retryCareerStatus")
  const branch = bootstrap.slice(bootstrap.indexOf('data.status === "unavailable"'), bootstrap.indexOf("} else {", bootstrap.indexOf('data.status === "unavailable"')))
  assert.match(branch, /state\.careerStatus = "required"/)
  assert.match(branch, /state\.careerRequirementReason = "unavailable"/)
  assert.match(shell, /t\("unavailableCareer"\)/)
})

test("E20 bootstrap failures retain error retry fallback and 401 cleanup", () => {
  const bootstrap = between(shell, "async function bootstrapCareerStatus", "function retryCareerStatus")
  assert.match(bootstrap, /error && error\.status === 401/)
  assert.match(bootstrap, /clearAuth\(\)/)
  assert.match(bootstrap, /state\.careerStatus = "error"/)
  assert.match(shell, /retryCareerStatus/)
  assert.match(shell, /continueToNative\(false\)/)
})

test("E21 career editing contains no Track deletion archival or regeneration calls", () => {
  const relevant = enhance + shell
  assert.doesNotMatch(relevant, /method:\s*"DELETE"|\/tracks[^\n]*(delete|archive)|deleteTrack|archiveTrack/)
  const editFunctions = between(shell, "function enterCareerEditing", "async function loadCareers")
  assert.doesNotMatch(editFunctions, /\/tracks|generatePath|learning.path/)
})

test("E22 Chinese and English labels cover entry current career cancel and confirmation", () => {
  assert.match(enhance, /careerEditText\("修改职业","Change career"\)/)
  assert.match(enhance, /careerEditText\("取消","Cancel"\)/)
  assert.match(enhance, /继续修改职业/)
  assert.match(enhance, /Your current learning path will not be deleted/)
  assert.match(shell, /currentCareerBadge: "当前职业"/)
  assert.match(shell, /currentCareerBadge: "Current career"/)
  assert.match(shell, /cancel: "取消"/)
  assert.match(shell, /cancel: "Cancel"/)
})

test("UI1 account text and change-career entry have a stable horizontal gap", () => {
  const entry = between(enhance, "function ensureCareerEditEntry", 'window.addEventListener("aix-auth-changed"')
  assert.match(entry, /margin-left:10px/)
  assert.match(entry, /display:inline-flex/)
  assert.doesNotMatch(entry, /position:absolute|margin-left:-|transform:translate/)
})

test("UI2 Chinese change-career label cannot wrap or inherit the native fixed width", () => {
  const entry = between(enhance, "function ensureCareerEditEntry", 'window.addEventListener("aix-auth-changed"')
  assert.match(entry, /width:auto/)
  assert.match(entry, /min-width:max-content/)
  assert.match(entry, /white-space:nowrap/)
  assert.match(entry, /careerEditText\("修改职业","Change career"\)/)
})

test("UI3 English label and adjacent actions cannot shrink the change-career entry", () => {
  const entry = between(enhance, "function ensureCareerEditEntry", 'window.addEventListener("aix-auth-changed"')
  assert.match(entry, /flex:0 0 auto/)
  assert.match(entry, /height:30px/)
  assert.match(entry, /careerEditText\("修改职业","Change career"\)/)
})

test("UI4 repeated observer enhancement still creates only one entry", () => {
  const entry = between(enhance, "function ensureCareerEditEntry", 'window.addEventListener("aix-auth-changed"')
  assert.match(entry, /getElementById\(CAREER_EDIT_BUTTON_ID\)/)
  assert.match(entry, /if\(!existing\)\{/)
  assert.equal((entry.match(/createElement\("button"\)/g) || []).length, 1)
})

test("UI5 one click still binds one request and dispatches one career-edit event", () => {
  const entry = between(enhance, "function ensureCareerEditEntry", 'window.addEventListener("aix-auth-changed"')
  const dispatch = between(enhance, "function dispatchCareerEdit", "function storeCareerEditIntent")
  assert.equal((entry.match(/addEventListener\("click",requestCareerEdit\)/g) || []).length, 1)
  assert.equal((dispatch.match(/dispatchEvent\(/g) || []).length, 1)
  assert.match(enhance, /personalized-secure:career-edit-requested/)
})
