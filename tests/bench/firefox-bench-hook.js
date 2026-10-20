// Bench-only background script, added to a --test Firefox build by tests/bench/firefox-bench.js.
// Opens the popup in a popup-sized window and times it from the background page, which can
// reach the popup's window directly.
browser.runtime.onMessage.addListener((message, sender) => {
  const query = message && message.limitrTest;
  if (!query || query.op !== 'bench-popup' || !sender.tab) return undefined;
  const tabId = sender.tab.id;
  return (async () => {
    const win = await browser.windows.create({ url: `popup.html?tabId=${tabId}`, type: 'popup', width: 360, height: 600 });
    // Poll the new window for its milestones, in its own clock
    const t = {};
    const started = Date.now();
    let view = null;
    while (Date.now() - started < 8000) {
      view = view || browser.extension.getViews({ windowId: win.id })[0];
      const doc = view && view.document;
      if (doc && doc.getElementById('presetGrid')) {
        const now = view.performance.now();
        if (t.rendered === undefined && doc.getElementById('presetGrid').children.length >= 6) t.rendered = now;
        if (t.status === undefined && /Taming/.test(doc.getElementById('status').textContent)) t.status = now;
        if (t.meters === undefined && doc.getElementById('traceCaption').textContent) t.meters = now;
        if (t.rendered !== undefined && t.status !== undefined && t.meters !== undefined) break;
      }
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
    const nav = view.performance.getEntriesByType('navigation')[0] || {};
    const paint = view.performance.getEntriesByType('paint').find(e => e.name === 'first-contentful-paint');
    t.fcp = paint ? paint.startTime : NaN;
    t.domContentLoaded = nav.domContentLoadedEventEnd;
    t.load = nav.loadEventEnd;

    // First open of each screen: sync work (handler + style + layout) and time to the next frame
    const doc = view.document;
    const settle = () => new Promise(r => view.requestAnimationFrame(() => view.setTimeout(r, 0)));
    const time = async (action) => {
      await settle();
      const t0 = view.performance.now();
      action();
      void doc.body.offsetHeight;
      const sync = view.performance.now() - t0;
      await settle();
      return { sync, frame: view.performance.now() - t0 };
    };
    const click = sel => () => doc.querySelector(sel).click();
    const screens = {
      finetune: await time(click('.nav-row[data-open="finetune"]')),
      mainFromFinetune: await time(click('[data-screen="finetune"] .back')),
      listening: await time(click('.nav-row[data-open="listening"]')),
      mainFromListening: await time(click('[data-screen="listening"] .back')),
      captions: await time(() => view.showScreen('captions')),
      mainFromCaptions: await time(click('[data-screen="captions"] .back'))
    };
    await browser.windows.remove(win.id);
    return { t, screens };
  })();
});
