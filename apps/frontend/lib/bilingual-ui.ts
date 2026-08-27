export type Locale = "zh" | "en"

export const LOCALE_STORAGE_KEY = "personalized-secure:locale:v1"
export const LOCALE_COOKIE_KEY = "personalized-secure-locale"

export function readInitialLocale(): Locale {
  if (typeof window === "undefined") return "zh"
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  return stored === "en" ? "en" : "zh"
}

export function writeLocale(locale: Locale) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; Path=/; Max-Age=63072000; SameSite=Lax`
}

const dictionary = {
  currentAccount: { zh: "当前账号", en: "Account" },
  logout: { zh: "退出登录", en: "Log out" },
  selectedCount: { zh: "已选", en: "Selected" },
  connectInterests: { zh: "连接我的兴趣", en: "Connect my interests" },
  adjustSelection: { zh: "调整选择", en: "Adjust choices" },
  restart: { zh: "重新开始", en: "Restart" },
  generating: { zh: "正在匹配原课程…", en: "Matching original courses…" },
  generatePath: { zh: "生成学习路径", en: "Generate path" },
  dreamEyebrow: { zh: "你的目标正在长出路径", en: "Your goals are becoming a route" },
  dreamTitle: { zh: "每一个兴趣，都能连向一件真正完成的作品", en: "Every interest can lead to a real finished project" },
  personalRoute: { zh: "你的学习路径", en: "Your learning path" },
  returnCatalog: { zh: "返回课程目录", en: "Back to catalog" },
  returnGraph: { zh: "返回知识图谱", en: "Back to knowledge graph" },
  adjustInterests: { zh: "调整兴趣", en: "Adjust interests" },
  learningContent: { zh: "学习内容", en: "learning items" },
  project: { zh: "实践项目", en: "projects" },
  routeProgress: { zh: "本轮进度", en: "Route progress" },
  routeProgressHelp: { zh: "本轮只安排尚未达标的课程；完成后会继续计算下一批。", en: "This route only includes unfinished courses. The next batch is recalculated after completion." },
  learningSteps: { zh: "学习步骤", en: "Learning steps" },
  evidenceChain: { zh: "过程记录", en: "Learning records" },
  evidenceChainSubtitle: { zh: "后台可追踪本轮学习全过程", en: "The full learning process is tracked in the background" },
  timelineEmpty: { zh: "还没有过程记录。开始学习、打勾、求助或完成步骤后，系统会自动记录。", en: "No learning records yet. The system records learning, checks, help requests and completions automatically." },
  refresh: { zh: "刷新", en: "Refresh" },
  loading: { zh: "正在读取…", en: "Loading…" },
  syncCatalog: { zh: "正在同步课程目录", en: "Syncing course catalog" },
  syncFailed: { zh: "课程目录同步失败", en: "Catalog sync failed" },
  routeFinished: { zh: "本轮学习已同步完成", en: "This route has been synced" },
  savingCompletion: { zh: "正在保存你的完成记录", en: "Saving your completion record" },
  completionUnsynced: { zh: "完成记录尚未同步", en: "Completion not synced yet" },
  pathCompleted: { zh: "这条学习路径已完成", en: "This learning path is complete" },
  retrySync: { zh: "重试同步", en: "Retry sync" },
  continueChoose: { zh: "继续选择课程", en: "Choose more courses" },
  modeGuided: { zh: "带着学", en: "Guided" },
  modeSelf: { zh: "自主挑战", en: "Self-directed" },
  chooseMode: { zh: "选择一种真正不同的学习方式。你可以随时切换，已经保存的记录不会丢失。", en: "Choose a learning mode. You can switch anytime; saved records will not be lost." },
  guidedDesc: { zh: "一次完成一个真实课程步骤，展开操作说明、检查清单、安全提醒和排错建议。", en: "Complete one real course step at a time with instructions, checklist, safety notes and troubleshooting." },
  selfDesc: { zh: "隐藏所有内部步骤，只保留最终任务、验收标准、资源和作品提交。", en: "Hide internal steps and focus on the final task, acceptance criteria, resources and submission." },
  stepList: { zh: "课程内步骤", en: "Course steps" },
  doNow: { zh: "现在这样做", en: "Do this now" },
  scaffold: { zh: "本步学习支架", en: "Learning scaffold" },
  checklist: { zh: "操作检查清单", en: "Action checklist" },
  safety: { zh: "安全边界", en: "Safety boundary" },
  completion: { zh: "完成标准", en: "Completion checkpoint" },
  troubleshooting: { zh: "排错提示", en: "Troubleshooting" },
  troubleshootingOpened: { zh: "已展开排错提示", en: "Troubleshooting shown" },
  troubleshootingOpen: { zh: "展开排错提示", en: "Show troubleshooting" },
  askAgent: { zh: "向学习伙伴求助", en: "Ask learning partner" },
  completeStep: { zh: "完成当前步骤", en: "Complete current step" },
  nextStep: { zh: "进入下一步", en: "Next step" },
  finishCourse: { zh: "完成本课，继续路径", en: "Finish course and continue" },
  noMatchedRouteTitle: { zh: "暂时没有匹配到原平台内容", en: "No matching original-platform content yet" },
  noMatchedRouteBody: { zh: "请返回知识图谱调整兴趣选择。", en: "Go back to the knowledge graph and adjust your interests." },
  adjustMyChoices: { zh: "调整我的选择", en: "Adjust my choices" },
  routeCompleteHint: { zh: "已确认的课程将写入课程目录；返回后，它们不会再作为可选课程出现。", en: "Confirmed courses are saved to the catalog and will no longer appear as selectable courses." },
  routeCompleteErrorHint: { zh: "请重试同步；成功前不会把这轮课程从目录中移除。", en: "Please retry syncing. These courses will not be removed from the catalog until syncing succeeds." },
  coursesRecorded: { zh: "门课程已记录", en: "courses recorded" },
  nextGoalsHint: { zh: "下一批目标可以重新选择", en: "You can choose the next goals again" },
  originalProject: { zh: "原平台实践项目", en: "Original project" },
  originalCourse: { zh: "原平台课程", en: "Original course" },
  guidedAction: { zh: "带着我一步步完成", en: "Guide me step by step" },
  selfAction: { zh: "只给任务，我来完成", en: "Give me the task only" },
  guidedIncludes: { zh: "带着学包含", en: "Guided mode includes" },
  realSteps: { zh: "个真实步骤", en: "real steps" },
  fromDatabase: { zh: "来自原平台数据库", en: "From the original-platform database" },
  selfInternalStepsHidden: { zh: "自主挑战 · 不显示课程内部步骤", en: "Self-directed · internal steps hidden" },
  yourTask: { zh: "你的任务", en: "Your task" },
  shouldMeet: { zh: "完成时应当满足", en: "What completion should meet" },
  acceptanceCriteria: { zh: "验收标准", en: "Acceptance criteria" },
  openWhenNeeded: { zh: "需要时再打开", en: "Open when needed" },
  originalResources: { zh: "原平台资源", en: "Original resources" },
  cannotSkip: { zh: "不可跳过", en: "Do not skip" },
  safetyLimits: { zh: "安全与限制", en: "Safety and limits" },
  submitResult: { zh: "提交挑战结果", en: "Submit challenge result" },
  uploadEvidence: { zh: "上传挑战证据", en: "Upload challenge evidence" },
  uploading: { zh: "正在上传…", en: "Uploading…" },
  finalEvidenceOnly: { zh: "内部过程由你决定，平台只检查最终交付", en: "You decide the internal process; the platform checks the final deliverable." },
  saving: { zh: "正在保存", en: "Saving" },
  challengeSaved: { zh: "挑战记录已保存", en: "Challenge record saved" },
  savedLocal: { zh: "记录已保存在当前浏览器", en: "Saved in this browser" },
  submitAndFinish: { zh: "提交挑战并完成本课", en: "Submit challenge and finish this course" },
  minutes: { zh: "分钟", en: "min" },
  items: { zh: "条", en: "items" },
  savingStep: { zh: "正在保存当前步骤", en: "Saving current step" },
  troubleshootingSaved: { zh: "已显示当前步骤的真实排错提示", en: "Troubleshooting for this step is now shown" },
  troubleshootingHint: { zh: "遇到问题时可展开当前步骤的排错提示", en: "Open troubleshooting when you get stuck on this step" },
  noTroubleshootingHint: { zh: "当前步骤没有单独配置排错列表，可直接让学习伙伴帮你定位问题", en: "This step has no dedicated troubleshooting list. You can ask the learning partner for help." },
  loadingOriginalSteps: { zh: "正在读取原平台课程步骤…", en: "Loading original course steps…" },
  noOriginalSteps: { zh: "没有加载到原课程步骤", en: "Original course steps could not be loaded" },
  noConfiguredSteps: { zh: "原课程暂时没有配置步骤", en: "No course steps have been configured yet" },
  noConfiguredStepsBody: { zh: "这项内容不会被伪造；请回到路径选择其他原平台课程。", en: "This content is not fabricated. Go back to the route and choose another original-platform course." },
  defaultCourseDescription: { zh: "按当前学习路径完成本课程。", en: "Complete this course according to the current learning path." },
  defaultRecommendation: { zh: "这是你的当前学习路径中的课程。", en: "This course is part of your current learning path." },
  lockedRecommendation: { zh: "先完成前置课程后即可解锁。", en: "Complete the prerequisite course first to unlock this item." },
  defaultInstruction: { zh: "按原课程要求完成当前任务。", en: "Complete the current task according to the original course requirements." },
  defaultCompletion: { zh: "完成并保留可复查的结果。", en: "Complete the task and keep a reviewable result." },
  defaultEvidence: { zh: "上传能证明当前步骤已完成的截图、照片、日志或文件。", en: "Upload a screenshot, photo, log or file that proves this step is complete." },
  courseResource: { zh: "课程资源", en: "Course resource" },
  selectedInterests: { zh: "已选择的兴趣", en: "Selected interests" },
  remove: { zh: "点击移除", en: "Click to remove" },
} as const

export type BilingualKey = keyof typeof dictionary

export function t(locale: Locale, key: BilingualKey) {
  return dictionary[key][locale]
}
