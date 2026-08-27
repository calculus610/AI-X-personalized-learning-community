const fs = require("node:fs")
const path = require("node:path")
const bundledNodeModules = process.env.CODEX_NODE_MODULES
  || "C:\\Users\\30906\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules"
const { chromium } = require(path.join(bundledNodeModules, "playwright"))

const url = process.env.REVIEW_URL || "http://127.0.0.1:3403/"
const outputDir = path.resolve(__dirname, "../design-review/login-i18n")

function assert(value, message) {
  if (!value) throw new Error(message)
}

async function visibleLoginText(page) {
  return page.locator(".platform-login-screen").innerText()
}

async function loginLayout(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".platform-login-screen")
    const title = document.querySelector(".login-introduction h1")
    const focus = document.querySelector(".login-title-focus")
    const capabilityTitles = [...document.querySelectorAll(".login-capabilities strong")]
    return {
      locale: root?.getAttribute("data-locale"),
      documentLanguage: document.documentElement.lang,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      titleFitsViewport: title ? title.getBoundingClientRect().right <= innerWidth + 1 : false,
      titleWhiteSpace: focus ? getComputedStyle(focus).whiteSpace : null,
      clippedCapabilityTitles: capabilityTitles.filter((node) => node.scrollWidth > node.clientWidth + 1).map((node) => node.textContent?.trim()),
    }
  })
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const serverResponse = await fetch(url, { headers: { Cookie: "personalized-secure-locale=en" } })
  const serverHtml = await serverResponse.text()
  assert(serverHtml.includes("Loading your session…"), "The server-rendered English loading state is missing.")
  assert(!serverHtml.includes("正在读取登录状态"), "The server-rendered English page still contains the Chinese loading state.")
  process.stdout.write("[login-i18n] launching browser\n")
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    timeout: 15000,
  })
  process.stdout.write("[login-i18n] opening English login\n")
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addCookies([{ name: "personalized-secure-locale", value: "en", url }])
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  await page.addInitScript(() => localStorage.setItem("personalized-secure:locale:v1", "en"))

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 })
  await page.getByRole("heading", { name: "Continue your exploration" }).waitFor()
  process.stdout.write("[login-i18n] checking desktop login\n")

  const englishText = await visibleLoginText(page)
  assert(!/[\u3400-\u9fff]/.test(englishText), "The English login page still contains Chinese text.")
  const desktop = await loginLayout(page)
  assert(desktop.locale === "en" && desktop.documentLanguage === "en", "The English locale is not applied consistently.")
  assert(!desktop.horizontalOverflow && desktop.titleFitsViewport, "The English login title overflows the desktop viewport.")
  assert(desktop.titleWhiteSpace !== "nowrap", "The English title is still forced onto one line.")
  assert(desktop.clippedCapabilityTitles.length === 0, `English feature titles are clipped: ${desktop.clippedCapabilityTitles.join(", ")}`)
  await page.screenshot({ path: path.join(outputDir, "english-login-desktop.png"), fullPage: true })

  await page.getByRole("button", { name: "Register" }).click()
  process.stdout.write("[login-i18n] checking registration and live error translation\n")
  await page.getByRole("heading", { name: "Create your learning space" }).waitFor()
  assert(!/[\u3400-\u9fff]/.test(await visibleLoginText(page)), "The English registration state contains Chinese text.")
  await page.locator('input[name="username"]').fill("i18n-review-account")
  await page.locator('input[name="password"]').fill("password-a")
  await page.locator('input[name="confirmPassword"]').fill("password-b")
  await page.getByRole("button", { name: "Register and enter" }).click()
  await page.getByText("The passwords do not match.").waitFor()

  await page.getByRole("button", { name: "Switch to Chinese" }).click()
  await page.getByText("两次输入的密码不一致。").waitFor()
  assert((await page.locator(".platform-login-screen").getAttribute("data-locale")) === "zh", "The error state did not switch to Chinese.")
  await page.getByRole("button", { name: "切换到英文" }).click()
  await page.getByText("The passwords do not match.").waitFor()
  await page.screenshot({ path: path.join(outputDir, "english-register-error.png"), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  process.stdout.write("[login-i18n] checking mobile login\n")
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 })
  await page.getByRole("heading", { name: "Continue your exploration" }).waitFor()
  const mobile = await loginLayout(page)
  assert(!mobile.horizontalOverflow && mobile.titleFitsViewport, "The English login page overflows the mobile viewport.")
  await page.screenshot({ path: path.join(outputDir, "english-login-mobile.png"), fullPage: true })

  await browser.close()
  process.stdout.write(`${JSON.stringify({ desktop, mobile, screenshots: outputDir }, null, 2)}\n`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
