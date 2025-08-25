# HKU Exambase Download Renamer

Automatically renames Exambase past paper downloads into:

`<COURSECODE>_Exam_<YYYY-MM-DD>.pdf`

Examples:
- `CIVL2112_Exam_2024-12-09.pdf`
- `CIVL1113_Exam_2019-05-12.pdf`

## Install (Developer mode)
1. Open Chrome → `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked** → select the `exambase-renamer/` folder

## How it works
- `content_exambase.js` parses the results table, collecting:
  - course code (e.g., CIVL2112)
  - exam date (converted to `YYYY-MM-DD`)
  - each PDF link URL
- It sends a map to the background service worker.
- When you click a PDF, `background.js` intercepts the download and renames using the template.

## Notes
- Only runs on `https://exambase-lib-hku-hk.eproxy.lib.hku.hk/*`.
- Some entries are "Restricted" and have no PDFs — they’re skipped.
- If a date isn’t found for any reason, the extension falls back to prefixing the original filename with `<COURSECODE>_Exam_`.
- In-memory caches auto-expire after ~30 minutes.

## Debugging
- In the Exambase page: open DevTools Console → look for `[ExambaseRenamer]` logs.
- In `chrome://extensions` → “HKU Exambase Download Renamer” → **Service worker** → “Inspect views” to see background logs.
