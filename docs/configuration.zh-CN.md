# 配置与 API Key

[English](configuration.en.md) · [返回 README](../README.md)

Community 仓库不提供任何真实的 API Key、AppKey、Token 或生产密码。启动前将 `.env.example` 复制为 `.env`，并只在本地 `.env` 中填写密钥。

```bash
cp .env.example .env
```

`.env` 已被 Git 忽略；`.env.example` 只保留变量名、空的第三方字段和本地示例值。

## 本地运行变量

| 变量 | 必需 | 用途 | 安全说明 |
| --- | --- | --- | --- |
| `PERSONALIZED_SECURE_PORT` | 否 | 将 Nginx 入口映射到主机的端口，默认 `8080` | 端口冲突时可更改 |
| `MYSQL_DATABASE` | 是 | 主业务数据库名 | 不是密钥，但应与部署配置一致 |
| `MYSQL_USER` | 是 | API 使用的 MySQL 用户 | 公网环境不应沿用示例值 |
| `MYSQL_PASSWORD` | 是 | MySQL 业务用户密码 | 真实密码，只应保存在本地/服务器环境配置 |
| `MYSQL_ROOT_PASSWORD` | 是 | MySQL root 初始化密码 | 高权限凭据，必须使用强随机值 |
| `MINIO_ROOT_USER` | 是 | MinIO 对象存储管理用户 | 应按敏感凭据保护 |
| `MINIO_ROOT_PASSWORD` | 是 | MinIO 对象存储管理密码 | 高权限凭据，必须使用强随机值 |
| `JWT_SECRET` | 是 | 签发与验证登录访问 Token | 必须是长且随机的 Secret，更换后现有 Token 将失效 |

`.env.example` 里的密码只为“在一台隔离开发机上快速体验”准备。它们不是生产密钥，但也不应被用在可被他人访问的环境。

## 可选的 DeepSeek 配置

| 变量 | 必需 | 用途 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 否 | 启用实时数字分身对话、动态界面翻译和英文 Quiz 的模型增强翻译 |

不填写 `DEEPSEEK_API_KEY` 时：

- 平台仍可启动；
- 注册、个性化路径、课程、证据和 Quiz 仍可使用；
- 数字分身概要使用本地规则生成；
- 数字分身自由对话会报告未配置；
- 英文 Quiz 使用本地降级翻译逻辑。

请从你自己的 DeepSeek 账号获取 Key，并自行了解调用价格、数据处理和使用条款。本项目不代为提供或共享额度。

## 可选的 HiAgent 学习伙伴配置

| 变量 | 必需 | 当前作用 |
| --- | --- | --- |
| `AGENT_PROVIDER_URL` | 调用 HiAgent 时是 | HiAgent 发布接口基础 URL；后端会请求 `/create_conversation` 和 `/chat_query_v2` |
| `AGENT_APP_KEY` | 否 | 未命中分阶段 Key 时使用的默认 AppKey |
| `HIAGENT_PHASE1_APP_KEY` | 否 | Phase 1 学习伙伴的服务端 AppKey |
| `HIAGENT_PHASE2_APP_KEY` | 否 | Phase 2 学习伙伴的服务端 AppKey |
| `HIAGENT_PHASE34_APP_KEY` | 否 | Phase 3/4 共用的服务端 AppKey |
| `HIAGENT_PHASE5_APP_KEY` | 否 | Phase 5 学习伙伴的服务端 AppKey |
| `AGENT_PROVIDER_API_KEY` | 否 | 为其他 Provider Adapter 保留；当前 HiAgent 请求路径不使用该变量 |

当 `AGENT_PROVIDER_URL` 或适用的 AppKey 为空时，学习伙伴不会调用外部 Agent，而是返回明确的后端降级消息。会话与学习上下文仍会按本地证据链路保存。

HiAgent 发布模式可能具有不同的凭据性质和管理策略。在开启外部调用前，请由你的 HiAgent 管理员确认：

- 这些 AppKey 对应的 Agent 和发布环境；
- 是否启用了域名、访问控制、限额或日志审计；
- 是否允许服务端使用，以及应遵循的轮换策略。

## 示例

```dotenv
# 可选：DeepSeek
DEEPSEEK_API_KEY=your-deepseek-api-key

# 可选：HiAgent
AGENT_PROVIDER_URL=https://your-hiagent-publication-endpoint.example
AGENT_PROVIDER_API_KEY=
AGENT_APP_KEY=
HIAGENT_PHASE1_APP_KEY=your-phase1-app-key
HIAGENT_PHASE2_APP_KEY=your-phase2-app-key
HIAGENT_PHASE34_APP_KEY=your-phase34-app-key
HIAGENT_PHASE5_APP_KEY=your-phase5-app-key
```

上述值全部是占位符，不是可用凭据。

## 更新配置

修改 `.env` 后重建 API 容器：

```bash
docker compose up -d --force-recreate api
```

如果你同时修改了数据库或 MinIO 凭据，不要盲目重建已有数据卷。MySQL 初始化密码只在空数据卷首次启动时生效，应对已有数据执行有计划的凭据迁移。

## 不要这样做

- 不要将 `.env` 或密钥复制到 `.env.example`；
- 不要将后端密钥放入 `NEXT_PUBLIC_*` 变量；
- 不要把 AppKey、Token 或数据库 URL 写入 HTML、前端 JavaScript、截图或文档；
- 不要在 Issue、PR 或日志中粘贴完整凭据；
- 不要将本地示例密码用于可共享或公网环境。

如果凭据曾被提交、上传或发送到不可信位置，应将它视为已泄露，在所属服务端执行轮换/撤销，然后按 [SECURITY.md](../SECURITY.md) 报告。
