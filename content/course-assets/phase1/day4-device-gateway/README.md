# Phase1 Day4：M5Stack S3 设备触发网关实机包

## 目标与边界

Day4 的核心是把 Day3 已经手搓出的 Agent Core 包装成真实 M5Stack CoreS3 / ESP-Claw / 微信可以触发的设备网关，形成“设备输入 -> 本机 Agent -> 可追踪产物 -> 短回复”的云边协同系统。

合理边界：

```text
Day3：实现最小桌面 Agent；Agent 内部调用大模型 API，操作本地 workspace，生成摘要/待办/风险/复习卡和 trace。
Day4：不重新实现 Agent；只把 Day3 Agent 包装成 OpenAI-compatible 服务，面向 ESP-Claw / 微信提供触发能力，并增加二次确认、去重、设备日志和实机触发。
```

固定边界：

```text
Day3 不暴露 ESP-Claw 接口，不实现 /v1/chat/completions。
Day4 才实现 /v1/chat/completions、/v1/models、/health。
```

当前实机包已经验证的链路：

```text
微信 / ESP-Claw 事件
  -> 本机 OpenAI-compatible 服务 /v1/chat/completions
  -> Day4 Device Gateway
  -> 调用 Day3 Desktop Agent Core
  -> 写入 day4_agent_workspace
  -> 返回适合微信 / M5Stack CoreS3 展示的短回答
```

更详细的修正版说明见：

```text
Day3-Day4_实验边界修正版.md
```

最终演示：

1. 对微信 ClawBot 或 S3 入口发送：`请整理今天资料`
2. 设备链路返回：`我将调用桌面Agent整理课程资料。为避免误操作，请再说：确认整理。`
3. 再发送：`确认整理`
4. Day4 网关调用 Day3 Agent Core，本机生成 `day4_agent_workspace/summaries/course_summary.md`、`tasks.md`、`risks.md`、复习卡和 trace 证据。
5. S3 返回：`Day3桌面Agent已整理完成...`

## 当前实机事实

- S3 串口：`/dev/cu.usbmodem1101`
- Mac 当前局域网 IP：以 `run_day4_service.command` 启动时打印的 `Device Base URL` 为准；下文以 `192.168.x.x` 为示例
- 本机服务端口：`8000`
- ESP-Claw / OpenAI-compatible Base URL：`http://192.168.x.x:8000/v1`
- Model：`pocket-campus-agent`
- API Key：`classroom-demo-key`

## 1. 本机先自测

双击或终端运行：

```bash
./test_day4_service.command
```

通过标准：

- 返回第一轮确认提示。
- 返回第二轮 Agent 已整理完成。
- 生成 `day4_selftest_result.json`。
- 生成 `day4_agent_workspace/` 和 `day4_trace_log.jsonl`。

## 2. 启动 Day4 服务

双击或终端运行：

```bash
./run_day4_service.command
```

启动后不要关闭终端。浏览器检查：

```text
http://127.0.0.1:8000/dashboard
```

这个 dashboard 是 Day4 的实时看板。每次刷新都会重新读取 `day4_agent_workspace` 和 `day4_trace_log.jsonl`，展示最新设备输入、二次确认、Day3 Tool Use、RAG 命中、输出文件、复习卡和关键事件链。页面顶部有刷新和 5 秒自动刷新。

同一局域网设备访问：

```text
http://192.168.x.x:8000/v1
```

## 3. 电脑模拟 S3 调用

另开一个终端：

```bash
curl -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer classroom-demo-key" \
  -d '{"model":"pocket-campus-agent","messages":[{"role":"user","content":"请整理今天资料"}]}'
```

确认执行：

```bash
curl -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer classroom-demo-key" \
  -d '{"model":"pocket-campus-agent","messages":[{"role":"user","content":"确认整理"}]}'
```

复习题：

```bash
curl -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer classroom-demo-key" \
  -d '{"model":"pocket-campus-agent","messages":[{"role":"user","content":"给我一道复习题"}]}'
```

## 4. 配置 ESP-Claw

官方路线：

1. 使用 M5Burner。
2. 左侧选择 `CORES3`。
3. 下载并烧录 `ESP-Claw` 固件。
4. 重启后连接设备 AP：`esp-claw-xxx`。
5. 浏览器打开 `192.168.4.1`。
6. 配置课程 Wi-Fi。
7. LLM 配置选择 `Custom`，并填：

```text
Backend Type: openai_compatible
Config File: qwen_compatible
Base URL: http://192.168.x.x:8000/v1
Model: pocket-campus-agent
API Key: classroom-demo-key
Auth Type: bearer
```

实测注意：`Config File` 保持 `qwen_compatible`，不要改成 `openai_compatible`。这次真机验证里，把配置文件改成 `openai_compatible` 会触发 CoreS3 重启异常；正确做法是只把 `Backend Type` 设为 `openai_compatible`。

如果 ESP-Claw 当前版本没有可用的 Web Chat / IM / Console 输入入口，就不能直接触发 Day3 Agent Core。此时用本包的兜底固件：

```text
firmware_fallback/CoreS3_Day4_HTTP_Bridge/CoreS3_Day4_HTTP_Bridge.ino
```

该固件通过 Wi-Fi 直接 POST 到本机服务，触摸屏幕即可依次触发：

```text
请整理今天资料 -> 确认整理 -> 给我一道复习题
```

刷入前需要把固件里的 `WIFI_PASSWORD` 改成当前课程 Wi-Fi 密码。

## 5. 交付证据

学生演示结束后检查：

```text
day4_agent_workspace/voice_inbox/
day4_agent_workspace/summaries/course_summary.md
day4_agent_workspace/summaries/tasks.md
day4_agent_workspace/summaries/risks.md
day4_agent_workspace/cards/review_cards.json
day4_agent_workspace/evidence/
day4_trace_log.jsonl
```

这些就是 assessment 可追踪证据：

- 设备输入是什么。
- 是否要求二次确认。
- Agent 写了哪些文件。
- 输出是否能回到微信或 M5Stack CoreS3。
- 是否能生成复习题。

## 6. 课堂 Demo 台词

学生：

```text
请整理今天资料
```

设备：

```text
我将调用Day3桌面Agent整理课程资料。为避免误操作，请再说：确认整理。
```

学生：

```text
确认整理
```

设备：

```text
Day3桌面Agent已整理完成：摘要、待办、风险和复习卡已更新。可以说“给我一道复习题”。
```

学生：

```text
给我一道复习题
```

设备返回一条基于 Day3 资料生成的复习题。

# Day4 实验手册：S3 掌上 AI 实机

> ⏱ 预计时间：15-20 分钟（不含 M5Stack 烧录时间）
> 把前三天的成果装进一台真实的硬件设备里。

---

## 背景

Day3 的 Agent 跑在你的电脑上，但它只能通过命令行触发。今天你要给它装一个"入口"——要么是 M5Stack CoreS3 智能终端（刷入 Claw/龙虾固件），要么是微信消息。你发一条消息，设备/微信触发 Agent，Agent 跑完结果返回给你。

---

## 你的目标

启动一个本地 API 服务，让设备或微信能通过网络调用你的 Agent。服务启动后：
- 设备按一下按钮 / 微信发一条消息 → API 收到请求
- API 调用 Day3 的 Agent
- Agent 执行完毕后把结果返回给设备

---

## 操作步骤

### 准备工作：确认 Day3 产物存在

打开终端：

```
# 确认 Day3 的 agent_workspace 存在
ls day3-desktop-agent/outputs/agent_workspace/summaries/
```

应该看到 `course_summary.md` 等文件。如果没有 → 先跑一次 Day3。

### 第一步：启动本地服务（3 分钟）

**Windows:** 双击 `run_day4_service.bat`
**Mac:** 双击 `run_day4_service.command`

终端会显示服务正在运行：

```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 第二步：打开 Dashboard（2 分钟）

打开浏览器访问 `http://127.0.0.1:8000/dashboard`。

你能看到：
- 服务状态
- Day3 Agent 的运行历史
- 设备触发日志

### 第三步：发送测试消息（5 分钟）

**Windows:** 双击 `test_day4_service.bat`
**Mac:** 双击 `test_day4_service.command`

这个测试脚本会向你的服务发送一条消息："请整理今天资料"。Agent 收到后自动运行，结果写进 `day4_agent_workspace/`。

回到 Dashboard 刷新，看看有没有新的运行记录。

### 第四步：M5Stack 实机触发（如果有硬件）

1. 用烧录工具将 Claw 固件刷入 M5Stack CoreS3
2. 配置设备连接到你的电脑 IP 和端口 8000
3. 按一下设备按钮 → 触发 Agent → 结果显示在设备屏幕上

> 没有硬件也没关系——微信消息触发同样能完成这个实验。

---

## 交付清单

| 必须提交 | 文件路径 | 干什么用 |
|---|---|---|
| 设备触发摘要 | `day4_agent_workspace/summaries/course_summary.md` | 证明设备触发了 Agent |
| 设备触发待办 | `day4_agent_workspace/summaries/tasks.md` | 展示用 |
| 设备触发风险 | `day4_agent_workspace/summaries/risks.md` | 展示用 |
| 设备触发复习卡 | `day4_agent_workspace/cards/review_cards.json` | 最终演示用 |
| 执行记录 | `day4_trace_log.jsonl` | 评估用 |

## 展示方式

打开 `http://127.0.0.1:8000/dashboard` 投屏，展示：
1. 服务正在运行，Dashboard 能看到运行历史
2. 发一条测试消息，展示 Agent 实时执行并返回结果
3. 打开 `day4_agent_workspace/summaries/course_summary.md`，展示设备触发后 Agent 做了什么
4. 如果有实机，按按钮触发一次，展示端到端链路

> 核心问题：从设备按钮或微信消息，到 Agent 执行完毕返回结果——中间经过了哪些环节？

# Day4 学生操作手册

> ⏱ 预计时间：20-30 分钟（有设备的话 +15 分钟）
> 今天你要把 Day3 手搓的桌面 Agent，接到一台真实的 M5Stack S3 硬件上。
> 按一下 S3 的触摸屏，Agent 就干活，结果直接显示在屏幕上。

---

## 你的目标

> 前三天你做了三样东西：
> - **Day1**：模型路由表（决定哪个任务用哪个模型）
> - **Day2**：能力定义文件（4 个功能的 JSON 合同）
> - **Day3**：桌面 Agent（能读文件、查知识、写结果的 Python 脚本）
>
> 今天你要把这三样东西串起来——**用一台 M5Stack S3 设备（刷了 Claw 固件），通过微信输入指令，调用你的 Agent，结果在设备屏幕上显示。**

看不懂的词？→ 去 AI 平台搜"边缘计算"、"设备网关"、"OpenAI 兼容 API"

---

## 准备工作（5 分钟）

如果你前三天都跑过了，只需要多装几个包：

### 装依赖
终端运行：

```
pip install fastapi uvicorn pydantic
```

### 找到今天的文件夹
打开 `day4-device-gateway`，里面应该有：
- `index.html`
- `cloud_service.py` — 设备网关程序
- `run_day4_service.bat`（或 `.command`）— 启动服务
- `test_day4_service.bat`（或 `.command`）— 先自测

---

## 第一步：理解今天要搭什么（2 分钟）

**看 README** 第 1 页，理解架构：

```
你微信发"请整理今天资料"
  → 本机的 cloud_service 收到请求
  → 调用 Day3 的桌面 Agent
  → Agent 干活、写文件
  → 结果传回给设备屏显
```

**今天实际上做了一件事：** 把 Day3 的 Agent 包装成一个"微信也能调用的服务"。

---

## 第二步：本机自测（3 分钟）

**操作：** Windows 双击 `test_day4_service.bat`，Mac 双击 `test_day4_service.command`

**你会在终端里看到什么：**
```
>> 用户：请整理今天资料
<< Agent：我将调用桌面Agent整理课程资料。为避免误操作，请再说：确认整理。

>> 用户：确认整理
<< Agent：Day3桌面Agent已整理完成：摘要、待办、风险和复习卡已更新。
```

**这一步在干嘛：**
在没有真实设备的情况下，模拟 S3 发了两条消息给 Agent：
1. "请整理今天资料" → Agent 要求二次确认（防误触）
2. "确认整理" → Agent 开始干活并返回结果

**检查成果：** 跑完之后，看看文件夹里多出了什么：
- `day4_selftest_result.json` — 测试结果
- `day4_agent_workspace/` — Agent 生成的成果
- `day4_trace_log.jsonl` — 执行记录

> 🔍 不懂"二次确认"？想想你按错按钮时的保护机制

---

## 第三步：启动服务（3 分钟）

**操作：** Windows 双击 `run_day4_service.bat`，Mac 双击 `run_day4_service.command`

**你会看到：**
```
=== Day4 Device-to-Agent Bridge ===
Local: http://127.0.0.1:8000/dashboard
Device Base URL: http://192.168.x.x:8000/v1
Model: pocket-campus-agent
API Key: classroom-demo-key
```

**⚠️ 这个终端不要关**，关了服务就停了。

**你在看什么：**
- `127.0.0.1:8000/dashboard` — 本机看板，浏览器打开就能看到
- `192.168.x.x:8000/v1` — 你的 S3 设备需要填的这个地址

**操作：** 浏览器打开 `http://127.0.0.1:8000/dashboard`

看板上显示什么：
- 设备输入记录
- Agent 响应
- 工作区文件列表

> 🔍 不懂"127.0.0.1"和"192.168.x.x"的区别？→ 127.0.0.1 是本机，192.168.x.x 是局域网其他设备访问你的地址

---

## 第四步：用电脑模拟 S3 调用（3 分钟）

不用真设备也能验证。打开一个新的终端，输入以下命令。

**发第一句：**
```
curl -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer classroom-demo-key" \
  -d '{"model":"pocket-campus-agent","messages":[{"role":"user","content":"请整理今天资料"}]}'
```

你会收到一条要求确认的回复。

**发第二句：**
```
curl -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer classroom-demo-key" \
  -d '{"model":"pocket-campus-agent","messages":[{"role":"user","content":"确认整理"}]}'
```

这次 Agent 会真正干活，并返回整理结果。

**这一步在干嘛：**
你在用手动方式模拟 S3 设备发请求。S3 其实就是内部发同样的 HTTP 请求。

> 🔍 不懂"curl"和"HTTP 请求"？去 AI 平台搜"HTTP POST"

---

## 第五步（有设备才做）：配置 M5Stack S3

1. 下载 **M5Burner**（M5Stack 官网有 Windows/Mac 版）
2. 打开 M5Burner，左侧选 `CORES3`
3. 搜索并烧录 `ESP-Claw` 固件
4. 烧录完成后，S3 重启，连接它的 Wi-Fi 热点（名字像 `esp-claw-xxx`）
5. 浏览器打开 `192.168.4.1`，配置：
   - 课程 Wi-Fi 密码
   - LLM 配置选择 `Custom`：
     ```
     Backend Type: openai_compatible
     Config File: qwen_compatible
     Base URL: http://你的IP:8000/v1
     Model: pocket-campus-agent
     API Key: classroom-demo-key
     Auth Type: bearer
     ```
   - 你的 IP 在第 3 步终端里已经打印出来了
6. 保存后，在微信 ClawBot 里发"请整理今天资料"

---

## 第六步：检查完整链路成果

跑完之后检查：
```
day4_agent_workspace/summaries/course_summary.md  ✅ 摘要
day4_agent_workspace/summaries/tasks.md          ✅ 待办
day4_agent_workspace/summaries/risks.md          ✅ 风险
day4_agent_workspace/cards/review_cards.json     ✅ 复习卡
day4_trace_log.jsonl                              ✅ 执行记录
```

---

## 检查自己学会了什么

问自己三个问题：
- Day4 和 Day3 的区别是什么？→ **Day3 是手动双击运行，Day4 是微信/设备一触发就自动运行**
- 如果没有 Day1 的路由表，Agent 知道用哪个模型吗？→ **不知道，所以 Day1 必须先做**
- 如果没有 Day2 的合同，Agent 知道输出什么格式吗？→ **不知道，所以 Day2 必须先做**
- 这 4 天其实在做什么？→ **做了一条完整的 AI 产品链路：选型→设计→实现→部署**

---

## 常见问题

**服务启动时报错 `Address already in use`**
→ 之前开过一个没关。关掉所有终端重新双击运行

**浏览器打开 dashboard 显示空白**
→ 先双击 `test_day4_service.bat` 跑一次自测，确保数据生成了

**S3 连不上 Wi-Fi**
→ 检查第 5 步的 Wi-Fi 密码是否正确，注意不能有空格

**`uvicorn` 找不到**
→ 运行 `pip install fastapi uvicorn pydantic`
