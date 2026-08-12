// Owns all LLM calls. The content script never talks to Gemini directly —
// it only ever sees questions and gets back answers, never the API key.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Keyboard shortcut (default Ctrl/Cmd+Shift+F) — runs autofill without
// opening the popup. Invoking a declared command grants activeTab for the
// current tab, same as clicking the toolbar icon, so this needs no extra
// permissions. Feedback is shown as an in-page toast by content.js itself
// since there's no popup open to report back to.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "run-autofill") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    await chrome.tabs.sendMessage(tab.id, { action: "AUTOFILL" });
  } catch {
    // Nothing to report to — content script (if it loaded) handles its own errors via toast.
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GENERATE_ANSWERS") {
    generateAnswers(message.payload)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true; // async response
  }
  if (message?.type === "TEST_API_KEY") {
    testApiKey(message.payload)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }
  return false;
});

async function testApiKey({ apiKey, model }) {
  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: "Reply with exactly the word OK." }] }],
      generationConfig: { maxOutputTokens: 10 },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || `Gemini API error (HTTP ${res.status})`);
  }
  return { text: extractText(data) };
}

async function generateAnswers({ questions, profile, templates, pageContext, apiKey, model }) {
  if (!apiKey) throw new Error("No Gemini API key configured. Add one in the extension Options page.");
  if (!Array.isArray(questions) || questions.length === 0) return { answers: [] };

  const prompt = buildPrompt({ questions, profile, templates, pageContext });
  const url = `${GEMINI_BASE}/${encodeURIComponent(model || "gemini-2.5-flash")}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `Gemini API error (HTTP ${res.status})`;
    if (res.status === 429) throw new Error("Gemini free-tier rate limit hit. Wait a bit and try again.");
    throw new Error(msg);
  }

  const raw = extractText(data);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
    }
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Model did not return the expected JSON list of answers.");
  }
  return { answers: parsed };
}

function extractText(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => p.text || "").join("");
}

function buildPrompt({ questions, profile, templates, pageContext }) {
  const resumeSummary = summarizeProfile(profile);
  const styleExamples = (templates || [])
    .filter((t) => t.question && t.answer)
    .map((t, i) => `Example ${i + 1}\nQ: ${t.question}\nA: ${t.answer}`)
    .join("\n\n");

  const questionList = questions
    .map((q) => `- id: ${q.id}\n  question: ${q.label}${q.maxLength ? `\n  max_characters: ${q.maxLength}` : ""}`)
    .join("\n");

  return `You are ghostwriting job application answers AS THE CANDIDATE, in the first person ("I"), based on their real resume and their own past answers. Never invent facts, employers, degrees, or numbers not present in the resume context below. If a question asks for something the resume doesn't cover, answer honestly and generally rather than fabricating specifics.

RESUME CONTEXT:
${resumeSummary}

${pageContext ? `JOB / COMPANY CONTEXT (scraped from the page, may be partial or noisy):\n${pageContext}\n` : ""}
${styleExamples ? `THE CANDIDATE'S OWN PAST ANSWERS (match this tone, voice, sentence length, and level of detail):\n${styleExamples}\n` : "The candidate has not provided example answers yet — default to a concise, direct, professional tone.\n"}

TASK: Answer each of the following application questions. Respond with ONLY a JSON array, no markdown fences, no commentary, in this exact shape:
[{"id": "<id>", "answer": "<answer text>"}]

Keep each answer under its max_characters if one is given (leave headroom, don't hit the limit exactly). Keep answers natural and human, not generic AI filler.

QUESTIONS:
${questionList}`;
}

function summarizeProfile(profile) {
  if (!profile) return "(no resume data available)";
  const p = profile.personal || {};
  const lines = [];
  lines.push(`Name: ${p.fullName || `${p.firstName || ""} ${p.lastName || ""}`.trim()}`);
  if (profile.headline) lines.push(`Headline: ${profile.headline}`);
  if (Array.isArray(profile.education) && profile.education.length) {
    lines.push("Education:");
    for (const e of profile.education) {
      lines.push(`  - ${e.degree || ""} at ${e.institution || ""}${e.endDate ? `, ${e.endDate}` : ""}`);
    }
  }
  if (Array.isArray(profile.experience) && profile.experience.length) {
    lines.push("Experience:");
    for (const e of profile.experience) {
      lines.push(`  - ${e.title || ""} at ${e.company || ""} (${e.startDate || ""}–${e.endDate || "present"}): ${e.description || ""}`);
    }
  }
  if (Array.isArray(profile.projects) && profile.projects.length) {
    lines.push("Projects:");
    for (const proj of profile.projects) {
      lines.push(`  - ${proj.name || ""}: ${(proj.bullets || []).join(" ")}`);
    }
  }
  if (Array.isArray(profile.activities) && profile.activities.length) {
    lines.push("Activities & Leadership:");
    for (const act of profile.activities) {
      lines.push(`  - ${act.role || ""}${act.dates ? ` (${act.dates})` : ""}: ${act.description || ""}`);
    }
  }
  const skills = profile.skills || {};
  const allSkills = Object.values(skills).flat().filter(Boolean);
  if (allSkills.length) lines.push(`Skills: ${allSkills.join(", ")}`);
  return lines.join("\n");
}
