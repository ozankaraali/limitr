#!/usr/bin/env node
// Popup performance in Chromium, with a tab playing a stream so the popup is live (status,
// meters, trace). Opened in a 360x600 tab like the E2E tests do.
// Run: node tests/bench/popup-bench.js [--ext=DIR ...] [--rounds=3] [--opens=5] [--cold]
//   --cold  stop the service worker before every popup open (it sleeps after 30 s idle)
// Reports medians per extension copy:
//   load:      first contentful paint, controls rendered (and painted), status text, first meters
//   screens:   first open of each secondary screen: sync work (script+style+layout) and to next frame
//   steady:    popup main-thread busy ms per second on the main and Fine-tune screens
//   trace:     cost of one drawTraces() call
//   scroll:    Fine-tune scrolled top to bottom with every section open: frame intervals
//   captions:  2,000 transcript lines (with interim updates) and scrolling the transcript

const B = require('./common');
const { startStaticServer } = require('../static-server');
const { streamWav } = require('../stream-audio');

// Runs in the popup before its own scripts: paint/longtask observers, DOM milestones, API timings
function instrument() {
  if (!location.pathname.endsWith('/popup.html')) return;
  const bench = window.__bench = { t: {}, longtasks: [], api: [] };
  const now = () => performance.now();
  const mark = name => { if (bench.t[name] === undefined) bench.t[name] = now(); };
  const afterPaint = cb => requestAnimationFrame(() => setTimeout(cb, 0));
  try {
    new PerformanceObserver(list => list.getEntries().forEach(e => { bench.t[e.name] = e.startTime; }))
      .observe({ type: 'paint', buffered: true });
    new PerformanceObserver(list => list.getEntries().forEach(e => bench.longtasks.push([e.startTime, e.duration])))
      .observe({ type: 'longtask', buffered: true });
  } catch (e) { /* not supported */ }
  new MutationObserver(() => {
    const grid = document.getElementById('presetGrid');
    if (bench.t.rendered === undefined && grid && grid.children.length >= 6) {
      mark('rendered');
      afterPaint(() => mark('renderedPainted'));
    }
    const status = document.getElementById('status');
    if (bench.t.status === undefined && status && /Taming/.test(status.textContent)) mark('status');
    const caption = document.getElementById('traceCaption');
    if (bench.t.meters === undefined && caption && caption.textContent) {
      mark('meters');
      afterPaint(() => mark('metersPainted'));
    }
  }).observe(document, { childList: true, subtree: true, characterData: true });
  document.fonts.ready.then(() => mark('fontsReady'));
  const wrap = (obj, name, describe) => {
    const original = obj[name];
    obj[name] = function (...args) {
      const entry = { what: describe(args), t0: now() };
      bench.api.push(entry);
      const result = original.apply(this, args);
      Promise.resolve(result).then(() => { entry.t1 = now(); }, () => { entry.t1 = now(); });
      return result;
    };
  };
  wrap(chrome.runtime, 'sendMessage', a => `runtime.sendMessage ${a[0] && a[0].action}`);
  wrap(chrome.tabs, 'sendMessage', a => `tabs.sendMessage ${a[1] && a[1].action}`);
  wrap(chrome.tabs, 'get', () => 'tabs.get');
  wrap(chrome.tabs, 'query', () => 'tabs.query');
  wrap(chrome.scripting, 'executeScript', () => 'scripting.executeScript');
  wrap(chrome.storage.local, 'get', () => 'storage.get');
}

(async () => {
  const rounds = Number(B.arg('rounds', 3));
  const opens = Number(B.arg('opens', 5));
  const cold = process.argv.includes('--cold');
  const dirs = B.extensionDirs();
  const wav = streamWav();
  const { server, port } = await startStaticServer(undefined, {
    '/stream.wav': (q, r) => { r.writeHead(200, { 'Content-Type': 'audio/wav' }); r.end(wav); },
    '/play.html': (q, r) => {
      r.writeHead(200, { 'Content-Type': 'text/html' });
      r.end('<!DOCTYPE html><button id="play">Play</button><audio id="a" src="/stream.wav" loop></audio>' +
        '<script>play.onclick = () => a.play();</script>');
    }
  });
  const results = {};
  const timelines = {};
  const silence = B.watchSilence();

  for (let round = 0; round < rounds; round++) {
    for (const dir of dirs) {
      const lbl = B.label(dir);
      const { context, worker, extensionId, close } = await B.launch(dir);
      try {
        await context.addInitScript(instrument);
        const tab = await context.newPage();
        await tab.goto(`http://127.0.0.1:${port}/play.html`);
        await tab.click('#play');
        await B.sleep(2000);
        const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'http://127.0.0.1/*' }))[0].id);
        const popupUrl = `chrome-extension://${extensionId}/popup.html?tabId=${tabId}`;
        // One unmeasured open so every measured one finds the extension process and caches warm
        const warm = await context.newPage();
        await warm.goto(popupUrl);
        await B.sleep(1000);
        await warm.close();

        for (let i = 0; i < opens; i++) {
          const popup = await context.newPage();
          await popup.setViewportSize({ width: 360, height: 600 });
          const cdp = await context.newCDPSession(popup);
          if (cold) {
            await cdp.send('ServiceWorker.enable');
            await cdp.send('ServiceWorker.stopAllWorkers');
            await B.sleep(300);
          }
          await popup.goto(popupUrl);
          await popup.waitForFunction(() => window.__bench && __bench.t.status !== undefined &&
            __bench.t.metersPainted !== undefined && __bench.t.renderedPainted !== undefined, null, { timeout: 10000 })
            .catch(() => {});
          await B.sleep(1200);
          const t = await popup.evaluate(() => {
            const nav = performance.getEntriesByType('navigation')[0];
            const firstSecond = __bench.longtasks.filter(([s]) => s < 1500);
            return {
              ...__bench.t,
              domContentLoaded: nav.domContentLoadedEventEnd,
              load: nav.loadEventEnd,
              longTaskMs: firstSecond.reduce((sum, [, d]) => sum + d, 0),
              api: __bench.api.map(a => ({ what: a.what, t0: a.t0, ms: a.t1 === undefined ? null : a.t1 - a.t0 }))
            };
          });
          for (const key of ['first-contentful-paint', 'domContentLoaded', 'load', 'fontsReady', 'rendered',
            'renderedPainted', 'status', 'meters', 'metersPainted', 'longTaskMs']) {
            B.record(results, `load: ${key} (ms)`, lbl, t[key]);
          }
          const captionsCall = t.api.find(a => /captions-status/.test(a.what));
          B.record(results, 'load: captions-status answered (ms)', lbl, captionsCall && captionsCall.ms !== null ? captionsCall.t0 + captionsCall.ms : NaN);
          if (i === 0 && round === 0) timelines[lbl] = t;

          // First open of each screen in this popup
          const screens = await popup.evaluate(async () => {
            // sync = handler + style + layout; frame = until the frame after it is painted
            const settle = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
            const timeActionFn = async (action) => {
              await settle();
              const t0 = performance.now();
              action();
              void document.body.offsetHeight;
              const sync = performance.now() - t0;
              await settle();
              return { sync, frame: performance.now() - t0 };
            };
            const out = {};
            const click = sel => () => document.querySelector(sel).click();
            out.finetune = await timeActionFn(click('.nav-row[data-open="finetune"]'));
            out.mainFromFinetune = await timeActionFn(click('[data-screen="finetune"] .back'));
            out.listening = await timeActionFn(click('.nav-row[data-open="listening"]'));
            out.mainFromListening = await timeActionFn(click('[data-screen="listening"] .back'));
            out.captions = await timeActionFn(() => showScreen('captions'));
            out.mainFromCaptions = await timeActionFn(click('[data-screen="captions"] .back'));
            return out;
          });
          for (const [name, v] of Object.entries(screens)) {
            B.record(results, `screen ${name}: sync (ms)`, lbl, v.sync);
            B.record(results, `screen ${name}: to next frame (ms)`, lbl, v.frame);
          }

          if (i === opens - 1) {
            // Steady state: main-thread busy time per second
            await cdp.send('Performance.enable');
            const busy = async (ms) => {
              const metric = m => m.metrics.find(x => x.name === 'TaskDuration').value;
              const a = metric(await cdp.send('Performance.getMetrics'));
              await B.sleep(ms);
              const b = metric(await cdp.send('Performance.getMetrics'));
              return ((b - a) * 1000) / (ms / 1000);
            };
            B.record(results, 'steady: main screen busy (ms/s)', lbl, await busy(5000));
            await popup.click('.nav-row[data-open="finetune"]');
            B.record(results, 'steady: Fine-tune busy (ms/s)', lbl, await busy(5000));

            // Cost of one trace draw and one caught-line render, while Fine-tune shows both traces
            const draw = await popup.evaluate(async () => {
              const timings = { draw: [], caption: [] };
              const wrap = (name, into) => {
                const original = window[name];
                if (typeof original !== 'function') return () => {};
                window[name] = function (...args) {
                  const t0 = performance.now();
                  const r = original.apply(this, args);
                  into.push(performance.now() - t0);
                  return r;
                };
                return () => { window[name] = original; };
              };
              const undo = [wrap('drawTraces', timings.draw), wrap('renderCaption', timings.caption)];
              await new Promise(r => setTimeout(r, 3000));
              undo.forEach(fn => fn());
              const med = v => v.sort((a, b) => a - b)[v.length >> 1];
              return { draw: med(timings.draw), caption: med(timings.caption), calls: timings.draw.length };
            });
            B.record(results, 'trace: drawTraces per call, Fine-tune (ms)', lbl, draw.draw);
            B.record(results, 'trace: renderCaption per call (ms)', lbl, draw.caption);
            B.record(results, 'trace: draws per second', lbl, draw.calls / 3);

            // Fine-tune scroll with every section and the EQ bands open
            const scroll = await popup.evaluate(async () => {
              document.querySelectorAll('[data-screen="finetune"] details').forEach(d => { d.open = true; });
              const body = document.querySelector('[data-screen="finetune"] .screen-body');
              body.scrollTop = 0;
              await new Promise(r => requestAnimationFrame(() => setTimeout(r, 50)));
              const frames = [];
              const longTasks = [];
              const observer = new PerformanceObserver(l => l.getEntries().forEach(e => longTasks.push(e.duration)));
              observer.observe({ type: 'longtask' });
              await new Promise(resolve => {
                let last = performance.now();
                const step = () => {
                  const now = performance.now();
                  frames.push(now - last);
                  last = now;
                  if (body.scrollTop + body.clientHeight >= body.scrollHeight - 1) return resolve();
                  body.scrollTop += 24;
                  requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
              });
              observer.disconnect();
              frames.shift();
              frames.sort((a, b) => a - b);
              return {
                height: body.scrollHeight,
                p50: frames[frames.length >> 1],
                p95: frames[Math.floor(frames.length * 0.95)],
                slow: frames.filter(f => f > 25).length / frames.length,
                longTasks: longTasks.length
              };
            });
            B.record(results, 'scroll Fine-tune: frame p50 (ms)', lbl, scroll.p50);
            B.record(results, 'scroll Fine-tune: frame p95 (ms)', lbl, scroll.p95);
            B.record(results, 'scroll Fine-tune: frames > 25 ms (%)', lbl, scroll.slow * 100);

            // Captions: 2,000 lines, each preceded by two interim updates of the same line
            const captions = await popup.evaluate(async () => {
              state.captions = 'active';
              renderCaptions();
              showScreen('captions');
              const list = document.getElementById('transcript');
              list.replaceChildren();
              const perLine = [];
              const started = performance.now();
              for (let i = 0; i < 2000; i++) {
                const t0 = performance.now();
                const text = `Line ${i}: thanks for watching the stream tonight, remember to stay hydrated`;
                showTranscriptLine({ text: text.slice(0, 20), segmentId: i, final: false });
                showTranscriptLine({ text: text.slice(0, 45), segmentId: i, final: false });
                showTranscriptLine({ text, translation: i % 3 ? undefined : 'A translation under it', segmentId: i, final: true });
                perLine.push(performance.now() - t0);
                if (i % 50 === 49) await new Promise(r => setTimeout(r, 0));
              }
              const total = performance.now() - started;
              await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
              // Scroll the transcript back to the top and down again
              const frames = [];
              list.scrollTop = list.scrollHeight;
              await new Promise(resolve => {
                let last = performance.now();
                let dir = -1;
                const step = () => {
                  const now = performance.now();
                  frames.push(now - last);
                  last = now;
                  list.scrollTop += dir * 30;
                  if (dir < 0 && list.scrollTop <= 0) dir = 1;
                  else if (dir > 0 && list.scrollTop + list.clientHeight >= list.scrollHeight - 1) return resolve();
                  requestAnimationFrame(step);
                };
                requestAnimationFrame(step);
              });
              frames.shift();
              perLine.sort((a, b) => a - b);
              frames.sort((a, b) => a - b);
              return {
                lines: list.children.length,
                total,
                perLineP50: perLine[perLine.length >> 1],
                perLineP95: perLine[Math.floor(perLine.length * 0.95)],
                scrollFrames: frames.length,
                scrollP95: frames.length ? frames[Math.floor(frames.length * 0.95)] : NaN
              };
            });
            B.record(results, 'captions: lines kept in transcript', lbl, captions.lines);
            B.record(results, 'captions: 2,000 lines total (ms)', lbl, captions.total);
            B.record(results, 'captions: per line p95 (ms)', lbl, captions.perLineP95);
            B.record(results, 'captions: transcript scroll frames', lbl, captions.scrollFrames);
            B.record(results, 'captions: transcript scroll frame p95 (ms)', lbl, captions.scrollP95);
          }
          await popup.close();
        }
      } finally {
        await close();
      }
    }
  }
  server.close();
  silence.stop();

  for (const [lbl, t] of Object.entries(timelines)) {
    console.log(`\nPopup timeline, first measured open [${lbl}] (ms since navigation start)`);
    console.log(`  fcp ${B.round(t['first-contentful-paint'])}, fonts ${B.round(t.fontsReady)}, rendered ${B.round(t.rendered)}, ` +
      `status ${B.round(t.status)}, meters ${B.round(t.meters)}, load ${B.round(t.load)}`);
    for (const a of t.api) console.log(`  ${B.round(a.t0).toString().padStart(7)} +${String(B.round(a.ms)).padStart(6)}  ${a.what}`);
  }
  B.report(`Popup (${cold ? 'cold service worker' : 'warm service worker'}; medians of ${rounds} rounds x ${opens} opens)`, results);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
