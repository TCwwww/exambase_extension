(() => {
  const btn = document.getElementById('downloadAllBtn');
  const progressEl = document.getElementById('progress');

  function setBusy(isBusy, labelIdle = 'Download all exam PDFs') {
    if (isBusy) {
      btn.classList.add('busy');
      btn.disabled = true;
      btn.querySelector('.label').textContent = 'Downloading…';
    } else {
      btn.classList.remove('busy');
      btn.disabled = false;
      btn.querySelector('.label').textContent = labelIdle;
    }
  }

  function updateProgress(found, done) {
    if (found === 0) {
      progressEl.textContent = 'No exam PDFs detected on this page';
    } else {
      progressEl.textContent = `Found ${found} • Downloaded ${done} / ${found}`;
    }
  }

  function getActiveTabId() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
        const tab = tabs && tabs[0];
        if (!tab) return reject(new Error('No active tab'));
        resolve(tab.id);
      });
    });
  }

  function sendMessageWithRetry(target, msg) {
    return new Promise((resolve) => {
      const doSend = () => target(msg, res => resolve(res));
      doSend();
      setTimeout(() => {
        if (!resolve._called) doSend();
      }, 500);
    });
  }

  async function requestResources(tabId) {
    const send = (m) => new Promise((resolve) => {
      try {
        chrome.tabs.sendMessage(tabId, m, (res) => resolve(res));
      } catch (_) {
        resolve(null);
      }
    });

    let resp = await send({ type: 'REQUEST_EXAMBASE_RESOURCES' });
    if (!resp || resp.ok === false) {
      try {
        await chrome.scripting.executeScript({ target: { tabId }, files: ['content_exambase.js'] });
      } catch (_) { /* no-op */ }
      // retry twice with a small delay to handle content script initialization
      resp = await send({ type: 'REQUEST_EXAMBASE_RESOURCES' });
      if (!resp || resp.ok === false) {
        await new Promise(r => setTimeout(r, 200));
        resp = await send({ type: 'REQUEST_EXAMBASE_RESOURCES' });
      }
    }
    return resp;
  }

  function startBatchDownload(items) {
    return new Promise((resolve) => {
      const total = items.length;
      let done = 0;
      let started = false;

      const onMessage = (msg) => {
        if (msg?.type === 'DOWNLOAD_PROGRESS') {
          done = msg.done;
          updateProgress(total, done);
          if (done >= total) {
            chrome.runtime.onMessage.removeListener(onMessage);
            resolve();
          }
        }
        if (msg?.type === 'DOWNLOAD_DONE') {
          updateProgress(total, total);
          chrome.runtime.onMessage.removeListener(onMessage);
          resolve();
        }
      };
      chrome.runtime.onMessage.addListener(onMessage);

      const sendStart = () => {
        try {
          started = true;
          chrome.runtime.sendMessage({ type: 'DOWNLOAD_ALL_EXAMBASE', items }, () => void 0);
        } catch (_) { /* no-op */ }
      };

      // Try start, then retry once after 600ms if no progress (SW idle)
      sendStart();
      setTimeout(() => {
        if (!started || done === 0) {
          try { chrome.runtime.sendMessage({ type: 'DOWNLOAD_ALL_EXAMBASE', items }, () => void 0); } catch (_) {}
        }
      }, 600);
    });
  }

  btn.addEventListener('click', async () => {
    try {
      setBusy(true);
      const tabId = await getActiveTabId();
      const resp = await requestResources(tabId);
      if (!resp || !resp.ok) {
        updateProgress(0, 0);
        setBusy(false);
        return;
      }
      const entries = Object.entries(resp.resources || {});
      const found = entries.length;
      if (found === 0) {
        updateProgress(0, 0);
        setBusy(false);
        return;
      }
      updateProgress(found, 0);

      const items = entries.map(([pdfUrl, info]) => ({
        pdfUrl,
        courseCode: info.courseCode || resp.courseCode || null,
        examDate: info.examDate || null
      }));

      await startBatchDownload(items);
    } catch (e) {
      updateProgress(0, 0);
    } finally {
      setBusy(false);
    }
  });
})();


