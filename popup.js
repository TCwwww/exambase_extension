// Trigger downloads for all past paper PDFs on the current page
const btn = document.getElementById('download-all');
btn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0];
    if (tab) {
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_ALL_PDF_EXAMBASE',
        pageUrl: tab.url
      });
    }
    window.close();
  });
});
