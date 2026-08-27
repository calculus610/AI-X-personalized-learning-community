# 安全策略 / Security Policy

## 中文

### 支持范围

Community 项目当前只支持最新默认分支。已过期的 commit、自定义 fork 和未由项目提供的部署环境可能仍然得到调查建议，但不承诺补丁。

### 私密报告

不要在公开 Issue、Discussion 或 Pull Request 中报告：

- 可利用的身份验证、授权或会话问题；
- 暴露的 API Key、AppKey、Token、数据库凭据或私钥；
- 可访问真实学习者数据、证据文件或跨账号数据的问题；
- 能够引起数据丢失、任意代码执行或内网访问的问题。

当 GitHub 仓库开启 **Private vulnerability reporting** 后，请优先使用该功能。如果该入口不可用，请通过维护组织的私密联系渠道请求一个安全报告方式；在得到安全渠道前，不要发送完整凭据或敏感利用代码。

报告中请包含：

- 受影响的版本或 commit；
- 受影响组件和最小复现条件；
- 预期影响与可能的安全边界；
- 可以安全共享的日志、截图或概念验证；
- 你是否已经向任何其他人披露该问题。

请不要为验证问题而访问他人数据、消耗第三方 AI 额度、持久化访问、修改服务或破坏数据。

### 凭据暴露

如果你发现仓库、日志或截图中包含真实凭据：

1. 不要在公开评论中复制完整值；
2. 记录文件、commit 和凭据类型，必要时只提供哈希摘要；
3. 通过私密渠道报告；
4. 由凭据所有者在相应服务中撤销或轮换；
5. 在新凭据安全存放后再恢复功能。

从当前文件删除值不等于凭据已经失效，也不代表 Git 历史中不再存在该值。

### 默认部署边界

根目录 Docker Compose 为本地开发和课堂体验提供。示例凭据、HTTP 入口和单机数据卷不等于已经完成生产加固。运营者负责 HTTPS、网络限制、密钥管理、备份、隐私和数据保留策略。

## English

### Supported versions

The Community project supports the latest default branch. We may offer investigation guidance for older commits, custom forks, and third-party deployments, but do not promise patches for them.

### Private reporting

Do not report exploitable authentication, authorization, session, credential-exposure, real-user-data, cross-account, data-loss, arbitrary-code-execution, or internal-network-access issues in a public issue, discussion, or pull request.

When the GitHub repository enables **Private vulnerability reporting**, use it first. If it is unavailable, ask the maintaining organization through a private contact channel for a secure reporting method. Do not send complete credentials or sensitive exploit code until a secure channel is established.

Include the affected version or commit, component, minimum reproduction conditions, expected impact, relevant security boundary, safely shareable evidence, and whether the issue has been disclosed elsewhere.

Do not access another person's data, consume third-party AI quota, persist access, modify a service, or damage data while validating a report.

### Exposed credentials

If a real credential appears in the repository, a log, or a screenshot:

1. do not copy its complete value into a public comment;
2. record the file, commit, and credential type, using a hash when identification is needed;
3. report it privately;
4. have the credential owner revoke or rotate it at the provider;
5. restore functionality only after the replacement is stored safely.

Removing a value from the current file does not invalidate the credential or remove it from Git history.

### Default deployment boundary

The root Docker Compose stack is for local development and classroom trials. Example credentials, an HTTP entry point, and single-host volumes are not a production-hardening claim. Operators are responsible for HTTPS, network restriction, secret management, backups, privacy, and data-retention policy.
