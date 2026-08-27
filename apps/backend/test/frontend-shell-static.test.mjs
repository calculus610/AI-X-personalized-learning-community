import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../../frontend/public/course-interest-shell.js", import.meta.url), "utf8")

test("shell keeps the approved security and lifecycle boundaries", () => {
  assert.match(source, /localStorage\.getItem\("aix_token"\)/)
  assert.doesNotMatch(source, /setInterval\s*\(|history\.(pushState|replaceState)|\balert\s*\(|\bconfirm\s*\(|\bprompt\s*\(/)
  assert.doesNotMatch(source, /localStorage\.(getItem|setItem)\([^\n]*career-edit-intent/)
  assert.doesNotMatch(source, /\.innerHTML\s*=/)
  assert.doesNotMatch(source, /observer\.observe\(document\.body/)
  assert.match(source, /textContent/)
  assert.match(source, /AbortController/)
  assert.match(source, /window\.addEventListener\(AUTH_EVENT, handleAuthChange\)/)
  assert.match(source, /window\.removeEventListener\(AUTH_EVENT, handleAuthChange\)/)
})

test("recommendation view and career confirmation stay separated", () => {
  const recommendationBody = source.slice(source.indexOf("async function viewRecommendation"), source.indexOf("function recommendationCards"))
  assert.match(recommendationBody, /course-recommendations\/by-career/)
  assert.doesNotMatch(recommendationBody, /profile\/career-preference/)

  const confirmBody = source.slice(source.indexOf("async function confirmCareer"), source.indexOf("function continueToNative"))
  assert.match(confirmBody, /profile\/career-preference/)
  assert.match(confirmBody, /continueToNative\(true\)/)
})

test("available existing-career bootstrap enters native discover without recommendation side effects", () => {
  const bootstrapBody = source.slice(source.indexOf("async function bootstrapCareerStatus"), source.indexOf("function retryCareerStatus"))
  const selectedBranch = bootstrapBody.slice(
    bootstrapBody.indexOf('data.status === "selected"'),
    bootstrapBody.indexOf('data.status === "not_selected"'),
  )

  assert.match(bootstrapBody, /apiFetch\("\/profile\/career-preference"/)
  assert.match(selectedBranch, /state\.currentCareerId = primaryCareerId/)
  assert.match(selectedBranch, /state\.careerStatus = "native-discover"/)
  assert.match(selectedBranch, /continueToNative\(false\)/)
  assert.doesNotMatch(selectedBranch, /loadCareers|course-recommendations|recommendationItems|autoSelectRecommendedCourses|RECOMMENDATION_KEY/)
})

test("unavailable saved careers require reselection without mutating the profile", () => {
  const bootstrapBody = source.slice(source.indexOf("async function bootstrapCareerStatus"), source.indexOf("function retryCareerStatus"))
  const unavailableBranch = bootstrapBody.slice(
    bootstrapBody.indexOf('data.status === "unavailable"'),
    bootstrapBody.indexOf("} else {", bootstrapBody.indexOf('data.status === "unavailable"')),
  )
  const selectionBody = source.slice(source.indexOf("function renderCareerSelection"), source.indexOf("async function viewRecommendation"))

  assert.match(unavailableBranch, /state\.currentCareerId = primaryCareerId/)
  assert.match(unavailableBranch, /state\.careerStatus = "required"/)
  assert.match(unavailableBranch, /state\.careerRequirementReason = "unavailable"/)
  assert.match(unavailableBranch, /state\.view = "career-selection"/)
  assert.match(unavailableBranch, /loadCatalog = true/)
  assert.doesNotMatch(unavailableBranch, /continueToNative|method:\s*"PATCH"|primaryCareerId:\s*null|autoSelectRecommendedCourses|RECOMMENDATION_KEY/)
  assert.match(selectionBody, /state\.careerRequirementReason === "unavailable"/)
  assert.match(selectionBody, /t\("unavailableCareer"\)/)
})

test("new users enter career selection only after a not-selected response", () => {
  const freshStateBody = source.slice(source.indexOf("function freshState"), source.indexOf("var messages"))
  const bootstrapBody = source.slice(source.indexOf("async function bootstrapCareerStatus"), source.indexOf("function retryCareerStatus"))
  const notSelectedBranch = bootstrapBody.slice(
    bootstrapBody.indexOf('data.status === "not_selected"'),
    bootstrapBody.indexOf('data.status === "unavailable"'),
  )

  assert.match(freshStateBody, /view: null/)
  assert.match(freshStateBody, /careerStatus: "idle"/)
  assert.match(notSelectedBranch, /state\.careerStatus = "required"/)
  assert.match(notSelectedBranch, /state\.view = "career-selection"/)
  assert.match(notSelectedBranch, /loadCatalog = true/)
})

test("career bootstrap hides the selector while loading and exposes an explicit error path", () => {
  const ensureBody = source.slice(source.indexOf("function ensureMounted"), source.indexOf("function startObserver"))
  const bootstrapBody = source.slice(source.indexOf("async function bootstrapCareerStatus"), source.indexOf("function retryCareerStatus"))
  const errorBody = source.slice(source.indexOf("function renderCareerStatusError"), source.indexOf("function renderCareerSelection"))

  assert.match(ensureBody, /state\.careerStatus === "loading" \|\| state\.careerStatus === "idle"/)
  assert.match(ensureBody, /removeRoot\(\)/)
  assert.match(bootstrapBody, /state\.careerStatus = "error"/)
  assert.match(bootstrapBody, /career_status_timeout/)
  assert.match(errorBody, /retryCareerStatus/)
  assert.match(errorBody, /continueToNative\(false\)/)
})

test("401 and account-switch races cannot apply stale career state", () => {
  const bootstrapBody = source.slice(source.indexOf("async function bootstrapCareerStatus"), source.indexOf("function retryCareerStatus"))
  const authBody = source.slice(source.indexOf("function handleAuthChange"), source.indexOf("function installAuthListeners"))

  assert.match(bootstrapBody, /error && error\.status === 401/)
  assert.match(bootstrapBody, /clearAuth\(\)/)
  assert.match(authBody, /bootstrapGeneration \+= 1/)
  assert.match(authBody, /requestController\.abort\(\)/)
  assert.match(bootstrapBody, /generation !== bootstrapGeneration \|\| state\.authUserId !== userId \|\| currentAuthUserId\(\) !== userId/)
})

test("native discover stays unmounted and recommendation application remains opt-in", () => {
  const ensureBody = source.slice(source.indexOf("function ensureMounted"), source.indexOf("function startObserver"))
  const observerBody = source.slice(source.indexOf("function startObserver"), source.indexOf("function stopObserver"))
  const continueBody = source.slice(source.indexOf("function continueToNative"), source.indexOf("function recommendationItems"))

  assert.match(ensureBody, /state\.careerStatus === "native-discover" \|\| state\.nativeFlowActive/)
  assert.match(ensureBody, /removeRoot\(\)/)
  assert.match(observerBody, /applyNativeRecommendationIfEnabled\(\)/)
  assert.doesNotMatch(observerBody, /autoSelectRecommendedCourses\(\)/)
  assert.match(continueBody, /state\.applyRecommendationOnNativeEntry = applyRecommendation === true/)
  assert.match(continueBody, /if \(!state\.applyRecommendationOnNativeEntry\)/)
  assert.match(continueBody, /removeNativeMarks\(\)/)
  assert.match(continueBody, /autoSelectRecommendedCourses\(\)/)
})

test("confirmed recommendations auto-select matching native interest tags once", () => {
  assert.match(source, /function autoSelectRecommendedCourses\(\)/)
  assert.match(source, /interestField\(\)/)
  assert.match(source, /querySelectorAll\("button\.interest-bubble\[aria-pressed\]"\)/)
  assert.match(source, /function isAllowedAutoSelectTarget\(node\)/)
  assert.match(source, /node\.matches\("button\.interest-bubble\[aria-pressed\]"\)/)
  assert.match(source, /bestRecommendationForNativeCard\(card\.textContent\)/)
  assert.match(source, /state\.autoSelectedCourseIds\[item\.courseId \+ "::" \+ matchKey\(card\.textContent\)\] = true/)
  assert.match(source, /target\.click\(\)/)
  assert.match(source, /isAllowedAutoSelectTarget\(target\)/)
  assert.match(source, /function cardSelected\(card\)/)
  assert.match(source, /aria-pressed/)
  assert.match(source, /state\.autoSelectAttempts < 24/)
  assert.doesNotMatch(source, /querySelectorAll\("button,\[role='button'\]"\)/)
})
