# Feature preservation map

Reference: original backend commit `82c50c1` and the `skill-pathfinder-151` frontend. This matrix replaces the earlier resume-only scope decision.

| Original capability | Evidence in prototype | Current implementation |
|---|---|---|
| Email registration and login | Firebase frontend auth; auth/user routes | PostgreSQL accounts, salted scrypt, rotating Redis sessions; `/auth/register`, `/auth/login`, `/auth/logout` |
| Google login | `Login.tsx`, Firebase `loginWithGoogle` | Optional Google Identity Services, verified ID tokens and one-use Redis nonce |
| Onboarding/profile | `Onboarding.tsx`, `UserProfile` | Structured experience, projects, education, contacts and skills; month/year work periods; reviewable AI PDF-to-profile import; snapshot selected blocks into new resumes |
| Skill normalization | Frontend trim/dedup | Shared PostgreSQL catalog, optional descriptions, normalized unique names and fuzzy suggestions |
| Resume upload and AI extraction | Resume routes, Gemini PDF extraction | Drag-and-drop PDF/DOCX/TXT; structured OpenAI/Gemini extraction; explicit errors without cloud configuration, no silent heuristic fallback |
| Edit and verify resume | Resume editor screens | Editable fields; revision-based saves |
| Vacancy-specific adaptation | Gemini improvements with before/after/reason | Profile-aware rewrites; explicit acceptance atomically saves before/after snapshots and the current resume |
| Resume generation/templates | Modern/classic/minimalist selector; HTML output bug | Actual Unicode PDF in three styles plus editable DOCX, with readable structured sections |
| Version history/diff/active version | Mock `ResumeVersions.tsx` | Persistent snapshots, before/after comparison, restore, PDF and deletion |
| Interview setup | Company, job, stack, theoretical/practical/mixed | All inputs retained and used by coaching provider |
| Interview questions | Gemini question generation | Generated questions and references stored server-side; future answers not disclosed |
| Answer evaluation/results | Evaluator helper; incomplete route wiring | Each answer evaluated and persisted; feedback, reference, final score, history/resume |
| Learning plan | Eight mocked weekly modules | Eight generated modules using profile/resume/interview context, exercises, hours and resource search topics |
| Plan completion | React-only checkbox state | Durable progress and optimistic concurrency; API supports evidence notes |
| Plan export | Toast-only action | Real downloadable text artifact |
| NotebookLM overview | Toast-only action | Export source + manual NotebookLM import; no false claim of automatic video generation |
| Dashboard/progress | Fixed mock counters | Configurable analytic widgets, weekly comparisons, activity, XP and vacancy-specific next actions |
| Rewards | Mock availability/claim toast | Eligibility from records, persistent claims, duplicate protection |
| EN/RU/KZ preferences | Original locale files and switcher | Persisted en/ru/kk preference, localized screens/forms/errors/built-in skill descriptions, language-filtered knowledge articles and coaching language. User-authored content remains in its original language. |
| Audio interview mode | Setting toggle; STT service empty | Browser dictation plus OpenAI Realtime WebRTC mode, saved transcripts and final assessment; requires real provider configuration |
| FAQ/support/policies | Static screens | Searchable knowledge base, administrator draft/preview/publish editor, factual policy and user-initiated GitHub support link |

## Behavior deliberately corrected

- Generated HTML is no longer mislabeled as a PDF.
- Interview answers are evaluated before the session advances; the last answer is retained.
- Progress, versions and rewards come from stored user activity instead of sample numbers.
- The default mode never supplies demo coaching. Explicit test mode is labelled; real coaching requires OpenAI or Gemini configuration.
- Provider suggestions require explicit user approval before becoming resume content.

## External prerequisites

Live OpenAI/Gemini requires an API key/model; voice also requires Realtime and transcription model IDs; live Google sign-in requires a web client ID and allowed origin. Browser dictation depends on browser/provider support. NotebookLM import remains an external user action. Legacy Firebase users and Firestore/GCS records require a separate data migration; existing deployments are not redirected.

## Connected preparation release

Saved vacancies now connect a selected resume, interview history and learning plans. Application stages, private notes and next-contact dates are editable. Accounts can export private data; password accounts support password changes with global session revocation and confirmed deletion. Public product introduction, reproducible manual demo data and presentation/operations guides are included.

## Company atlas and vacancy import

`/companies` is a private PostgreSQL-backed company research workspace, shared with the existing vacancy/interview workflows. Records include website, location, stack, hiring stages, notes and source-linked assignments distinguished as employer tasks or personal practice. Companies can be archived and edited with revision checks. No invented company task corpus is presented as verified employer material.

`/applications/import` reads a public HTTP(S) vacancy or pasted text through the configured structured AI adapter. A reviewable draft contains role, employer, stack, requirements, responsibilities, location, employment and salary. The user applies the preview to the form and saves separately. Missing facts stay blank. Sites requiring sign-in, JavaScript rendering or blocking requests may need pasted text.

The fetcher rejects private/reserved IPs, credentials and nonstandard ports, pins the resolved public IP, revalidates redirects, bounds bytes/time and strips active HTML. It does not send application cookies or provider secrets to the supplied URL.

## Cover letters and calendar reminders

`POST /applications/{id}/cover-letter` drafts a letter for a saved vacancy from the selected resume (or the profile when none is selected). Only confirmed facts are sent: name, summary, skills, roles, projects and education. The response lists the facts the letter relies on, the vacancy skills the candidate has, and the ones they lack; a missing skill is named as a gap, never claimed. The draft is not stored until the user edits and saves it with the application. The rule-based provider writes a template letter in English, Russian or Kazakh and is labelled as a test provider.

`GET /applications/calendar.ics` exports next-contact dates of open applications, and `GET /plan/{id}/calendar.ics?start=YYYY-MM-DD` adds one reminder per learning week. Both are standard iCalendar files for Google Calendar, Outlook or Apple Calendar.

## Password recovery and email confirmation

The sign-in page offers "Forgot password?" when email is configured. The emailed link opens a page that sets a new password and signs out every device. New accounts receive a confirmation link; settings show the status and can send a new one. Messages are written in the interface language (English, Russian or Kazakh). See `docs/operations.md#account-controls` for limits and SMTP settings.

## Master profile and linked resumes

The profile is the single place for every confirmed fact, including achievements and interests that rarely belong in every resume. Experience, education, project and achievement entries carry stable ids. `/resume/new` lets the candidate choose whole sections and individual entries; interests start unselected.

Each resume remembers which profile facts it was built from (`resumes.profile_link`). `GET /resume/{id}/profile-changes` compares three states (what the resume was built from, the resume now, and the profile now) and lists:

- **update:** only the profile changed, safe to apply;
- **review:** both the profile and the resume changed, so the candidate decides;
- **new:** facts added to the profile since; new skills are ranked by how many open saved vacancies ask for them;
- **removed:** facts deleted from the profile but still in the resume.

Nothing changes until the candidate saves decisions with `POST /resume/{id}/profile-changes`. Before an accepted change is written, the previous text is stored as a version in the same transaction, and a stale list of changes is refused with 409. Keeping the resume text creates no version and hides that suggestion afterwards. Resumes made before linking are matched to profile entries by company and role (or title) and linked after one review. The resume library marks resumes with pending updates (`GET /resume-links`).

## Application funnel and rejection reviews

Each saved vacancy remembers when it first reached each status (`stages`), so a rejection keeps the furthest stage it got to. `/applications/funnel` (`GET /applications/funnel?offset=`) shows:

- saved → applied → interview → offer, with the share of the previous stage that moved on;
- rejections after applying or after an interview, and the reasons the candidate noted;
- eight local weeks of effort: applications sent, practice interviews finished and learning modules completed;
- feedback built only from those records: this week's effort, a streak of active weeks, interviews reached, a repeated rejection reason, and rejections caused by things outside the candidate's control. It never estimates the chance of an offer.

A rejected application asks three questions (`PUT /applications/{id}/rejection`): where it stopped, the main reason as far as the candidate knows, and, for technical, assignment or behavioural reasons, the topics that felt weak. Employer feedback is optional. The answer leads to one next step: tailor the resume, a learning plan prefilled with the weak topics, a practice interview for that vacancy, checking the salary fit early, or simply moving on when the reason was outside the candidate's control. Records saved before this release have no stage dates; the candidate's answer fills in the stage.
