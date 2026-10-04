# Moving from the hackathon prototype to Career Studio

Version 0.2 is a deliberate API revision for a reproducible portfolio demo. It does not modify the separate frontend repository or existing Google Cloud deployments.

| Prototype | Portfolio release |
|---|---|
| Firebase token + Firestore + GCS required at import | Redis session + PostgreSQL, initialized at startup |
| Upload then explicit extraction | Upload returns extracted editable fields |
| Unvalidated dictionaries for edits | Bounded Pydantic contracts and required revision |
| Old recommendations reused across different jobs | Stored analysis belongs to one saved revision and one job |
| GET could trigger an AI extraction | GET is read-only |
| Generated HTML returned under a PDF field | Real PDF bytes from reviewed data |
| Empty test files | Domain, real database integration, and browser tests |
| Compose depended on a commented-out database | Healthy PostgreSQL/Redis, one-shot migration, non-root API |

The supported journey is resume upload, manual review, job comparison and PDF export. Unfinished interview/profile/roadmap endpoints and duplicated cloud helpers are removed from the runnable package. They remain available in the repository's history.

The old external frontend's field shape and Firebase authentication do not match this API. Use the bundled interface, or adapt an external client using the generated OpenAPI specification. No existing deployed frontend is silently redirected.

Upgrading does not copy data out of Firestore or GCS. A migration of real user records requires an explicit data mapping and authorization; this project does not attempt it.
