# A2D Career Studio: product decisions

## Who and what

A focused portfolio MVP for an early-career IT candidate preparing for a specific vacancy. The repeatable job is: record the requirements, assemble a factual resume, practice explaining relevant experience, and turn feedback into exercises and a next action.

This is a product hypothesis. We have not run a representative user study, measured hiring outcomes, or validated willingness to pay. The implementation and presentation must not imply otherwise.

## Market check — 5 October 2026

Primary product sources show that the individual features already exist:

| Product | Observed offering | Decision for this project |
|---|---|---|
| [Teal](https://www.tealhq.com/how-it-works) | Resume creation and a job application tracker | A resume generator alone is insufficient positioning. Keep vacancy context connected across preparation steps. |
| [Jobscan](https://www.jobscan.co/resume-scanner) | Resume/job matching and ATS-oriented feedback | Label our keyword gaps honestly; never call them a hiring probability or universal ATS score. |
| [Yoodli](https://yoodli.ai/use-cases/interview-preparation) | AI interview roleplay and feedback | Voice is a useful interface, not the product's unique advantage. Keep feedback tied to a saved vacancy and learning plan. |

The proposed value is continuity and inspectability: confirmed profile facts → selected resume → recorded practice → actionable plan. Self-hosting and visible engineering make the project useful as a portfolio case study. These are design choices, not claims that competitors lack these features.

## Release priorities

1. **Trust and data:** no implicit template fallback, no invented experience, explicit acceptance of AI edits, atomic before/after snapshots, ownership checks, export and password-account deletion.
2. **A coherent loop:** shared vacancy records, status and next-contact notes, reusable context for resume/interview/plan, contextual links and next steps on the dashboard.
3. **A usable start:** public explanation, helpful empty states, usable manual workflows without credentials, clear action-level unavailability for AI.
4. **A reproducible presentation:** Docker, migrations, isolated tests, CI, fictional demo data, current screenshots, concise architecture and demo instructions.

## Deliberate boundaries

- No automatic application submission, scraping jobs, or messages to recruiters.
- No invented hiring metrics, customers, testimonials, income or performance claims.
- Practice scores and XP do not measure professional suitability.
- No payments or subscription layer until the preparation loop is validated.
- No fully managed public SaaS claim: Google-account self-deletion, operational alerting and independent security review remain outside this release.
- Server AI configuration and a live provider check remain a gate before presenting voice or generated output as tested.
- Interface copy, errors, built-in skill descriptions and knowledge navigation support Russian, English and Kazakh. Authored notes, employer text and existing AI outputs retain their original language; the app does not silently rewrite user material. Knowledge articles have an explicit language.

## What to learn from first user sessions

Run five observed sessions with students/junior candidates and real, consented job descriptions. Measure whether they can create a vacancy, produce a factual resume, understand feedback and identify a next action without help. Record completion time, confusing steps and factual corrections. Review the outcomes before expanding features. Do not use self-reported XP as a hiring-impact metric.
