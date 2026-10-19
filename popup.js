// Limitr popup. Settings live in chrome.storage; every tab's content scripts and the
// capture engine follow storage changes, so the popup only ever writes settings.

if (typeof browser !== 'undefined') {
  globalThis.chrome = browser;
}

const S = globalThis.LimitrSettings;
const K = S.STORAGE_KEYS;
const $ = id => document.getElementById(id);

const EXPLAINERS = {
  off: 'Audio plays exactly as the site sends it.',
  gentle: 'Steps in only when something is far louder than the talking around it.',
  stream: 'Pulls alerts, blerps and sudden yelling back to a few dB above normal talking.',
  sleep: 'Keeps everything quiet and even with softer highs. Spikes barely rise above normal.',
  movie: 'Tames explosions and music stings and leaves dialog alone.',
  tv90s: 'Narrow, warm broadcast sound with a little tape hiss.'
};

// Line icons for the factory presets (24 px grid, stroked with currentColor)
const PRESET_ICONS = {
  off: '<path d="M12 3v8"/><path d="M6.3 6.3a8 8 0 1 0 11.4 0"/>',
  gentle: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19l7-7"/>',
  stream: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  sleep: '<path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>',
  movie: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7.5 5v14M16.5 5v14M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  tv90s: '<rect x="3.5" y="7" width="17" height="13" rx="2.5"/><path d="M8.5 3.5L12 7l3.5-3.5"/>'
};

function lineIcon(markup, className) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  // Static markup from the constants above, never user input
  svg.innerHTML = markup;
  return svg;
}

const HISTORY_POINTS = 150;          // ~10 s at the meter poll rate
const METER_INTERVAL_MS = 66;
const STATUS_INTERVAL_MS = 1500;
const TRACE_RANGE = [-54, -6];       // LUFS shown on the trace

const state = {
  tabId: null,
  restricted: false,
  settings: S.normalize(null),
  enabled: true,
  mode: 'page',
  preset: null,
  custom: {},
  ui: { basePreset: S.DEFAULT_PRESET },
  screen: 'main',
  canCapture: false,
  captured: false,
  frameId: 0,
  frameStatus: null,
  history: [],
  meters: null,
  captions: 'off',
  captionPrefs: S.normalizeCaptions(null, uiLanguage()),
  crt: false
};

function uiLanguage() {
  return (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || navigator.language;
}

// ---------- formatting ----------
const MINUS = '−';
const signed = v => (v > 0 ? `+${trim(v)}` : v < 0 ? `${MINUS}${trim(-v)}` : '0');
const trim = v => (Math.round(v * 10) / 10).toString();
const fmt = {
  db: v => `${signed(v)} dB`,
  dbPlain: v => `${trim(v)} dB`,
  lufs: v => `${signed(v)} LUFS`,
  ms: v => (v >= 1000 ? `${trim(v / 1000)} s` : `${trim(v)} ms`),
  ratio: v => (v >= 20 ? 'Hard limit' : `${trim(v)}:1`),
  hz: v => (v >= 1000 ? `${trim(v / 1000)} kHz` : `${Math.round(v)} Hz`),
  lowCut: v => (v <= 20 ? 'Off' : fmt.hz(v)),
  highCut: v => (v >= 20000 ? 'Off' : fmt.hz(v)),
  hiss: v => (v <= 0 ? 'Off' : `${Math.round((v / 0.3) * 100)}%`),
  q: v => trim(v)
};

// ---------- theme ----------
// Canvas drawings read the CSS theme tokens at draw time, so they follow light/dark switches
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const token = name => css.getPropertyValue(name).trim();
  return {
    bg: token('--bg'),
    raised: token('--raised'),
    line: token('--line'),
    text: token('--text'),
    muted: token('--muted'),
    accent: token('--accent'),
    onAccent: token('--on-accent'),
    spike: token('--spike')
  };
}

// ---------- messaging ----------
function toBackground(message) {
  return chrome.runtime.sendMessage({ ...message, target: 'background' });
}

// ---------- persistence ----------
let saveTimer = null;
function commitSettings() {
  state.preset = S.matchPreset(state.settings, state.custom);
  renderPresets();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ [K.settings]: state.settings, [K.preset]: state.preset });
  }, 40);
}

function saveUi() {
  chrome.storage.local.set({ [K.ui]: state.ui });
}

function setSetting(key, value) {
  state.settings = S.normalize({ ...state.settings, [key]: value });
  commitSettings();
}

// ---------- presets ----------
function presetEntries() {
  return [
    ...S.PRESET_ORDER.map(id => [id, S.PRESETS[id], false]),
    ...Object.entries(state.custom).map(([id, p]) => [id, p, true])
  ];
}

function applyPreset(id) {
  state.settings = S.applyPreset(state.settings, id, state.custom);
  state.ui.basePreset = id;
  saveUi();
  commitSettings();
  renderControls();
}

function renderPresets() {
  const grid = $('presetGrid');
  grid.replaceChildren();
  for (const id of S.PRESET_ORDER) {
    const preset = S.PRESETS[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(state.preset === id));
    button.title = preset.desc || '';
    button.append(lineIcon(PRESET_ICONS[id] || '', 'preset-icon'), preset.name);
    button.addEventListener('click', () => applyPreset(id));
    grid.append(button);
  }
  renderPresetChips();
  renderMiniPreset();
  renderSavedPresets();

  const explainer = $('presetExplainer');
  explainer.replaceChildren();
  if (state.preset) {
    explainer.textContent = EXPLAINERS[state.preset] || 'Your saved preset.';
  } else {
    const base = S.PRESETS[state.ui.basePreset] || state.custom[state.ui.basePreset];
    explainer.append(base ? `Adjusted from ${base.name}. ` : 'Custom settings. ');
    if (base) {
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.textContent = `Reset to ${base.name}`;
      reset.addEventListener('click', () => applyPreset(state.ui.basePreset));
      explainer.append(reset);
    }
  }
}

// Saved presets sit in one line of chips; whatever doesn't fit collapses into "+N"
function renderPresetChips() {
  const row = $('presetChips');
  const entries = Object.entries(state.custom);
  row.replaceChildren();
  row.hidden = entries.length === 0;
  if (!entries.length) return;

  const chips = entries.map(([id, preset]) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.classList.toggle('on', state.preset === id);
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'chip-apply';
    apply.textContent = preset.name;
    apply.setAttribute('aria-pressed', String(state.preset === id));
    apply.addEventListener('click', () => applyPreset(id));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chip-remove';
    remove.textContent = '\u00d7';
    remove.setAttribute('aria-label', `Delete preset ${preset.name}`);
    remove.addEventListener('click', () => deletePreset(id));
    chip.append(apply, remove);
    row.append(chip);
    return chip;
  });
  const more = document.createElement('button');
  more.type = 'button';
  more.className = 'chip more';
  more.hidden = true;
  more.addEventListener('click', () => openScreen('finetune', 'savedPresets'));
  row.append(more);
  requestAnimationFrame(fitPresetChips);
}

// Hides chips from the end until the row fits, behind a "+N" chip. Only measurable while the main
// screen is shown, so showScreen('main') calls it again.
function fitPresetChips() {
  const row = $('presetChips');
  if (row.hidden || !row.clientWidth) return;
  const chips = [...row.querySelectorAll('.chip:not(.more)')];
  const more = row.querySelector('.chip.more');
  chips.forEach(chip => { chip.hidden = false; });
  more.hidden = true;
  let hiddenCount = 0;
  for (let i = chips.length - 1; i >= 0 && row.scrollWidth > row.clientWidth; i--) {
    chips[i].hidden = true;
    hiddenCount++;
    more.hidden = false;
    more.textContent = `+${hiddenCount}`;
    more.setAttribute('aria-label', `${hiddenCount} more saved presets`);
  }
}

// Which preset Fine-tune is adjusting, shown in its live strip
function renderMiniPreset() {
  const el = $('miniPreset');
  el.replaceChildren();
  const current = S.PRESETS[state.preset] || state.custom[state.preset];
  if (current) {
    el.textContent = `${current.name} preset`;
    return;
  }
  const base = S.PRESETS[state.ui.basePreset] || state.custom[state.ui.basePreset];
  el.append(base ? `Adjusted from ${base.name} \u00b7 ` : 'Custom settings');
  if (base) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => applyPreset(state.ui.basePreset));
    el.append(reset);
  }
}

function renderSavedPresets() {
  const list = $('savedPresetList');
  list.replaceChildren();
  const entries = Object.entries(state.custom);
  if (!entries.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Nothing saved yet.';
    list.append(empty);
    return;
  }
  for (const [id, preset] of entries) {
    const item = document.createElement('li');
    const apply = document.createElement('button');
    apply.type = 'button';
    apply.className = 'saved-apply';
    apply.textContent = preset.name;
    apply.setAttribute('aria-pressed', String(state.preset === id));
    apply.addEventListener('click', () => applyPreset(id));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'chip-remove';
    remove.textContent = '\u00d7';
    remove.setAttribute('aria-label', `Delete preset ${preset.name}`);
    remove.addEventListener('click', () => deletePreset(id));
    item.append(apply, remove);
    list.append(item);
  }
}

function deletePreset(id) {
  delete state.custom[id];
  chrome.storage.local.set({ [K.customPresets]: state.custom });
  if (state.ui.basePreset === id) state.ui.basePreset = S.DEFAULT_PRESET;
  commitSettings();
}

function savePreset(name) {
  const id = `custom_${Date.now()}`;
  const settings = { ...state.settings };
  delete settings.volume;
  state.custom[id] = { name, desc: 'Custom', settings };
  chrome.storage.local.set({ [K.customPresets]: state.custom });
  state.ui.basePreset = id;
  saveUi();
  commitSettings();
}

// ---------- sliders ----------
const sliderBindings = [];

function bindRange(input, output, key, format, mapping) {
  const [min, max, step] = mapping ? [0, 1000, 1] : S.rangeFor(key);
  input.min = min;
  input.max = max;
  input.step = step;
  const toSlider = mapping ? mapping.toSlider : v => v;
  const fromSlider = mapping ? mapping.fromSlider : v => v;
  const paint = () => {
    const value = state.settings[key];
    input.value = toSlider(value);
    input.style.setProperty('--fill', `${((toSlider(value) - min) / (max - min)) * 100}%`);
    if (output) output.textContent = format(value);
  };
  input.addEventListener('input', () => {
    setSetting(key, fromSlider(Number(input.value)));
    paint();
    if (key.startsWith('eq') || key === 'lowCut' || key === 'highCut') drawEqCurve();
  });
  sliderBindings.push(paint);
  paint();
}

const logFreq = {
  toSlider: f => Math.round(1000 * Math.log(f / 20) / Math.log(1000)),
  fromSlider: v => Math.round(20 * Math.pow(1000, v / 1000))
};

function sliderRow(key, label, format, mapping) {
  const row = document.createElement('div');
  row.className = 'slider-row';
  const id = `ctl-${key}`;
  const labelEl = document.createElement('label');
  labelEl.htmlFor = id;
  labelEl.textContent = label;
  const output = document.createElement('output');
  output.htmlFor = id;
  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  row.append(labelEl, output, input);
  bindRange(input, output, key, format, mapping);
  return row;
}

const toggleBindings = [];

function switchRow(key, label, note) {
  const row = document.createElement('label');
  row.className = 'toggle-row';
  const text = document.createElement('span');
  text.className = 'toggle-text';
  const title = document.createElement('span');
  title.textContent = label;
  text.append(title);
  if (note) {
    const small = document.createElement('small');
    small.textContent = note;
    text.append(small);
  }
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  const sw = document.createElement('span');
  sw.className = 'switch';
  sw.setAttribute('aria-hidden', 'true');
  row.append(text, input, sw);
  input.addEventListener('change', () => {
    setSetting(key, input.checked);
    renderControls();
  });
  toggleBindings.push(() => { input.checked = Boolean(state.settings[key]); });
  return row;
}

function selectRow(key, label, options) {
  const row = document.createElement('label');
  row.className = 'select-row';
  const text = document.createElement('span');
  text.textContent = label;
  const select = document.createElement('select');
  for (const [value, name] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = name;
    select.append(option);
  }
  select.addEventListener('change', () => {
    setSetting(key, select.value);
    if (key.startsWith('eq')) drawEqCurve();
  });
  toggleBindings.push(() => { select.value = state.settings[key]; });
  row.append(text, select);
  return row;
}

// ---------- fine-tune drawer ----------
// Line icons for the Fine-tune sections, keyed by section title
const SECTION_ICONS = {
  'Spike guard': '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M8.5 12.5c1-1.6 2-1.6 3 0s2 1.6 3 0"/>',
  'Even out levels': '<path d="M4 8h16M4 16h16"/><circle cx="9" cy="8" r="2.2"/><circle cx="15" cy="16" r="2.2"/>',
  'Peak limiter': '<path d="M4 6h16"/><path d="M4 18c3 0 3-8 6-8s3 8 6 8"/>',
  'Tone': '<path d="M5 20V4M12 20V4M19 20V4"/><circle cx="5" cy="14" r="2"/><circle cx="12" cy="8" r="2"/><circle cx="19" cy="16" r="2"/>',
  'Compressor': '<path d="M4 12h4l2-5 4 10 2-5h4"/>',
  'Extras': '<path d="M12 4v4M12 16v4M4 12h4M16 12h4"/><circle cx="12" cy="12" r="2"/>'
};

const GROUPS = [
  {
    title: 'Spike guard',
    toggle: 'guardEnabled',
    note: 'Learns how loud the stream normally is and pulls sudden jumps back down.',
    controls: [
      ['guardHeadroom', 'Allow above normal', fmt.dbPlain],
      ['guardCeiling', 'Never louder than', fmt.lufs],
      ['guardRatio', 'Strength', fmt.ratio],
      ['guardAttack', 'Reaction time', fmt.ms],
      ['guardHold', 'Hold before recovering', fmt.ms],
      ['guardRelease', 'Recovery time', fmt.ms]
    ]
  },
  {
    title: 'Even out levels',
    toggle: 'levelEnabled',
    note: 'Slowly moves every stream toward the same normal loudness.',
    controls: [
      ['levelTarget', 'Normal loudness', fmt.lufs],
      ['levelMaxBoost', 'Most it may raise a quiet stream', fmt.dbPlain]
    ]
  },
  {
    title: 'Peak limiter',
    toggle: 'limiterEnabled',
    note: 'The last safety net: no single sample gets past this ceiling.',
    controls: [
      ['limiterCeiling', 'Ceiling', v => `${signed(v)} dBFS`],
      ['limiterRelease', 'Recovery time', fmt.ms]
    ]
  },
  {
    title: 'Tone',
    toggle: 'toneEnabled',
    note: null,
    eq: true,
    controls: [
      ['lowCut', 'Cut rumble below', fmt.lowCut],
      ['highCut', 'Cut hiss above', fmt.highCut]
    ]
  },
  {
    title: 'Compressor',
    toggle: 'compressorEnabled',
    note: 'Classic compression for a denser sound. It never raises quiet audio.',
    controls: [
      ['compThreshold', 'Threshold', fmt.db],
      ['compRatio', 'Ratio', v => `${trim(v)}:1`],
      ['compKnee', 'Knee', fmt.dbPlain],
      ['compAttack', 'Attack', fmt.ms],
      ['compRelease', 'Release', fmt.ms],
      ['compMakeup', 'Output gain', fmt.db]
    ]
  },
  {
    title: 'Extras',
    controls: [['noiseLevel', 'Tape hiss', fmt.hiss]],
    extras: true
  }
];

const groupBindings = [];

function buildFineTune() {
  const body = $('fineTuneBody');
  const openGroups = state.ui.groups || {};
  for (const group of GROUPS) {
    const section = document.createElement('details');
    section.className = 'group';
    section.open = openGroups[group.title] ?? group.title === 'Spike guard';
    const head = document.createElement('summary');
    head.className = 'group-head';
    const icon = document.createElement('span');
    icon.className = 'gi';
    icon.append(lineIcon(SECTION_ICONS[group.title] || '', 'gi-svg'));
    const title = document.createElement('h3');
    title.textContent = group.title;
    head.append(icon, title);
    section.append(head);

    if (group.toggle) {
      const toggle = switchRow(group.toggle, '', null);
      toggle.querySelector('.toggle-text').remove();
      toggle.querySelector('input').setAttribute('aria-label', group.title);
      toggle.classList.add('compact');
      head.append(toggle);
      groupBindings.push(() => { section.dataset.off = String(!state.settings[group.toggle]); });
    }
    if (group.note) {
      const note = document.createElement('p');
      note.className = 'group-note';
      note.textContent = group.note;
      section.append(note);
    }

    const controls = document.createElement('div');
    controls.className = 'group-controls';
    for (const [key, label, format] of group.controls) controls.append(sliderRow(key, label, format));
    if (group.eq) buildEq(controls);
    if (group.extras) {
      controls.append(selectRow('noiseType', 'Hiss character', [['brown', 'Soft rumble'], ['pink', 'Warm'], ['white', 'Bright']]));
      controls.append(switchRow('monoEnabled', 'Fix one-sided audio', 'Plays mono or one-ear streams in both ears'));
      controls.append(crtRow());
    }
    section.append(controls);
    section.addEventListener('toggle', () => {
      state.ui.groups = { ...(state.ui.groups || {}), [group.title]: section.open };
      saveUi();
      if (group.eq && section.open) drawEqCurve();
    });
    body.append(section);
  }
}

function crtRow() {
  const row = switchRow('crt', 'CRT look on this tab', 'Scanlines and glow over videos');
  // Not a stored setting: swap the generic handler for the per-tab overlay toggle
  toggleBindings.pop();
  const input = row.querySelector('input');
  const fresh = input.cloneNode(true);
  fresh.id = 'crt';
  input.replaceWith(fresh);
  fresh.addEventListener('change', event => setCrt(event.target.checked));
  return row;
}

// ---------- EQ ----------
const EQ_TYPE_NAMES = [
  ['lowshelf', 'Low shelf'], ['peaking', 'Bell'], ['highshelf', 'High shelf'],
  ['highpass', 'High-pass'], ['lowpass', 'Low-pass'], ['notch', 'Notch']
];

function buildEq(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'eq-curve';
  canvas.id = 'eqCurve';
  canvas.width = 656;
  canvas.height = 144;
  container.append(canvas);
  const bands = document.createElement('details');
  bands.className = 'sub';
  const summary = document.createElement('summary');
  summary.textContent = 'Equalizer bands';
  bands.append(summary);
  for (let i = 1; i <= 5; i++) {
    const band = document.createElement('div');
    band.className = 'eq-band';
    const head = document.createElement('div');
    head.className = 'eq-band-head';
    const select = selectRow(`eq${i}Type`, `Band ${i}`, EQ_TYPE_NAMES);
    select.classList.add('flush');
    head.append(select);
    band.append(head);
    band.append(sliderRow(`eq${i}Freq`, 'Frequency', fmt.hz, logFreq));
    band.append(sliderRow(`eq${i}Gain`, 'Gain', fmt.db));
    band.append(sliderRow(`eq${i}Q`, 'Width (Q)', fmt.q));
    bands.append(band);
  }
  container.append(bands);
}

let eqContext = null;
function drawEqCurve() {
  const canvas = $('eqCurve');
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const { width, height } = canvas;
  g.clearRect(0, 0, width, height);

  const s = state.settings;
  eqContext = eqContext || new OfflineAudioContext(1, 128, 48000);
  const points = 160;
  const freqs = new Float32Array(points);
  for (let i = 0; i < points; i++) freqs[i] = 20 * Math.pow(1000, i / (points - 1));
  const total = new Float32Array(points).fill(0);
  const addFilter = (type, frequency, gain, q) => {
    const f = eqContext.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.gain.value = gain;
    f.Q.value = q;
    const mag = new Float32Array(points);
    f.getFrequencyResponse(freqs, mag, new Float32Array(points));
    for (let i = 0; i < points; i++) total[i] += 20 * Math.log10(Math.max(mag[i], 1e-6));
  };
  if (s.toneEnabled) {
    if (s.lowCut > 20) addFilter('highpass', s.lowCut, 0, Math.SQRT1_2);
    for (let i = 1; i <= 5; i++) addFilter(s[`eq${i}Type`], s[`eq${i}Freq`], s[`eq${i}Gain`], s[`eq${i}Q`]);
    if (s.highCut < 20000) addFilter('lowpass', s.highCut, 0, Math.SQRT1_2);
  }

  const y = db => height / 2 - (Math.max(-18, Math.min(18, db)) / 18) * (height / 2 - 6);
  const colors = themeColors();
  g.strokeStyle = colors.line;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, height / 2);
  g.lineTo(width, height / 2);
  g.stroke();

  g.strokeStyle = s.toneEnabled ? colors.accent : colors.muted;
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i < points; i++) {
    const x = (i / (points - 1)) * width;
    if (i === 0) g.moveTo(x, y(total[i]));
    else g.lineTo(x, y(total[i]));
  }
  g.stroke();
}

// ---------- rendering ----------
function renderControls() {
  sliderBindings.forEach(paint => paint());
  toggleBindings.forEach(sync => sync());
  groupBindings.forEach(sync => sync());
  $('denoiseEnabled').checked = state.settings.denoiseEnabled;
  const crt = $('crt');
  if (crt) crt.checked = state.crt;
  drawEqCurve();
}

function renderPower() {
  $('power').checked = state.enabled;
  $('powerLabel').textContent = state.enabled ? 'On' : 'Off';
  $('popup').dataset.enabled = String(state.enabled);
}

function renderMode() {
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.checked = radio.value === state.mode;
    if (radio.value === 'capture') radio.disabled = !state.canCapture;
  }
  if (!state.canCapture) {
    $('captureNote').textContent = 'Needs Chrome or another Chromium browser. This browser only allows listening inside the page.';
  }
  $('mixer').hidden = state.mode !== 'capture';
}

// Status parts are [text, style] pairs; style is 'strong', 'warn' or undefined
function renderStatus() {
  const fs = state.frameStatus;
  let parts;
  if (!state.enabled) {
    parts = [['Off. Audio plays untouched everywhere.']];
  } else if (state.restricted) {
    parts = [['Browser pages like this one can\u2019t be processed.']];
  } else if (state.captured) {
    parts = [['Listening to the whole tab.', 'strong']];
  } else if (!fs) {
    parts = [['Limitr isn\u2019t running on this page yet. Reload the tab to start it.']];
  } else if (fs.attached > 0) {
    parts = [[`Taming ${fs.attached === 1 ? 'the player' : `${fs.attached} players`} on this tab.`, 'strong']];
  } else if (fs.waitingForGesture > 0) {
    parts = [['Click anywhere on the page once', 'warn'], [' so the browser lets Limitr start.']];
  } else if (fs.skipped && (fs.skipped['cross-origin'] || fs.skipped.drm || fs.skipped['page-audio'])) {
    parts = state.canCapture
      ? [['This player can\u2019t be reached from inside the page.', 'warn'], [' Switch to Whole tab under How Limitr listens.']]
      : [['This player can\u2019t be reached from inside the page', 'warn'], [' in this browser, so it plays untouched.']];
  } else {
    parts = [['Press play. Limitr starts with the first sound on this page.']];
  }
  if (state.enabled && state.meters && state.meters.dsp === 'fallback') {
    parts.push([' This site blocks part of Limitr, so spike taming is simpler here.']);
  }
  setRichText($('status'), parts);
}

// The meter poll re-renders these lines 15 times a second; unchanged text skips the DOM work
// (and the style, layout and paint it would cause)
const richTextShown = new WeakMap();

function setRichText(el, parts) {
  const key = JSON.stringify(parts);
  if (richTextShown.get(el) === key) return;
  richTextShown.set(el, key);
  el.replaceChildren(...parts.map(([text, style]) => {
    if (!style) return document.createTextNode(text);
    const span = document.createElement(style === 'strong' ? 'strong' : 'span');
    if (style !== 'strong') span.className = style;
    span.textContent = text;
    return span;
  }));
}

function renderCaption() {
  for (const el of [$('traceCaption'), $('miniCaught')]) renderCaughtLine(el);
}

function renderCaughtLine(el) {
  const m = state.meters;
  const live = state.enabled && m && typeof m.spikes === 'number';
  if (!live) {
    setRichText(el, []);
    return;
  }
  if (m.spikes === 0) {
    setRichText(el, [['Listening. Nothing too loud yet.']]);
    return;
  }
  const count = m.spikes === 1 ? '1 spike' : `${m.spikes} spikes`;
  setRichText(el, [['CAUGHT', 'tag'], [` ${count}. The biggest was cut by ${trim(m.maxSpikeDb)} dB.`]]);
}

function renderAll() {
  renderPower();
  renderPresets();
  renderControls();
  renderMode();
  renderStatus();
  renderCaption();
  drawTraces();
}

// ---------- loudness trace ----------
function drawTraces() {
  drawTrace($('trace'), state.history, { label: true });
  if (state.screen === 'finetune') drawTrace($('miniTrace'), state.history);
}

function drawTrace(canvas, history, options = {}) {
  const g = canvas.getContext('2d');
  const { width, height } = canvas;
  g.clearRect(0, 0, width, height);
  const [lo, hi] = TRACE_RANGE;
  const y = db => height - ((Math.max(lo, Math.min(hi, db)) - lo) / (hi - lo)) * height;
  const step = width / (HISTORY_POINTS - 1);
  const h = history;
  const x = i => width - (h.length - 1 - i) * step;

  const colors = themeColors();

  // Resting line when there is nothing to show
  if (h.length < 2) {
    g.strokeStyle = colors.line;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, height - 1);
    g.lineTo(width, height - 1);
    g.stroke();
    return;
  }

  // Output loudness (what you hear)
  g.fillStyle = colors.accent;
  g.globalAlpha = 0.28;
  g.beginPath();
  g.moveTo(x(0), height);
  h.forEach((p, i) => g.lineTo(x(i), y(p.out)));
  g.lineTo(x(h.length - 1), height);
  g.closePath();
  g.fill();

  // What Limitr shaved off: between the would-be level and what you hear
  g.fillStyle = colors.spike;
  g.globalAlpha = 0.85;
  for (let i = 1; i < h.length; i++) {
    const a = h[i - 1];
    const b = h[i];
    if (a.cut < 0.5 && b.cut < 0.5) continue;
    g.beginPath();
    g.moveTo(x(i - 1), y(a.out + a.cut));
    g.lineTo(x(i), y(b.out + b.cut));
    g.lineTo(x(i), y(b.out));
    g.lineTo(x(i - 1), y(a.out));
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;

  g.strokeStyle = colors.accent;
  g.lineWidth = 2;
  g.beginPath();
  h.forEach((p, i) => (i === 0 ? g.moveTo(x(i), y(p.out)) : g.lineTo(x(i), y(p.out))));
  g.stroke();

  // Where taming starts right now
  const last = h[h.length - 1];
  if (Number.isFinite(last.limit)) {
    g.setLineDash([6, 6]);
    g.strokeStyle = colors.spike;
    g.globalAlpha = 0.5;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, y(last.limit));
    g.lineTo(width, y(last.limit));
    g.stroke();
    g.setLineDash([]);
    if (options.label) {
      // Label on a backing in the page colour so the curve never runs through the text
      const text = 'Taming starts here';
      g.font = "600 20px 'IBM Plex Sans', sans-serif";
      g.textBaseline = 'bottom';
      const labelY = y(last.limit) - 4;
      g.globalAlpha = 0.85;
      g.fillStyle = colors.bg;
      g.fillRect(0, labelY - 24, g.measureText(text).width + 8, 24);
      g.fillStyle = colors.spike;
      g.fillText(text, 0, labelY);
    }
    g.globalAlpha = 1;
  }
}

// ---------- tab status & meters ----------
async function refreshTabStatus() {
  if (!state.tabId || state.restricted) {
    renderStatus();
    return;
  }
  if (state.canCapture && state.mode === 'capture') {
    const list = await toBackground({ action: 'capture-list' }).catch(() => null);
    state.captured = Boolean(list?.tabs?.some(t => t.tabId === state.tabId));
    renderMixer(list?.tabs || []);
  } else {
    state.captured = false;
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: state.tabId, allFrames: true },
      func: () => globalThis.__limitrBridgeStatus || null
    });
    let best = null;
    const total = { attached: 0, waitingForGesture: 0, skipped: {} };
    let anyBridge = false;
    for (const { frameId, result } of results) {
      if (!result) continue;
      anyBridge = true;
      total.attached += result.attached || 0;
      total.waitingForGesture += result.waitingForGesture || 0;
      for (const [reason, count] of Object.entries(result.skipped || {})) {
        total.skipped[reason] = (total.skipped[reason] || 0) + count;
      }
      if (!best || (result.attached || 0) > (best.result.attached || 0)) best = { frameId, result };
    }
    state.frameStatus = anyBridge ? total : null;
    state.frameId = best ? best.frameId : 0;
  } catch (e) {
    state.frameStatus = null;
  }
  renderStatus();
}

async function pollMeters() {
  let meters = null;
  try {
    if (state.enabled && state.captured) {
      meters = (await toBackground({ action: 'capture-meters', tabId: state.tabId }))?.meters || null;
    } else if (state.enabled && state.frameStatus && state.frameStatus.attached > 0) {
      meters = await chrome.tabs.sendMessage(state.tabId, { action: 'limitr-get-meters' }, { frameId: state.frameId });
    }
  } catch (e) {
    meters = null;
  }

  state.meters = meters;
  if (meters && Number.isFinite(meters.outDb)) {
    const cut = Math.max(0, -(meters.guardDb || 0));
    state.history.push({ out: meters.outDb, cut, limit: meters.thresholdDb });
    if (state.history.length > HISTORY_POINTS) state.history.shift();
  }
  drawTraces();
  renderCaption();
  setTimeout(pollMeters, METER_INTERVAL_MS);
}

// ---------- tab capture ----------
async function captureCurrentTab() {
  if (!state.tabId || state.restricted) return;
  const response = await toBackground({ action: 'capture-tab', tabId: state.tabId }).catch(e => ({ error: e.message }));
  if (response && response.error) {
    setRichText($('status'), [['Couldn\u2019t listen to this tab: ', 'warn'], [response.error]]);
    return;
  }
  await refreshTabStatus();
}

function renderMixer(tabs) {
  const list = $('mixerList');
  list.replaceChildren();
  if (!tabs.length) {
    const empty = document.createElement('li');
    empty.textContent = 'No tabs yet. Tabs join when they start playing sound.';
    list.append(empty);
    return;
  }
  for (const tab of tabs) {
    const item = document.createElement('li');
    const icon = document.createElement('img');
    icon.alt = '';
    if (tab.favIconUrl && /^https?:/.test(tab.favIconUrl)) icon.src = tab.favIconUrl;
    const title = document.createElement('span');
    title.textContent = tab.title || 'Tab';
    const output = document.createElement('output');
    output.textContent = fmt.db(tab.volumeDb);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = -30;
    slider.max = 12;
    slider.step = 1;
    slider.value = tab.volumeDb;
    slider.setAttribute('aria-label', `Volume for ${tab.title}`);
    const paint = () => slider.style.setProperty('--fill', `${((slider.value - slider.min) / (slider.max - slider.min)) * 100}%`);
    paint();
    slider.addEventListener('input', () => {
      output.textContent = fmt.db(Number(slider.value));
      paint();
      toBackground({ action: 'capture-volume', tabId: tab.tabId, volumeDb: Number(slider.value) });
    });
    item.append(icon, title, output, slider);
    list.append(item);
  }
}

// ---------- captions ----------
const LANGUAGE_NAMES = Object.fromEntries(S.CAPTION_LANGUAGES);
const IDLE_CAPTIONS_NOTE = 'Runs on your computer. The first time downloads a speech model.';
// Chrome and Edge translate on-device into any language; elsewhere Whisper can only produce English
const translatorApi = () => (typeof self !== 'undefined' && self.Translator) || null;

function renderCaptions(note) {
  const toggle = $('captions');
  toggle.checked = state.captions === 'active' || state.captions === 'loading';
  toggle.disabled = state.captions === 'loading' || !state.enabled || state.restricted;
  $('transcript').hidden = state.captions !== 'active';
  const chip = $('captionsChip');
  chip.hidden = !toggle.checked;
  const auto = state.captionPrefs.language === 'auto';
  chip.textContent = auto
    ? (state.captionsDetected ? `Auto: ${LANGUAGE_NAMES[state.captionsDetected] || state.captionsDetected}` : 'Auto')
    : LANGUAGE_NAMES[state.captionPrefs.language] || state.captionPrefs.language;
  chip.setAttribute('aria-label', `Caption settings: ${chip.textContent}`);
  if (note) $('captionsNote').textContent = note;
}

function setCaptionsHint(text) {
  $('captionsHint').textContent = text || '';
  $('captionsHint').hidden = !text;
}

function buildCaptionOptions() {
  const language = $('captionsLanguage');
  const translate = $('captionsTranslate');
  const option = (value, name) => {
    const el = document.createElement('option');
    el.value = value;
    el.textContent = name;
    return el;
  };
  language.replaceChildren(option('auto', 'Detect automatically'), ...S.CAPTION_LANGUAGES.map(([c, n]) => option(c, n)));
  const targets = translatorApi() ? S.CAPTION_LANGUAGES : S.CAPTION_LANGUAGES.filter(([c]) => c === 'en');
  translate.replaceChildren(option('', 'Off'), ...targets.map(([c, n]) => option(c, n)));
  if (!translatorApi()) setCaptionsHint('This browser can only translate captions into English.');

  language.value = state.captionPrefs.language;
  translate.value = targets.some(([c]) => c === state.captionPrefs.translateTo) ? state.captionPrefs.translateTo : '';

  language.addEventListener('change', () => {
    saveCaptionPrefs({ language: language.value });
    renderCaptions();
  });
  translate.addEventListener('change', () => {
    saveCaptionPrefs({ translateTo: translate.value });
    // The change event carries the click, which a first-time translator download needs
    const source = state.captionPrefs.language;
    if (translate.value && source !== 'auto') prepareTranslation(source, translate.value);
  });
  $('translationDownload').addEventListener('click', () => {
    const { source, target } = $('translationDownload').dataset;
    prepareTranslation(source, target);
  });
}

function saveCaptionPrefs(change) {
  state.captionPrefs = S.normalizeCaptions({ ...state.captionPrefs, ...change }, uiLanguage());
  chrome.storage.local.set({ [K.captions]: state.captionPrefs });
}

// Downloads Chrome's on-device translation model for a pair. Only works from a click.
async function prepareTranslation(source, target) {
  const api = translatorApi();
  $('translationDownload').hidden = true;
  if (!api || source === target) return;
  const pair = `${LANGUAGE_NAMES[source] || source} to ${LANGUAGE_NAMES[target] || target}`;
  try {
    const availability = await api.availability({ sourceLanguage: source, targetLanguage: target });
    if (availability === 'unavailable') {
      setCaptionsHint(target === 'en'
        ? `This browser can't translate ${pair} on-device, so Whisper translates into English instead.`
        : `This browser can't translate ${pair} on-device.`);
      return;
    }
    if (availability === 'available') {
      setCaptionsHint('');
      return;
    }
    setCaptionsHint(`Downloading the ${pair} translation\u2026`);
    await api.create({
      sourceLanguage: source,
      targetLanguage: target,
      monitor(m) {
        m.addEventListener('downloadprogress', e => setCaptionsHint(`Downloading the ${pair} translation\u2026 ${Math.round(e.loaded * 100)}%`));
      }
    });
    setCaptionsHint(`${pair} translation is ready.`);
  } catch (error) {
    setCaptionsHint(`Couldn\u2019t prepare the ${pair} translation: ${error.message}`);
  }
}

async function setCaptions(enabled) {
  if (enabled) {
    state.captions = 'loading';
    renderCaptions('Loading the speech model\u2026');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: state.tabId, allFrames: true },
        files: ['content-transcribe.js']
      });
    } catch (e) { /* overlay is optional */ }
    const response = await toBackground({ action: 'captions-start', tabId: state.tabId }).catch(e => ({ success: false, error: e.message }));
    state.captions = response?.success ? 'active' : 'error';
    renderCaptions(response?.success ? 'Captions show over the video and here.' : `Captions failed: ${response?.error || 'unknown error'}`);
  } else {
    await toBackground({ action: 'captions-stop', tabId: state.tabId }).catch(() => {});
    state.captions = 'off';
    renderCaptions(IDLE_CAPTIONS_NOTE);
  }
}

async function refreshCaptions() {
  const status = await toBackground({ action: 'captions-status', tabId: state.tabId }).catch(() => null);
  if (status?.active) state.captions = 'active';
  else if (status?.loading) state.captions = 'loading';
  const detected = status?.session?.language;
  if (detected) state.captionsDetected = detected;
  renderCaptions(status?.active && detected && state.captionPrefs.language === 'auto'
    ? `Listening in ${LANGUAGE_NAMES[detected] || detected}.`
    : undefined);
}

// The line being spoken arrives several times as it grows; same segment = same line.
// The transcript keeps the original words; the video overlay shows the translation.
function showTranscriptLine(result) {
  const list = $('transcript');
  let line = result.segmentId != null && list.querySelector(`li[data-segment="${result.segmentId}"]`);
  if (!line) {
    line = document.createElement('li');
    if (result.segmentId != null) line.dataset.segment = result.segmentId;
    list.append(line);
    while (list.children.length > 6) list.firstChild.remove();
  }
  // Original line, with the translation (when there is one) muted underneath
  const orig = document.createElement('span');
  orig.className = 'orig';
  orig.textContent = result.text;
  line.replaceChildren(orig);
  if (result.translation) {
    const tr = document.createElement('span');
    tr.className = 'tr';
    tr.textContent = result.translation;
    line.append(tr);
  }
  list.scrollTop = list.scrollHeight;
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.tabId !== state.tabId) return;
  if (message.action === 'transcription-result' && message.result?.text) {
    showTranscriptLine(message.result);
  } else if (message.action === 'transcription-status') {
    if (message.status === 'active') state.captions = 'active';
    else if (message.status === 'loading') state.captions = 'loading';
    else if (message.status === 'error') state.captions = 'error';
    else if (message.status === 'stopped') state.captions = 'off';
    if (message.status === 'language') {
      state.captionsDetected = message.language;
      renderCaptions(`Listening in ${LANGUAGE_NAMES[message.language] || message.language}.`);
    } else if (message.status === 'translation-download') {
      const button = $('translationDownload');
      button.dataset.source = message.source;
      button.dataset.target = message.target;
      button.textContent = `Download the ${LANGUAGE_NAMES[message.source] || message.source} to ${LANGUAGE_NAMES[message.target] || message.target} translation`;
      button.hidden = false;
    } else {
      renderCaptions(message.status === 'error' ? `Captions failed: ${message.message}`
        : message.status === 'loading' ? message.message : undefined);
    }
  }
});

// ---------- CRT look ----------
async function setCrt(enabled) {
  state.crt = enabled;
  try {
    if (enabled) {
      await chrome.scripting.executeScript({ target: { tabId: state.tabId, allFrames: true }, files: ['content.js'] });
    }
    await chrome.tabs.sendMessage(state.tabId, { action: 'set-crt-visual', enabled });
  } catch (e) {
    state.crt = false;
    renderControls();
  }
}

// ---------- screens ----------
// The popup is one main screen plus secondary screens that replace it (back arrow or Esc returns).
function showScreen(name) {
  for (const screen of document.querySelectorAll('.screen')) {
    screen.hidden = screen.dataset.screen !== name;
  }
  state.screen = name;
  const current = document.querySelector(`.screen[data-screen="${name}"]`);
  const body = current.querySelector('.screen-body');
  if (body) body.scrollTop = 0;
  if (name === 'finetune') {
    drawEqCurve();
    drawTraces();
  }
  if (name === 'main') fitPresetChips();
  const focusTarget = name === 'main' ? $('power') : current.querySelector('.back');
  if (focusTarget) focusTarget.focus();
}

function openScreen(name, focusId) {
  showScreen(name);
  if (focusId && $(focusId)) $(focusId).focus();
}

// ---------- events ----------
function bindEvents() {
  $('power').addEventListener('change', async (event) => {
    state.enabled = event.target.checked;
    await chrome.storage.local.set({ [K.enabled]: state.enabled });
    renderPower();
    renderStatus();
    renderCaptions();
    if (state.enabled && state.mode === 'capture') captureCurrentTab();
  });

  bindRange($('volume'), $('volumeValue'), 'volume', fmt.db);

  $('denoiseEnabled').addEventListener('change', e => setSetting('denoiseEnabled', e.target.checked));
  $('captions').addEventListener('change', e => setCaptions(e.target.checked));
  $('captionsChip').addEventListener('click', () => openScreen('captions'));
  for (const row of document.querySelectorAll('.nav-row')) {
    row.addEventListener('click', () => openScreen(row.dataset.open));
  }

  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.addEventListener('change', async () => {
      if (!radio.checked) return;
      state.mode = radio.value;
      await chrome.storage.local.set({ [K.mode]: state.mode });
      renderMode();
      if (state.mode === 'capture' && state.enabled) await captureCurrentTab();
      else await refreshTabStatus();
    });
  }

  for (const back of document.querySelectorAll('.back')) {
    back.addEventListener('click', () => showScreen('main'));
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.screen !== 'main') {
      event.preventDefault();
      showScreen('main');
    }
  });

  const form = $('savePresetForm');
  $('savePresetButton').addEventListener('click', () => {
    form.hidden = false;
    $('savePresetButton').hidden = true;
    $('presetName').focus();
  });
  $('cancelPreset').addEventListener('click', () => {
    form.hidden = true;
    $('savePresetButton').hidden = false;
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = $('presetName').value.trim();
    if (!name) return;
    savePreset(name);
    form.reset();
    form.hidden = true;
    $('savePresetButton').hidden = false;
  });
}

// ---------- startup ----------
// Paint from local storage first; anything that needs the background (which may be a cold
// service worker taking a second or more to start) fills in afterwards.
async function init() {
  const forcedTab = Number(new URLSearchParams(location.search).get('tabId'));
  const [tabResult, loaded, stored] = await Promise.all([
    forcedTab ? chrome.tabs.get(forcedTab).then(t => [t]) : chrome.tabs.query({ active: true, currentWindow: true }),
    S.load(chrome.storage.local),
    chrome.storage.local.get([K.customPresets, K.ui, K.captions])
  ]);
  const tab = tabResult[0];
  state.tabId = tab ? tab.id : null;
  state.restricted = !tab || !/^(https?|file):/.test(tab.url || '');

  state.settings = loaded.settings;
  state.enabled = loaded.enabled;
  state.custom = stored[K.customPresets] || {};
  state.ui = { ...state.ui, ...(stored[K.ui] || {}) };
  state.preset = S.matchPreset(state.settings, state.custom);
  if (state.preset) state.ui.basePreset = state.preset;
  state.captionPrefs = S.normalizeCaptions(stored[K.captions], uiLanguage());
  // Tab capture exists only in Chromium browsers
  state.canCapture = Boolean(chrome.tabCapture && chrome.tabCapture.getMediaStreamId);
  state.mode = state.canCapture ? loaded.mode : 'page';

  buildFineTune();
  buildCaptionOptions();
  bindEvents();
  renderAll();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    drawTraces();
    drawEqCurve();
  });

  if (state.tabId && !state.restricted) {
    chrome.tabs.sendMessage(state.tabId, { action: 'get-crt-visual' })
      .then(r => { state.crt = Boolean(r && r.enabled); renderControls(); })
      .catch(() => {});
  }
  refreshCaptions();
  setInterval(refreshTabStatus, STATUS_INTERVAL_MS);
  // Meters come from the frame (or capture) the status finds, so the first poll waits for it
  // instead of polling empty-handed and trying again a timer tick later
  try {
    await refreshTabStatus();
  } finally {
    pollMeters();
  }
  if (state.mode === 'capture' && state.enabled && !state.restricted && !state.captured) captureCurrentTab();
}

init();
