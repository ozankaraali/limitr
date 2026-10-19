// Limitr debug harness: plays a file through the real LimitrEngine (live or offline) and
// shows what the spike guard does. Opened from the extension icon's context menu, or served
// over http from the repository root.

(function () {
  'use strict';

  const { LimitrSettings: S, LimitrEngine } = window;
  const $ = id => document.getElementById(id);
  const FS = 48000;
  const HISTORY_POINTS = 300;
  const api = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  let buffer = null;
  let fileName = '';
  let custom = {};
  let live = null;
  let history = [];
  let lastLog = null;

  const engineOptions = ctx => ({
    loadModule: path => ctx.audioWorklet.addModule('../' + path),
    loadBinary: path => fetch('../' + path).then(r => r.arrayBuffer()),
    log: (...args) => console.debug('[Limitr harness]', ...args)
  });

  function presetIds() {
    return [...S.PRESET_ORDER, ...Object.keys(custom)];
  }

  function presetName(id) {
    return (S.PRESETS[id] || custom[id] || { name: id }).name;
  }

  function settingsFor(id) {
    return S.applyPreset({ volume: 0 }, id, custom);
  }

  async function loadPresets() {
    try {
      if (api && api.storage) {
        const stored = await api.storage.local.get(S.STORAGE_KEYS.customPresets);
        custom = stored[S.STORAGE_KEYS.customPresets] || {};
      }
    } catch (e) { /* not running as an extension page */ }
    const select = $('preset');
    select.replaceChildren();
    for (const id of presetIds()) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = presetName(id);
      select.append(option);
    }
    select.value = S.DEFAULT_PRESET;
  }

  // ---------- file loading ----------
  async function loadFile(file) {
    fileName = file.name;
    $('note').textContent = `Decoding ${file.name}…`;
    const ctx = new AudioContext({ sampleRate: FS });
    try {
      buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      $('note').textContent = `${file.name}, ${buffer.duration.toFixed(1)} s, ${buffer.numberOfChannels} ch`;
      for (const id of ['play', 'compare']) $(id).disabled = false;
    } catch (error) {
      $('note').textContent = `Couldn’t decode ${file.name}: ${error.message}`;
    } finally {
      ctx.close();
    }
  }

  const drop = $('drop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('over');
    if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });
  $('file').addEventListener('change', e => { if (e.target.files[0]) loadFile(e.target.files[0]); });

  // ---------- live playback ----------
  async function play() {
    stop();
    const ctx = new AudioContext({ sampleRate: FS });
    const engine = new LimitrEngine(ctx, engineOptions(ctx));
    engine.update(settingsFor($('preset').value), true);
    await engine.init();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(engine.input);
    engine.output.connect(ctx.destination);
    source.onended = () => stop();
    source.start();
    history = [];
    live = { ctx, engine, source, timer: setInterval(tick, 66) };
    $('stop').disabled = false;
  }

  function stop() {
    if (!live) return;
    clearInterval(live.timer);
    try { live.source.stop(); } catch (e) { /* already ended */ }
    live.ctx.close();
    live = null;
    $('stop').disabled = true;
  }

  function tick() {
    if (!live) return;
    const m = live.engine.getMeters();
    if (Number.isFinite(m.outDb)) {
      history.push({ out: m.outDb, cut: Math.max(0, -m.guardDb), limit: m.thresholdDb });
      if (history.length > HISTORY_POINTS) history.shift();
    }
    drawTrace(history);
    renderReadouts(m);
  }

  $('preset').addEventListener('change', () => {
    if (live) live.engine.update(settingsFor($('preset').value), true);
  });
  $('play').addEventListener('click', play);
  $('stop').addEventListener('click', stop);

  // ---------- offline rendering ----------
  async function renderOffline(id) {
    const ctx = new OfflineAudioContext(2, buffer.length, FS);
    const engine = new LimitrEngine(ctx, engineOptions(ctx));
    engine.update(settingsFor(id), true);
    await engine.init();
    const log = [];
    if (engine.dspNode) {
      engine.dspNode.port.addEventListener('message', e => { if (e.data.type === 'meters') log.push(e.data); });
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(engine.input);
    engine.output.connect(ctx.destination);
    source.start();
    await ctx.startRendering();
    await new Promise(resolve => setTimeout(resolve, 50)); // let queued meter messages arrive
    return log;
  }

  function median(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    return sorted.length ? sorted[Math.floor(sorted.length / 2)] : NaN;
  }

  function summarize(log) {
    const audible = log.filter(m => m.inDb > -60);
    const normalIn = median(audible.map(m => m.inDb));
    const normalOut = median(audible.map(m => m.outDb));
    const last = log[log.length - 1] || {};
    return {
      normalIn,
      normalOut,
      spikes: last.spikes || 0,
      biggest: last.maxSpikeDb || 0,
      loudestOver: Math.max(...audible.map(m => m.outDb)) - normalOut,
      peak: Math.max(...log.map(m => m.peakOutDb))
    };
  }

  async function compareAll() {
    stop();
    $('compare').disabled = true;
    const tbody = $('results').querySelector('tbody');
    tbody.replaceChildren();
    $('results').hidden = false;
    const fmt = v => (Number.isFinite(v) ? v.toFixed(1) : '–');
    for (const id of presetIds()) {
      $('note').textContent = `Rendering ${presetName(id)}…`;
      const log = await renderOffline(id);
      if (id === $('preset').value) lastLog = log;
      const s = summarize(log);
      const row = document.createElement('tr');
      for (const cell of [presetName(id), `${fmt(s.normalIn)} LUFS`, `${fmt(s.normalOut)} LUFS`, String(s.spikes),
        `${fmt(s.biggest)} dB`, `+${fmt(s.loudestOver)} dB`, `${fmt(s.peak)} dBFS`]) {
        const td = document.createElement('td');
        td.textContent = cell;
        row.append(td);
      }
      tbody.append(row);
    }
    $('note').textContent = `${fileName}: compared ${presetIds().length} presets offline`;
    $('compare').disabled = false;
    $('csv').disabled = !lastLog;
  }

  $('compare').addEventListener('click', compareAll);

  $('csv').addEventListener('click', () => {
    if (!lastLog) return;
    const cols = ['time', 'inDb', 'outDb', 'guardDb', 'limiterDb', 'levelDb', 'baselineDb', 'thresholdDb', 'peakOutDb', 'spikes'];
    const lines = [cols.join(',')].concat(lastLog.map(m => cols.map(c => (Number.isFinite(m[c]) ? m[c].toFixed(3) : '')).join(',')));
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `limitr-${$('preset').value}-${fileName.replace(/\.[^.]+$/, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // ---------- drawing ----------
  function renderReadouts(m) {
    const fmt = (v, unit) => (Number.isFinite(v) ? `${v.toFixed(1)} ${unit}` : '–');
    const items = [
      ['Input', fmt(m.inDb, 'LUFS')],
      ['Output', fmt(m.outDb, 'LUFS')],
      ['Spike guard', fmt(m.guardDb, 'dB')],
      ['Peak limiter', fmt(m.limiterDb, 'dB')],
      ['Normal level', fmt(m.baselineDb, 'LUFS')],
      ['Taming starts at', fmt(m.thresholdDb, 'LUFS')],
      ['Spikes caught', String(m.spikes ?? '–')],
      ['Biggest cut', fmt(m.maxSpikeDb, 'dB')]
    ];
    $('readouts').replaceChildren(...items.map(([label, value]) => {
      const div = document.createElement('div');
      div.className = 'readout';
      const span = document.createElement('span');
      span.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      div.append(span, strong);
      return div;
    }));
  }

  function drawTrace(h) {
    const canvas = $('trace');
    const g = canvas.getContext('2d');
    const { width, height } = canvas;
    g.clearRect(0, 0, width, height);
    if (h.length < 2) return;
    const lo = -54;
    const hi = -6;
    const y = db => height - ((Math.max(lo, Math.min(hi, db)) - lo) / (hi - lo)) * height;
    const x = i => width - (h.length - 1 - i) * (width / (HISTORY_POINTS - 1));

    const css = getComputedStyle(document.documentElement);
    const accent = css.getPropertyValue('--accent').trim();
    const spike = css.getPropertyValue('--spike').trim();
    g.save();
    g.fillStyle = accent;
    g.globalAlpha = 0.28;
    g.beginPath();
    g.moveTo(x(0), height);
    h.forEach((p, i) => g.lineTo(x(i), y(p.out)));
    g.lineTo(x(h.length - 1), height);
    g.fill();

    g.globalAlpha = 0.85;
    g.fillStyle = spike;
    for (let i = 1; i < h.length; i++) {
      const a = h[i - 1];
      const b = h[i];
      if (a.cut < 0.5 && b.cut < 0.5) continue;
      g.beginPath();
      g.moveTo(x(i - 1), y(a.out + a.cut));
      g.lineTo(x(i), y(b.out + b.cut));
      g.lineTo(x(i), y(b.out));
      g.lineTo(x(i - 1), y(a.out));
      g.fill();
    }

    const limit = h[h.length - 1].limit;
    if (Number.isFinite(limit)) {
      g.setLineDash([10, 10]);
      g.globalAlpha = 0.5;
      g.strokeStyle = spike;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, y(limit));
      g.lineTo(width, y(limit));
      g.stroke();
    }
    g.restore();
  }

  loadPresets();
  renderReadouts({});
})();
