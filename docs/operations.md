# Local release and operating notes

## Before a presentation or deployment

- Run the isolated backend suite and desktop/mobile browser suite; check CI for the exact commit being presented.
- Run `docker compose exec backend alembic check`; verify `/health` and an authenticated manual resume/export workflow.
- Configure distinct database credentials. Bind publicly only behind a trusted HTTPS reverse proxy and set `CAREER_SECURE_COOKIE=true` for HTTPS. Browser microphones require a secure context; localhost is an exception.
- Choose a server AI provider and model IDs explicitly. Check live extraction against a representative PDF/DOCX, accept/restore a proposal, complete a text interview, and test voice permissions, interruptions, pause/reconnect and final assessment before advertising these integrations as verified.
- Keep keys and passwords outside Git. Administrator email is an allowlist, not a password; provision administrators using `python -m app.manage` inside the backend container.
- Choose and document retention for backups and provider-side data. The UI describes application storage and does not promise that account deletion erases third-party copies or backups.

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

Google accounts can export data; self-service deletion and recovery for those accounts are not implemented. The operator should verify identity using the configured provider before an administrative deletion. Never accept a public issue as identity proof.

## Known scale boundaries

Owner collections are bounded (20 resumes, 100 records per aggregate type). Vacancy/overview pages assemble those bounded collections; this is intentional for the MVP. Moving to large datasets requires paginated repositories and database-side analytics. Do not replace persistence with process memory caches. Per-owner transactions protect quotas and atomic resume changes. Managed PostgreSQL must support `pg_trgm`.
