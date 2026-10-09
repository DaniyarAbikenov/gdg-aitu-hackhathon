# Local release and operating notes

## Before a presentation or deployment

- Run the isolated backend suite and desktop/mobile browser suite; check CI for the exact commit being presented.
- Run `docker compose exec backend alembic check`; verify `/health` and an authenticated manual resume/export workflow.
- Configure distinct database credentials. Bind publicly only behind a trusted HTTPS reverse proxy and set `CAREER_SECURE_COOKIE=true` for HTTPS; `deploy/compose.prod.yml` does both (see [deploy.md](deploy.md)). Browser microphones require a secure context; localhost is an exception.
- Choose a server AI provider and model IDs explicitly. Check live extraction against a representative PDF/DOCX, accept/restore a proposal, complete a text interview, and test voice permissions, interruptions, pause/reconnect and final assessment before advertising these integrations as verified.
- Keep keys and passwords outside Git. Administrator email is an allowlist, not a password; provision administrators using `python -m app.manage` inside the backend container.
- Choose and document retention for backups and provider-side data. The UI describes application storage and does not promise that account deletion erases third-party copies or backups.

## Observability

- **Logs.** API and worker write one JSON object per line to stdout (`docker compose logs -f backend worker`). Every request gets an `X-Request-ID` (a valid incoming one is kept) that appears on the access line, on every log line written while handling it, and on the worker's lines for jobs it queued. Unhandled errors are logged with the stack trace and return `{"code": "internal_error"}`.
- **Errors.** Set `CAREER_SENTRY_DSN` to report unhandled errors to Sentry or a compatible service. Personal data and request bodies are not sent; resumes never leave the server this way.
- **Traces.** Set `CAREER_OTEL_ENABLED=true` and the standard `OTEL_EXPORTER_OTLP_ENDPOINT` (for example a local Jaeger or Grafana Tempo) to export spans for HTTP requests, SQL, Redis and provider calls from both the API (`career-api`) and the worker (`career-worker`).

## AI usage and cost

Every request to OpenAI or Gemini is recorded in the `ai_usage` table: task, provider, model, input and output tokens, duration and whether it succeeded. Prompts, answers and user ids are not stored, and rows older than 180 days are removed by the API's cleanup loop. Administrators see the totals per task and per day at **Settings → AI usage and cost** (`GET /api/admin/ai-usage?days=30`). Set `CAREER_AI_INPUT_USD_PER_MILLION` and `CAREER_AI_OUTPUT_USD_PER_MILLION` to the provider's current prices for a cost estimate; the provider's own billing remains the source of truth.

## Backup

For a project started as `career-studio`, a local database backup can be created with:

```sh
mkdir -p work/backups
chmod 700 work/backups
docker compose -p career-studio exec -T postgres pg_dump -U career -d career -Fc > work/backups/career.dump
chmod 600 work/backups/career.dump
```

Backups contain private data. Store them outside published artifacts, encrypt/archive according to your deployment policy, and test restoration into a separate disposable database. Never restore over a live database without a verified backup and an explicit maintenance decision. Docker volume persistence alone is not a backup.

## Account controls

Email/password accounts can export all private material, change a password and delete their account after re-entering the current password and email. The database stores an authentication version; changing a password invalidates old Redis sessions on the next request even across workers. Deletion is a database transaction and removes private aggregates and activity. Shared skill definitions and knowledge articles remain shared content.

A forgotten password is reset through an emailed link (`POST /auth/password/forgot`, then `POST /auth/password/reset`). The response is the same whether or not the address has an account, each address receives at most three emails an hour, and the link works once for one hour. Setting the new password bumps the authentication version, so every existing session ends. After registration the user also receives a confirmation link valid for 24 hours; settings show whether the address is confirmed and can send a new link. Tokens are random, stored in Redis only as SHA-256 hashes, and travel in the URL fragment, so they never appear in server or proxy logs.

Email is sent by the worker from its own Redis queue, ahead of AI jobs, and retried twice. Locally, Docker Compose delivers it to Mailpit at http://127.0.0.1:8025, so no message leaves the machine. In production set `CAREER_SMTP_URL` (`smtp+starttls://user:password@host:587` or `smtps://...:465`), `CAREER_MAIL_FROM` and `CAREER_PUBLIC_URL`; without SMTP, recovery is reported as unavailable instead of pretending to send.

Google accounts can export data; self-service deletion and password recovery for those accounts are not implemented (they have no password, and Google confirms their address). The operator should verify identity using the configured provider before an administrative deletion. Never accept a public issue as identity proof.

## Known scale boundaries

Owner collections are bounded (20 resumes, 100 records per aggregate type). Vacancy/overview pages assemble those bounded collections; this is intentional for the MVP. Moving to large datasets requires paginated repositories and database-side analytics. Do not replace persistence with process memory caches. Per-owner transactions protect quotas and atomic resume changes. Managed PostgreSQL must support `pg_trgm`.
