// Browser-wide Chrome tracing for the benchmarks: attaches over --remote-debugging-port (next to
// Playwright's own pipe) and sums main-thread work per process and thread.

const { chromium } = require('playwright');

const CATEGORIES = [
  '__metadata', 'toplevel', 'devtools.timeline', 'v8', 'v8.execute',
  'disabled-by-default-devtools.timeline', 'extensions'
];
// Add V8 sampling profiles (ProfileChunk events) for attributing time to functions
const PROFILE_CATEGORIES = ['disabled-by-default-v8.cpu_profiler'];

async function connect(port) {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const session = await browser.newBrowserCDPSession();
  return { browser, session };
}

async function start(session, { profile = false } = {}) {
  await session.send('Tracing.start', {
    transferMode: 'ReturnAsStream',
    traceConfig: {
      includedCategories: profile ? [...CATEGORIES, ...PROFILE_CATEGORIES] : CATEGORIES,
      recordMode: 'recordAsMuchAsPossible'
    }
  });
}

async function stop(session) {
  const complete = new Promise(resolve => session.once('Tracing.tracingComplete', resolve));
  await session.send('Tracing.end');
  const { stream } = await complete;
  let text = '';
  for (;;) {
    const chunk = await session.send('IO.read', { handle: stream, size: 1 << 20 });
    text += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data;
    if (chunk.eof) break;
  }
  await session.send('IO.close', { handle: stream });
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : parsed.traceEvents;
}

// Thread and process names from the trace's metadata events
function names(events) {
  const threads = new Map();
  const processes = new Map();
  for (const e of events) {
    if (e.ph !== 'M') continue;
    if (e.name === 'thread_name') threads.set(`${e.pid}:${e.tid}`, e.args.name);
    if (e.name === 'process_name') processes.set(e.pid, { ...(processes.get(e.pid) || {}), name: e.args.name });
    if (e.name === 'process_labels') processes.set(e.pid, { ...(processes.get(e.pid) || {}), labels: e.args.labels });
  }
  return { threads, processes };
}

// Busy milliseconds per thread from top-level scheduler tasks (nested ones are skipped).
// ms is CPU time where the trace has it (tdur), which doesn't count time the thread was
// descheduled on a busy machine; wallMs is the tasks' wall time.
function busyByThread(events) {
  const { threads, processes } = names(events);
  const byThread = new Map();
  const openUntil = new Map();
  const tasks = events.filter(e => e.ph === 'X' && (e.name === 'ThreadControllerImpl::RunTask' || e.name === 'RunTask'))
    .sort((a, b) => a.ts - b.ts);
  for (const e of tasks) {
    const key = `${e.pid}:${e.tid}`;
    if ((openUntil.get(key) || 0) > e.ts) continue;
    openUntil.set(key, e.ts + (e.dur || 0));
    const sums = byThread.get(key) || { wall: 0, cpu: 0 };
    sums.wall += (e.dur || 0) / 1000;
    sums.cpu += (e.tdur !== undefined ? e.tdur : e.dur || 0) / 1000;
    byThread.set(key, sums);
  }
  return [...byThread.entries()].map(([key, sums]) => {
    const pid = Number(key.split(':')[0]);
    const proc = processes.get(pid) || {};
    return { key, pid, thread: threads.get(key) || '?', process: proc.name || '?', labels: proc.labels || '', ms: sums.cpu, wallMs: sums.wall };
  }).sort((a, b) => b.ms - a.ms);
}

// Script evaluation and compile time for scripts whose URL matches `urlTest`
function scriptTime(events, urlTest) {
  let evaluate = 0;
  let compile = 0;
  let count = 0;
  for (const e of events) {
    if (e.ph !== 'X') continue;
    const data = e.args && (e.args.data || e.args);
    const url = data && (data.url || data.fileName);
    if (!url || !urlTest(url)) continue;
    if (e.name === 'EvaluateScript') {
      evaluate += (e.dur || 0) / 1000;
      count++;
    } else if (e.name === 'v8.compile' || e.name === 'V8.CompileScript' || e.name === 'v8.compileModule') {
      compile += (e.dur || 0) / 1000;
    }
  }
  return { evaluate, compile, count };
}

module.exports = { connect, start, stop, busyByThread, scriptTime };
