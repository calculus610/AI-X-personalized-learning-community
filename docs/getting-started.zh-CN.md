# 本地运行指南

[English](getting-started.en.md) · [返回 README](../README.md)

本指南用 Docker Compose 启动一套完整的 AI-X Personalized Learning，包括 Next.js 前端、Fastify API、MySQL、MinIO 和 Nginx。不需要在主机上单独安装 Node.js、pnpm、MySQL 或 Nginx。

## 1. 准备环境

你需要：

- macOS、Windows 或 Linux；
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)，或 Docker Engine 与 Docker Compose v2；
- 能够下载基础镜像和安装构建依赖的网络；
- 建议在首次构建前预留至少 8 GiB 可用磁盘空间。

确认 Docker 已启动：

```bash
docker version
docker compose version
```

两条命令都应该正常返回版本信息。如果 `docker version` 无法连接 daemon，请先打开 Docker Desktop。

## 2. 准备本地配置

在仓库根目录执行：

### macOS / Linux

```bash
cp .env.example .env
```

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

`.env` 已经被 `.gitignore` 排除。默认值可用于隔离的本地体验，但如果计算机会被同一网络的其他人访问，请先替换：

- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `JWT_SECRET`

第三方 AI 变量可以保持为空。完整说明见 [配置与 API Key](configuration.zh-CN.md)。

## 3. 构建并启动

```bash
docker compose up --build -d
```

首次启动会执行以下工作：

1. 下载固定版本的 MySQL、MinIO 和 Nginx 镜像；
2. 从 `apps/backend` 构建 API 镜像；
3. 从 `apps/frontend` 构建 Next.js 镜像；
4. 创建数据库表并写入 Agent 基础配置；
5. 把仓库中的课程结构与资源导入 MySQL 和 MinIO；
6. 等待 API 和前端健康后启动 Nginx 入口。

构建时间取决于网络和计算机性能。查看状态：

```bash
docker compose ps
```

`mysql`、`api`、`frontend`、`nginx` 应最终显示为 healthy；`content-init` 应以状态码 0 完成并退出。

## 4. 打开平台

访问：

```text
http://localhost:8080/personalized-secure/
```

首次使用：

1. 在登录页切换到“注册”；
2. 创建一个本地用户名和密码；
3. 选择兴趣或学习方向；
4. 生成个性化路径，进入课程步骤；
5. 完成检查项、上传证据或开始 Quiz。

本项目不附带默认学生账号，也不包含真实用户数据。

## 5. 验证服务

浏览器入口：

```bash
curl -f http://localhost:8080/personalized-secure/api/health
```

后端 API：

```bash
curl -f http://localhost:8080/personalized-secure-api/health
```

查看所有服务日志：

```bash
docker compose logs -f
```

只查看某个服务：

```bash
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f content-init
```

使用 `Ctrl+C` 退出日志跟踪，不会停止容器。

## 6. 停止、再次启动与更新

停止服务并保留数据：

```bash
docker compose down
```

再次启动：

```bash
docker compose up -d
```

源码更新后重新构建：

```bash
docker compose up --build -d
```

MySQL 和 MinIO 数据分别保存在命名 Docker 卷 `mysql-data` 与 `minio-data` 中，普通的 `docker compose down` 不会删除它们。

### 彻底重置本地数据

```bash
docker compose down -v
```

> **警告：** `-v` 会永久删除这一套 Compose 项目的 MySQL 和 MinIO 卷，包括本地账号、学习进度和上传证据。只在确认不再需要这些数据时执行。

## 7. 常见问题

### 8080 端口已被占用

在 `.env` 中修改：

```dotenv
PERSONALIZED_SECURE_PORT=8088
```

重新执行 `docker compose up -d`，然后访问 `http://localhost:8088/personalized-secure/`。

### 容器一直处于 starting 或 unhealthy

先查看：

```bash
docker compose ps
docker compose logs --tail=200 mysql api content-init frontend nginx
```

常见原因包括镜像或依赖下载中断、磁盘空间不足、`.env` 值缺失，或旧数据卷中的数据库凭据与新 `.env` 不一致。

### 修改 `.env` 密码后 MySQL 无法连接

MySQL 初始化变量只在空数据卷第一次启动时生效。对已有数据执行直接改密码或安全迁移；只在可以删除全部本地数据时，才使用 `docker compose down -v` 重新初始化。

### 没有 API Key，但 Quiz 仍然可以工作

这是预期行为。Quiz 会从本地课程、学习步骤和内置规则构造题目。`DEEPSEEK_API_KEY` 只用于英文 Quiz 的模型增强翻译；没有 Key 时会使用本地英文降级逻辑。

### 学习伙伴显示降级回复

这表示 `AGENT_PROVIDER_URL` 或相应 HiAgent AppKey 未配置。平台的其他学习功能仍可使用。如需真实 Agent 回复，请按 [配置指南](configuration.zh-CN.md) 填入你自己的发布凭据。

## 8. 安全边界

默认 Compose 面向本地开发和课堂体验，不是一份已完成公网加固的生产方案。在暴露给局域网或公网前，至少需要：

- 更换所有本地示例密码和 JWT Secret；
- 使用 HTTPS 与适当的反向代理安全头；
- 限制入站网络访问并配置备份；
- 评估隐私、数据保留、账号管理和第三方 AI 条款。

安全问题请按 [SECURITY.md](../SECURITY.md) 报告。
