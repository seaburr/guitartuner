(function () {
  'use strict';

  const LOOP_INTERVAL_MS = 2400; // how often a looping string is replucked
  const PLUCK_SECONDS = 2.5;     // length of each synthesized pluck
  const VIS_HZ = 7;              // visual vibration rate of the drawn string
  const VIS_DECAY_S = 0.9;       // visual decay time constant
  const VIS_AMP = 16;            // max string displacement in pixels
  const MIC_INTERVAL_MS = 120;   // how often the microphone is analysed
  const IN_TUNE_CENTS = 5;       // |cents| within this counts as in tune
  const MAX_METER_CENTS = 50;    // meter full scale on each side

  const KEY_CUSTOM = 'guitar-tuner.custom';
  const KEY_LAST = 'guitar-tuner.last';
  const DEFAULT_NOTES = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];

  const W = 960, H = 320;
  const X0 = 110, X1 = 920;      // nut and far end of the neck
  const Y_TOP = 60, Y_BOTTOM = 260;

  const canvas = document.getElementById('neck');
  const g = canvas.getContext('2d');
  const tuningSelect = document.getElementById('tuning');
  const volumeInput = document.getElementById('volume');
  const stopBtn = document.getElementById('stop');
  const statusEl = document.getElementById('status');
  const stringsEl = document.getElementById('strings');
  const micToggle = document.getElementById('mic-toggle');
  const meterNeedle = document.getElementById('meter-needle');
  const meterReadout = document.getElementById('meter-readout');
  const customCount = document.getElementById('custom-count');
  const customInputs = document.getElementById('custom-inputs');
  const customForm = document.getElementById('custom-form');
  const customClear = document.getElementById('custom-clear');
  const customError = document.getElementById('custom-error');

  let custom = null;      // saved custom tuning, or null
  let tuning = Tunings.getTuning('standard');
  let freqs = [];
  let loop = null;        // index of the looping string, or null
  let loopTimer = null;
  let vib = [];           // per string: time (ms) of last pluck, or -1e9

  // ---- Storage (localStorage can be blocked; fail quietly) ----------------
  function loadCustom() {
    try {
      const raw = window.localStorage.getItem(KEY_CUSTOM);
      if (!raw) return null;
      return Tunings.makeCustomTuning(JSON.parse(raw));
    } catch (e) {
      return null;
    }
  }

  function saveCustom(notes) {
    try {
      window.localStorage.setItem(KEY_CUSTOM, JSON.stringify(notes));
      return true;
    } catch (e) {
      return false;
    }
  }

  function removeCustom() {
    try { window.localStorage.removeItem(KEY_CUSTOM); } catch (e) { /* ignore */ }
  }

  function loadLast() {
    try { return window.localStorage.getItem(KEY_LAST); } catch (e) { return null; }
  }

  function saveLast(id) {
    try { window.localStorage.setItem(KEY_LAST, id); } catch (e) { /* ignore */ }
  }

  function allTunings() {
    return custom ? Tunings.TUNINGS.concat([custom]) : Tunings.TUNINGS;
  }

  function findTuning(id) {
    return allTunings().find((t) => t.id === id) || null;
  }

  function label(note) {
    return note.replace('#', '\u266F').replace(/b(?=\d)/, '\u266D');
  }

  // ---- Audio -------------------------------------------------------------
  let ctx = null;
  let master = null;

  function ensureAudio() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio is not supported in this browser.');
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = parseFloat(volumeInput.value);
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  // A plucked-string-like tone: a triangle fundamental, a quieter octave
  // partial, and an exponential decay.
  function playTone(freq) {
    const t = ctx.currentTime;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, t + PLUCK_SECONDS);
    env.connect(master);

    const fund = ctx.createOscillator();
    fund.type = 'triangle';
    fund.frequency.value = freq;
    fund.connect(env);

    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.value = freq * 2;
    const partialGain = ctx.createGain();
    partialGain.gain.value = 0.25;
    partial.connect(partialGain);
    partialGain.connect(env);

    fund.start(t);
    partial.start(t);
    fund.stop(t + PLUCK_SECONDS + 0.05);
    partial.stop(t + PLUCK_SECONDS + 0.05);
  }

  // ---- Playback state ----------------------------------------------------
  function pluck(i) {
    ensureAudio();
    playTone(freqs[i]);
    vib[i] = performance.now();
  }

  function stopLoop() {
    if (loopTimer !== null) clearInterval(loopTimer);
    loopTimer = null;
    loop = null;
    updateUi();
  }

  function startLoop(i) {
    stopLoop();
    loop = i;
    pluck(i);
    loopTimer = setInterval(() => pluck(i), LOOP_INTERVAL_MS);
    updateUi();
  }

  function toggleString(i) {
    if (loop === i) {
      stopLoop();
    } else {
      startLoop(i);
    }
  }

  // ---- UI ----------------------------------------------------------------
  function updateUi() {
    const buttons = stringsEl.querySelectorAll('.string-btn');
    buttons.forEach((btn, i) => {
      btn.setAttribute('aria-pressed', i === loop ? 'true' : 'false');
    });
    if (loop === null) {
      statusEl.textContent = 'Click a string to hear it. Click it again to stop.';
    } else {
      const note = tuning.notes[loop];
      statusEl.textContent =
        'Looping ' + label(note) + ' (' + freqs[loop].toFixed(2) + ' Hz). ' +
        'Click it again, pick another string, or press Esc to stop.';
    }
  }

  function buildStringButtons() {
    stringsEl.innerHTML = '';
    stringsEl.style.setProperty('--cols', String(tuning.notes.length));
    tuning.notes.forEach((note, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'string-btn';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'String ' + (i + 1) + ', ' + label(note));
      btn.innerHTML =
        '<span class="note"></span>' +
        '<span class="freq"></span>' +
        '<span class="key">key ' + (i + 1) + '</span>';
      btn.querySelector('.note').textContent = label(note);
      btn.querySelector('.freq').textContent = freqs[i].toFixed(2) + ' Hz';
      btn.addEventListener('click', () => toggleString(i));
      stringsEl.appendChild(btn);
    });
  }

  function setTuning(id) {
    const found = findTuning(id) || Tunings.getTuning('standard');
    stopLoop();
    tuning = found;
    freqs = tuning.notes.map((n) => Tunings.noteToFreq(n));
    vib = tuning.notes.map(() => -1e9);
    tuningSelect.value = tuning.id;
    saveLast(tuning.id);
    buildStringButtons();
    fillEditor(tuning.notes);
    updateUi();
  }

  function makeOption(value, text) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    return opt;
  }

  function populateTunings() {
    tuningSelect.innerHTML = '';
    Tunings.INSTRUMENTS.forEach((inst) => {
      const group = document.createElement('optgroup');
      group.label = inst.label;
      Tunings.TUNINGS.filter((t) => t.instrument === inst.id).forEach((t) => {
        group.appendChild(makeOption(t.id, t.name));
      });
      tuningSelect.appendChild(group);
    });
    if (custom) {
      const group = document.createElement('optgroup');
      group.label = 'Your tuning';
      group.appendChild(makeOption(custom.id, custom.name));
      tuningSelect.appendChild(group);
    }
  }

  // ---- Custom tuning editor ----------------------------------------------
  function buildCountOptions() {
    customCount.innerHTML = '';
    for (let n = Tunings.MIN_STRINGS; n <= Tunings.MAX_STRINGS; n++) {
      customCount.appendChild(makeOption(String(n), n + ' strings'));
    }
  }

  // Rebuilds the note inputs for the given notes (padded or cut to the count).
  function fillEditor(notes) {
    const count = Math.min(Tunings.MAX_STRINGS, Math.max(Tunings.MIN_STRINGS, notes.length));
    customCount.value = String(count);
    customInputs.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const value = notes[i] !== undefined ? notes[i] : DEFAULT_NOTES[i];
      const wrap = document.createElement('label');
      wrap.textContent = 'String ' + (i + 1);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'custom-note';
      input.value = value;
      input.maxLength = 4;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', 'Note for string ' + (i + 1));
      wrap.appendChild(input);
      customInputs.appendChild(wrap);
    }
    customError.textContent = '';
  }

  function readEditorNotes() {
    return Array.from(customInputs.querySelectorAll('.custom-note')).map((input) => {
      const s = input.value.trim();
      return s.charAt(0).toUpperCase() + s.slice(1);
    });
  }

  customCount.addEventListener('change', () => {
    const current = readEditorNotes();
    const count = parseInt(customCount.value, 10);
    const next = [];
    for (let i = 0; i < count; i++) next.push(current[i] !== undefined ? current[i] : DEFAULT_NOTES[i]);
    fillEditor(next);
  });

  customForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const notes = readEditorNotes();
    const err = Tunings.validateNotes(notes);
    if (err) {
      customError.textContent = err;
      return;
    }
    if (!saveCustom(notes)) {
      customError.textContent = 'Could not save in this browser. The tuning will last until you reload.';
    }
    custom = Tunings.makeCustomTuning(notes);
    populateTunings();
    setTuning(custom.id);
    customError.textContent = '';
  });

  customClear.addEventListener('click', () => {
    removeCustom();
    custom = null;
    populateTunings();
    if (tuning.id === Tunings.CUSTOM_ID) {
      setTuning('standard');
    } else {
      fillEditor(tuning.notes);
    }
    customError.textContent = 'Saved custom tuning deleted.';
  });

  // ---- Tuning meter (microphone) ----------------------------------------
  let micStream = null;
  let micStarting = false;
  let micSource = null;
  let analyser = null;
  let micBuf = null;
  let micTimer = null;

  function setReadout(text) {
    meterReadout.textContent = text;
  }

  function showNeedle(cents) {
    if (cents === null) {
      meterNeedle.classList.remove('on', 'good');
      return;
    }
    const c = Math.max(-MAX_METER_CENTS, Math.min(MAX_METER_CENTS, cents));
    meterNeedle.style.left = (50 + (c / MAX_METER_CENTS) * 50) + '%';
    meterNeedle.classList.add('on');
    meterNeedle.classList.toggle('good', Math.abs(cents) <= IN_TUNE_CENTS);
  }

  function sampleMic() {
    if (!analyser) return;
    analyser.getFloatTimeDomainData(micBuf);
    const freq = Pitch.detectPitch(micBuf, ctx.sampleRate);
    if (freq === null) {
      showNeedle(null);
      setReadout('No clear note yet. Play a string closer to the microphone.');
      return;
    }
    const i = Pitch.nearestString(freq, freqs);
    const cents = Pitch.centsBetween(freq, freqs[i]);
    const name = label(tuning.notes[i]);
    if (Math.abs(cents) > 100) {
      showNeedle(null);
      setReadout('Heard ' + freq.toFixed(1) + ' Hz, which is not close to any string in this tuning.');
      return;
    }
    showNeedle(cents);
    const rounded = Math.round(cents);
    let verdict;
    if (Math.abs(cents) <= IN_TUNE_CENTS) verdict = 'in tune';
    else verdict = Math.abs(rounded) + ' cents ' + (cents > 0 ? 'sharp' : 'flat');
    setReadout(name + ': ' + freq.toFixed(1) + ' Hz, ' + verdict + '.');
  }

  async function startMic() {
    if (micStream || micStarting) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setReadout('This browser cannot open the microphone.');
      return;
    }
    micStarting = true;
    setReadout('Asking for microphone access...');
    try {
      ensureAudio();
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      micStream = null;
      setReadout('Microphone not available: ' + (e && e.message ? e.message : 'permission denied') + '.');
      micStarting = false;
      return;
    }
    micStarting = false;
    micSource = ctx.createMediaStreamSource(micStream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    micSource.connect(analyser);
    micBuf = new Float32Array(analyser.fftSize);
    micToggle.textContent = 'Stop microphone';
    micTimer = setInterval(sampleMic, MIC_INTERVAL_MS);
    setReadout('Listening. Play a string.');
  }

  function stopMic() {
    if (micTimer !== null) clearInterval(micTimer);
    micTimer = null;
    if (micStream) micStream.getTracks().forEach((t) => t.stop());
    if (micSource) micSource.disconnect();
    micStream = null;
    micSource = null;
    analyser = null;
    micToggle.textContent = 'Start microphone';
    showNeedle(null);
    setReadout('Microphone is off.');
  }

  micToggle.addEventListener('click', () => {
    if (micStream) stopMic(); else startMic();
  });

  // ---- Drawing -----------------------------------------------------------
  function stringY(i) {
    // index 0 (lowest pitch) is drawn at the bottom
    const n = tuning.notes.length;
    return Y_BOTTOM - i * (Y_BOTTOM - Y_TOP) / (n - 1);
  }

  function drawNeck() {
    g.clearRect(0, 0, W, H);

    // fretboard
    g.fillStyle = '#3b2a1c';
    roundRect(g, 40, 30, W - 70, H - 60, 12);
    g.fill();

    // frets
    const fretCount = 6;
    for (let n = 1; n <= fretCount; n++) {
      const x = X0 + (X1 - X0) * n / fretCount;
      g.strokeStyle = '#b9b2a4';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, Y_TOP - 22);
      g.lineTo(x, Y_BOTTOM + 22);
      g.stroke();
    }

    // position dots (frets 3 and 5, drawn between wires)
    g.fillStyle = 'rgba(240,230,210,0.35)';
    [2.5, 4.5].forEach((f) => {
      const x = X0 + (X1 - X0) * f / 6;
      g.beginPath();
      g.arc(x, (Y_TOP + Y_BOTTOM) / 2, 9, 0, Math.PI * 2);
      g.fill();
    });

    // nut
    g.fillStyle = '#efe6d2';
    g.fillRect(X0 - 8, Y_TOP - 24, 8, Y_BOTTOM - Y_TOP + 48);

    const now = performance.now();
    const n = tuning.notes.length;
    tuning.notes.forEach((note, i) => {
      const y0 = stringY(i);
      const t = (now - vib[i]) / 1000;
      const amp = t >= 0 ? VIS_AMP * Math.exp(-t / VIS_DECAY_S) : 0;
      const active = i === loop;

      // string, thicker for the wound low strings
      g.strokeStyle = i < Math.floor(n / 2) ? '#c9a465' : '#e4dccb';
      g.lineWidth = Math.max(1.2, 3.4 - i * 0.4);
      g.beginPath();
      for (let x = X0; x <= X1; x += 6) {
        let dy = 0;
        if (amp > 0.2) {
          dy = amp * Math.sin(Math.PI * (x - X0) / (X1 - X0)) *
               Math.sin(2 * Math.PI * VIS_HZ * t);
        }
        if (x === X0) g.moveTo(x, y0 + dy); else g.lineTo(x, y0 + dy);
      }
      g.stroke();

      // label on the left
      g.fillStyle = active ? '#e0a040' : '#f1ebe0';
      g.font = '600 20px system-ui, sans-serif';
      g.textAlign = 'right';
      g.textBaseline = 'middle';
      g.fillText(label(note), 62, y0);

      // active indicator: glow ring at the string's end
      if (active) {
        g.beginPath();
        g.arc(X1 + 26, y0, 10, 0, Math.PI * 2);
        g.fillStyle = '#e0a040';
        g.fill();
      }
    });
  }

  function roundRect(ctx2, x, y, w, h, r) {
    ctx2.beginPath();
    ctx2.moveTo(x + r, y);
    ctx2.arcTo(x + w, y, x + w, y + h, r);
    ctx2.arcTo(x + w, y + h, x, y + h, r);
    ctx2.arcTo(x, y + h, x, y, r);
    ctx2.arcTo(x, y, x + w, y, r);
    ctx2.closePath();
  }

  function frame() {
    drawNeck();
    requestAnimationFrame(frame);
  }

  // ---- Input -------------------------------------------------------------
  function stringAtPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * W / rect.width;
    const y = (clientY - rect.top) * H / rect.height;
    if (x < X0 - 30 || x > X1 + 40) return -1;
    let best = -1, bestDist = Infinity;
    tuning.notes.forEach((_, i) => {
      const d = Math.abs(y - stringY(i));
      if (d < bestDist) { best = i; bestDist = d; }
    });
    const band = (Y_BOTTOM - Y_TOP) / (tuning.notes.length - 1) / 2 + 4;
    return bestDist <= band ? best : -1;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const i = stringAtPoint(e.clientX, e.clientY);
    if (i >= 0) toggleString(i);
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (!tabChords.hidden) return; // tuner keys do nothing on the Chords tab
    if (e.key >= '1' && e.key <= '6') {
      const i = parseInt(e.key, 10) - 1;
      if (i < tuning.notes.length) {
        e.preventDefault();
        toggleString(i);
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Left/right switch to the neighbouring note and loop it.
      const n = tuning.notes.length;
      const cur = loop === null ? -1 : loop;
      let next;
      if (cur < 0) next = e.key === 'ArrowLeft' ? n - 1 : 0;
      else next = e.key === 'ArrowLeft' ? Math.max(0, cur - 1) : Math.min(n - 1, cur + 1);
      e.preventDefault();
      if (next !== loop) startLoop(next);
    } else if (e.key === 'Escape' || (e.key === ' ' && tag !== 'BUTTON')) {
      e.preventDefault();
      stopLoop();
    }
  });

  volumeInput.addEventListener('input', () => {
    if (master) master.gain.value = parseFloat(volumeInput.value);
  });

  stopBtn.addEventListener('click', stopLoop);

  tuningSelect.addEventListener('change', () => setTuning(tuningSelect.value));

  // ---- Tabs --------------------------------------------------------------
  const tabBtnTuner = document.getElementById('tab-btn-tuner');
  const tabBtnChords = document.getElementById('tab-btn-chords');
  const tabTuner = document.getElementById('tab-tuner');
  const tabChords = document.getElementById('tab-chords');

  function showTab(name) {
    const isChords = name === 'chords';
    tabTuner.hidden = isChords;
    tabChords.hidden = !isChords;
    tabBtnTuner.setAttribute('aria-selected', String(!isChords));
    tabBtnChords.setAttribute('aria-selected', String(isChords));
    tabBtnTuner.tabIndex = isChords ? -1 : 0;
    tabBtnChords.tabIndex = isChords ? 0 : -1;
    if (isChords) {
      stopLoop();
    } else {
      stopProgression();
    }
  }

  tabBtnTuner.addEventListener('click', () => showTab('tuner'));
  tabBtnChords.addEventListener('click', () => showTab('chords'));

  // ---- Chords tab --------------------------------------------------------
  const STANDARD_FREQS = Tunings.getTuning('standard').notes.map((n) => Tunings.noteToFreq(n));
  const STRUM_GAP_MS = 35;   // delay between strings when strumming
  const PROG_STEP_MS = 1400; // time per chord when playing a progression
  const chordGrid = document.getElementById('chord-grid');
  const capoSelect = document.getElementById('capo');
  const capoNote = document.getElementById('capo-note');
  const progKey = document.getElementById('prog-key');
  const progSelect = document.getElementById('prog-select');
  const progPlay = document.getElementById('prog-play');
  const progNote = document.getElementById('prog-note');
  const progChords = document.getElementById('prog-chords');
  const progStatus = document.getElementById('prog-status');
  let progList = [];   // chords of the shown progression
  let progTimers = [];
  let capo = 0;        // capo fret, 0 for none

  // SVG fret diagram. `frets` are the physical frets (already moved up by the
  // capo), so the neck drawn is the one you see. With a capo the capo is drawn
  // as a bar, and the window starts at the capo when the chord is high up.
  function chordSvg(frets, capoFret) {
    const x0 = 22, dx = 13.2, top = 28, dy = 18, rows = 4;
    const right = x0 + 5 * dx;
    const fretted = frets.filter((p) => p !== null && p > capoFret);
    const maxP = fretted.length ? Math.max(...fretted) : 0;
    const minP = fretted.length ? Math.min(...fretted) : 1;
    let start = 1;
    if (maxP > rows) start = capoFret > 0 ? capoFret : minP;
    const rowOf = (p) => p - start + 1;
    const rowY = (r) => top + (r - 0.5) * dy;

    let s = '<svg viewBox="0 0 110 110" role="img" aria-hidden="true">';
    if (start > 1) {
      s += '<text x="2" y="' + (rowY(1) + 4) + '" font-size="11" fill="#f1ebe0">' + start + 'fr</text>';
    }
    frets.forEach((p, i) => {
      const x = x0 + i * dx;
      if (p === null) {
        s += '<text class="chord-diagram-mark" x="' + x + '" y="14">x</text>';
      } else if (p === 0) {
        s += '<circle cx="' + x + '" cy="10" r="3.5" fill="none" stroke="#f1ebe0" stroke-width="1.3"/>';
      }
    });
    if (start === 1) {
      s += '<line class="chord-diagram-nut" x1="' + x0 + '" y1="' + top + '" x2="' + right + '" y2="' + top + '"/>';
    } else {
      s += '<line class="chord-diagram-line" x1="' + x0 + '" y1="' + top + '" x2="' + right + '" y2="' + top + '"/>';
    }
    for (let r = 1; r <= rows; r++) {
      const y = top + r * dy;
      s += '<line class="chord-diagram-line" x1="' + x0 + '" y1="' + y + '" x2="' + right + '" y2="' + y + '"/>';
    }
    frets.forEach((_, i) => {
      const x = x0 + i * dx;
      s += '<line class="chord-diagram-string" x1="' + x + '" y1="' + top + '" x2="' + x + '" y2="' + (top + rows * dy) + '"/>';
    });
    if (capoFret > 0 && capoFret >= start && capoFret < start + rows) {
      const y = rowY(rowOf(capoFret));
      s += '<line x1="' + (x0 - 4) + '" y1="' + y + '" x2="' + (right + 4) + '" y2="' + y +
           '" stroke="#e0a040" stroke-width="5" stroke-linecap="round"/>';
    }
    frets.forEach((p, i) => {
      if (p === null || p === 0 || p <= capoFret) return; // open and capo strings are drawn above
      const cx = x0 + i * dx;
      s += '<circle class="chord-diagram-dot" cx="' + cx + '" cy="' + rowY(rowOf(p)) + '" r="5.5"/>';
    });
    return s + '</svg>';
  }

  function strumChord(frets) {
    ensureAudio();
    const freqs = Chords.strumFrequencies(frets, STANDARD_FREQS);
    freqs.forEach((f, i) => {
      if (f !== null) setTimeout(() => playTone(f), i * STRUM_GAP_MS);
    });
  }

  // `chord` is {name (sounding), shape (fingered), frets (physical)}.
  function makeChordCard(chord, numeral) {
    const card = document.createElement('div');
    card.className = 'chord-card';
    if (numeral) {
      const num = document.createElement('span');
      num.className = 'numeral';
      num.textContent = numeral;
      card.appendChild(num);
    }
    const title = document.createElement('h3');
    title.textContent = chord.name;
    card.appendChild(title);
    if (capo > 0 && chord.shape) {
      const sub = document.createElement('p');
      sub.className = 'shape-note hint';
      sub.textContent = 'Shape: ' + chord.shape + ' (capo ' + capo + ')';
      card.appendChild(sub);
    }
    if (chord.frets) {
      const diagram = document.createElement('div');
      diagram.innerHTML = chordSvg(chord.frets, capo);
      card.appendChild(diagram);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Play';
      btn.setAttribute('aria-label', 'Play ' + chord.name);
      btn.addEventListener('click', () => strumChord(chord.frets));
      card.appendChild(btn);
    } else {
      const note = document.createElement('p');
      note.className = 'missing';
      note.textContent = 'No open shape in this library.';
      card.appendChild(note);
    }
    return card;
  }

  function buildChordCards() {
    chordGrid.innerHTML = '';
    Chords.CHORDS.forEach((shape) => {
      chordGrid.appendChild(makeChordCard(Chords.gridChord(shape, capo), null));
    });
  }

  function currentProgression() {
    return Chords.PROGRESSIONS.find((p) => p.id === progSelect.value) || Chords.PROGRESSIONS[0];
  }

  function stopProgression() {
    progTimers.forEach((t) => clearTimeout(t));
    progTimers = [];
    Array.from(progChords.children).forEach((c) => c.classList.remove('playing'));
    progStatus.textContent = '';
  }

  function renderProgression() {
    stopProgression();
    const p = currentProgression();
    progList = Chords.progressionChords(parseInt(progKey.value, 10), p.numerals, capo);
    progNote.textContent = p.note;
    progChords.innerHTML = '';
    progList.forEach((c) => {
      progChords.appendChild(makeChordCard(c, c.numeral));
    });
  }

  function playProgression() {
    stopProgression();
    ensureAudio();
    const cards = Array.from(progChords.children);
    progList.forEach((c, k) => {
      progTimers.push(setTimeout(() => {
        cards.forEach((card) => card.classList.remove('playing'));
        cards[k].classList.add('playing');
        if (c.frets) {
          strumChord(c.frets);
          progStatus.textContent = 'Playing ' + c.name + '.';
        } else {
          progStatus.textContent = c.name + ' has no open shape here, so it is skipped.';
        }
      }, k * PROG_STEP_MS));
    });
    progTimers.push(setTimeout(() => {
      cards.forEach((card) => card.classList.remove('playing'));
      progStatus.textContent = 'Done.';
      progTimers = [];
    }, progList.length * PROG_STEP_MS));
  }

  function buildProgressionControls() {
    Chords.KEY_NAMES.forEach((name, i) => progKey.appendChild(makeOption(String(i), name)));
    Chords.PROGRESSIONS.forEach((p) => progSelect.appendChild(makeOption(p.id, p.name)));
    progKey.value = '0';
    progSelect.value = Chords.PROGRESSIONS[0].id;
    progKey.addEventListener('change', renderProgression);
    progSelect.addEventListener('change', renderProgression);
    progPlay.addEventListener('click', playProgression);
    renderProgression();
  }

  function setCapo(value) {
    capo = Chords.checkCapo(value);
    capoNote.textContent = capo > 0
      ? 'Capo at fret ' + capo + ': chords sound ' + capo + ' semitones higher. Diagrams show where to put your fingers.'
      : '';
    buildChordCards();
    renderProgression();
  }

  function buildCapoControl() {
    capoSelect.appendChild(makeOption('0', 'No capo'));
    for (let n = 1; n <= 12; n++) capoSelect.appendChild(makeOption(String(n), 'Fret ' + n));
    capoSelect.value = '0';
    capoSelect.addEventListener('change', () => setCapo(parseInt(capoSelect.value, 10)));
  }

  buildCapoControl();
  buildChordCards();
  buildProgressionControls();

  // ---- Start -------------------------------------------------------------
  custom = loadCustom();
  buildCountOptions();
  populateTunings();
  const last = loadLast();
  setTuning(findTuning(last) ? last : 'standard');
  requestAnimationFrame(frame);
})();
