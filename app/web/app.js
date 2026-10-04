"use strict";

const $ = (id) => document.getElementById(id);
let current = null;
let dirty = false;
let busy = false;
const fields = {
  full_name: "full-name",
  email: "email",
  summary: "summary",
  experience: "experience",
  education: "education",
  phone: "resume-phone",
  location: "resume-location",
  projects: "resume-projects",
  certificates: "resume-certificates",
  languages: "resume-languages",
};

function notice(message, error = false) {
  $("notice").textContent = message;
  $("notice").classList.toggle("error", error);
  $("notice").hidden = !message;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : "Something went wrong. Please try again.",
    );
  }
  return response.status === 204 ? null : response.json();
}

function jsonRequest(data) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

async function run(action) {
  if (busy) return;
  busy = true;
  document.body.classList.add("busy");
  const controls = [...document.querySelectorAll("button, input, textarea")];
  controls.forEach((control) => {
    if (control.tagName === "BUTTON" || control.type === "file")
      control.disabled = true;
    else control.inert = true;
  });
  notice("");
  try {
    await action();
  } catch (error) {
    notice(error.message || "Please try again.", true);
  } finally {
    busy = false;
    document.body.classList.remove("busy");
    controls.forEach((control) => {
      control.disabled = false;
      control.inert = false;
    });
  }
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function renderAnalysis(analysis) {
  $("results").hidden = !analysis;
  $("step-3").classList.toggle("current", !!analysis);
  $("skill-match").replaceChildren();
  $("suggestions").replaceChildren();
  if (!analysis) return;
  $("analysis-source").textContent =
    analysis.provider === "gemini" ? "Gemini suggestions" : "Rule-based review";
  for (const [title, values, gap] of [
    ["Skills already in your story", analysis.matched_skills, false],
    ["Worth a closer look", analysis.missing_skills, true],
  ]) {
    if (!values.length) continue;
    $("skill-match").append(node("div", title, "match-heading"));
    const chips = node("div", "", "skill-chips" + (gap ? " gap" : ""));
    values.forEach((skill) => chips.append(node("span", skill)));
    $("skill-match").append(chips);
  }
  for (const item of analysis.suggestions) {
    const card = node("article", "", "suggestion");
    card.append(
      node("span", item.kind, "kind"),
      node("h3", item.title),
      node("p", item.detail),
    );
    $("suggestions").append(card);
  }
}

function render(record) {
  current = record;
  dirty = false;
  $("welcome").hidden = !!record;
  $("workspace").hidden = !record;
  $("step-1").classList.toggle("current", !record);
  $("step-2").classList.toggle("current", !!record);
  if (!record) {
    renderAnalysis(null);
    return;
  }
  $("document-name").textContent = record.filename;
  $("save-state").textContent = "Saved";
  for (const [name, id] of Object.entries(fields))
    $(id).value = record.fields[name] || "";
  $("skills").value = record.fields.skills.join(", ");
  if (record.jd_text) $("job-description").value = record.jd_text;
  renderAnalysis(record.analysis);
  document.dispatchEvent(new CustomEvent("resume:changed"));
}

async function loadHistory() {
  const records = await api("/resume");
  $("history").replaceChildren();
  if (!records.length)
    $("history").append(
      node("p", "Your resumes will appear here.", "muted small"),
    );
  for (const record of records) {
    const button = node(
      "button",
      record.fields.full_name || record.filename,
      current?.resume_id === record.resume_id ? "selected" : "",
    );
    button.type = "button";
    button.addEventListener("click", async () => {
      if (busy || !(await canLeave())) return;
      await run(async () => {
        $("job-description").value = "";
        render(await api("/resume/" + record.resume_id));
        await loadHistory();
      });
    });
    $("history").append(button);
  }
  return records;
}

function confirmAction(title, description, label = "Delete") {
  $("confirm-dialog").querySelector('[value="confirm"]').textContent = label;
  $("confirm-title").textContent = title;
  $("confirm-description").textContent = description;
  const dialog = $("confirm-dialog");
  dialog.returnValue = "cancel";
  dialog.showModal();
  return new Promise((resolve) => {
    dialog.addEventListener(
      "close",
      () => resolve(dialog.returnValue === "confirm"),
      { once: true },
    );
  });
}

async function canLeave() {
  return (
    !dirty ||
    confirmAction(
      "Discard unsaved changes?",
      "Your last saved version will remain available.",
      "Discard",
    )
  );
}

async function upload(file) {
  if (!file) return;
  if (file.size > 2_000_000)
    throw new Error("Choose a resume smaller than 2 MB.");
  const body = new FormData();
  body.append("file", file);
  render(await api("/resume/upload", { method: "POST", body }));
  await loadHistory();
  notice("Resume ready. Check the extracted details before continuing.");
}

async function save() {
  if (!current || !dirty) return;
  if (!$("resume-form").reportValidity())
    throw new Error("Please check your resume fields.");
  const data = Object.fromEntries(
    Object.entries(fields).map(([name, id]) => [name, $(id).value]),
  );
  data.skills = $("skills")
    .value.split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
  render(
    await api(
      "/resume/" + current.resume_id + "/save",
      jsonRequest({
        fields: data,
        revision: current.revision,
      }),
    ),
  );
  await loadHistory();
}

$("resume-form").addEventListener("input", () => {
  dirty = true;
  $("save-state").textContent = "Unsaved changes";
  renderAnalysis(null);
});
$("resume-form").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    await save();
    notice("Your changes are saved.");
  });
});
$("file").addEventListener("change", () =>
  run(async () => {
    await upload($("file").files[0]);
    $("file").value = "";
  }),
);
$("try-example").addEventListener("click", () =>
  run(async () => {
    const example = await api("/api/example");
    await upload(
      new File([example.resume], "alex-morgan.txt", { type: "text/plain" }),
    );
    $("job-description").value = example.job_description;
  }),
);
$("analyze").addEventListener("click", () =>
  run(async () => {
    const job = $("job-description").value.trim();
    if (job.length < 30)
      throw new Error("Add at least 30 characters describing the role.");
    await save();
    notice("Reviewing your resume…");
    render(
      await api(
        "/resume/" + current.resume_id + "/improve",
        jsonRequest({
          jd_text: job,
          revision: current.revision,
        }),
      ),
    );
    notice(
      "Review ready. Apply the suggestions you agree with in your resume fields.",
    );
    $("results").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }),
);
$("download").addEventListener("click", () =>
  run(async () => {
    await save();
    const response = await fetch("/resume/" + current.resume_id + "/pdf");
    if (!response.ok)
      throw new Error("Could not export the resume. Please try again.");
    const url = URL.createObjectURL(await response.blob());
    const link = node("a");
    link.href = url;
    link.download = "resume.pdf";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice("Your PDF contains your saved fields, exactly as reviewed.");
  }),
);
$("new-resume").addEventListener("click", async () => {
  if (busy || !(await canLeave())) return;
  render(null);
  $("job-description").value = "";
  notice("");
});
$("delete-resume").addEventListener("click", async () => {
  if (
    busy ||
    !(await confirmAction(
      "Delete this resume?",
      "The resume and its recommendations will be permanently removed.",
    ))
  )
    return;
  await run(async () => {
    await api("/resume/" + current.resume_id, { method: "DELETE" });
    render(null);
    $("job-description").value = "";
    await loadHistory();
    notice("Resume deleted.");
  });
});
$("clear-workspace").addEventListener("click", async () => {
  if (
    busy ||
    !(await confirmAction(
      "Clear this workspace?",
      "This deletes every resume in this browser workspace and ends the session.",
    ))
  )
    return;
  await run(async () => {
    await api("/api/session", { method: "DELETE" });
    render(null);
    await initialize();
    notice("Workspace cleared.");
  });
});
const dropzone = $("dropzone");
dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});
dropzone.addEventListener("dragleave", () =>
  dropzone.classList.remove("dragging"),
);
dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  run(() => upload(event.dataTransfer.files[0]));
});
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});

async function initialize() {
  const session = await api("/api/session", { method: "POST" });
  const cloud = session.provider === "gemini";
  $("mode").textContent = cloud ? "Gemini reviewer" : "Local reviewer";
  $("provider-disclosure").textContent = cloud
    ? "When you select Find my focus, your reviewed fields and this job description are sent to Google Gemini."
    : "Rule-based skill matching. Your resume stays on this server; no external AI calls.";
  $("privacy-note").textContent = cloud
    ? "Extraction stays local. Gemini is used only when you request recommendations."
    : "Local analysis. No account, cloud keys, or external AI calls required.";
  document.dispatchEvent(new CustomEvent("career:ready"));
  const records = await loadHistory();
  if (records.length) {
    render(records[0]);
    await loadHistory();
  }
}
run(initialize);
