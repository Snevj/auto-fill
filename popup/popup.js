const statusEl = document.getElementById("profileStatus");
const btn = document.getElementById("autofillBtn");
const resultEl = document.getElementById("result");
const resumeHintEl = document.getElementById("resumeHint");
const suggestionEl = document.getElementById("presetSuggestion");
const suggestionTextEl = document.getElementById("presetSuggestionText");
const switchProfileBtn = document.getElementById("switchProfileBtn");

document.getElementById("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.getElementById("editProfileLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();

async function init() {
  const { profile, settings, presets, activeProfileName } = await chrome.storage.local.get([
    "profile",
    "settings",
    "presets",
    "activeProfileName",
  ]);
  if (!profile) {
    statusEl.textContent = "No profile saved yet — open settings to set one up.";
    btn.disabled = true;
    return;
  }

  const name = profile.personal?.fullName || "your profile";
  const aiNote = settings?.apiKey ? "AI answers enabled." : "AI answers off (no API key set).";
  statusEl.textContent = `Ready: ${name}. ${aiNote}`;

  const currentName = activeProfileName || "Default";
  const currentPreset = Array.isArray(presets) ? presets.find((p) => p.name === currentName) : null;
  if (currentPreset?.resumeFileName) {
    resumeHintEl.textContent = `Attach when asked for a resume: ${currentPreset.resumeFileName}`;
    resumeHintEl.classList.remove("hidden");
  }

  if (Array.isArray(presets) && presets.length > 0) {
    await maybeSuggestPreset(presets, currentName);
  }
}

async function maybeSuggestPreset(presets, currentName) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const ctx = await getPageContext(tab.id);
  if (!ctx) return;

  const text = [ctx.title, ctx.desc, ctx.h1].join(" ").toLowerCase();
  const scored = presets
    .map((preset) => ({ preset, score: scorePreset(preset, text) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];

  // Require a couple of real keyword hits and a genuinely different profile
  // before suggesting — a single coincidental match isn't worth interrupting for.
  if (!best || best.score < 2 || best.preset.name === currentName) return;

  suggestionTextEl.textContent = `This looks like a "${best.preset.name}" role — switch profiles?`;
  suggestionEl.classList.remove("hidden");
  switchProfileBtn.onclick = async () => {
    await chrome.storage.local.set({ profile: best.preset.profile, activeProfileName: best.preset.name });
    suggestionEl.classList.add("hidden");
    await init();
  };
}

async function getPageContext(tabId) {
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        title: document.title || "",
        desc: document.querySelector('meta[name="description"]')?.content || "",
        h1: document.querySelector("h1")?.innerText || "",
      }),
    });
    return result;
  } catch {
    return null;
  }
}

function scorePreset(preset, lowerCaseText) {
  const keywords =
    preset.keywords && preset.keywords.trim()
      ? preset.keywords.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      : deriveKeywords(preset.profile);
  let score = 0;
  for (const kw of keywords) {
    if (kw.length > 1 && lowerCaseText.includes(kw)) score++;
  }
  return score;
}

function deriveKeywords(profile) {
  const skills = Object.values(profile?.skills || {}).flat().filter(Boolean);
  const headlineWords = (profile?.headline || "").split(/\W+/).filter((w) => w.length > 4);
  return [...skills, ...headlineWords].map((s) => String(s).toLowerCase());
}

btn.addEventListener("click", async () => {
  btn.disabled = true;
  btn.textContent = "Filling…";
  resultEl.classList.add("hidden");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab.");

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
    const response = await chrome.tabs.sendMessage(tab.id, { action: "AUTOFILL" });

    if (!response?.ok) {
      showResult(response?.error || "Something went wrong.", "error");
    } else {
      const s = response.summary;
      const lines = [`Filled ${s.filledDirect} field(s) directly.`];
      if (s.llmQueued > 0) {
        if (s.filledAI > 0) lines.push(`AI drafted ${s.filledAI} answer(s) — please review before submitting.`);
        if (s.aiError) lines.push(s.aiError);
      }
      if (s.skippedBlocked > 0) {
        lines.push(`Left ${s.skippedBlocked} field(s) untouched (demographic/EEO or sensitive) for you to fill yourself.`);
      }
      if (s.skippedNoData > 0) {
        lines.push(`Left ${s.skippedNoData} field(s) untouched (no factual basis to answer, e.g. referral source).`);
      }
      if (s.skippedFilled > 0) {
        lines.push(`Left ${s.skippedFilled} field(s) as-is (already had an answer).`);
      }
      showResult(lines.join(" "), s.aiError && s.filledAI === 0 ? "warn" : "");
    }
  } catch (err) {
    showResult(
      /Could not establish connection|Receiving end does not exist/.test(String(err))
        ? "Couldn't reach this page. Try reloading the tab and running autofill again."
        : String(err.message || err),
      "error"
    );
  } finally {
    btn.disabled = false;
    btn.textContent = "Autofill this page";
  }
});

function showResult(text, kind) {
  resultEl.textContent = text;
  resultEl.className = "result" + (kind ? ` ${kind}` : "");
  resultEl.classList.remove("hidden");
}
