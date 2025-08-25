// Simple in-memory caches (persisted via chrome.storage)
const resourcesByUrl = Object.create(null);   // { pdfUrl: { courseCode, examDate, ts } }
const courseCodeByUrl = Object.create(null);  // optional: pageUrl -> courseCode

// Load persisted caches to survive service worker restarts
{
  const stored = await chrome.storage.local.get({
    resourcesByUrl: {},
    courseCodeByUrl: {}
  });
  Object.assign(resourcesByUrl, stored.resourcesByUrl);
  Object.assign(courseCodeByUrl, stored.courseCodeByUrl);
}

function persistCache() {
  chrome.storage.local.set({ resourcesByUrl, courseCodeByUrl });
}

// Housekeeping: expire entries after 30 min
const EXPIRY_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of Object.entries(resourcesByUrl)) {
    if (now - v.ts > EXPIRY_MS) delete resourcesByUrl[k];
  }
  for (const [k, v] of Object.entries(courseCodeByUrl)) {
    if (now - v.ts > EXPIRY_MS) delete courseCodeByUrl[k];
  }
  // Persist cleaned caches
  persistCache();
}, 5 * 60 * 1000);

// Receive parsed page info from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg?.type === "PAGE_INFO_EXAMBASE") {
      const pageUrl = sender?.url || sender?.origin || "";
      const now = Date.now();

      if (msg.courseCode && pageUrl) {
        courseCodeByUrl[pageUrl] = { courseCode: msg.courseCode, ts: now };
      }

      if (msg.resources && typeof msg.resources === "object") {
        for (const [pdfUrl, info] of Object.entries(msg.resources)) {
          if (!pdfUrl) continue;
          resourcesByUrl[pdfUrl] = {
            courseCode: info.courseCode || msg.courseCode || null,
            examDate: info.examDate || null,
            ts: now
          };
        }
      }

      persistCache();
    } else if (msg?.type === "DOWNLOAD_PDF_EXAMBASE" && msg.pdfUrl) {
      const info = { courseCode: msg.courseCode, examDate: msg.examDate };
      const filename = buildTargetFilename(info, msg.pdfUrl);
      const now = Date.now();
      resourcesByUrl[msg.pdfUrl] = { ...info, ts: now };
      chrome.downloads.download({
        url: msg.pdfUrl,
        filename,
        conflictAction: "uniquify"
      });
      persistCache();
    }
  } catch (e) {
    console.error("[ExambaseRenamer] onMessage error:", e);
  } finally {
    // Not really needed but avoids "Unchecked runtime.lastError" in some cases
    if (sendResponse) sendResponse({ ok: true });
  }
});

// Utility: ensure date looks like YYYY-MM-DD
function isISODate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Utility: sanitize filename (remove illegal characters)
function sanitize(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "").trim();
}

// Build target filename using existing rules
function buildTargetFilename(info, url) {
  if (!info?.courseCode) return undefined;
  const code = sanitize(info.courseCode);
  if (info.examDate && isISODate(info.examDate)) {
    return `${code}_Exam_${info.examDate}.pdf`;
  }
  const original = url.split("/").pop().split("?")[0];
  return `${code}_Exam_${sanitize(original)}`;
}

// Main: intercept and rename
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  try {
    // Try direct URL mapping first
    let info = resourcesByUrl[item.url];

    // Fallback: try referrer
    if (!info && item.referrer) {
      info = resourcesByUrl[item.referrer];

      // LAST-RESORT: prefix match search if referrer is a full page URL and we stored per-link entries
      if (!info) {
        for (const [k, v] of Object.entries(resourcesByUrl)) {
          if (item.referrer.startsWith(k)) { info = v; break; }
        }
      }
    }

    // If we have details, build the target file name
    if (info?.courseCode) {
      const code = sanitize(info.courseCode);
      let target = null;

      // Use desired format: <COURSECODE>_Exam_<YYYY-MM-DD>.pdf
      if (info.examDate && isISODate(info.examDate)) {
        target = `${code}_Exam_${info.examDate}.pdf`;
      } else {
        // fallback when date missing: prefix whatever was given
        const original = item.filename.split("/").pop();
        target = `${code}_Exam_${sanitize(original)}`;
      }

      console.log("[ExambaseRenamer] Renaming to:", target);
      suggest({ filename: target, conflictAction: "uniquify" });
      return;
    }

    // If nothing found, keep original
    suggest({ filename: item.filename, conflictAction: "uniquify" });
  } catch (e) {
    console.error("[ExambaseRenamer] rename error:", e);
    suggest({ filename: item.filename, conflictAction: "uniquify" });
  }
});
