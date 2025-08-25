// Trigger downloads for all past paper PDFs on the current page
const btn = document.getElementById('download-all');
btn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tabId = tabs[0]?.id;
    if (tabId != null) {
      chrome.tabs.sendMessage(tabId, { type: 'DOWNLOAD_ALL_PDF_EXAMBASE' });
    }
    window.close();
  });
});
