// Test-only content script (dist/firefox-test builds only). Relays queries from the local
// test page to tests/firefox-test-hook.js so the Firefox E2E test can inspect the extension.
const captionResults = [];
const captionStatuses = [];
browser.runtime.onMessage.addListener((message) => {
  if (message && message.action === 'transcription-result' && message.result) captionResults.push(message.result);
  if (message && message.action === 'transcription-status') captionStatuses.push(message);
});

window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || !event.data.limitrTestQuery) return;
  const { id, query } = event.data.limitrTestQuery;
  if (query.op === 'caption-results') {
    window.postMessage({ limitrTestReply: { id, result: captionResults.splice(0) } }, '*');
    return;
  }
  if (query.op === 'caption-statuses') {
    window.postMessage({ limitrTestReply: { id, result: captionStatuses.splice(0) } }, '*');
    return;
  }
  browser.runtime.sendMessage({ limitrTest: query }).then(
    result => window.postMessage({ limitrTestReply: { id, result } }, '*'),
    error => window.postMessage({ limitrTestReply: { id, error: error.message } }, '*')
  );
});
