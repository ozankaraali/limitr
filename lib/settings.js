// Limitr settings: defaults, presets, control ranges, and storage helpers.
// Shared by popup, background, content bridge, offscreen document and tests.

(function (root) {
  'use strict';

  const STORAGE_KEYS = {
    settings: 'limitrSettings',
    enabled: 'limitrEnabled',
    mode: 'limitrMode',          // 'page' (works everywhere) | 'capture' (Chrome tab capture)
    preset: 'limitrPreset',      // id of the last applied preset
    customPresets: 'limitrUserPresets',
    ui: 'limitrUi',
    captions: 'limitrCaptions'   // { language: 'auto' | code, translateTo: '' | code, largeModel }
  };

  const DEFAULTS = {
    // Final volume (dB), applied after the guard and limiter: it changes loudness, not taming.
    volume: 0,

    // Spike guard: learns the stream's normal loudness, pulls sudden jumps back down.
    guardEnabled: true,
    guardHeadroom: 4,        // dB above the stream's normal peaks before taming starts
    guardMemory: 60,         // s a loud stretch counts as a spike before it's the new normal
    guardRatio: 10,
    guardAttack: 5,          // ms
    guardHold: 150,          // ms
    guardRelease: 800,       // ms

    // Comfortable level: anything louder is turned down to it (within about a second);
    // quieter streams are left alone unless levelMaxBoost lifts them a little
    levelEnabled: false,
    levelTarget: -20,
    levelMaxCut: 24,
    levelMaxBoost: 0,

    // Brickwall limiter (true sample-peak ceiling)
    limiterEnabled: true,
    limiterCeiling: -1,
    limiterRelease: 80,

    // Classic compressor (optional; makeup gain is compensated so it never boosts quiet audio)
    compressorEnabled: false,
    compThreshold: -24,
    compRatio: 3,
    compKnee: 6,
    compAttack: 10,
    compRelease: 200,
    compMakeup: 0,

    // Tone: low/high cut + 5-band EQ
    toneEnabled: false,
    lowCut: 0,               // Hz, 0 = off
    highCut: 20000,          // Hz, >= 20000 = off
    eq1Type: 'lowshelf', eq1Freq: 100, eq1Gain: 0, eq1Q: 0.7,
    eq2Type: 'peaking', eq2Freq: 300, eq2Gain: 0, eq2Q: 1,
    eq3Type: 'peaking', eq3Freq: 1000, eq3Gain: 0, eq3Q: 1,
    eq4Type: 'peaking', eq4Freq: 3500, eq4Gain: 0, eq4Q: 1,
    eq5Type: 'highshelf', eq5Freq: 8000, eq5Gain: 0, eq5Q: 0.7,

    // Extras
    denoiseEnabled: false,   // RNNoise
    monoEnabled: false,
    noiseLevel: 0,           // lo-fi background noise (linear, 0..0.3)
    noiseType: 'brown'
  };

  const OFF_SETTINGS = {
    guardEnabled: false,
    levelEnabled: false,
    limiterEnabled: false,
    compressorEnabled: false,
    toneEnabled: false,
    denoiseEnabled: false,
    monoEnabled: false,
    noiseLevel: 0
  };

  const NEUTRAL_TONE = {
    lowCut: 0, highCut: 20000,
    eq1Type: 'lowshelf', eq1Freq: 100, eq1Gain: 0, eq1Q: 0.7,
    eq2Type: 'peaking', eq2Freq: 300, eq2Gain: 0, eq2Q: 1,
    eq3Type: 'peaking', eq3Freq: 1000, eq3Gain: 0, eq3Q: 1,
    eq4Type: 'peaking', eq4Freq: 3500, eq4Gain: 0, eq4Q: 1,
    eq5Type: 'highshelf', eq5Freq: 8000, eq5Gain: 0, eq5Q: 0.7
  };

  // Presets only describe processing; they never touch the user's volume.
  const PRESETS = {
    off: {
      name: 'Off',
      desc: 'No processing',
      settings: { ...OFF_SETTINGS, ...NEUTRAL_TONE }
    },
    gentle: {
      name: 'Gentle',
      desc: 'Only big surprises',
      settings: {
        guardEnabled: true, guardHeadroom: 7, guardMemory: 15, guardRatio: 10,
        guardAttack: 6, guardHold: 100, guardRelease: 600,
        levelEnabled: true, levelTarget: -14, levelMaxCut: 24, levelMaxBoost: 0,
        limiterEnabled: true, limiterCeiling: -1, limiterRelease: 80,
        compressorEnabled: false, toneEnabled: false, denoiseEnabled: false,
        monoEnabled: false, noiseLevel: 0, ...NEUTRAL_TONE
      }
    },
    stream: {
      name: 'Stream',
      desc: 'Alerts & yelling',
      settings: {
        guardEnabled: true, guardHeadroom: 3, guardMemory: 60, guardRatio: 20,
        guardAttack: 3, guardHold: 200, guardRelease: 1000,
        levelEnabled: true, levelTarget: -20, levelMaxCut: 24, levelMaxBoost: 0,
        limiterEnabled: true, limiterCeiling: -3, limiterRelease: 80,
        compressorEnabled: false, toneEnabled: false, denoiseEnabled: false,
        monoEnabled: false, noiseLevel: 0, ...NEUTRAL_TONE
      }
    },
    sleep: {
      name: 'Sleep',
      desc: 'Quiet & even',
      settings: {
        guardEnabled: true, guardHeadroom: 2.5, guardMemory: 300, guardRatio: 20,
        guardAttack: 2, guardHold: 300, guardRelease: 1500,
        levelEnabled: true, levelTarget: -28, levelMaxCut: 24, levelMaxBoost: 6,
        limiterEnabled: true, limiterCeiling: -6, limiterRelease: 100,
        compressorEnabled: false, denoiseEnabled: false, monoEnabled: false, noiseLevel: 0,
        // Soften rumble and harsh highs that cut through at night
        toneEnabled: true, ...NEUTRAL_TONE,
        lowCut: 60, eq5Type: 'highshelf', eq5Freq: 6000, eq5Gain: -4, eq5Q: 0.7
      }
    },
    movie: {
      name: 'Movie',
      desc: 'Tame explosions',
      settings: {
        guardEnabled: true, guardHeadroom: 4, guardMemory: 30, guardRatio: 20,
        guardAttack: 5, guardHold: 150, guardRelease: 900,
        levelEnabled: true, levelTarget: -18, levelMaxCut: 24, levelMaxBoost: 0,
        limiterEnabled: true, limiterCeiling: -2, limiterRelease: 80,
        compressorEnabled: false, toneEnabled: false, denoiseEnabled: false,
        monoEnabled: false, noiseLevel: 0, ...NEUTRAL_TONE
      }
    },
    tv90s: {
      name: '90s TV',
      desc: 'Warm CRT sound',
      settings: {
        guardEnabled: true, guardHeadroom: 6.5, guardMemory: 60, guardRatio: 8,
        guardAttack: 5, guardHold: 150, guardRelease: 800,
        levelEnabled: true, levelTarget: -20, levelMaxCut: 24, levelMaxBoost: 0,
        limiterEnabled: true, limiterCeiling: -2, limiterRelease: 80,
        compressorEnabled: true, compThreshold: -22, compRatio: 4, compKnee: 6,
        compAttack: 4, compRelease: 150, compMakeup: 0,
        denoiseEnabled: false, monoEnabled: false,
        toneEnabled: true, ...NEUTRAL_TONE, lowCut: 180, highCut: 7500,
        eq3Gain: 2, eq3Freq: 1500, eq3Q: 0.8,
        noiseLevel: 0.015, noiseType: 'brown'
      }
    }
  };

  const PRESET_ORDER = ['off', 'gentle', 'stream', 'sleep', 'movie', 'tv90s'];
  const DEFAULT_PRESET = 'stream';

  // Control ranges, shared by UI and normalize()
  const RANGES = {
    volume: [-30, 12, 0.5],
    guardHeadroom: [1, 15, 0.5],
    guardMemory: [5, 300, 5],
    guardRatio: [2, 20, 1],
    guardAttack: [1, 20, 0.5],
    guardHold: [0, 500, 10],
    guardRelease: [100, 3000, 50],
    levelTarget: [-36, -10, 1],
    levelMaxCut: [0, 30, 1],
    levelMaxBoost: [0, 15, 1],
    limiterCeiling: [-12, 0, 0.5],
    limiterRelease: [20, 500, 10],
    compThreshold: [-50, 0, 1],
    compRatio: [1, 20, 0.5],
    compKnee: [0, 30, 1],
    compAttack: [0.5, 100, 0.5],
    compRelease: [20, 1000, 10],
    compMakeup: [-12, 12, 0.5],
    lowCut: [0, 300, 5],
    highCut: [2000, 20000, 250],
    noiseLevel: [0, 0.3, 0.005],
    eqFreq: [20, 20000, 1],
    eqGain: [-15, 15, 0.5],
    eqQ: [0.1, 10, 0.1]
  };

  const EQ_TYPES = ['lowshelf', 'peaking', 'highshelf', 'lowpass', 'highpass', 'notch'];
  const NOISE_TYPES = ['white', 'pink', 'brown'];

  // Caption languages, by Whisper language code; names in their own language.
  // English is transcribed live by Moonshine, everything else by Whisper.
  const CAPTION_LANGUAGES = [
    ['en', 'English'], ['tr', 'Türkçe'], ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français'],
    ['it', 'Italiano'], ['pt', 'Português'], ['nl', 'Nederlands'], ['pl', 'Polski'], ['ru', 'Русский'],
    ['uk', 'Українська'], ['ar', 'العربية'], ['hi', 'हिन्दी'], ['ja', '日本語'], ['ko', '한국어'], ['zh', '中文']
  ];
  const CAPTION_CODES = CAPTION_LANGUAGES.map(([code]) => code);

  // English speakers keep the fast English engine by default; everyone else starts on Auto
  function defaultCaptions(uiLanguage) {
    const ui = String(uiLanguage || '').toLowerCase();
    return { language: ui.startsWith('en') ? 'en' : 'auto', translateTo: '', largeModel: false };
  }

  function normalizeCaptions(prefs, uiLanguage) {
    const out = defaultCaptions(uiLanguage);
    if (!prefs || typeof prefs !== 'object') return out;
    if (prefs.language === 'auto' || CAPTION_CODES.includes(prefs.language)) out.language = prefs.language;
    if (prefs.translateTo === '' || CAPTION_CODES.includes(prefs.translateTo)) out.translateTo = prefs.translateTo;
    out.largeModel = prefs.largeModel === true;
    return out;
  }

  function rangeFor(key) {
    if (RANGES[key]) return RANGES[key];
    const m = /^eq[1-5](Freq|Gain|Q)$/.exec(key);
    return m ? RANGES['eq' + m[1]] : null;
  }

  function normalize(input) {
    const out = { ...DEFAULTS };
    if (!input || typeof input !== 'object') return out;
    for (const key of Object.keys(DEFAULTS)) {
      const value = input[key];
      if (value === undefined || value === null) continue;
      const def = DEFAULTS[key];
      if (typeof def === 'boolean') {
        out[key] = Boolean(value);
      } else if (typeof def === 'number') {
        const num = Number(value);
        if (!Number.isFinite(num)) continue;
        const range = rangeFor(key);
        out[key] = range ? Math.min(range[1], Math.max(range[0], num)) : num;
      } else if (/^eq[1-5]Type$/.test(key)) {
        if (EQ_TYPES.includes(value)) out[key] = value;
      } else if (key === 'noiseType') {
        if (NOISE_TYPES.includes(value)) out[key] = value;
      }
    }
    return out;
  }

  function presetSettings(id, customPresets) {
    const preset = PRESETS[id] || (customPresets && customPresets[id]);
    if (!preset) return null;
    return preset.settings;
  }

  // Apply a preset on top of current settings, keeping the user's volume.
  function applyPreset(current, id, customPresets) {
    const settings = presetSettings(id, customPresets);
    if (!settings) return normalize(current);
    return normalize({ ...DEFAULTS, ...settings, volume: current ? current.volume : DEFAULTS.volume });
  }

  // Which preset (if any) matches the current settings exactly (ignoring volume)
  function matchPreset(settings, customPresets) {
    const all = { ...PRESETS, ...(customPresets || {}) };
    for (const id of Object.keys(all)) {
      const expected = normalize({ ...DEFAULTS, ...all[id].settings, volume: settings.volume });
      let same = true;
      for (const key of Object.keys(DEFAULTS)) {
        if (expected[key] !== settings[key]) { same = false; break; }
      }
      if (same) return id;
    }
    return null;
  }

  const GUARD_KEYS = [
    'guardEnabled', 'guardHeadroom', 'guardMemory', 'guardRatio', 'guardAttack', 'guardHold', 'guardRelease',
    'levelEnabled', 'levelTarget', 'levelMaxCut', 'levelMaxBoost'
  ];

  // ---- Legacy (v1.x) migration ----
  // Old compressor/limiter values were tuned around DynamicsCompressorNode's hidden makeup gain
  // (v1's limiter was a 20:1 compressor, not a brickwall), so they are not carried over; the
  // spike guard and limiter come from the preset. Volume, tone and extras do carry over.
  function migrateLegacySettings(old) {
    if (!old || typeof old !== 'object') return null;
    const m = {};
    if (typeof old.outputGain === 'number') m.volume = old.outputGain;
    if (typeof old.noiseSuppressionEnabled === 'boolean') m.denoiseEnabled = old.noiseSuppressionEnabled;
    if (typeof old.monoMixEnabled === 'boolean') m.monoEnabled = old.monoMixEnabled;
    if (old.effectsEnabled && typeof old.noiseLevel === 'number') m.noiseLevel = old.noiseLevel;
    if (typeof old.noiseType === 'string') m.noiseType = old.noiseType;
    if (old.eqEnabled || old.filtersEnabled) {
      m.toneEnabled = true;
      for (let i = 1; i <= 5; i++) {
        for (const p of ['Type', 'Freq', 'Gain', 'Q']) {
          if (old[`eq${i}${p}`] !== undefined && old.eqEnabled) m[`eq${i}${p}`] = old[`eq${i}${p}`];
        }
      }
      if (old.filtersEnabled) {
        if (old.bassCutFreq > 20) m.lowCut = old.bassCutFreq;
        if (old.trebleCutFreq < 20000) m.highCut = old.trebleCutFreq;
      }
    }
    return m;
  }

  // v1 custom presets were flat objects ({ name, ...settings }) keyed by id
  function migrateLegacyCustomPresets(old) {
    const out = {};
    if (!old || typeof old !== 'object') return out;
    for (const [id, preset] of Object.entries(old)) {
      if (!preset || typeof preset !== 'object') continue;
      const migrated = migrateLegacySettings(preset) || {};
      delete migrated.volume;
      out[id] = {
        name: String(preset.name || 'Custom').slice(0, 40),
        desc: 'Custom',
        settings: normalize({ ...DEFAULTS, ...PRESETS[DEFAULT_PRESET].settings, ...migrated })
      };
    }
    return out;
  }

  // Read state from storage (new keys, falling back to legacy keys). `area` is chrome.storage.local.
  async function load(area) {
    const stored = await area.get([
      STORAGE_KEYS.settings, STORAGE_KEYS.enabled, STORAGE_KEYS.mode, STORAGE_KEYS.preset,
      // legacy
      'limitrCurrentSettings', 'limitrFallbackSettings', 'limitrGlobalEnabled', 'limitrMixerMode'
    ]);

    let settings = stored[STORAGE_KEYS.settings];
    let preset = stored[STORAGE_KEYS.preset];
    if (settings && settings.guardMemory === undefined) {
      // 2.0 settings: the guard and comfortable level work differently now, so they come from
      // the preset; the listener's volume, tone and extras stay
      const fresh = (PRESETS[preset] || PRESETS[DEFAULT_PRESET]).settings;
      settings = { ...settings };
      for (const key of GUARD_KEYS) settings[key] = fresh[key] !== undefined ? fresh[key] : DEFAULTS[key];
    }
    if (!settings) {
      // The preset's spike guard, with the listener's volume, tone and extras from 1.x on top
      const legacy = migrateLegacySettings(stored.limitrCurrentSettings || stored.limitrFallbackSettings) || {};
      settings = normalize({ ...applyPreset({ volume: 0 }, preset || DEFAULT_PRESET), ...legacy });
      preset = matchPreset(settings);
    }

    let enabled = stored[STORAGE_KEYS.enabled];
    if (typeof enabled !== 'boolean') enabled = stored.limitrGlobalEnabled !== false;

    let mode = stored[STORAGE_KEYS.mode];
    if (mode !== 'page' && mode !== 'capture') mode = stored.limitrMixerMode ? 'capture' : 'page';

    return { settings: normalize(settings), enabled, mode, preset: preset || null };
  }

  root.LimitrSettings = {
    STORAGE_KEYS,
    DEFAULTS,
    PRESETS,
    PRESET_ORDER,
    DEFAULT_PRESET,
    RANGES,
    EQ_TYPES,
    NOISE_TYPES,
    rangeFor,
    normalize,
    applyPreset,
    matchPreset,
    presetSettings,
    migrateLegacySettings,
    migrateLegacyCustomPresets,
    load,
    CAPTION_LANGUAGES,
    defaultCaptions,
    normalizeCaptions
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
