(function () {
    // ===== helpers =====
    const byQSAll = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  
    function normalizeISO(ddl, mml, yyyyl) {
      // zero-pad day and month
      const dd = String(ddl).padStart(2, "0");
      const mm = String(mml).padStart(2, "0");
      const yyyy = String(yyyyl);
      return `${yyyy}-${mm}-${dd}`;
    }
  
    function extractCourseCode() {
      // Strategy 1: banner like: <i>Listing results for the course code <b>CIVL2112</b>:</i>
      const bannerI = Array.from(document.querySelectorAll("i"))
        .find(el => /Listing results for the course code/i.test(el.textContent || ""));
      if (bannerI) {
        const b = bannerI.querySelector("b");
        if (b && /[A-Z]{2,6}\d{3,4}/.test(b.textContent)) {
          return b.textContent.trim();
        }
      }
  
      // Strategy 2: any anchor to /exhibits/show/exam/searchcourse?id=<CODE>
      const a = document.querySelector('a[href*="/exhibits/show/exam/searchcourse?id="]');
      if (a && /[A-Z]{2,6}\d{3,4}/.test(a.textContent)) {
        return a.textContent.trim();
      }
  
      // Strategy 3: last resort — scan entire document text
      const m = (document.body.textContent || "").match(/([A-Z]{2,6}\d{3,4})/);
      return m ? m[1] : null;
    }
  
    function parseRows(courseCode) {
      const resources = {};
      // rows that hold results (both even & odd)
      const rows = byQSAll("td.evenResultDetail, td.oddResultDetail");
  
      rows.forEach(row => {
        // pdf link
        const link = row.querySelector('a[href*="/archive/files/"][href$=".pdf"]');
        if (!link) return; // skip "Restricted" rows (no PDF)

        // ensure clicking forces a download instead of inline view
        const url = new URL(link.getAttribute("href"), location.origin);
        url.searchParams.set("download", "1");
        link.setAttribute("href", url.href);
        link.setAttribute("download", "");

        // locate metadata block <ul>
        const meta = row.querySelector("ul");
        if (!meta) return;

        // find date like: "Exam date (d-m-yyyy): 9-12-2024"
        const text = meta.textContent || "";
        const m = text.match(/Exam date\s*\(d-m-yyyy\)\s*:\s*(\d{1,2})-(\d{1,2})-(\d{4})/i);
        if (!m) return;

        const examDateISO = normalizeISO(m[1], m[2], m[3]);
        const pdfUrl = url.href;

        resources[pdfUrl] = {
          courseCode,
          examDate: examDateISO
        };
      });
  
      return resources;
    }
  
    // ===== run =====
    try {
      const courseCode = extractCourseCode();
      const resources = parseRows(courseCode);

      // Attach click listener for direct downloads
      byQSAll('a[href*="/archive/files/"][href$=".pdf"]').forEach(a => {
        a.addEventListener('click', evt => {
          evt.preventDefault();
          const pdfUrl = new URL(a.getAttribute('href'), location.origin).href;
          const info = resources[pdfUrl] || { courseCode, examDate: null };
          chrome.runtime.sendMessage({
            type: 'DOWNLOAD_PDF_EXAMBASE',
            pdfUrl,
            courseCode: info.courseCode,
            examDate: info.examDate
          }, () => void 0);
        });
      });

      // Debug logs (visible in page console)
      console.log("[ExambaseRenamer] courseCode:", courseCode);
      console.log("[ExambaseRenamer] resources:", resources);

      // Send to background
      chrome.runtime.sendMessage({
        type: "PAGE_INFO_EXAMBASE",
        courseCode,
        resources
      }, () => void 0);

      // Listen for "download all" requests from the popup
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'DOWNLOAD_ALL_PDF_EXAMBASE') {
          Object.entries(resources).forEach(([pdfUrl, info]) => {
            chrome.runtime.sendMessage({
              type: 'DOWNLOAD_PDF_EXAMBASE',
              pdfUrl,
              courseCode: info.courseCode,
              examDate: info.examDate
            });
          });
        }
      });
    } catch (e) {
      console.error("[ExambaseRenamer] content script error:", e);
    }
  })();
  