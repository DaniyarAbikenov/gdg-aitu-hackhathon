# Architecture decisions

## Clean Architecture with a small aggregate

The central aggregate is a resume: user-reviewed fields, source filename, analysis, revision and lifetime. Domain models are dataclasses. Pydantic belongs at the HTTP and external-provider boundaries; SQLAlchemy belongs in infrastructure. An architecture test enforces dependency direction.

The application service coordinates document extraction, persistence, and review through protocols. It owns the rule that editing fields invalidates an earlier analysis. The composition root creates concrete adapters and manages their lifecycle.

## PostgreSQL and Redis

PostgreSQL is the source of truth. JSONB is intentional: resume sections form a single document and are versioned together. Owner, revision, creation and expiration remain separate queryable columns. Alembic owns schema changes. A transaction-scoped advisory lock makes the per-owner upload quota correct across workers.

Redis stores opaque session-token hashes and atomic rate limits with TTLs. It is a separate service, not an application-local cache. Persisted analyses are reused only for an unchanged resume and the same job description; an edit clears them.

The application starts only when the schema and Redis are reachable. Readiness checks both dependencies. PostgreSQL and Redis ports are not published by the development Compose file.

## Concurrency and lifecycle

Every update supplies a revision. SQL updates include owner, expiration and revision predicates. A slow reviewer cannot overwrite a newer edit: the revision is checked both before its call and atomically on persistence afterward. Missing or foreign records return 404; stale owned records return 409.

Sessions and their resumes share a deadline. Queries exclude expired records. A periodic cleanup task removes expired database records, including abandoned sessions. Deleting a workspace removes its database rows before deleting the session key so a transient database outage does not leave unreachable personal data.

## Presentation and external analysis

The interface uses same-origin requests, HttpOnly cookies, safe DOM text insertion and no third-party assets. CSRF protection combines SameSite=Strict with Origin validation. HTTP bodies are bounded even without Content-Length. The transient request buffer is bounded I/O, not a cache or persistence mechanism.

Gemini is optional and only produces validated suggestions. Deterministic skill matching remains visible. A trusted PDF renderer uses reviewed fields, XML escaping and a bundled Unicode font; no arbitrary model HTML or remote assets are interpreted.

## Deliberate limits

This is a single deployable application with external PostgreSQL and Redis. The use case does not justify microservices or a message broker. PDF parsing and review use synchronous adapters executed by FastAPI's worker threads, with bounded input and an HTTP timeout. For sustained public traffic, document work should move to supervised job workers with CPU/time budgets and stronger abuse controls.

The session cookie is a local demo identity. Real account authentication and longer-term document retention should be designed together if the project becomes a hosted product.
