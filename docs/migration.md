# Migration from the hackathon prototype

Version 0.3 preserves the CareerBot concept across profiles, resumes, interviews, plans and progress. The earlier resume-only refactor was a scope error; this revision restores the connected workflows and completes the previously mocked ones.

## Functional migration

See [the feature matrix](features.md) for every original capability, its new implementation, and external prerequisites.

| Legacy behavior | Current API |
|---|---|
| Firebase login/token | Local registration/login or optional Google identity → opaque Redis session cookie |
| `GET /user/profile` | Same path; returns `{id, revision, data}` |
| `POST /user/profile/update` | `{profile, revision}`; profile revision 0 creates the first record |
| Upload → explicit `/extract` | `/resume/upload` immediately extracts fields using the configured provider |
| Save arbitrary field dictionary | Bounded fields plus optimistic revision |
| `/improve` | Skill comparison and advice; `/adapt` adds profile-aware before/after changes |
| `/generate` returned HTML URL | `/pdf?template=modern|classic|minimalist` returns real PDF bytes |
| Mock resume versions | `/resume/{id}/versions`, `/versions/{id}/restore`, `/versions/{id}/pdf` |
| `/interview/start` | Same path; accepts company, job, stack, style and language |
| `/interview/{id}/answer` | Requires revision; returns persisted feedback, next question or final result |
| Plan/progress stubs | `/plan`, `/plan/{id}/modules/{week}`, `/progress`, reward claims |

All career data is scoped to the authenticated or guest workspace. A foreign record ID returns 404. Concurrent changes return 409. Original files are not retained. Raw provider output is validated and never executed as HTML.

## Data and deployment

Alembic upgrades existing portfolio PostgreSQL data in place:

- `0001`: resume storage.
- `0002`: accounts, profiles, interviews, plans, versions and rewards; nullable expiration for account-owned data.
- `0003`: Google identity subjects, without automatic email-based account linking.

Guest records still expire. Registering promotes that guest's records to persistent account ownership. Signing into an existing account opens its workspace; it does not merge unrelated guest data. Clearing a workspace removes career content but retains the account credential.

The old separate frontend uses Firebase tokens and different shapes. It is not silently redirected to this API and its repository is unchanged. Use the bundled interface or adapt the client using OpenAPI. Original routes and implementations remain in Git history.

There is no automatic Firestore/GCS or Firebase-user migration. Real legacy account/data migration needs an explicit mapping and deployment plan.
