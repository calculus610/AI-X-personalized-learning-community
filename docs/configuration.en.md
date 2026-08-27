# Configuration and API keys

[中文](configuration.zh-CN.md) · [Back to README](../README_EN.md)

The Community repository provides no real API key, AppKey, token, or production password. Copy `.env.example` to `.env` before startup and put credentials only in your local `.env`.

```bash
cp .env.example .env
```

Git ignores `.env`. `.env.example` contains variable names, empty third-party fields, and local example values only.

## Local runtime variables

| Variable | Required | Purpose | Security note |
| --- | --- | --- | --- |
| `PERSONALIZED_SECURE_PORT` | No | Host port for the Nginx entry point; defaults to `8080` | Change it when the port is already occupied |
| `MYSQL_DATABASE` | Yes | Primary application database name | Not a secret, but must match the deployment configuration |
| `MYSQL_USER` | Yes | MySQL user used by the API | Do not reuse the example in a remotely reachable environment |
| `MYSQL_PASSWORD` | Yes | Password for the MySQL application user | Real credential; keep it in local or server-side environment configuration only |
| `MYSQL_ROOT_PASSWORD` | Yes | MySQL root initialization password | Privileged credential; use a strong random value |
| `MINIO_ROOT_USER` | Yes | Administrative user for MinIO object storage | Treat it as a sensitive credential |
| `MINIO_ROOT_PASSWORD` | Yes | Administrative password for MinIO | Privileged credential; use a strong random value |
| `JWT_SECRET` | Yes | Signs and verifies sign-in access tokens | Use a long random secret; rotating it invalidates existing tokens |

Passwords in `.env.example` exist only to make an isolated developer-machine trial straightforward. They are not production secrets and must not be used where another person can reach the service.

## Optional DeepSeek configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | No | Enables live digital-twin chat, dynamic interface translation, and model-enhanced English quiz translation |

Without `DEEPSEEK_API_KEY`:

- the platform still starts;
- registration, routes, courses, evidence, and quizzes remain available;
- the digital-twin summary uses local rule-based generation;
- free-form digital-twin chat reports that the provider is not configured;
- English quizzes use the local fallback translation logic.

Obtain a key from your own DeepSeek account and review its pricing, data processing, and terms. This project provides neither credentials nor shared quota.

## Optional HiAgent learning-companion configuration

| Variable | Required | Current purpose |
| --- | --- | --- |
| `AGENT_PROVIDER_URL` | Yes for HiAgent calls | Base URL of the HiAgent publication API; the backend calls `/create_conversation` and `/chat_query_v2` |
| `AGENT_APP_KEY` | No | Default AppKey when no phase-specific key matches |
| `HIAGENT_PHASE1_APP_KEY` | No | Server-side AppKey for the Phase 1 companion |
| `HIAGENT_PHASE2_APP_KEY` | No | Server-side AppKey for the Phase 2 companion |
| `HIAGENT_PHASE34_APP_KEY` | No | Shared server-side AppKey for Phase 3 and Phase 4 |
| `HIAGENT_PHASE5_APP_KEY` | No | Server-side AppKey for the Phase 5 companion |
| `AGENT_PROVIDER_API_KEY` | No | Reserved for other provider adapters; the current HiAgent request path does not use this variable |

When `AGENT_PROVIDER_URL` or the applicable AppKey is empty, the companion does not call an external Agent. It returns an explicit backend fallback message instead. The conversation and learning context are still stored through the local evidence path.

HiAgent publication modes may apply different credential properties and management policies. Before enabling external calls, ask your HiAgent administrator to confirm:

- which Agent and publication environment each AppKey represents;
- whether domain, access-control, quota, and audit-log controls are enabled;
- whether server-side use is allowed and which rotation policy applies.

## Example

```dotenv
# Optional: DeepSeek
DEEPSEEK_API_KEY=your-deepseek-api-key

# Optional: HiAgent
AGENT_PROVIDER_URL=https://your-hiagent-publication-endpoint.example
AGENT_PROVIDER_API_KEY=
AGENT_APP_KEY=
HIAGENT_PHASE1_APP_KEY=your-phase1-app-key
HIAGENT_PHASE2_APP_KEY=your-phase2-app-key
HIAGENT_PHASE34_APP_KEY=your-phase34-app-key
HIAGENT_PHASE5_APP_KEY=your-phase5-app-key
```

Every value above is a placeholder, not a usable credential.

## Apply an updated configuration

After editing `.env`, recreate the API container:

```bash
docker compose up -d --force-recreate api
```

If you also change database or MinIO credentials, do not blindly recreate existing data volumes. MySQL initialization passwords apply only when an empty volume starts for the first time. Migrate credentials deliberately when data already exists.

## Do not do this

- Do not copy `.env` or credentials into `.env.example`.
- Do not put backend credentials in `NEXT_PUBLIC_*` variables.
- Do not embed AppKeys, tokens, or credential-bearing database URLs in HTML, frontend JavaScript, screenshots, or documentation.
- Do not paste complete credentials into issues, pull requests, or logs.
- Do not use the local example passwords in a shared or internet-facing environment.

If a credential was committed, uploaded, or sent to an untrusted location, treat it as exposed. Rotate or revoke it at the provider, then report the incident according to [SECURITY.md](../SECURITY.md).
