#!/usr/bin/env node
// What the extension costs on every page load: a page with N same-origin iframes (ads, embeds)
// loaded repeatedly with a browser-wide Chrome trace. Compares extension copies and a browser
// without the extension. Nothing plays, so this is the price of browsing with Limitr installed.
// Run: node tests/bench/pageload-bench.js [--ext=DIR ...] [--frames=20] [--loads=10] [--rounds=3] [--cold]
//   --cold  stop the service worker before every load (it sleeps after 30 s idle)
// Per load (medians): page renderer main-thread busy ms, content-script evaluate+compile ms,
// service worker busy ms, browser main-thread busy ms, and the page's load event time.

const B = require('./common');
const T = require('./trace');
const { startStaticServer } = require('../static-server');

(async () => {
  const frames = Number(B.arg('frames', 20));
  const loads = Number(B.arg('loads', 10));
  const rounds = Number(B.arg('rounds', 3));
  const cold = process.argv.includes('--cold');
  const variants = [...B.extensionDirs().map(dir => ({ dir, lbl: B.label(dir) })), { dir: null, lbl: 'no extension' }];
  const { server, port } = await startStaticServer(undefined, {
    '/frames.html': (q, r) => {
      r.writeHead(200, { 'Content-Type': 'text/html' });
      const iframes = Array.from({ length: frames }, (_, i) => `<iframe src="/leaf.html?${i}" width="120" height="60"></iframe>`).join('');
      r.end(`<!DOCTYPE html><html><body><h1>Page</h1><video width="160" height="90"></video>${iframes}</body></html>`);
    },
    '/leaf.html': (q, r) => {
      r.writeHead(200, { 'Content-Type': 'text/html' });
      r.end('<!DOCTYPE html><html><body><p>frame</p></body></html>');
    }
  });
  const results = {};
  const silence = B.watchSilence();
  let debugPort = 9300 + Math.floor(Math.random() * 400);

  for (let round = 0; round < rounds; round++) {
    for (const { dir, lbl } of variants) {
      debugPort++;
      const { context, close } = await B.launch(dir, { extraArgs: [`--remote-debugging-port=${debugPort}`] });
      const { browser, session } = await T.connect(debugPort);
      try {
        const tab = await context.newPage();
        const cdp = await context.newCDPSession(tab);
        // Warm the HTTP cache and code caches, then let the service worker settle
        for (let i = 0; i < 2; i++) await tab.goto(`http://127.0.0.1:${port}/frames.html?warm${i}`, { waitUntil: 'load' });
        await B.sleep(1500);
        const loadTimes = [];
        await T.start(session);
        for (let i = 0; i < loads; i++) {
          if (cold && dir) {
            await cdp.send('ServiceWorker.enable');
            await cdp.send('ServiceWorker.stopAllWorkers');
            await B.sleep(200);
          }
          await tab.goto(`http://127.0.0.1:${port}/frames.html?r${round}l${i}`, { waitUntil: 'load' });
          loadTimes.push(await tab.evaluate(() => performance.getEntriesByType('navigation')[0].loadEventStart));
          // Messages the frames send after load (status reports) land within this window
          await B.sleep(700);
        }
        const events = await T.stop(session);
        const threads = T.busyByThread(events);
        // The page and its same-origin frames share one renderer: the busiest non-extension one
        const pageMain = threads.filter(t => t.thread === 'CrRendererMain' && t.process === 'Renderer').slice(0, 1);
        const sw = threads.filter(t => /ServiceWorker/i.test(t.thread));
        const browserMain = threads.filter(t => t.thread === 'CrBrowserMain');
        const sum = (list, key = 'ms') => list.reduce((s, t) => s + t[key], 0);
        const scripts = T.scriptTime(events, url => url.startsWith('chrome-extension://'));
        B.record(results, 'page renderer main thread CPU (ms/load)', lbl, sum(pageMain) / loads);
        B.record(results, 'content scripts evaluate (ms/load)', lbl, scripts.evaluate / loads);
        B.record(results, 'content scripts compile (ms/load)', lbl, scripts.compile / loads);
        B.record(results, 'content script runs per load', lbl, scripts.count / loads);
        B.record(results, 'service worker thread CPU (ms/load)', lbl, sum(sw) / loads);
        B.record(results, 'service worker thread wall (ms/load)', lbl, sum(sw, 'wallMs') / loads);
        B.record(results, 'browser main thread CPU (ms/load)', lbl, sum(browserMain) / loads);
        B.record(results, 'load event (ms)', lbl, B.median(loadTimes));
        if (round === 0 && process.argv.includes('--threads')) {
          console.log(`\n[${lbl}] busiest threads over ${loads} loads`);
          threads.slice(0, 12).forEach(t => console.log(`  ${t.ms.toFixed(1).padStart(8)} ms  ${t.thread}  ${t.process} ${t.labels}`));
        }
      } finally {
        await browser.close().catch(() => {});
        await close();
      }
    }
  }
  server.close();
  silence.stop();
  B.report(`Page load with ${frames} iframes (${cold ? 'cold' : 'warm'} service worker; medians of ${rounds} rounds, ${loads} loads each)`, results);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
