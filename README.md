# Resume Autofill AI

A Chrome extension that autofills job application forms from a saved profile
(pre-populated from your resume), and drafts answers to open-ended questions
using Gemini's free tier, styled after example answers you provide.

## How it works

- **Direct fill (green highlight):** name, email, phone, links, education,
  address, salary/notice-period/availability, work-authorization yes/no
  questions — anything matched confidently to a profile field. Dropdowns
  (country, state, etc.) match on exact text/value first, then fall back to a
  fuzzy contains-match so "India" still hits an option worded "IN" or
  "India (IN)".
- **AI-drafted (amber highlight):** open-ended questions ("Why do you want to
  work here?", "Describe a project you're proud of") get answered by Gemini,
  using your resume + the example Q&A pairs you save in Options as style
  guides. **Always review amber fields before submitting** — nothing is
  auto-submitted, ever. How many questions get sent per page is capped by
  **Max AI-drafted fields per page** in AI Settings (default 8).
- **Left for you, no field highlighted:** demographic/EEO questions (gender,
  race, veteran, disability status, etc.), passwords, file uploads, submit
  buttons, and questions the AI has no factual basis to answer (e.g. "How did
  you hear about us?", requisition/job IDs) — the extension won't fabricate an
  answer to those. Browsers also don't allow scripts to set file inputs, so
  **resume/cover letter uploads always need to be attached manually.**
- **Run it without opening the popup:** press **Ctrl+Shift+F** (**Cmd+Shift+F**
  on Mac) on any page to autofill it directly — a small toast in the
  bottom-right corner reports what happened. Change the shortcut at
  `chrome://extensions/shortcuts`.

## Setup

1. **Load the extension**
   - Open `chrome://extensions`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked" and select the `resume-autofill-extension` folder

2. **Get a free Gemini API key**
   - Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - Create a key (no cost on the free tier)

3. **Configure the extension**
   - Click the extension icon → the gear icon → Options
   - Fill in / correct your profile (pre-filled from your resume — check
     links, location, and preferences since those weren't on the PDF)
   - Add a few **Answer Style Templates**: real questions you've answered
     before + your actual answers. The more you add, the better the AI
     matches your voice.
   - Fill in **Activities & Leadership** (Projects & Experience tab) for
     positions of responsibility, clubs, or volunteering — used as context
     for "tell us about your leadership experience" style questions.
   - Paste your Gemini API key under **AI Settings**, type a model ID (any
     current Gemini model — see the hint text on that tab), and click "Test
     connection"
   - Click **Save changes**

4. **Back up your profile (optional but recommended)**
   - Click **Export backup (JSON)** in the sidebar any time to download your
     full profile, templates, and settings as one file — note it includes
     your API key in plain text, so keep the file private.
   - **Import backup** restores from that file, e.g. on a new machine or a
     second browser profile.

## Using it

1. Open any job application form
2. Click the extension icon → **Autofill this page**
3. Green fields were filled directly; amber fields were AI-drafted — read
   them, edit anything, then submit the form yourself as normal

## Notes & limits

- Works on plain HTML forms and most ATS platforms (Greenhouse, Lever,
  generic career sites). Highly customized multi-step platforms (e.g.
  Workday) may need a second "Autofill" click per step, since new fields
  only appear after you advance.
- The Gemini free tier has rate limits (a handful of requests per minute,
  ~1500/day as of writing) — the extension batches all open-ended questions
  on a page into one request to stay well within that.
- Google periodically retires older Gemini model IDs. If autofill suddenly
  stops drafting AI answers, open **AI Settings** and click "Test connection"
  — a failure there usually means the model ID needs updating to a current
  one from [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models).
- Your API key and profile are stored only in `chrome.storage.local` on your
  machine — nothing is sent anywhere except Google's Gemini API when drafting
  an answer.
- The extension is unpacked/local-only (not published to the Chrome Web
  Store), so Chrome will show a "Developer mode extensions" warning banner —
  that's expected for unpacked extensions.

## File structure

```
manifest.json        Extension manifest (MV3)
background.js         Owns the Gemini API key; makes all LLM calls
content.js             Injected on demand; scans the page, fills fields
popup/                 Toolbar popup — "Autofill this page" button
options/                Full settings UI — profile, templates, AI key
icons/                  Generated toolbar icons
```
