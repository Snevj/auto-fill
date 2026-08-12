// Injected on demand (from the popup) into the active tab. Scans the page for
// form fields, fills what it can map directly from the saved profile, and
// batches anything that looks like an open-ended question off to the
// background worker for an AI-drafted (but never auto-submitted) answer.

(() => {
  if (window.__resumeAutofillRunning) return; // guard against double-injection
  window.__resumeAutofillRunning = true;

  const BLOCKLIST_RE =
    /race|ethnicit|gender|\bsex\b|veteran|disabilit|sexual\s*orientation|transgender|pronoun|social\s*security|\bssn\b|passport|date\s*of\s*birth|\bdob\b|\bage\b|religion|marital/i;

  // Questions the AI has no factual basis to answer (referral source, internal
  // codes, etc.) — left blank for the user rather than risking a fabricated guess.
  const NO_GUESS_RE =
    /how\s*did\s*you\s*(hear|find|learn)|referral|referred\s*by|hear\s*about\s*(us|this|the\s*role)|source\s*of\s*(this\s*)?(job|application)|requisition|\breq\.?\s*(id|number)\b|job\s*(id|code)/i;

  const RULES = [
    { key: "email", re: /e-?mail/i, get: (p) => p.personal.email },
    { key: "firstName", re: /^first\s*name$|given\s*name/i, get: (p) => p.personal.firstName },
    { key: "lastName", re: /^last\s*name$|sur\s*name|family\s*name/i, get: (p) => p.personal.lastName },
    { key: "fullName", re: /^(your\s+|full\s+|legal\s+)?name$/i, get: (p) => p.personal.fullName },
    { key: "phone", re: /phone|mobile|cell/i, get: (p) => p.personal.phone },
    { key: "linkedin", re: /linkedin/i, get: (p) => p.links.linkedin },
    { key: "github", re: /git\s*hub/i, get: (p) => p.links.github },
    { key: "portfolio", re: /portfolio|personal\s*website|^website$/i, get: (p) => p.links.portfolio },
    { key: "address", re: /street\s*address|^address(\s*line\s*1)?$/i, get: (p) => p.personal.address1 },
    { key: "city", re: /^city$|^town$/i, get: (p) => p.personal.city },
    { key: "state", re: /^state$|state\s*\/\s*province|^province$/i, get: (p) => p.personal.state },
    { key: "zip", re: /zip|postal/i, get: (p) => p.personal.zip },
    { key: "country", re: /^country$/i, get: (p) => p.personal.country },
    { key: "currentCompany", re: /current\s*(employer|company)/i, get: (p) => p.personal.currentCompany },
    { key: "currentTitle", re: /current\s*(job\s*)?title|current\s*position/i, get: (p) => p.personal.currentTitle },
    { key: "university", re: /university|college|school\s*name|institution/i, get: (p) => p.education?.[0]?.institution },
    { key: "degree", re: /degree/i, get: (p) => p.education?.[0]?.degree },
    { key: "major", re: /major|field\s*of\s*study/i, get: (p) => p.education?.[0]?.major },
    { key: "graduationYear", re: /graduation|grad\s*date|grad\s*year/i, get: (p) => p.education?.[0]?.endDate },
    { key: "gpa", re: /gpa/i, get: (p) => p.education?.[0]?.gpa },
    { key: "salary", re: /salary|compensation\s*expectation|desired\s*pay/i, get: (p) => p.preferences.desiredSalary },
    { key: "noticePeriod", re: /notice\s*period/i, get: (p) => p.preferences.noticePeriod },
    { key: "startDate", re: /available.*start|start\s*date|earliest\s*(start\s*)?date/i, get: (p) => p.preferences.availableStartDate },
    { key: "yearsExperience", re: /years?\s*of\s*experience/i, get: (p) => p.preferences.yearsExperience },
  ];

  const BOOLEAN_GROUPS = [
    { key: "workAuthorization", re: /authoriz(ed|ation).*work|legally\s*(entitled|permitted|authorized)/i, get: (p) => p.preferences.workAuthorized },
    { key: "sponsorship", re: /sponsor|visa\s*sponsorship/i, get: (p) => p.preferences.requiresSponsorship },
    { key: "relocate", re: /relocat/i, get: (p) => p.preferences.willingToRelocate },
  ];

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.action === "AUTOFILL") {
      runAutofill().then((result) => {
        showToast(result);
        sendResponse(result);
      });
      return true;
    }
    return false;
  });

  function showToast(result) {
    document.getElementById("__resumeAutofillToast")?.remove();

    let text;
    if (!result?.ok) {
      text = result?.error || "Autofill failed.";
    } else {
      const s = result.summary;
      const parts = [`Filled ${s.filledDirect} directly`];
      if (s.filledAI > 0) parts.push(`${s.filledAI} AI-drafted (review before submitting)`);
      if (s.skippedBlocked > 0) parts.push(`${s.skippedBlocked} left for you (sensitive)`);
      if (s.skippedNoData > 0) parts.push(`${s.skippedNoData} left for you (no data)`);
      if (s.aiError) parts.push(s.aiError);
      text = parts.join(" · ");
    }

    const toast = document.createElement("div");
    toast.id = "__resumeAutofillToast";
    toast.textContent = text;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "20px",
      right: "20px",
      maxWidth: "340px",
      background: "#18181b",
      color: "#f4f4f5",
      padding: "12px 16px",
      borderRadius: "10px",
      fontSize: "13px",
      lineHeight: "1.5",
      fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      zIndex: 2147483647,
    });
    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
  }

  async function runAutofill() {
    const { profile, templates, settings } = await chrome.storage.local.get(["profile", "templates", "settings"]);
    if (!profile) {
      return { ok: false, error: "No profile saved yet. Open the extension Options page and fill it in first." };
    }

    const fields = discoverFields();
    let filledDirect = 0;
    let skippedBlocked = 0;
    let skippedNoData = 0;
    const llmCandidates = [];

    for (const field of fields) {
      if (BLOCKLIST_RE.test(field.label)) {
        skippedBlocked++;
        continue;
      }
      if (field.kind === "text") {
        const rule = RULES.find((r) => r.re.test(field.label));
        if (rule) {
          const value = rule.get(profile);
          if (value) {
            if (setValue(field.el, String(value))) {
              flash(field.el, "direct");
              filledDirect++;
            }
            continue;
          }
        }
        if (NO_GUESS_RE.test(field.label)) {
          skippedNoData++;
          continue;
        }
        if (isOpenEndedCandidate(field)) {
          llmCandidates.push(field);
        }
      } else if (field.kind === "boolGroup") {
        const rule = BOOLEAN_GROUPS.find((r) => r.re.test(field.label));
        if (rule) {
          const val = rule.get(profile);
          if (val === true || val === false) {
            const target = pickYesNo(field.options, val);
            if (target) {
              target.checked = true;
              target.dispatchEvent(new Event("click", { bubbles: true }));
              target.dispatchEvent(new Event("change", { bubbles: true }));
              flash(target, "direct");
              filledDirect++;
            }
          }
        }
      }
    }

    const maxAiFields = Number(settings?.maxAiFields) > 0 ? Number(settings.maxAiFields) : 8;
    const capped = llmCandidates.slice(0, maxAiFields);
    let filledAI = 0;
    let aiError = null;

    if (capped.length > 0) {
      if (!settings?.apiKey) {
        aiError = `${capped.length} open-ended question(s) found, but no Gemini API key is set — add one in Options to have these drafted.`;
      } else {
        const questions = capped.map((f, i) => ({
          id: `q${i}`,
          label: f.label,
          maxLength: f.el.maxLength > 0 ? f.el.maxLength : undefined,
        }));
        const pageContext = scrapePageContext();
        const response = await chrome.runtime.sendMessage({
          type: "GENERATE_ANSWERS",
          payload: {
            questions,
            profile,
            templates,
            pageContext,
            apiKey: settings.apiKey,
            model: settings.model || "gemini-2.5-flash",
          },
        });
        if (response?.ok) {
          const byId = new Map(response.answers.map((a) => [a.id, a.answer]));
          capped.forEach((f, i) => {
            const answer = byId.get(`q${i}`);
            if (answer) {
              setValue(f.el, answer);
              flash(f.el, "ai");
              filledAI++;
            }
          });
        } else {
          aiError = response?.error || "AI answer generation failed.";
        }
      }
    }

    return {
      ok: true,
      summary: {
        totalFields: fields.length,
        filledDirect,
        filledAI,
        skippedBlocked,
        skippedNoData,
        llmQueued: llmCandidates.length,
        llmFilled: capped.length,
        aiError,
      },
    };
  }

  function isOpenEndedCandidate(field) {
    const el = field.el;
    const isTextarea = el.tagName === "TEXTAREA";
    const looksLikeQuestion = field.label.length > 15 || /\?/.test(field.label);
    if (el.value && el.value.trim().length > 0) return false; // don't overwrite existing content
    return isTextarea || looksLikeQuestion;
  }

  function pickYesNo(options, wantYes) {
    const yesRe = /^yes$/i;
    const noRe = /^no$/i;
    for (const opt of options) {
      if (wantYes && yesRe.test(opt.label.trim())) return opt.el;
      if (!wantYes && noRe.test(opt.label.trim())) return opt.el;
    }
    return null;
  }

  function discoverFields() {
    const results = [];
    const seenRadioGroups = new Set();
    const nodes = document.querySelectorAll("input, textarea, select");

    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const type = (el.getAttribute("type") || el.tagName.toLowerCase()).toLowerCase();

      if (type === "radio" || type === "checkbox") {
        const name = el.name;
        if (!name || seenRadioGroups.has(name)) continue;
        const group = document.querySelectorAll(`input[name="${cssEscape(name)}"]`);
        if (group.length < 2) continue; // single checkbox (e.g. consent) — leave for the user
        seenRadioGroups.add(name);
        const label = labelForGroup(group[0]) || "";
        const options = Array.from(group).map((g) => ({ el: g, label: labelForField(g) || g.value || "" }));
        results.push({ kind: "boolGroup", label, options });
        continue;
      }

      if (["submit", "button", "image", "hidden", "file", "password", "reset"].includes(type)) continue;
      if (el.disabled || el.readOnly) continue;

      const label = labelForField(el);
      if (!label) continue;
      results.push({ kind: "text", el, label });
    }
    return results;
  }

  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function labelForField(el) {
    if (el.id) {
      const byFor = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
      if (byFor) return cleanText(byFor.innerText || byFor.textContent);
    }
    const wrapping = el.closest("label");
    if (wrapping) return cleanText(wrapping.innerText || wrapping.textContent);

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return cleanText(ariaLabel);

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const node = document.getElementById(labelledBy);
      if (node) return cleanText(node.innerText || node.textContent);
    }

    const placeholder = el.getAttribute("placeholder");
    if (placeholder) return cleanText(placeholder);

    // Walk up a few ancestors looking for a preceding heading/label-ish text node.
    let container = el.parentElement;
    for (let depth = 0; depth < 4 && container; depth++) {
      const candidate = container.querySelector("label, .label, legend, [class*='label']");
      if (candidate && !candidate.contains(el)) {
        const text = cleanText(candidate.innerText || candidate.textContent);
        if (text) return text;
      }
      container = container.parentElement;
    }

    const name = el.getAttribute("name") || el.getAttribute("id");
    if (name) return humanize(name);
    return "";
  }

  function labelForGroup(radioEl) {
    let container = radioEl.closest("fieldset") || radioEl.parentElement;
    for (let depth = 0; depth < 5 && container; depth++) {
      const legend = container.querySelector("legend, .label, [class*='question'], [class*='label']");
      if (legend) {
        const text = cleanText(legend.innerText || legend.textContent);
        if (text && text.length > 2) return text;
      }
      container = container.parentElement;
    }
    return labelForField(radioEl);
  }

  function cleanText(text) {
    let t = (text || "").replace(/\s+/g, " ").trim();
    // Strip required/optional decorations that break exact-match rules, e.g.
    // "First Name *", "Country:", "City (optional)" all mean just "City".
    for (let i = 0; i < 3; i++) {
      const before = t;
      t = t
        .replace(/\s*\*+\s*$/, "")
        .replace(/\s*\((optional|required)\)\s*$/i, "")
        .replace(/\s*:\s*$/, "")
        .trim();
      if (t === before) break;
    }
    return t.slice(0, 300);
  }

  function humanize(name) {
    return name
      .replace(/[_-]/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .toLowerCase()
      .trim();
  }

  function cssEscape(str) {
    return window.CSS && CSS.escape ? CSS.escape(str) : str.replace(/([^\w-])/g, "\\$1");
  }

  function setValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    let changed = true;
    if (el.tagName === "SELECT") {
      const option = matchOption(el, value);
      if (option) {
        el.value = option.value;
      } else {
        changed = false;
      }
    } else if (nativeSetter) {
      nativeSetter.call(el, value);
    } else {
      el.value = value;
    }
    if (changed) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return changed;
  }

  // Exact text/value match first, then fuzzy contains-either-way (handles
  // "United States" vs "United States of America", "IN" vs "India", etc.)
  function matchOption(el, value) {
    const target = value.trim().toLowerCase();
    if (!target) return null;
    const options = Array.from(el.options).filter((o) => o.value);
    let match = options.find(
      (o) => o.textContent.trim().toLowerCase() === target || o.value.trim().toLowerCase() === target
    );
    if (match) return match;
    match = options.find((o) => {
      const text = o.textContent.trim().toLowerCase();
      return text.length > 2 && (text.includes(target) || target.includes(text));
    });
    return match || null;
  }

  function flash(el, kind) {
    const color = kind === "ai" ? "#f59e0b" : "#22c55e";
    const prevOutline = el.style.outline;
    const prevOffset = el.style.outlineOffset;
    el.style.outline = `2px solid ${color}`;
    el.style.outlineOffset = "1px";
    if (kind === "ai") {
      el.title = "AI-drafted answer — please review before submitting.";
      const clearOnEdit = () => {
        el.style.outline = prevOutline;
        el.style.outlineOffset = prevOffset;
        el.removeEventListener("input", clearOnEdit);
      };
      el.addEventListener("input", clearOnEdit, { once: true });
    } else {
      setTimeout(() => {
        el.style.outline = prevOutline;
        el.style.outlineOffset = prevOffset;
      }, 2500);
    }
  }

  function scrapePageContext() {
    const parts = [];
    if (document.title) parts.push(`Page title: ${document.title}`);
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    if (ogTitle) parts.push(`OG title: ${ogTitle}`);
    const metaDesc = document.querySelector('meta[name="description"]')?.content;
    if (metaDesc) parts.push(`Description: ${metaDesc.slice(0, 300)}`);
    const h1 = document.querySelector("h1")?.innerText;
    if (h1) parts.push(`Heading: ${cleanText(h1)}`);
    return parts.join("\n").slice(0, 800);
  }
})();
