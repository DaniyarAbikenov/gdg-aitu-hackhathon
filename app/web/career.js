"use strict";

// Presentation state only. Durable records and sessions live in PostgreSQL/Redis.
let careerProfile = null;
let careerTab = "resume";
let activeInterview = null;
let activePlan = null;
let adaptation = null;
let recognition = null;
const pane = $("career-pane");
const tabs = [
  ["resume", "Resume"],
  ["profile", "Profile & goal"],
  ["interview", "Interview"],
  ["plan", "Learning plan"],
  ["progress", "Progress"],
  ["account", "Account"],
  ["help", "Help"],
];

function button(text, action, className = "secondary") {
  const b = node("button", text, className);
  b.type = "button";
  b.addEventListener("click", () => run(action));
  return b;
}
function card(title, description = "") {
  const c = node("section", "", "card career-card");
  c.append(node("h2", title));
  if (description) c.append(node("p", description, "muted"));
  return c;
}
function input(
  parent,
  id,
  title,
  value = "",
  multiline = false,
  required = false,
) {
  const label = node("label", title);
  const element = node(multiline ? "textarea" : "input");
  element.id = id;
  element.value = value;
  element.required = required;
  element.maxLength = multiline ? 10000 : 1000;
  if (multiline) element.rows = 3;
  label.append(element);
  parent.append(label);
  return element;
}
function select(parent, id, title, choices, value) {
  const label = node("label", title);
  const element = node("select");
  element.id = id;
  for (const [key, text] of choices) {
    const option = node("option", text);
    option.value = key;
    element.append(option);
  }
  element.value = value || choices[0][0];
  label.append(element);
  parent.append(label);
  return element;
}
async function downloadFile(path, filename) {
  const response = await fetch(path, { credentials: "same-origin" });
  if (!response.ok) throw new Error("Download failed. Please try again.");
  const url = URL.createObjectURL(await response.blob());
  const a = node("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function profileValues() {
  const result = {};
  for (const key of [
    "full_name",
    "email",
    "phone",
    "location",
    "summary",
    "experience",
    "education",
    "projects",
    "certificates",
    "languages",
    "desired_position",
    "career_goal",
  ])
    result[key] = $("profile-" + key).value;
  result.skills = $("profile-skills")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  result.language = $("profile-language").value;
  result.audio_mode = $("profile-audio").checked;
  return result;
}
async function showProfile() {
  careerProfile = await api("/user/profile");
  const profile = careerProfile.data;
  const c = card(
    "Your experience, your direction",
    "Build a reusable profile. Resume suggestions and learning plans use the facts you confirm here.",
  );
  const form = node("form");
  const labels = {
    full_name: "Name",
    email: "Contact email",
    phone: "Phone",
    location: "Location",
    desired_position: "Target role",
    career_goal: "Career goal",
    summary: "Introduction",
    skills: "Skills (comma separated)",
    experience: "Work experience",
    education: "Education",
    projects: "Projects",
    certificates: "Certificates",
    languages: "Spoken languages",
  };
  for (const [key, label] of Object.entries(labels))
    input(
      form,
      "profile-" + key,
      label,
      key === "skills" ? profile.skills.join(", ") : profile[key] || "",
      [
        "summary",
        "experience",
        "education",
        "projects",
        "certificates",
        "career_goal",
      ].includes(key),
    );
  select(
    form,
    "profile-language",
    "Coaching language",
    [
      ["en", "English"],
      ["ru", "Русский"],
      ["kk", "Қазақша"],
    ],
    profile.language,
  );
  const audio = input(
    form,
    "profile-audio",
    "Enable voice input for interviews",
  );
  audio.type = "checkbox";
  audio.checked = profile.audio_mode;
  form.append(
    button("Normalize skills", async () => {
      $("profile-skills").value = [
        ...new Map(
          $("profile-skills")
            .value.split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => [s.toLowerCase(), s]),
        ).values(),
      ].join(", ");
      notice("Skills normalized. Save your profile to keep the changes.");
    }),
  );
  const submit = node("button", "Save profile", "primary");
  submit.type = "submit";
  form.append(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      careerProfile = await api(
        "/user/profile/update",
        jsonRequest({
          profile: profileValues(),
          revision: careerProfile.revision,
        }),
      );
      notice("Profile saved. Your goal is ready for the next step.");
    });
  });
  c.append(form);
  pane.append(c);
}
async function showAccount() {
  const me = await api("/user/me");
  const c = card(
    me.authenticated ? "Your account" : "Keep your career journey",
    me.authenticated
      ? "Your saved career data persists across sign-ins. Signing out keeps your data."
      : "Guest data expires after 24 hours. Register to keep this workspace and return from another browser.",
  );
  if (me.authenticated) {
    c.append(
      button("Sign out", async () => {
        await api("/auth/logout", { method: "POST" });
        location.reload();
      }),
    );
  } else {
    const form = node("form");
    const email = input(
      form,
      "account-email",
      "Account email",
      "",
      false,
      true,
    );
    email.type = "email";
    email.autocomplete = "username";
    const password = input(
      form,
      "account-password",
      "Password (at least 12 characters)",
      "",
      false,
      true,
    );
    password.type = "password";
    password.minLength = 12;
    password.maxLength = 256;
    password.autocomplete = "current-password";
    const register = node("button", "Create account", "primary");
    register.type = "submit";
    form.append(register);
    const authenticate = async (path) => {
      if (!form.reportValidity()) return;
      await api(
        path,
        jsonRequest({ email: email.value, password: password.value }),
      );
      password.value = "";
      location.reload();
    };
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      run(() => authenticate("/auth/register"));
    });
    form.append(button("Sign in", () => authenticate("/auth/login")));
    c.append(form);
    c.append(
      node(
        "p",
        "Signing into an existing account opens that account’s workspace. Registering preserves the current guest workspace.",
        "muted small",
      ),
    );
  }
  pane.append(c);
}
async function showInterview() {
  const profile = (await api("/user/profile")).data;
  const c = card(
    "Practice for the real conversation",
    "Set the company, role and stack. Answer one question at a time, then review feedback and your reference answers.",
  );
  const form = node("form");
  input(form, "interview-company", "Company and context", "", true, true);
  input(
    form,
    "interview-job",
    "Role description",
    current?.jd_text || profile.desired_position || "",
    true,
    true,
  );
  input(
    form,
    "interview-stack",
    "Technology stack",
    profile.skills.join(", "),
    false,
    true,
  );
  select(form, "interview-style", "Interview style", [
    ["mixed", "Mixed"],
    ["theoretical", "Theoretical"],
    ["practical", "Practical"],
  ]);
  const submit = node("button", "Start interview", "primary");
  submit.type = "submit";
  form.append(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      activeInterview = await api(
        "/interview/start",
        jsonRequest({
          company_description: $("interview-company").value,
          job_description: $("interview-job").value,
          tech_stack: $("interview-stack").value,
          style: $("interview-style").value,
          language: profile.language,
        }),
      );
      await drawInterview(profile.audio_mode);
    });
  });
  c.append(form);
  pane.append(c);
  const list = card("Interview history");
  for (const item of await api("/interview"))
    list.append(
      button(
        `${item.context.company_description.slice(0, 60)} · ${item.finished ? "completed" : "in progress"}`,
        async () => {
          activeInterview = await api("/interview/" + item.id);
          await drawInterview(profile.audio_mode);
        },
      ),
    );
  pane.append(list);
}
async function drawInterview(audioMode = false) {
  pane.replaceChildren();
  const i = activeInterview;
  const c = card(
    i.finished
      ? "Interview summary"
      : `Question ${i.answers.length + 1} of ${i.total_questions}`,
    i.provider === "local"
      ? "Demo practice: fixed question templates and keyword rubric. No AI evaluation or hiring prediction."
      : "Gemini coaching. Your answers are sent to Google for feedback; scores are practice guidance.",
  );
  if (!i.finished) {
    c.append(node("h3", i.question));
    const answer = input(c, "interview-answer", "Your answer", "", true, true);
    if (audioMode) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        c.append(
          node(
            "p",
            "Voice recognition uses your browser’s speech service and may send audio to that provider. Review the transcript before submitting.",
            "muted small",
          ),
        );
        c.append(
          button("Dictate answer", async () => {
            recognition = new SpeechRecognition();
            recognition.lang = { en: "en-US", ru: "ru-RU", kk: "kk-KZ" }[
              i.context.language
            ];
            recognition.onresult = (event) => {
              answer.value +=
                (answer.value ? " " : "") + event.results[0][0].transcript;
            };
            recognition.onerror = () =>
              notice(
                "Voice input unavailable. Type your answer instead.",
                true,
              );
            recognition.start();
            notice("Listening…");
          }),
        );
        c.append(button("Stop dictation", async () => recognition?.stop()));
      } else
        c.append(
          node(
            "p",
            "Voice input is unavailable in this browser. You can type your answer.",
            "muted",
          ),
        );
    }
    c.append(
      button(
        "Submit answer",
        async () => {
          if (!answer.value.trim())
            throw new Error("Enter an answer before continuing.");
          recognition?.stop();
          activeInterview = await api(
            `/interview/${i.id}/answer`,
            jsonRequest({ revision: i.revision, answer: answer.value }),
          );
          await drawInterview(audioMode);
        },
        "primary",
      ),
    );
  } else {
    c.append(node("h3", `Practice score: ${i.score}/100`));
    c.append(
      button("Build a learning plan from this interview", async () => {
        careerTab = "plan";
        await showTab("plan");
      }),
    );
  }
  for (const [index, a] of i.answers.entries()) {
    const detail = node("details");
    if (index === i.answers.length - 1) detail.open = true;
    detail.append(
      node("summary", `${index + 1}. ${a.question} · ${a.score}/100`),
      node("h4", "Your answer"),
      node("p", a.answer),
      node("h4", "Feedback"),
      node("p", a.feedback),
      node("h4", "Reference answer"),
      node("p", a.reference_answer),
    );
    for (const value of [...a.strengths, ...a.improvements])
      detail.append(node("p", value));
    c.append(detail);
  }
  c.append(button("Back to interviews", () => showTab("interview")));
  c.append(
    button("Delete interview", async () => {
      if (
        await confirmAction(
          "Delete this interview?",
          "Your answers and feedback will be removed.",
        )
      ) {
        await api(`/career/interview/${i.id}`, { method: "DELETE" });
        activeInterview = null;
        await showTab("interview");
      }
    }),
  );
  pane.append(c);
}
async function showPlan() {
  const profile = (await api("/user/profile")).data;
  const c = card(
    "A plan you can put into practice",
    "Eight weeks, concrete exercises and progress you can keep. The plan uses your profile and any selected resume or interview.",
  );
  input(
    c,
    "plan-goal",
    "Learning goal",
    profile.career_goal || profile.desired_position || "",
    false,
    true,
  );
  const resumes = await api("/resume"),
    interviews = await api("/interview");
  select(
    c,
    "plan-resume",
    "Use resume gaps",
    [["", "No resume"], ...resumes.map((r) => [r.resume_id, r.filename])],
    current?.resume_id,
  );
  select(
    c,
    "plan-interview",
    "Use interview feedback",
    [
      ["", "No interview"],
      ...interviews.map((i) => [
        i.id,
        i.context.company_description.slice(0, 60),
      ]),
    ],
    activeInterview?.id,
  );
  c.append(
    button(
      "Create learning plan",
      async () => {
        activePlan = await api(
          "/plan",
          jsonRequest({
            goal: $("plan-goal").value,
            resume_id: $("plan-resume").value || null,
            interview_id: $("plan-interview").value || null,
          }),
        );
        drawPlan();
      },
      "primary",
    ),
  );
  pane.append(c);
  const list = card("Saved plans");
  for (const plan of await api("/plan"))
    list.append(
      button(plan.data.goal, async () => {
        activePlan = plan;
        drawPlan();
      }),
    );
  pane.append(list);
}
function drawPlan() {
  pane.replaceChildren();
  const plan = activePlan;
  const c = card(plan.data.goal, plan.data.explanation);
  c.append(
    node(
      "p",
      plan.data.provider === "local"
        ? "Demo curriculum · customize the exercises to your level."
        : "Generated with Gemini · verify the suggested learning path.",
      "mode-badge",
    ),
  );
  const done = plan.data.modules.filter((m) => m.completed).length;
  c.append(node("h3", `${done} / ${plan.data.modules.length} weeks complete`));
  for (const m of plan.data.modules) {
    const section = node("section", "", "plan-module");
    section.append(
      node("h3", `Week ${m.id} · ${m.title}`),
      node(
        "p",
        `${m.hours} hours · ${m.completed ? "Completed" : "In progress"}`,
      ),
    );
    const ul = node("ul");
    for (const goal of m.goals) ul.append(node("li", goal));
    section.append(ul, node("p", m.exercise));
    const resource = node("a", "Find learning resources ↗");
    resource.href =
      "https://www.google.com/search?q=" +
      encodeURIComponent(m.resource_topic + " official documentation tutorial");
    resource.target = "_blank";
    resource.rel = "noopener noreferrer";
    section.append(resource);
    const evidence = input(
      section,
      "evidence-" + m.id,
      "Your notes / evidence",
      m.evidence,
      true,
    );
    section.append(
      button(m.completed ? "Mark incomplete" : "Complete week", async () => {
        activePlan = await api(
          `/plan/${plan.id}/modules/${m.id}`,
          jsonRequest({
            revision: plan.revision,
            completed: !m.completed,
            evidence: evidence.value,
          }),
        );
        drawPlan();
      }),
    );
    section.append(
      button("Save notes", async () => {
        activePlan = await api(
          `/plan/${plan.id}/modules/${m.id}`,
          jsonRequest({
            revision: plan.revision,
            completed: m.completed,
            evidence: evidence.value,
          }),
        );
        drawPlan();
        notice("Notes saved.");
      }),
    );
    c.append(section);
  }
  c.append(
    button("Export plan", () =>
      downloadFile(`/plan/${plan.id}/export`, "career-plan.txt"),
    ),
  );
  c.append(
    button("Prepare for NotebookLM", async () => {
      await downloadFile(
        `/plan/${plan.id}/export`,
        "career-plan-notebooklm.txt",
      );
      notice(
        "Import the downloaded plan into NotebookLM to create an overview. CareerBot does not generate a video itself.",
      );
    }),
  );
  const notebook = node("a", "Open NotebookLM ↗");
  notebook.href = "https://notebooklm.google.com/";
  notebook.target = "_blank";
  notebook.rel = "noopener noreferrer";
  c.append(notebook);
  c.append(
    button("Delete plan", async () => {
      if (
        await confirmAction(
          "Delete this plan?",
          "The plan and its progress will be removed.",
        )
      ) {
        await api(`/career/plan/${plan.id}`, { method: "DELETE" });
        activePlan = null;
        await showTab("plan");
      }
    }),
  );
  c.append(button("Back to plans", () => showTab("plan")));
  pane.append(c);
}
async function showProgress() {
  const p = await api("/progress");
  const c = card(
    "Your progress",
    "These numbers come from your saved work. Interview scores are practice feedback, not a measure of hiring readiness.",
  );
  const grid = node("div", "", "progress-grid");
  for (const [title, value] of [
    ["Learning weeks", `${p.completed_modules}/${p.total_modules}`],
    ["Completed interviews", p.interviews_completed],
    [
      "Average practice score",
      p.average_score === null ? "—" : `${p.average_score}/100`,
    ],
    ["Saved resume versions", p.resume_versions],
  ]) {
    const stat = node("section", "", "stat");
    stat.append(node("strong", String(value)), node("p", title));
    grid.append(stat);
  }
  c.append(grid, node("h3", "Milestones"));
  const requirements = {
    "first-step": "Complete one learning week",
    interview: "Finish an interview with a practice score of 70+",
    resume: "Save three resume versions",
    persistence: "Complete five learning weeks",
  };
  for (const r of p.rewards) {
    const section = node("section", "", "plan-module");
    section.append(node("h3", r.title), node("p", requirements[r.key]));
    if (r.claimed) section.append(node("p", "Claimed ✓"));
    else if (r.available)
      section.append(
        button("Claim milestone", async () => {
          await api("/progress/rewards/" + r.key, { method: "POST" });
          await showTab("progress");
        }),
      );
    else
      section.append(
        node("p", "Keep going — this milestone is locked.", "muted"),
      );
    c.append(section);
  }
  pane.append(c);
}
async function showHelp() {
  const c = card(
    "How CareerBot works",
    "Profile → tailored resume → interview practice → learning plan → progress.",
  );
  for (const [q, a] of [
    [
      "Where should I start?",
      "Save your profile and career goal, then upload a resume or try the fictional example. Compare a job, review specific changes, and save a version before practicing an interview.",
    ],
    [
      "What is the demo mode?",
      "Without Gemini credentials, CareerBot uses deterministic skill ordering, question templates, a keyword rubric and a curriculum template. The UI labels these results. Gemini adds personalized writing, questions, evaluations and plans.",
    ],
    [
      "Where is my data stored?",
      "PostgreSQL stores career records; Redis holds expiring sessions and rate limits. Guest records expire after 24 hours. Registered records persist until you clear them.",
    ],
    [
      "What leaves this server?",
      "In Gemini mode, requesting coaching sends the relevant fields and answers to Google. Voice dictation may use your browser’s speech provider. Nothing is sent to NotebookLM automatically.",
    ],
    [
      "Need help or want to report a bug?",
      "Open an issue in the project repository. Never include passwords, API keys or private resume content.",
    ],
  ]) {
    const d = node("details");
    d.append(node("summary", q), node("p", a));
    c.append(d);
  }
  const issue = node("a", "Project issues ↗");
  issue.href = "https://github.com/DaniyarAbikenov/gdg-aitu-hackhathon/issues";
  issue.target = "_blank";
  issue.rel = "noopener noreferrer";
  c.append(issue);
  pane.append(c);
}
async function showTab(tab) {
  recognition?.stop();
  careerTab = tab;
  $("resume-pane").hidden = tab !== "resume";
  pane.hidden = tab === "resume";
  pane.replaceChildren();
  document
    .querySelectorAll("[data-career-tab]")
    .forEach((b) =>
      b.setAttribute(
        "aria-current",
        b.dataset.careerTab === tab ? "page" : "false",
      ),
    );
  notice("");
  if (tab === "resume") {
    if (current) await loadVersions();
    return;
  }
  await {
    profile: showProfile,
    interview: showInterview,
    plan: showPlan,
    progress: showProgress,
    account: showAccount,
    help: showHelp,
  }[tab]();
}
for (const [key, title] of tabs) {
  const b = node("button", title, "text-button");
  b.type = "button";
  b.dataset.careerTab = key;
  b.addEventListener("click", async () => {
    if (busy) return;
    if (dirty && !(await canLeave())) return;
    await run(() => showTab(key));
  });
  $("career-nav").append(b);
}
async function loadVersions() {
  const list = $("version-list");
  list.replaceChildren();
  if (!current) return;
  const versions = await api(`/resume/${current.resume_id}/versions`);
  if (!versions.length)
    list.append(node("p", "No saved versions yet.", "muted"));
  for (const v of versions) {
    const d = node("details");
    d.append(node("summary", v.data.label));
    for (const key of Object.keys(v.data.fields)) {
      if (
        JSON.stringify(v.data.fields[key]) !==
        JSON.stringify(v.data.before[key])
      ) {
        d.append(
          node("h4", key),
          node("p", "Before: " + String(v.data.before[key] || "—")),
          node("p", "After: " + String(v.data.fields[key] || "—")),
        );
      }
    }
    d.append(
      button("Download this version", () =>
        downloadFile(`/versions/${v.id}/pdf`, "resume-version.pdf"),
      ),
    );
    d.append(
      button("Make this version active", async () => {
        if (dirty && !(await canLeave())) return;
        render(
          await api(
            `/versions/${v.id}/restore`,
            jsonRequest({ revision: current.revision }),
          ),
        );
        await loadHistory();
        await loadVersions();
        notice("Version restored as the current resume.");
      }),
    );
    d.append(
      button("Delete version", async () => {
        if (
          await confirmAction(
            "Delete this version?",
            "The current resume will remain available.",
          )
        ) {
          await api(`/career/version/${v.id}`, { method: "DELETE" });
          await loadVersions();
        }
      }),
    );
    list.append(d);
  }
}
$("save-version").addEventListener("click", () =>
  run(async () => {
    await save();
    await api(
      `/resume/${current.resume_id}/versions`,
      jsonRequest({
        fields: current.fields,
        revision: current.revision,
        label: $("version-label").value,
        jd_text: $("job-description").value.trim(),
      }),
    );
    await loadVersions();
    notice("Resume version saved.");
  }),
);
$("adapt-resume").addEventListener("click", () =>
  run(async () => {
    await save();
    adaptation = await api(
      `/resume/${current.resume_id}/adapt`,
      jsonRequest({
        revision: current.revision,
        jd_text: $("job-description").value.trim(),
      }),
    );
    const list = $("adaptations");
    list.replaceChildren();
    list.append(
      node(
        "p",
        adaptation.provider === "local"
          ? "Demo changes only. Configure Gemini for personalized rewrites."
          : "Gemini suggestions. Verify every claim before accepting.",
        "muted",
      ),
    );
    for (const change of adaptation.improvements) {
      const section = node("section", "", "plan-module");
      const checkbox = input(
        section,
        "change-" + change.id,
        "Accept change: " + change.section,
      );
      checkbox.type = "checkbox";
      section.append(
        node("h4", "Before"),
        node("p", change.before || "(empty)"),
        node("h4", "After"),
        node("p", change.after),
        node("p", change.reason, "muted"),
      );
      list.append(section);
    }
    if (!adaptation.improvements.length) {
      list.append(
        node(
          "p",
          "No supported rewrite was suggested. You can edit and save a version manually.",
        ),
      );
      return;
    }
    list.append(
      button(
        "Save accepted changes as a version",
        async () => {
          if (current.revision !== adaptation.revision || dirty)
            throw new Error(
              "Resume changed. Request fresh suggestions before applying them.",
            );
          const updated = structuredClone(current.fields);
          let count = 0;
          for (const change of adaptation.improvements)
            if ($("change-" + change.id).checked) {
              updated[change.section] =
                change.section === "skills"
                  ? change.after
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : change.after;
              count++;
            }
          if (!count) throw new Error("Select at least one change to accept.");
          await api(
            `/resume/${current.resume_id}/versions`,
            jsonRequest({
              fields: updated,
              revision: current.revision,
              label: $("version-label").value || "Adapted version",
              jd_text: adaptation.jd_text,
            }),
          );
          await loadVersions();
          notice(
            "Accepted changes saved as a new version. Use Make this version active to continue editing it.",
          );
        },
        "primary",
      ),
    );
  }),
);
document.addEventListener("resume:changed", () => {
  adaptation = null;
  $("adaptations").replaceChildren();
  loadVersions().catch((e) => notice(e.message, true));
});
document.addEventListener("career:ready", () => {
  $("career-nav")
    .querySelector('[data-career-tab="resume"]')
    .setAttribute("aria-current", "page");
});
