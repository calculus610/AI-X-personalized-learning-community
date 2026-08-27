# CLI-Anything

> **Towards Agent-Native Computer Use** — 让 AI 智能体直接控制任意软件

由 [香港大学数据科学实验室 (HKUDS)](https://github.com/HKUDS) 开源，CLI-Anything 通过全自动流水线将任意软件的 GUI 功能转化为生产级命令行工具（CLI），构建真正的 "Agent-Native" 生态。

---

## 核心思路

传统 AI 控制软件依赖 GUI 自动化（截图、识别按钮、模拟鼠标），脆弱且不可扩展。CLI-Anything 另辟蹊径：让 AI 像调用 `ffmpeg` 或 `git` 一样，通过文本命令直接调用软件的后端能力。

| 传统方式 | CLI-Anything |
|---------|-------------|
| 截图 + 视觉识别 + 模拟点击 | 纯文本命令调用 |
| 分辨率变化即崩溃 | 确定性执行，稳定可靠 |
| 难以解析执行结果 | 原生 JSON 输出，AI 直接消费 |

---

## 全自动 7 阶段流水线

给定一个软件的代码库，CLI-Anything 自动完成：

```
分析 → 设计 → 实现 → 规划测试 → 编写测试 → 文档生成 → 发布
```

1. **分析** — 扫描源代码，将 GUI 操作映射到 API
2. **设计** — 设计命令架构、状态模型和输出格式
3. **实现** — 构建基于 Click 的 CLI，支持 REPL 和 JSON 输出
4. **规划测试** — 创建单元测试和端到端测试计划
5. **编写测试** — 实现全面的测试套件
6. **文档生成** — 更新测试文档
7. **发布** — 创建 `setup.py` 并安装到 PATH

---

## 关键特性

- **纯文本格式天然适配 LLM** — 无需复杂的格式转换
- **自描述性** — 通过 `--help` 自动提供文档，AI 可以自主发现功能
- **确定性执行** — 相比 GUI 的模糊性，CLI 提供可靠且确定的结果
- **原生 JSON 输出** — 所有命令支持 `--json` 标志，方便 AI 解析
- **撤销/重做支持** — 内置状态管理，操作可回滚

---

## 已支持软件（部分）

| 软件 | 领域 | 状态 |
|------|------|------|
| GIMP | 图像处理 | ✅ 已支持 |
| Blender | 3D 建模 | ✅ 已支持 |
| Inkscape | 矢量图形 | ✅ 已支持 |
| LibreOffice | 办公套件 | ✅ 已支持 |
| Audacity | 音频编辑 | ✅ 已支持 |
| OBS Studio | 直播/录屏 | ✅ 已支持 |
| ComfyUI | AI 工作流 | ✅ 已支持 |

累计覆盖 **18 款主流软件**，运行超过 **1,700 项测试** 全部通过。

---

## 支持的 Agent 框架

- Claude Code
- OpenCode
- Codex
- Goose
- Cursor

---

## 快速开始

### 安装

```bash
pip install cli-anything
```

### 使用示例

```bash
# 为 GIMP 生成 CLI
cli-anything generate --source /path/to/gimp --output gimp-cli

# 安装生成的 CLI
cd gimp-cli && pip install -e .

# AI 可直接调用
gimp-cli --help
gimp-cli open --file image.png --json
gimp-cli filter --name "blur" --radius 5 --json
```

---

## 相关资源

- **GitHub**: https://github.com/HKUDS/CLI-Anything
- **CLI-Hub**（工具市场）: https://clianything.cc/
- **论文**: CLI-Anything: Towards Agent-Native Computer Use (arXiv)
- **实验室**: [HKUDS @ 香港大学](https://github.com/HKUDS)

---

## 关于 HKUDS

香港大学数据科学实验室（HKUDS）致力于构建下一代 AI 基础设施。CLI-Anything 是继 [LightRAG](https://github.com/HKUDS/LightRAG) 之后的又一热门开源项目，GitHub Stars 已突破 4 万。

---

## License

MIT License
