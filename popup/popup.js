const statusEl = document.getElementById("profileStatus");
const btn = document.getElementById("autofillBtn");
const resultEl = document.getElementById("result");

document.getElementById("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
document.getElementById("editProfileLink").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

init();

async function init() {
  const { profile, settings } = await chrome.storage.local.get(["profile", "settings"]);
  if (!profile) {
    statusEl.textContent = "No profile saved yet — open settings to set one up.";
    btn.disabled = true;
  } else {
    const name = profile.personal?.fullName || "your profile";
    const aiNote = settings?.apiKey ? "AI answers enabled." : "AI answers off (no API key set).";
    statusEl.textContent = `Ready: ${name}. ${aiNote}`;
  }
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
