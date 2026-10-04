# Feature preservation map

Reference: original backend commit `82c50c1` and the `skill-pathfinder-151` frontend. This matrix replaces the earlier resume-only scope decision.

| Original capability | Evidence in prototype | Current implementation |
|---|---|---|
| Email registration and login | Firebase frontend auth; auth/user routes | PostgreSQL accounts, salted scrypt, rotating Redis sessions; `/auth/register`, `/auth/login`, `/auth/logout` |
| Google login | `Login.tsx`, Firebase `loginWithGoogle` | Optional Google Identity Services, verified ID tokens and one-use Redis nonce |
| Onboarding/profile | `Onboarding.tsx`, `UserProfile` | Original onboarding form backed by a persistent profile; full profile fields are available through the API |
| Skill normalization | Frontend trim/dedup | Trim/dedup in UI and validated backend fields |
| Resume upload and AI extraction | Resume routes, Gemini PDF extraction | Bounded PDF/TXT upload; Gemini extraction when configured; local text extraction otherwise, with an explicit AI-unavailable notice |
| Edit and verify resume | Resume editor screens | Editable fields; revision-based saves |
| Vacancy-specific adaptation | Gemini improvements with before/after/reason | Profile-aware rewrites, explicit accept/reject selection and saved version |
| Resume generation/templates | Modern/classic/minimalist selector; HTML output bug | Actual Unicode PDF in three styles |
| Version history/diff/active version | Mock `ResumeVersions.tsx` | Persistent snapshots, before/after comparison, restore, PDF and deletion |
| Interview setup | Company, job, stack, theoretical/practical/mixed | All inputs retained and used by coaching provider |
| Interview questions | Gemini question generation | Generated questions and references stored server-side; future answers not disclosed |
| Answer evaluation/results | Evaluator helper; incomplete route wiring | Each answer evaluated and persisted; feedback, reference, final score, history/resume |
| Learning plan | Eight mocked weekly modules | Eight generated modules using profile/resume/interview context, exercises, hours and resource search topics |
| Plan completion | React-only checkbox state | Durable progress and optimistic concurrency; API supports evidence notes |
| Plan export | Toast-only action | Real downloadable text artifact |
| NotebookLM overview | Toast-only action | Export source + manual NotebookLM import; no false claim of automatic video generation |
| Dashboard/progress | Fixed mock counters | Aggregated real saved work on Progress screen and connected navigation |
| Rewards | Mock availability/claim toast | Eligibility from records, persistent claims, duplicate protection |
| EN/RU/KZ preferences | Original locale files and switcher | Persisted en/ru/kk preference, localized navigation/core controls, coaching language. Additional explanatory copy still needs translation. |
| Audio interview mode | Setting toggle; STT service empty | Optional browser dictation, transcript review and text fallback; no claimed server transcription service |
| FAQ/support/policies | Static screens | Original static pages retained; support delivery is not configured |

## Behavior deliberately corrected

- Generated HTML is no longer mislabeled as a PDF.
- Interview answers are evaluated before the session advances; the last answer is retained.
- Progress, versions and rewards come from stored user activity instead of sample numbers.
- The default mode never supplies demo coaching. Explicit test mode is labelled; real coaching requires Gemini configuration.
- Provider suggestions require explicit user approval before becoming resume content.

## External prerequisites

Live Gemini requires an API key/model; live Google sign-in requires a web client ID and allowed origin. Browser dictation depends on browser/provider support. NotebookLM import remains an external user action. Legacy Firebase users and Firestore/GCS records require a separate data migration; existing deployments are not redirected.
