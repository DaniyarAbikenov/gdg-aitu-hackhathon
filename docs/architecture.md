# Architecture decisions

## Preserve the product boundary

CareerBot connects profile → resume adaptation → interview coaching → learning plan → progress. Architecture changes must preserve those capabilities. `docs/features.md` records the original behavior and restoration status.

## Clean Architecture with explicit ports

Domain and application modules contain no FastAPI, Pydantic, SQLAlchemy, Redis or HTTP client imports. The application coordinates repositories, sessions, documents and coaching ports. Infrastructure implements the ports; presentation validates external contracts and maps domain errors to HTTP. `app/main.py` is the composition root. An AST test enforces the dependency boundary.

Resumes, profiles, interviews, plans, versions and rewards are separate aggregates. JSONB captures their bounded documents; SQL columns provide ownership, revisions, timestamps and expiration. This avoids dozens of join tables for small documents while keeping transactions and queryable ownership explicit. Separate tables make aggregate lifecycles and quotas visible.

## PostgreSQL and Redis

PostgreSQL is the durable source of truth. There is no SQLite fallback. Redis owns expiring sessions, atomic limits and single-use Google login nonces. No data cache or persistence substitute runs inside a worker process. Temporary upload buffers, UI form state and immutable vocabularies are not data caches.

All reads/writes include owner and expiration predicates. Resume limits and aggregate quotas use a PostgreSQL advisory transaction lock per owner. Revisions are checked atomically on updates, including after external coaching requests. Separate version snapshots never overwrite the source resume; restoration explicitly requires the current resume revision.

Accounts use salted scrypt password hashes or a verified Google subject. Registration promotes the guest workspace to persistent records in the same database transaction. Redis session tokens rotate at authentication. A Google email never silently links to an existing password account.

## Coaching and document adapters

The actual Gemini adapter implements document extraction, concrete resume rewrites, interview generation/evaluation and learning plans with bounded schemas. A separate deterministic behavior within the adapter makes the demo runnable without credentials and labels every result. Neither mode pretends to calculate hiring probability.

AI data is untrusted. Rewrites refer to exact current sections, are shown with before/after/reason and require acceptance. Interview reference answers stay server-side until the corresponding answer is submitted. A failed provider call leaves the stored revision unchanged. PDF rendering escapes user text and performs no network fetches.

## Lifecycle and verification

Guest records expire after a bounded session lifetime; account data survives sign-out. Expired data is filtered immediately and purged periodically. Individual records and full workspaces can be deleted. Resume deletion removes its snapshots.

Tests use real PostgreSQL and Redis. Mock transports isolate external Google/Gemini protocols only. Browser tests exercise complete journeys and reload persistence on desktop/mobile. CI runs migrations, checks schema drift and dependency vulnerabilities, and builds/boots the Docker application.

## Remaining deployment concerns

The shipped configuration is for local evaluation. Public hosting needs HTTPS, secure cookies, operational credentials/backups and monitoring. Account recovery, legacy data migration and complete translation of explanatory copy are separate follow-up work. Dictation is a browser integration; NotebookLM is a manual exported-source workflow.
