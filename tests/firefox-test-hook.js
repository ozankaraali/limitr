// Test-only background script (dist/firefox-test builds only). Answers queries from
// tests/firefox-test-agent.js using the extension APIs a real popup would use.
browser.runtime.onMessage.addListener((message, sender) => {
  const query = message && message.limitrTest;
  if (!query || !sender.tab) return undefined;
  const tabId = sender.tab.id;

  switch (query.op) {
    case 'frame-status':
      return browser.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => globalThis.__limitrBridgeStatus || null
      }).then(results => results.map(r => ({ frameId: r.frameId, ...r.result })));
    case 'meters':
      return browser.tabs.sendMessage(tabId, { action: 'limitr-get-meters' }, { frameId: query.frameId || 0 });
    case 'captions-start':
      // Same background page as background.js, so call it directly like the popup's message would
      return startCaptions(tabId);
    case 'popup-metrics':
      // Opens the popup in a popup-sized window and measures overflow, closed and with Fine-tune open
      return (async () => {
        const win = await browser.windows.create({ url: 'popup.html', type: 'popup', width: 360, height: 600 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        const view = browser.extension.getViews({ windowId: win.id })[0];
        const measure = () => {
          const doc = view.document.documentElement;
          const inner = view.document.querySelector('.popup');
          return {
            viewport: view.innerWidth,
            docScrollW: doc.scrollWidth, docClientW: doc.clientWidth,
            innerScrollW: inner.scrollWidth, innerClientW: inner.clientWidth
          };
        };
        const closed = measure();
        const screens = {};
        for (const name of ['finetune', 'listening']) {
          view.document.querySelector(`.nav-row[data-open="${name}"]`).click();
          await new Promise(resolve => setTimeout(resolve, 300));
          screens[name] = measure();
          view.document.querySelector(`[data-screen="${name}"] .back`).click();
        }
        const result = { closed, ...screens };
        await browser.windows.remove(win.id);
        return result;
      })();
    case 'diag':
      return (async () => {
        const out = { translatorType: typeof self.Translator };
        if (self.Translator) {
          try {
            out.availability = await Promise.race([self.Translator.availability({ sourceLanguage: 'tr', targetLanguage: 'en' }),
              new Promise(r => setTimeout(() => r('no answer'), 3000))]);
          } catch (e) { out.availabilityError = e.message; }
        }
        out.prefs = (await browser.storage.local.get('limitrCaptions')).limitrCaptions;
        if (backgroundTranscriber) out.session = (await backgroundTranscriber).sessionInfo(tabId);
        return out;
      })();
    case 'storage-set':
      return browser.storage.local.set(query.values).then(() => true);
    case 'popup':
      return (async () => {
        const popupTab = await browser.tabs.create({ url: `popup.html?tabId=${tabId}`, active: false });
        await new Promise(resolve => setTimeout(resolve, 2500));
        const view = browser.extension.getViews({ type: 'tab' }).find(v => v.location.search.includes(`tabId=${tabId}`));
        const result = view ? {
          status: view.document.getElementById('status').textContent,
          caption: view.document.getElementById('traceCaption').textContent,
          captureDisabled: view.document.querySelector('input[name="mode"][value="capture"]').disabled
        } : null;
        await browser.tabs.remove(popupTab.id);
        return result;
      })();
    default:
      return undefined;
  }
});
