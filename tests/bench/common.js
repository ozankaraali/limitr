// Shared helpers for the performance benchmarks in tests/bench/.
// Every browser here is silent and off the GPU: --disable-audio-output (fake output device, the
// speakers are never opened) and --disable-gpu. Benchmarks can load any copy of the extension
// (--ext=DIR, repeatable), so a baseline snapshot and the working tree run side by side.

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');

// Unpacked extension IDs derive from the path
function extensionIdFor(dir) {
  return crypto.createHash('sha256').update(dir).digest('hex')
    .slice(0, 32).replace(/[0-9a-f]/g, c => String.fromCharCode(97 + parseInt(c, 16)));
}

function arg(name, fallback) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function args(name) {
  return process.argv.filter(a => a.startsWith(`--${name}=`)).map(a => a.slice(name.length + 3));
}

// Extension copies to compare: --ext=DIR (repeatable), labelled by folder name; default is this tree
function extensionDirs() {
  const dirs = args('ext').map(d => path.resolve(d));
  return dirs.length ? dirs : [ROOT];
}

function label(dir) {
  return dir === ROOT ? 'tree' : path.basename(dir);
}

// Bench pages run inside the extension, so other copies get this tree's versions of them
function installBenchPages(dir, files) {
  if (dir === ROOT) return;
  fs.mkdirSync(path.join(dir, 'tests', 'bench'), { recursive: true });
  for (const file of files) fs.copyFileSync(path.join(__dirname, file), path.join(dir, 'tests', 'bench', file));
}

async function launch(extDir, { profile, extraArgs = [] } = {}) {
  const userDataDir = profile || fs.mkdtempSync(path.join(os.tmpdir(), 'limitr-bench-'));
  const args = ['--disable-audio-output', '--disable-gpu', ...extraArgs];
  if (extDir) {
    args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`,
      `--allowlisted-extension-id=${extensionIdFor(extDir)}`);
  }
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args
  });
  let worker = null;
  if (extDir) {
    [worker] = context.serviceWorkers();
    if (!worker) worker = await context.waitForEvent('serviceworker');
  }
  const close = async () => {
    await context.close();
    if (!profile) fs.rmSync(userDataDir, { recursive: true, force: true });
  };
  return { context, worker, extensionId: extDir ? extensionIdFor(extDir) : null, close };
}

// ---------- statistics ----------
const median = values => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const quantile = (values, q) => {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return NaN;
  return v[Math.min(v.length - 1, Math.floor(q * v.length))];
};
const round = (v, digits = 1) => (Number.isFinite(v) ? Number(v.toFixed(digits)) : v);

// results: { metric: { label: [samples] } } -> printed table of medians (and p90 where asked)
function report(title, results) {
  console.log(`\n${title}`);
  const labels = [...new Set(Object.values(results).flatMap(r => Object.keys(r)))];
  const width = Math.max(...Object.keys(results).map(k => k.length), 10);
  console.log(`  ${'metric'.padEnd(width)}  ${labels.map(l => l.padStart(22)).join('')}`);
  for (const [metric, byLabel] of Object.entries(results)) {
    const cells = labels.map(l => {
      const samples = byLabel[l] || [];
      return `${round(median(samples), 2)} (n=${samples.length})`.padStart(22);
    });
    console.log(`  ${metric.padEnd(width)}  ${cells.join('')}`);
  }
}

function record(results, metric, lbl, value) {
  if (!results[metric]) results[metric] = {};
  if (!results[metric][lbl]) results[metric][lbl] = [];
  results[metric][lbl].push(value);
}

// ---------- silence check ----------
// A new coreaudiod "output.context" assertion while a benchmark runs means a real audio device
// opened. Assertions that existed before the run belong to the user's own playback.
function outputAssertions() {
  try {
    const out = execFileSync('pmset', ['-g', 'assertions'], { encoding: 'utf8' });
    return out.split('\n').filter(l => /output\.context/.test(l))
      .map(l => ({ id: (l.match(/\[(0x[0-9a-f]+)\]/) || [])[1], name: (l.match(/named: "([^"]+)"/) || [])[1] }))
      .filter(a => a.id);
  } catch (e) {
    return [];
  }
}

// Other programs (the user's own browser, other test runs) can open the device too, so this
// only says when it happened; a browser launched here never gets a real audio output device.
function watchSilence() {
  if (process.platform !== 'darwin') return { stop: () => true };
  const before = new Set(outputAssertions().map(a => a.id));
  const seen = new Map();
  const poll = () => {
    for (const a of outputAssertions()) {
      if (!before.has(a.id) && !seen.has(a.id)) seen.set(a.id, `${a.name} at ${new Date().toLocaleTimeString()}`);
    }
  };
  const timer = setInterval(poll, 1000);
  return {
    stop() {
      clearInterval(timer);
      poll();
      if (seen.size) console.log(`\n  WARNING: new audio output assertion(s): ${[...seen.values()].join('; ')}`);
      else console.log('\n  Silence check: no new audio output assertions');
      return seen.size === 0;
    }
  };
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// CPU milliseconds used so far by the browser started with this profile and all its child
// processes (renderers, GPU, utility), from ps
function browserCpuMs(profileDir) {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,time=,command='], { encoding: 'utf8' }).split('\n')
    .map(line => line.trim().match(/^(\d+)\s+(\d+)\s+([\d:.]+)\s+(.*)$/)).filter(Boolean)
    .map(([, pid, ppid, time, command]) => ({ pid: Number(pid), ppid: Number(ppid), time, command }));
  const root = rows.find(r => r.command.includes(`--user-data-dir=${profileDir}`) && !/--type=/.test(r.command));
  if (!root) return NaN;
  const inTree = new Set([root.pid]);
  for (let grew = true; grew;) {
    grew = false;
    for (const r of rows) if (!inTree.has(r.pid) && inTree.has(r.ppid)) { inTree.add(r.pid); grew = true; }
  }
  const toMs = t => t.split(':').reduce((acc, part) => acc * 60 + Number(part), 0) * 1000;
  return rows.filter(r => inTree.has(r.pid)).reduce((sum, r) => sum + toMs(r.time), 0);
}

module.exports = {
  ROOT, extensionIdFor, arg, args, extensionDirs, label, installBenchPages, launch,
  median, quantile, round, report, record, watchSilence, sleep, browserCpuMs
};
