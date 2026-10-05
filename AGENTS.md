# Project engineering rules

- Use PostgreSQL for durable data and Redis for sessions, rate limits, and shared caching.
- Do not introduce SQLite, process-local caches, or in-memory storage substitutes.
- Follow the existing Clean Architecture boundaries: domain → application ← infrastructure/presentation.
- Keep FastAPI, Pydantic, SQLAlchemy, Redis, and HTTP client details out of the domain and application.
- Wire adapters in the composition root. Routers validate and translate; use cases coordinate behavior.
- Use Alembic migrations for database changes.
- Test persistence and session behavior against real PostgreSQL and Redis services.
- Keep the offline reviewer explicitly identified as rule-based. Never fabricate resume facts.
- Run lint, integration tests, Docker smoke tests, and browser tests before submitting changes.
- Do not read or modify excluded projects: BAITC-Hacks, AIRings, centralized-pm-management.

- Preserve the full CareerBot concept: accounts/profile, resume adaptation and versions, interview coaching, learning plans, progress and rewards. Do not remove a feature or substitute a demo for its real provider-backed implementation without explicit user direction.
- Commit completed implementation stages separately, then run the required checks before pushing.
