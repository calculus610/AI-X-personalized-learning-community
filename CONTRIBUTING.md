# 贡献指南 / Contributing Guide

## 中文

感谢你愿意改善 AI-X Personalized Learning。我们欢迎以下类型的贡献：

- 修复明确可复现的问题；
- 改善可访问性、中英文体验和本地安装流程；
- 补充后端、前端或 Docker 验证；
- 在来源和授权清晰的前提下贡献课程内容；
- 提出有证据支持的学习体验或架构改进建议。

### 开始之前

1. 阅读 [README](README.md)、[系统架构](docs/architecture.zh-CN.md) 和 [行为准则](CODE_OF_CONDUCT.md)。
2. 搜索已有 Issue 与 Pull Request，避免重复工作。
3. 对新功能、数据库变更、API 契约或跨模块修改，请先创建讨论 Issue，说明问题、实际用例和备选方案。
4. 安全漏洞、暴露的凭据或真实用户数据不应出现在公开 Issue，请使用 [SECURITY.md](SECURITY.md) 中的私密报告方式。

### 本地环境

推荐先用完整 Docker 路径复现现有行为：

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

访问 `http://localhost:8080/personalized-secure/`。详细说明见 [本地运行指南](docs/getting-started.zh-CN.md)。

### 修改原则

- 保持变更紧凑，一个 PR 解决一个清晰问题。
- 不要顺便重构与目标无关的模块。
- 行为变更需要相应测试，用户可见变更需要中英文案。
- 数据库变更需要可审查迁移，不得依赖手工修改已有数据。
- 不得加入生产服务器地址、SSH 命令、服务器快照或现网数据。
- 不得提交 `.env`、API Key、AppKey、Token、数据库凭据或真实用户信息。

### 资源与许可证

向 `content/course-assets/` 或 `assets/` 添加文件时，PR 必须说明：

- 资源的原始作者和来源 URL；
- 你是否拥有再分发权利；
- 适用的许可证和必要的署名；
- 文件是否包含个人信息、账号、密钥、本地网络信息或第三方受限内容。

如果无法证明可再分发，请改为链接官方来源，而不要将文件放进仓库。

### 验证

至少执行与修改范围对应的检查。

Backend：

```bash
cd apps/backend
npm ci
npm test
```

Frontend：

```bash
cd apps/frontend
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

Compose：

```bash
docker compose --env-file .env.example config --quiet
docker compose up --build -d
docker compose ps
```

不需要运行与修改无关的外部 AI 调用。测试不应消耗真实 Agent 额度或写入生产数据。

### Pull Request 清单

- [ ] PR 说明了问题、解决方式和用户影响。
- [ ] 变更未包含凭据、个人数据、生产信息或生成产物。
- [ ] 相关测试和构建已通过，结果已写入 PR。
- [ ] 用户可见修改已同步考虑中英文。
- [ ] 新资源已说明来源与许可证。
- [ ] 数据或契约变更包含迁移和回滚说明。

## English

Thank you for improving AI-X Personalized Learning. We welcome reproducible bug fixes, accessibility and bilingual UX improvements, local setup improvements, tests, well-licensed learning content, and evidence-backed product or architecture proposals.

### Before you begin

1. Read the [README](README_EN.md), [Architecture](docs/architecture.en.md), and [Code of Conduct](CODE_OF_CONDUCT.md).
2. Search existing issues and pull requests.
3. Open a discussion issue before implementing a feature, database change, API-contract change, or cross-module change. Describe the problem, real use case, and alternatives.
4. Never report vulnerabilities, exposed credentials, or real user data in a public issue. Follow [SECURITY.md](SECURITY.md).

### Local setup

Reproduce the current behavior through the complete Docker path first:

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

Open `http://localhost:8080/personalized-secure/`. See the [local setup guide](docs/getting-started.en.md) for details.

### Change principles

- Keep a pull request focused on one clear problem.
- Do not refactor unrelated modules opportunistically.
- Add tests for behavior changes and both languages for user-visible copy.
- Provide a reviewable migration for database changes; do not rely on manually editing existing data.
- Do not add production addresses, SSH commands, server snapshots, or live data.
- Never commit `.env`, API keys, AppKeys, tokens, database credentials, or real user information.

### Assets and licensing

When adding a file under `content/course-assets/` or `assets/`, state its author, source URL, redistribution right, licence, and required attribution. Confirm that it contains no personal information, account, credential, local-network detail, or restricted third-party content. Link to the official source instead when redistribution rights cannot be established.

### Validation

Run the checks relevant to your change.

Backend:

```bash
cd apps/backend
npm ci
npm test
```

Frontend:

```bash
cd apps/frontend
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

Compose:

```bash
docker compose --env-file .env.example config --quiet
docker compose up --build -d
docker compose ps
```

Do not call external AI services when they are unrelated to the change. Tests must not consume live Agent quota or write production data.

### Pull request checklist

- [ ] The PR explains the problem, solution, and user impact.
- [ ] It contains no credentials, personal data, production details, or generated artifacts.
- [ ] Relevant tests and builds pass, and results are included in the PR.
- [ ] User-facing changes account for both Chinese and English.
- [ ] New assets include source and licence information.
- [ ] Data or contract changes include migration and rollback notes.
