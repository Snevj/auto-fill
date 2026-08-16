const DEFAULT_PROFILE = {
  personal: {
    firstName: "Sneh",
    lastName: "Vijayvargiya",
    fullName: "Sneh Vijayvargiya",
    email: "snehvjay@gmail.com",
    phone: "+91-7737748669",
    address1: "",
    city: "",
    state: "",
    zip: "",
    country: "India",
    currentCompany: "",
    currentTitle: "AI Engineer",
  },
  links: {
    linkedin: "",
    github: "",
    portfolio: "",
  },
  headline:
    "B.Tech student at IIT Kharagpur (2026) focused on applied AI/ML — LLM fine-tuning (DPO/QLoRA), RAG systems, and agentic pipelines with LangChain/CrewAI.",
  education: [
    { degree: "B.Tech", institution: "Indian Institute of Technology, Kharagpur", major: "", endDate: "2026", gpa: "" },
  ],
  experience: [
    {
      title: "Research Intern",
      company: "IIT Kharagpur",
      startDate: "Spring'26",
      endDate: "Spring'26",
      description:
        "Short-term ocean wave height forecasting using LSTM, under Prof. P. K. Bhaskaran. Built a 2-layer LSTM (TensorFlow/Keras) forecasting wave height 3hrs ahead from NOAA buoy data, beating a persistence baseline (MAE 0.162m vs. 0.168m). Extended to a 6-feature multi-variate LSTM and found added features degraded performance, revealing a feature-engineering vs. signal-strength tradeoff. Cleaned and resampled 6,252 hourly buoy records with pandas/scikit-learn, building reproducible sequence-to-one training pipelines.",
    },
  ],
  activities: [
    {
      role: "Governor — Technology Comedy Club, Technology Students' Gymkhaana",
      dates: "May 2024 - April 2025",
      description:
        "Conducted 4 different flagship events with a combined expected footfall of around 3,200 and 5+ successful collaborations. Increased the annual budget by around 33%, content engagement by around 42%, and total posts by 40%. Collaborated with comedians Piyush Sharma and Nishant Suri, achieving a collective footfall of 5,000+ audience.",
    },
  ],
  projects: [
    {
      name: "DPO Fine-Tuning & Eval Pipeline",
      date: "Jul'26",
      bullets: [
        "Trained DPO on Llama-3.1-8B and Qwen2.5-7B via LoRA on a single L40S, tuning batch size and gradient accumulation to resolve OOM under a fixed 2-3hr compute budget.",
        "Built a position-bias-controlled pairwise-judge evaluation (Groq-hosted Llama-3.3-70B) with resumable, rate-limit-aware judging.",
        "Ran a 2-point beta ablation across 283 judged pairs; DPO-tuned model won modestly more pairs than baseline but ~89% were ties.",
      ],
    },
    {
      name: "FinRAG — Production Document Intelligence System",
      date: "Jun'26-Jul'26",
      bullets: [
        "Engineered a 2-stage retrieval pipeline (Qdrant vector search -> Cohere reranker) reducing context window from top-15 to top-3 chunks with page-level source citations via Groq LLM inference.",
        "Deployed full-stack FastAPI backend on AWS EC2 via Docker with PyMuPDF ingestion, sentence-transformers embeddings, and Qdrant vector store.",
        "Built LangSmith observability achieving sub-second p50 latency (0.94s) at $0.00017/query via Groq inference.",
        "Diagnosed chunk-noise degrading RAGAS faithfulness from 0.83 to 0.17; fixed with a header-detection chunker.",
      ],
    },
    {
      name: "SDPO LLM Fine-Tuning Pipeline",
      date: "Jun'26",
      bullets: [
        "Built a 3-checkpoint pipeline (Base -> SFT -> SDPO) on Llama-3-8B using Unsloth 4-bit QLoRA, cutting VRAM ~30% via gradient checkpointing.",
        "Implemented RL via Self-Distillation (SDPO), using the model's own feedback-conditioned outputs as the training signal.",
        "Diagnosed an apparent 38-point GSM8K regression to two stacked bugs; recovered true performance (SFT 57% -> SDPO 54%, n=100).",
      ],
    },
    {
      name: "Automated Insurance Data Entry System",
      date: "May'26",
      bullets: [
        "Orchestrated an agentic multi-agent AI system using LangChain and Llama 3.2 via Ollama for local insurance data entry.",
        "Developed an Agent Orchestration framework using CrewAI to manage user interaction and document processing workflows.",
        "Implemented a DocProcessor Agent using PyPDF2, Bedrock Embeddings, and ChromaDB to vectorize and store documents.",
        "Built a web app with real-time chat using Flask, PostgreSQL (SQLAlchemy), and HTML/CSS/JS.",
      ],
    },
    {
      name: "Custom GPT Architecture & Weight-Mapping",
      date: "Apr'26-May'26",
      bullets: [
        "Reduced trainable parameters to ~39.3M unique / ~78M total via weight-tying across the 50,257x768 tensor.",
        "Built a tensor-mapping framework to match and inject pre-trained OpenAI GPT-2 weights into a custom 12-layer pipeline.",
        "Scaled autoregressive context windows up to 400% (256 to 1024 tokens) by dynamically refactoring model dimensions.",
      ],
    },
  ],
  skills: {
    languagesTools: ["Python", "SQL", "ChromaDB", "Qdrant", "Hugging Face", "Git", "GitHub", "Flask", "PostgreSQL", "FastAPI", "Docker", "RAGAS", "Groq", "AWS", "LangSmith"],
    aiMl: ["LangChain", "LangGraph", "CrewAI", "PyTorch", "RAG", "TensorFlow/Keras", "OpenCV", "Unsloth/QLoRA", "DPO", "TRL", "PEFT/LoRA", "Quantization (4-bit/GGUF)", "NumPy", "Scikit-Learn", "Sentence-Transformers", "Cohere Rerank"],
    soft: ["Analytical Thinking", "Leadership", "Communication", "Planning & Execution", "Creative Problem Solving"],
  },
  preferences: {
    desiredSalary: "",
    yearsExperience: "",
    noticePeriod: "",
    availableStartDate: "",
    workAuthorized: null,
    requiresSponsorship: null,
    willingToRelocate: null,
  },
};

const DEFAULT_SETTINGS = { apiKey: "", model: "gemini-2.5-flash", maxAiFields: 8 };

let state = { profile: null, templates: [], settings: { ...DEFAULT_SETTINGS }, presets: [], activeProfileName: "Default" };

init();

async function init() {
  const stored = await chrome.storage.local.get(["profile", "templates", "settings", "presets", "activeProfileName"]);
  state.profile = stored.profile || structuredClone(DEFAULT_PROFILE);
  state.profile.experience ||= [];
  state.profile.activities ||= [];
  state.profile.education ||= [];
  state.profile.projects ||= [];
  state.templates = stored.templates || [];
  state.settings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  state.presets = Array.isArray(stored.presets) ? stored.presets : [];
  state.activeProfileName = stored.activeProfileName || "Default";

  bindTabs();
  fillPersonalForm();
  renderEducation();
  renderExperience();
  renderActivities();
  renderProjects();
  fillSkillsForm();
  fillPreferencesForm();
  renderTemplates();
  renderPresets();
  fillAiForm();
  bindAddButtons();
  bindSave();
  bindTestKey();
  bindExportImport();
  bindPresets();
}

function bindTabs() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab").forEach((t) => t.classList.add("hidden"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");
    });
  });
}

function fillPersonalForm() {
  const p = state.profile.personal;
  const l = state.profile.links;
  set("firstName", p.firstName);
  set("lastName", p.lastName);
  set("fullName", p.fullName);
  set("email", p.email);
  set("phone", p.phone);
  set("address1", p.address1);
  set("city", p.city);
  set("state", p.state);
  set("zip", p.zip);
  set("country", p.country);
  set("currentCompany", p.currentCompany);
  set("currentTitle", p.currentTitle);
  set("linkedin", l.linkedin);
  set("github", l.github);
  set("portfolio", l.portfolio);
  set("headline", state.profile.headline);
}

function readPersonalForm() {
  state.profile.personal = {
    firstName: get("firstName"),
    lastName: get("lastName"),
    fullName: get("fullName"),
    email: get("email"),
    phone: get("phone"),
    address1: get("address1"),
    city: get("city"),
    state: get("state"),
    zip: get("zip"),
    country: get("country"),
    currentCompany: get("currentCompany"),
    currentTitle: get("currentTitle"),
  };
  state.profile.links = { linkedin: get("linkedin"), github: get("github"), portfolio: get("portfolio") };
  state.profile.headline = get("headline");
}

// ---- Education ----
function renderEducation() {
  const list = document.getElementById("educationList");
  list.innerHTML = "";
  state.profile.education.forEach((edu, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <button class="remove-btn" data-remove="education:${i}">Remove</button>
      <div class="grid2">
        <label>Degree<input data-edu="${i}:degree" value="${esc(edu.degree)}" /></label>
        <label>Institution<input data-edu="${i}:institution" value="${esc(edu.institution)}" /></label>
        <label>Major / field<input data-edu="${i}:major" value="${esc(edu.major)}" /></label>
        <label>Graduation year<input data-edu="${i}:endDate" value="${esc(edu.endDate)}" /></label>
        <label>GPA<input data-edu="${i}:gpa" value="${esc(edu.gpa)}" /></label>
      </div>`;
    list.appendChild(card);
  });
  list.querySelectorAll("[data-edu]").forEach((input) => {
    input.addEventListener("input", () => {
      const [idx, field] = input.dataset.edu.split(":");
      state.profile.education[idx][field] = input.value;
    });
  });
  list.querySelectorAll("[data-remove^='education:']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remove.split(":")[1]);
      state.profile.education.splice(idx, 1);
      renderEducation();
    });
  });
}

// ---- Experience ----
function renderExperience() {
  const list = document.getElementById("experienceList");
  list.innerHTML = "";
  state.profile.experience.forEach((exp, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <button class="remove-btn" data-remove="experience:${i}">Remove</button>
      <div class="grid2">
        <label>Title<input data-exp="${i}:title" value="${esc(exp.title)}" /></label>
        <label>Company<input data-exp="${i}:company" value="${esc(exp.company)}" /></label>
        <label>Start date<input data-exp="${i}:startDate" value="${esc(exp.startDate)}" /></label>
        <label>End date<input data-exp="${i}:endDate" value="${esc(exp.endDate)}" /></label>
      </div>
      <label>Description<textarea rows="2" data-exp="${i}:description">${esc(exp.description)}</textarea></label>`;
    list.appendChild(card);
  });
  list.querySelectorAll("[data-exp]").forEach((input) => {
    input.addEventListener("input", () => {
      const [idx, field] = input.dataset.exp.split(":");
      state.profile.experience[idx][field] = input.value;
    });
  });
  list.querySelectorAll("[data-remove^='experience:']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remove.split(":")[1]);
      state.profile.experience.splice(idx, 1);
      renderExperience();
    });
  });
}

// ---- Activities / Leadership ----
function renderActivities() {
  const list = document.getElementById("activitiesList");
  list.innerHTML = "";
  state.profile.activities.forEach((act, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <button class="remove-btn" data-remove="activities:${i}">Remove</button>
      <div class="grid2">
        <label>Role / Position<input data-act="${i}:role" value="${esc(act.role)}" /></label>
        <label>Dates<input data-act="${i}:dates" value="${esc(act.dates)}" placeholder="e.g. May 2024 - April 2025" /></label>
      </div>
      <label>Description<textarea rows="2" data-act="${i}:description">${esc(act.description)}</textarea></label>`;
    list.appendChild(card);
  });
  list.querySelectorAll("[data-act]").forEach((input) => {
    input.addEventListener("input", () => {
      const [idx, field] = input.dataset.act.split(":");
      state.profile.activities[idx][field] = input.value;
    });
  });
  list.querySelectorAll("[data-remove^='activities:']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remove.split(":")[1]);
      state.profile.activities.splice(idx, 1);
      renderActivities();
    });
  });
}

// ---- Projects ----
function renderProjects() {
  const list = document.getElementById("projectsList");
  list.innerHTML = "";
  state.profile.projects.forEach((proj, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <button class="remove-btn" data-remove="projects:${i}">Remove</button>
      <div class="grid2">
        <label>Name<input data-proj="${i}:name" value="${esc(proj.name)}" /></label>
        <label>Date<input data-proj="${i}:date" value="${esc(proj.date)}" /></label>
      </div>
      <label>Bullets (one per line)<textarea rows="4" data-proj="${i}:bullets">${esc((proj.bullets || []).join("\n"))}</textarea></label>`;
    list.appendChild(card);
  });
  list.querySelectorAll("[data-proj]").forEach((input) => {
    input.addEventListener("input", () => {
      const [idx, field] = input.dataset.proj.split(":");
      if (field === "bullets") {
        state.profile.projects[idx].bullets = input.value.split("\n").map((s) => s.trim()).filter(Boolean);
      } else {
        state.profile.projects[idx][field] = input.value;
      }
    });
  });
  list.querySelectorAll("[data-remove^='projects:']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remove.split(":")[1]);
      state.profile.projects.splice(idx, 1);
      renderProjects();
    });
  });
}

// ---- Skills ----
function fillSkillsForm() {
  set("skillsLanguagesTools", (state.profile.skills.languagesTools || []).join(", "));
  set("skillsAiMl", (state.profile.skills.aiMl || []).join(", "));
  set("skillsSoft", (state.profile.skills.soft || []).join(", "));
}
function readSkillsForm() {
  state.profile.skills = {
    languagesTools: splitCsv(get("skillsLanguagesTools")),
    aiMl: splitCsv(get("skillsAiMl")),
    soft: splitCsv(get("skillsSoft")),
  };
}

// ---- Preferences ----
function fillPreferencesForm() {
  const p = state.profile.preferences;
  set("desiredSalary", p.desiredSalary);
  set("yearsExperience", p.yearsExperience);
  set("noticePeriod", p.noticePeriod);
  set("availableStartDate", p.availableStartDate);
  set("workAuthorized", boolToStr(p.workAuthorized));
  set("requiresSponsorship", boolToStr(p.requiresSponsorship));
  set("willingToRelocate", boolToStr(p.willingToRelocate));
}
function readPreferencesForm() {
  state.profile.preferences = {
    desiredSalary: get("desiredSalary"),
    yearsExperience: get("yearsExperience"),
    noticePeriod: get("noticePeriod"),
    availableStartDate: get("availableStartDate"),
    workAuthorized: strToBool(get("workAuthorized")),
    requiresSponsorship: strToBool(get("requiresSponsorship")),
    willingToRelocate: strToBool(get("willingToRelocate")),
  };
}

// ---- Templates ----
function renderTemplates() {
  const list = document.getElementById("templatesList");
  list.innerHTML = "";
  state.templates.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <button class="remove-btn" data-remove="templates:${i}">Remove</button>
      <label>Question you were asked<input data-tmpl="${i}:question" value="${esc(t.question)}" /></label>
      <label>Your answer<textarea rows="3" data-tmpl="${i}:answer">${esc(t.answer)}</textarea></label>`;
    list.appendChild(card);
  });
  list.querySelectorAll("[data-tmpl]").forEach((input) => {
    input.addEventListener("input", () => {
      const [idx, field] = input.dataset.tmpl.split(":");
      state.templates[idx][field] = input.value;
    });
  });
  list.querySelectorAll("[data-remove^='templates:']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remove.split(":")[1]);
      state.templates.splice(idx, 1);
      renderTemplates();
    });
  });
}

// ---- Profiles (presets) ----
function renderPresets() {
  document.getElementById("activeProfileLabel").textContent = state.activeProfileName;

  const list = document.getElementById("presetsList");
  list.innerHTML = "";
  state.presets.forEach((preset, i) => {
    const card = document.createElement("div");
    card.className = "card";
    const isActive = preset.name === state.activeProfileName;
    card.innerHTML = `
      <button class="remove-btn" data-remove="presets:${i}">Remove</button>
      <strong>${esc(preset.name)}</strong>${isActive ? " (active)" : ""}
      <p class="hint" style="margin:6px 0">
        ${preset.resumeFileName ? `Resume: ${esc(preset.resumeFileName)}` : "No resume filename saved"}
        ${preset.keywords ? ` · Keywords: ${esc(preset.keywords)}` : " · Keywords: auto (from skills/headline)"}
      </p>
      <button class="secondary-btn" data-load="${i}" ${isActive ? "disabled" : ""}>Load this profile</button>`;
    list.appendChild(card);
  });
  list.querySelectorAll("[data-load]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.load);
      loadPreset(state.presets[idx]);
    });
  });
  list.querySelectorAll("[data-remove^='presets:']").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remove.split(":")[1]);
      state.presets.splice(idx, 1);
      chrome.storage.local.set({ presets: state.presets });
      renderPresets();
    });
  });
}

function loadPreset(preset) {
  if (!preset) return;
  if (!confirm(`Load "${preset.name}"? This replaces the profile fields currently shown (unsaved edits will be lost).`)) return;
  state.profile = structuredClone(preset.profile);
  state.profile.experience ||= [];
  state.profile.activities ||= [];
  state.profile.education ||= [];
  state.profile.projects ||= [];
  state.activeProfileName = preset.name;

  fillPersonalForm();
  renderEducation();
  renderExperience();
  renderActivities();
  renderProjects();
  fillSkillsForm();
  fillPreferencesForm();
  renderPresets();

  chrome.storage.local.set({ profile: state.profile, activeProfileName: state.activeProfileName });
}

function bindPresets() {
  document.getElementById("savePresetBtn").addEventListener("click", () => {
    readAllForms();
    const name = document.getElementById("newPresetName").value.trim();
    if (!name) {
      alert("Give this preset a name first.");
      return;
    }
    const resumeFileName = document.getElementById("newPresetResumeFileName").value.trim();
    const keywords = document.getElementById("newPresetKeywords").value.trim();
    state.presets.push({ name, resumeFileName, keywords, profile: structuredClone(state.profile) });
    state.activeProfileName = name;
    chrome.storage.local.set({ presets: state.presets, activeProfileName: state.activeProfileName });

    document.getElementById("newPresetName").value = "";
    document.getElementById("newPresetResumeFileName").value = "";
    document.getElementById("newPresetKeywords").value = "";
    renderPresets();
  });
}

// ---- AI settings ----
function fillAiForm() {
  set("apiKey", state.settings.apiKey || "");
  set("model", state.settings.model || DEFAULT_SETTINGS.model);
  set("maxAiFields", state.settings.maxAiFields || DEFAULT_SETTINGS.maxAiFields);
}
function readAiForm() {
  const maxAiFields = Number(get("maxAiFields"));
  state.settings = {
    apiKey: get("apiKey"),
    model: get("model") || DEFAULT_SETTINGS.model,
    maxAiFields: Number.isFinite(maxAiFields) && maxAiFields > 0 ? maxAiFields : DEFAULT_SETTINGS.maxAiFields,
  };
}

function bindAddButtons() {
  document.querySelectorAll("[data-add]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switch (btn.dataset.add) {
        case "education":
          state.profile.education.push({ degree: "", institution: "", major: "", endDate: "", gpa: "" });
          renderEducation();
          break;
        case "experience":
          state.profile.experience.push({ title: "", company: "", startDate: "", endDate: "", description: "" });
          renderExperience();
          break;
        case "activities":
          state.profile.activities.push({ role: "", dates: "", description: "" });
          renderActivities();
          break;
        case "projects":
          state.profile.projects.push({ name: "", date: "", bullets: [] });
          renderProjects();
          break;
        case "templates":
          state.templates.push({ question: "", answer: "" });
          renderTemplates();
          break;
      }
    });
  });
}

function readAllForms() {
  readPersonalForm();
  readSkillsForm();
  readPreferencesForm();
  readAiForm();
}

function bindSave() {
  document.getElementById("saveBtn").addEventListener("click", async () => {
    readAllForms();
    await chrome.storage.local.set({ profile: state.profile, templates: state.templates, settings: state.settings });
    const status = document.getElementById("saveStatus");
    status.textContent = "Saved.";
    setTimeout(() => (status.textContent = ""), 2000);
  });
}

function bindTestKey() {
  document.getElementById("testKeyBtn").addEventListener("click", async () => {
    const status = document.getElementById("testKeyStatus");
    status.textContent = "Testing…";
    const apiKey = get("apiKey");
    const model = get("model");
    if (!apiKey) {
      status.textContent = "Enter an API key first.";
      return;
    }
    const res = await chrome.runtime.sendMessage({ type: "TEST_API_KEY", payload: { apiKey, model } });
    status.textContent = res?.ok ? "Connection OK." : `Failed: ${res?.error}`;
  });
}

// ---- Export / Import ----
function bindExportImport() {
  const status = document.getElementById("importStatus");

  document.getElementById("exportBtn").addEventListener("click", () => {
    readAllForms();
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: state.profile,
      templates: state.templates,
      settings: state.settings,
      presets: state.presets,
      activeProfileName: state.activeProfileName,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume-autofill-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    status.textContent = "Exported. Note: this file contains your Gemini API key in plain text — store it somewhere private.";
  });

  document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
  });

  document.getElementById("importFile").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.profile) throw new Error("File is missing a 'profile' object.");
      state.profile = data.profile;
      state.profile.experience ||= [];
      state.profile.activities ||= [];
      state.profile.education ||= [];
      state.profile.projects ||= [];
      state.templates = Array.isArray(data.templates) ? data.templates : [];
      state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      state.presets = Array.isArray(data.presets) ? data.presets : [];
      state.activeProfileName = data.activeProfileName || "Default";
      await chrome.storage.local.set({
        profile: state.profile,
        templates: state.templates,
        settings: state.settings,
        presets: state.presets,
        activeProfileName: state.activeProfileName,
      });

      fillPersonalForm();
      renderEducation();
      renderExperience();
      renderActivities();
      renderProjects();
      fillSkillsForm();
      fillPreferencesForm();
      renderTemplates();
      renderPresets();
      fillAiForm();

      status.textContent = "Imported and saved.";
    } catch (err) {
      status.textContent = `Import failed: ${err.message || err}`;
    }
  });
}

// ---- helpers ----
function set(id, value) {
  document.getElementById(id).value = value ?? "";
}
function get(id) {
  return document.getElementById(id).value.trim();
}
function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function splitCsv(str) {
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}
function boolToStr(v) {
  return v === true ? "true" : v === false ? "false" : "";
}
function strToBool(v) {
  return v === "true" ? true : v === "false" ? false : null;
}
