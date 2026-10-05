# A five-minute presentation

## Prepare

1. Follow the root README to start Docker. Keep existing data volumes.
2. Create a **separate fictional account** with real PostgreSQL records:

   ```sh
   python3 scripts/seed_demo.py --url http://localhost:8088
   ```

   Enter a new password at the hidden prompt. The script never overwrites existing accounts and makes no paid AI calls. If rerunning, use a new `--email`. All seeded content identifies itself as fictional; no completed interviews or generated scores are seeded.
3. Open `/`, show the product explanation, and sign in as `demo@a2d.local` with your chosen password.
4. For AI and voice, configure local server credentials/model IDs and restart the backend. Verify real document extraction and at least one complete conversation before showing them as working. Never expose `.env`, account passwords or provider keys in a recording.

## Show the user journey

- **0:00–0:40 — Problem.** “I am preparing for one junior developer vacancy, but resume edits, interview practice and learning tasks are scattered.” Explain the vacancy-centred workflow.
- **0:40–1:30 — Facts and resume.** Open the profile and vacancy. Show the selected resume, structured project/education fields and actual DOCX/PDF download. Explain that a new resume snapshots selected profile blocks.
- **1:30–2:30 — Adaptation (if configured).** Use the sample job requirements. Show before/after proposals, accept one and open version history. Show both original and changed versions, and that stale writes are rejected. If AI is unconfigured, show manual editing and state this limitation plainly.
- **2:30–3:30 — Practice (if configured).** Start from the vacancy, show prefilled context, choose theory/practice, then answer a question. In a prepared completed session, inspect the actual answer-level feedback. Voice requires a microphone and real Realtime configuration; do not simulate provider responses for the presentation.
- **3:30–4:20 — Learning and next contact.** Create a plan from that vacancy and its latest completed interview. Save evidence for a module. Set the next contact date and return to the overview.
- **4:20–5:00 — Engineering and control.** Show PostgreSQL persistence after reload, data export, the architecture diagram, green CI and a brief account of the design tradeoffs.

## What to claim

“I evolved a hackathon project into a connected career-preparation MVP with a React frontend, FastAPI use cases, PostgreSQL/Redis persistence, structured AI adapters, transactional versioning, owner isolation, browser tests and Docker CI.” Credit the original repository and imported frontend provenance.

Do not claim product-market fit, proven improvement in hiring rates, universal ATS compatibility, live cloud validation when not performed, or an independently audited production service.

The exact startup commands and the seeded manual data are reproducible. No cloud-provider result is included in the seed. For screenshots of AI feedback, create a real consented session after provider configuration and label any test-provider captures explicitly.

## Company research and link import

Open **Companies** to show the private company atlas. A saved company can hold its stack, location, hiring process and test assignments. Add an assignment with a source URL and distinguish employer material from personal practice. Open an interview or a vacancy directly from the company to reuse its context.

In a new vacancy, paste a public job URL and choose AI parsing. Review the preview before applying it to the form; verify the employer, responsibilities, location and salary. If the page blocks access, paste the vacancy text. A real provider must be configured to demonstrate this step; do not present test fixtures as live parsing.

Switch Russian, English and Kazakh while a company draft is open: the interface changes without discarding entered facts. User-authored material remains in its original language.

## Import candidate facts from a PDF

On the profile, choose **Fill profile from PDF** or drop a PDF (up to 5 MB, 20 pages, no password). With OpenAI/Gemini configured, the document itself is sent for structured extraction, including scanned pages; no cloud result is fabricated. Review/edit extracted facts, select the fields to apply, then save the profile. Existing text is unchecked by default; selected experience, education, projects and skills append without exact duplicates. Import alone does not save a profile or create a resume.

Work periods use separate month/year controls and a **Present** checkbox. A year-only source stays year-only; an unknown month is never guessed. Education uses year selectors. Invalid/reversed dates are rejected on write; older free-text dates remain readable for correction.
