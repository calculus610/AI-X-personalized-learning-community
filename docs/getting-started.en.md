# Local setup guide

[中文](getting-started.zh-CN.md) · [Back to README](../README_EN.md)

This guide starts a complete AI-X Personalized Learning stack with Docker Compose: the Next.js frontend, Fastify API, MySQL, MinIO, and Nginx. You do not need to install Node.js, pnpm, MySQL, or Nginx separately on the host.

## 1. Prerequisites

You need:

- macOS, Windows, or Linux;
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), or Docker Engine with Docker Compose v2;
- network access for base images and build dependencies;
- at least 8 GiB of free disk space before the first build is recommended.

Confirm that Docker is running:

```bash
docker version
docker compose version
```

Both commands should print version information. If `docker version` cannot reach the daemon, start Docker Desktop first.

## 2. Prepare local configuration

Run this from the repository root.

### macOS / Linux

```bash
cp .env.example .env
```

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

`.env` is excluded by `.gitignore`. The defaults can be used for an isolated local trial. If anyone else can reach your machine, replace these values before startup:

- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `MINIO_ROOT_USER`
- `MINIO_ROOT_PASSWORD`
- `JWT_SECRET`

Third-party AI variables may remain empty. See [Configuration and API keys](configuration.en.md) for details.

## 3. Build and start

```bash
docker compose up --build -d
```

On the first run, Compose will:

1. download pinned MySQL, MinIO, and Nginx images;
2. build the API image from `apps/backend`;
3. build the Next.js image from `apps/frontend`;
4. create database tables and seed the base Agent configuration;
5. import the repository's course structure and assets into MySQL and MinIO;
6. start the Nginx entry point after the API and frontend become healthy.

Build time depends on the machine and network. Check progress with:

```bash
docker compose ps
```

`mysql`, `api`, `frontend`, and `nginx` should eventually be healthy. `content-init` should finish with exit code 0.

## 4. Open the platform

Visit:

```text
http://localhost:8080/personalized-secure/
```

On first use:

1. switch to **Register** on the sign-in page;
2. create a local username and password;
3. select interests or learning directions;
4. generate a personalized route and open a course step;
5. complete checklist items, upload evidence, or start a quiz.

The project ships no default student account and no real user data.

## 5. Verify the services

Browser-facing health endpoint:

```bash
curl -f http://localhost:8080/personalized-secure/api/health
```

Backend API health endpoint:

```bash
curl -f http://localhost:8080/personalized-secure-api/health
```

Follow all service logs:

```bash
docker compose logs -f
```

Follow one service:

```bash
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f content-init
```

`Ctrl+C` stops following logs; it does not stop the containers.

## 6. Stop, restart, and update

Stop the services and keep data:

```bash
docker compose down
```

Start them again:

```bash
docker compose up -d
```

Rebuild after a source update:

```bash
docker compose up --build -d
```

MySQL and MinIO data live in the named `mysql-data` and `minio-data` Docker volumes. A normal `docker compose down` leaves them intact.

### Permanently reset local data

```bash
docker compose down -v
```

> **Warning:** `-v` permanently deletes this Compose project's MySQL and MinIO volumes, including local accounts, progress, and uploaded evidence. Run it only when you are certain that the data is no longer needed.

## 7. Troubleshooting

### Port 8080 is already in use

Change this in `.env`:

```dotenv
PERSONALIZED_SECURE_PORT=8088
```

Run `docker compose up -d` again and open `http://localhost:8088/personalized-secure/`.

### A container remains starting or becomes unhealthy

Inspect status and recent logs:

```bash
docker compose ps
docker compose logs --tail=200 mysql api content-init frontend nginx
```

Common causes include an interrupted image or dependency download, insufficient disk space, missing `.env` values, or credentials in an existing database volume that no longer match the new `.env`.

### MySQL stops connecting after `.env` passwords change

MySQL initialization variables take effect only when an empty data volume is started for the first time. Migrate or change credentials deliberately when data already exists. Use `docker compose down -v` only when deleting all local data is acceptable.

### Quizzes work even though no API key is configured

This is expected. Quizzes are built from local course content, learning steps, and deterministic rules. `DEEPSEEK_API_KEY` only enhances English quiz translation; without it, the platform uses its local English fallback.

### The learning companion returns a fallback message

This means `AGENT_PROVIDER_URL` or the matching HiAgent AppKey is missing. Other learning features remain available. Follow the [configuration guide](configuration.en.md) to add your own publication credentials for live Agent responses.

## 8. Security boundary

The default Compose stack is intended for local development and classroom trials. It is not a public-internet production hardening guide. Before exposing it to a LAN or the internet, at minimum:

- replace every local example password and the JWT secret;
- use HTTPS and suitable reverse-proxy security headers;
- restrict inbound network access and configure backups;
- assess privacy, retention, account management, and third-party AI terms.

Report security issues according to [SECURITY.md](../SECURITY.md).
