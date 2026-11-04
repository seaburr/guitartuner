/*
 * Chord data and progression helpers. Works in the browser (global `Chords`)
 * and in Node (module.exports) so it can be unit tested.
 *
 * Shapes are open or near-open chords for standard tuning (E2 A2 D3 G3 B3 E4),
 * which is the tuning the Chords tab assumes.
 * Each shape lists the fret for each string, lowest string first;
 * null means the string is not played (x), 0 means open.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Chords = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const KEY_NAMES = ['C', 'C# / Db', 'D', 'D# / Eb', 'E', 'F', 'F# / Gb', 'G', 'G# / Ab', 'A', 'A# / Bb', 'B'];
  const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]; // semitones of the major scale degrees I..VII
  const NUMERALS = { I: 0, II: 1, III: 2, IV: 3, V: 4, VI: 5, VII: 6 };

  const CHORDS = [
    { name: 'C', frets: [null, 3, 2, 0, 1, 0] },
    { name: 'D', frets: [null, null, 0, 2, 3, 2] },
    { name: 'E', frets: [0, 2, 2, 1, 0, 0] },
    { name: 'F', frets: [1, 3, 3, 2, 1, 1] },
    { name: 'G', frets: [3, 2, 0, 0, 0, 3] },
    { name: 'A', frets: [null, 0, 2, 2, 2, 0] },
    { name: 'B', frets: [null, 2, 4, 4, 4, 2] },
    { name: 'Am', frets: [null, 0, 2, 2, 1, 0] },
    { name: 'Bm', frets: [null, 2, 4, 4, 3, 2] },
    { name: 'Dm', frets: [null, null, 0, 2, 3, 1] },
    { name: 'Em', frets: [0, 2, 2, 0, 0, 0] },
    { name: 'C7', frets: [null, 3, 2, 3, 1, 0] },
    { name: 'D7', frets: [null, null, 0, 2, 1, 2] },
    { name: 'E7', frets: [0, 2, 0, 1, 0, 0] },
    { name: 'G7', frets: [3, 2, 0, 0, 0, 1] },
    { name: 'A7', frets: [null, 0, 2, 0, 2, 0] },
  ];

  const PROGRESSIONS = [
    { id: 'pop', name: 'Pop: I V vi IV', numerals: ['I', 'V', 'vi', 'IV'],
      note: 'The most common pop loop. Try it with a strum on each chord.' },
    { id: 'doo-wop', name: 'Doo-wop: I vi IV V', numerals: ['I', 'vi', 'IV', 'V'],
      note: 'The 50s progression, also known as the "Stand by Me" changes.' },
    { id: 'four', name: 'Four chords: I IV V I', numerals: ['I', 'IV', 'V', 'I'],
      note: 'The basis of many folk, country and blues songs.' },
    { id: 'circle', name: 'Circle: I vi ii V', numerals: ['I', 'vi', 'ii', 'V'],
      note: 'Walks around the circle of fifths. Common in jazz and ballads.' },
    { id: 'turnaround', name: 'Turnaround: ii V I', numerals: ['ii', 'V', 'I'],
      note: 'A short jazz cadence that resolves home to the key.' },
  ];

  function findChord(name) {
    return CHORDS.find((c) => c.name === name) || null;
  }

  // "I" or "V" is major, "ii" or "vi" is minor. Returns null if unknown.
  function parseNumeral(numeral) {
    const upper = String(numeral).toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(NUMERALS, upper)) return null;
    return { degree: NUMERALS[upper], minor: numeral === numeral.toLowerCase() };
  }

  // ---- Chords by root note (the per-note tabs) ----------------------------
  // Movable shapes. Each is written with its root on one string at fret 0.
  // Placed at fret f, every fretted note moves up f frets, so the same shape
  // gives the chord on any root. OPEN_SEMI is the open note of each string.
  const OPEN_SEMI = [4, 9, 2, 7, 11, 4]; // E A D G B E, lowest string first
  const TYPE_SUFFIXES = ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4'];
  const MOVABLE = [
    { string: 0, shapes: {
      '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0],
      maj7: [0, 2, 1, 1, 0, 0], sus2: [0, 2, 4, 4, 0, 0], sus4: [0, 2, 2, 2, 0, 0] } },
    { string: 1, shapes: {
      '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0], m7: [null, 0, 2, 0, 1, 0],
      maj7: [null, 0, 2, 1, 2, 0], sus2: [null, 0, 2, 2, 0, 0], sus4: [null, 0, 2, 2, 3, 0] } },
    { string: 2, shapes: {
      '': [null, null, 0, 2, 3, 2], m: [null, null, 0, 2, 3, 1], '7': [null, null, 0, 2, 1, 2],
      m7: [null, null, 0, 2, 1, 1], maj7: [null, null, 0, 2, 2, 2], sus2: [null, null, 0, 2, 3, 0],
      sus4: [null, null, 0, 2, 3, 3] } },
  ];

  // Slash chords: the bass note is the one after the slash.
  const SLASH_CHORDS = [
    { name: 'E/A', frets: [null, 0, 2, 1, 0, 0] },
    { name: 'E/G#', frets: [4, 2, 2, 1, 0, 0] },
    { name: 'Am/G', frets: [3, null, 2, 2, 1, 0] },
    { name: 'C/E', frets: [0, 3, 2, 0, 1, 0] },
    { name: 'C/G', frets: [3, 3, 2, 0, 1, 0] },
    { name: 'D/A', frets: [null, 0, 0, 2, 3, 2] },
    { name: 'D/F#', frets: [2, null, 0, 2, 3, 2] },
    { name: 'G/B', frets: [null, 2, 0, 0, 3, 3] },
    { name: 'A/C#', frets: [null, 4, 2, 2, 2, 0] },
  ];

  // Lowest fretted position of a shape (0 for an all-open shape).
  function lowestFret(frets) {
    const fretted = frets.filter((f) => f !== null && f > 0);
    return fretted.length ? Math.min(...fretted) : 0;
  }

  // For every root and chord type, the shape nearest the top of the neck:
  // a curated open shape if there is one, otherwise the movable shape that
  // sits lowest. Ties go to the curated shape.
  function buildLibrary() {
    const out = [];
    for (let root = 0; root < 12; root++) {
      TYPE_SUFFIXES.forEach((suffix) => {
        const candidates = [];
        CHORDS.forEach((c) => {
          const p = splitName(c.name);
          if (p && p.root === root && p.suffix === suffix) candidates.push(c.frets);
        });
        MOVABLE.forEach((family) => {
          const shape = family.shapes[suffix];
          if (!shape) return;
          const f = (root - OPEN_SEMI[family.string] + 12) % 12;
          candidates.push(shape.map((x) => (x === null ? null : x + f)));
        });
        if (!candidates.length) return;
        let best = candidates[0];
        candidates.forEach((c) => { if (lowestFret(c) < lowestFret(best)) best = c; });
        out.push({ name: NOTE_NAMES[root] + suffix, root: root, frets: best });
      });
    }
    return out;
  }

  const LIBRARY = buildLibrary();

  // Every chord with the given root note (0 for C .. 11 for B): the seven
  // chord types, then any slash chords on that root. Each is {name, frets}.
  function chordsForRoot(root) {
    const r = ((root % 12) + 12) % 12;
    const types = LIBRARY.filter((c) => c.root === r).map((c) => ({ name: c.name, frets: c.frets }));
    const slash = SLASH_CHORDS
      .filter((c) => splitName(c.name.split('/')[0]).root === r)
      .map((c) => ({ name: c.name, frets: c.frets }));
    return types.concat(slash);
  }

  // Capo: a number 0..12. Returns the capo fret or throws if it is not one.
  function checkCapo(capo) {
    const c = capo === undefined || capo === null ? 0 : Number(capo);
    if (!Number.isInteger(c) || c < 0 || c > 12) throw new Error('Capo must be 0 to 12: ' + capo);
    return c;
  }

  // Splits "F#m7" into {root: 6, suffix: 'm7'}. Returns null if it is not a chord name.
  function splitName(name) {
    const m = /^([A-G]#?)(.*)$/.exec(name);
    if (!m) return null;
    const idx = NOTE_NAMES.indexOf(m[1]);
    return idx < 0 ? null : { root: idx, suffix: m[2] };
  }

  // Moves a chord name up (positive) or down (negative) by semitones.
  // "Am" up 2 is "Bm", "F#7" up 1 is "G7", "E/A" up 2 is "F#/B".
  // Returns the name unchanged if it cannot be parsed.
  function transposeName(name, semitones) {
    if (name.indexOf('/') >= 0) {
      return name.split('/').map((part) => transposeName(part, semitones)).join('/');
    }
    const p = splitName(name);
    if (!p) return name;
    const root = (((p.root + semitones) % 12) + 12) % 12;
    return NOTE_NAMES[root] + p.suffix;
  }

  // Physical frets when a shape is played with a capo: every fretted note moves
  // up by the capo, open strings sound at the capo, muted stays muted.
  function capoFrets(frets, capo) {
    const c = checkCapo(capo);
    return frets.map((f) => {
      if (f === null || f === undefined) return null;
      return f === 0 ? c : f + c;
    });
  }

  // A library shape as it sounds with a capo: name moved up, frets moved up.
  function gridChord(shape, capo) {
    const c = checkCapo(capo);
    return { name: transposeName(shape.name, c), shape: shape.name, frets: capoFrets(shape.frets, c) };
  }

  // The chord a roman numeral gives in a key (keyRoot is 0 for C .. 11 for B).
  // The key and name are the sounding ones; the shape is what you finger with the capo.
  function chordForNumeral(keyRoot, numeral, capo) {
    const parsed = parseNumeral(numeral);
    if (!parsed) throw new Error('Unknown numeral: ' + numeral);
    const c = checkCapo(capo);
    const root = (keyRoot + MAJOR_STEPS[parsed.degree]) % 12;
    // The seventh degree in major is diminished (vii), not minor.
    const suffix = parsed.minor ? (parsed.degree === 6 ? 'dim' : 'm') : '';
    const name = NOTE_NAMES[root] + suffix;
    const shape = findChord(transposeName(name, -c));
    return {
      numeral: numeral,
      name: name,
      shape: shape ? shape.name : null,
      frets: shape ? capoFrets(shape.frets, c) : null,
    };
  }

  function progressionChords(keyRoot, numerals, capo) {
    return numerals.map((n) => chordForNumeral(keyRoot, n, capo));
  }

  // Frequency of each string for a shape, or null for a muted string.
  // openFreqs is the open-string frequency of each string, lowest first.
  function strumFrequencies(frets, openFreqs) {
    return frets.map((fret, i) => {
      if (fret === null || fret === undefined) return null;
      return openFreqs[i] * Math.pow(2, fret / 12);
    });
  }

  return {
    NOTE_NAMES,
    KEY_NAMES,
    CHORDS,
    PROGRESSIONS,
    findChord,
    chordsForRoot,
    SLASH_CHORDS,
    LIBRARY,
    parseNumeral,
    checkCapo,
    transposeName,
    capoFrets,
    gridChord,
    chordForNumeral,
    progressionChords,
    strumFrequencies,
  };
});
