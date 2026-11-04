// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const Chords = require('../public/chords.js');
const Tunings = require('../public/tunings.js');

const names = (list) => list.map((c) => c.name);

test('every shape has six strings, frets 0-4 or muted, and is playable', () => {
  for (const chord of Chords.CHORDS) {
    assert.strictEqual(chord.frets.length, 6, chord.name + ' string count');
    const played = chord.frets.filter((f) => f !== null);
    assert.ok(played.length >= 3, chord.name + ' needs at least 3 strings');
    for (const f of played) {
      assert.ok(Number.isInteger(f) && f >= 0 && f <= 4, chord.name + ' fret ' + f);
    }
  }
});

test('chord names are unique', () => {
  const all = names(Chords.CHORDS);
  assert.strictEqual(new Set(all).size, all.length);
});

test('findChord returns the shape or null', () => {
  assert.deepStrictEqual(Chords.findChord('Am').frets, [null, 0, 2, 2, 1, 0]);
  assert.strictEqual(Chords.findChord('H'), null);
});

test('parseNumeral reads case as major or minor', () => {
  assert.deepStrictEqual(Chords.parseNumeral('I'), { degree: 0, minor: false });
  assert.deepStrictEqual(Chords.parseNumeral('vi'), { degree: 5, minor: true });
  assert.strictEqual(Chords.parseNumeral('IX'), null);
});

test('chords in C major from roman numerals', () => {
  const got = Chords.progressionChords(0, ['I', 'V', 'vi', 'IV']);
  assert.deepStrictEqual(names(got), ['C', 'G', 'Am', 'F']);
  for (const c of got) assert.ok(c.frets !== null, c.name + ' should have a shape');
});

test('same progression transposes to G major', () => {
  const got = Chords.progressionChords(7, ['I', 'IV', 'V', 'I']);
  assert.deepStrictEqual(names(got), ['G', 'C', 'D', 'G']);
});

test('ii V I in C is Dm G C', () => {
  assert.deepStrictEqual(names(Chords.progressionChords(0, ['ii', 'V', 'I'])), ['Dm', 'G', 'C']);
});

test('chords without an open shape have null frets', () => {
  // Bdim is not in the library (vii in C), so no shape is given.
  const got = Chords.chordForNumeral(0, 'vii');
  assert.strictEqual(got.frets, null);
});

test('every built-in progression uses valid numerals in all 12 keys', () => {
  for (const p of Chords.PROGRESSIONS) {
    for (let k = 0; k < 12; k++) {
      const chords = Chords.progressionChords(k, p.numerals);
      assert.strictEqual(chords.length, p.numerals.length, p.id);
    }
  }
});

test('transposeName moves roots by semitones and keeps the suffix', () => {
  assert.strictEqual(Chords.transposeName('Am', 2), 'Bm');
  assert.strictEqual(Chords.transposeName('G7', 1), 'G#7');
  assert.strictEqual(Chords.transposeName('B', 1), 'C');
  assert.strictEqual(Chords.transposeName('C', -1), 'B');
  assert.strictEqual(Chords.transposeName('E', 12), 'E');
  assert.strictEqual(Chords.transposeName('D', -14), 'C');
});

test('checkCapo accepts 0 to 12 and rejects anything else', () => {
  assert.strictEqual(Chords.checkCapo(undefined), 0);
  assert.strictEqual(Chords.checkCapo(12), 12);
  assert.throws(() => Chords.checkCapo(13));
  assert.throws(() => Chords.checkCapo(-1));
  assert.throws(() => Chords.checkCapo(1.5));
});

test('capoFrets: fretted notes and open strings move up, muted stays muted', () => {
  // D shape with capo 2: open D string sounds at fret 2, others move up 2.
  assert.deepStrictEqual(Chords.capoFrets([null, null, 0, 2, 3, 2], 2), [null, null, 2, 4, 5, 4]);
  assert.deepStrictEqual(Chords.capoFrets([0, 2, 2, 1, 0, 0], 0), [0, 2, 2, 1, 0, 0]);
});

test('gridChord with a capo gives the sounding name and shifted frets', () => {
  const g = Chords.gridChord(Chords.findChord('C'), 2);
  assert.strictEqual(g.name, 'D');
  assert.strictEqual(g.shape, 'C');
  assert.deepStrictEqual(g.frets, [null, 5, 4, 2, 3, 2]);
});

test('capo 0 leaves the grid and progressions unchanged', () => {
  const g = Chords.gridChord(Chords.findChord('Am'), 0);
  assert.strictEqual(g.name, 'Am');
  assert.deepStrictEqual(g.frets, Chords.findChord('Am').frets);
  assert.deepStrictEqual(names(Chords.progressionChords(0, ['I', 'V', 'vi', 'IV'], 0)), ['C', 'G', 'Am', 'F']);
});

test('progressions with a capo: names are sounding, shapes are fingered lower', () => {
  // Key of C with capo 3: sounding C, G, Am, F. Shapes fingered: A, E, F#m (none), D.
  const got = Chords.progressionChords(0, ['I', 'V', 'vi', 'IV'], 3);
  assert.deepStrictEqual(names(got), ['C', 'G', 'Am', 'F']);
  assert.deepStrictEqual(got.map((c) => c.shape), ['A', 'E', null, 'D']);
  assert.deepStrictEqual(got[0].frets, [null, 3, 5, 5, 5, 3]); // A shape moved up 3 frets
  assert.strictEqual(got[2].frets, null); // Am is fingered as F#m, which has no shape
});

test('strum frequencies: fret raises pitch by semitones, muted gives null', () => {
  const open = Tunings.getTuning('standard').notes.map(Tunings.noteToFreq);
  const freqs = Chords.strumFrequencies([null, 0, 2, 2, 1, 0], open);
  assert.strictEqual(freqs[0], null);
  assert.ok(Math.abs(freqs[1] - open[1]) < 1e-9);
  assert.ok(Math.abs(freqs[2] - open[2] * Math.pow(2, 2 / 12)) < 1e-9);
  assert.ok(Math.abs(freqs[4] - open[4] * Math.pow(2, 1 / 12)) < 1e-9);
});

test('every note has seven chord types, each with six strings in a playable range', () => {
  const types = ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4'];
  for (let root = 0; root < 12; root++) {
    const list = Chords.chordsForRoot(root);
    const base = Chords.NOTE_NAMES[root];
    for (const suffix of types) {
      const found = list.find((c) => c.name === base + suffix);
      assert.ok(found, base + suffix + ' is in the tab for ' + base);
      assert.strictEqual(found.frets.length, 6, found.name);
      const played = found.frets.filter((f) => f !== null);
      assert.ok(played.length >= 3, found.name + ' needs at least 3 strings');
      for (const f of played) assert.ok(Number.isInteger(f) && f >= 0 && f <= 12, found.name + ' fret ' + f);
    }
    const names = list.map((c) => c.name);
    assert.strictEqual(new Set(names).size, names.length, 'unique names for ' + base);
  }
});

test('a tab only lists chords with its own root', () => {
  for (let root = 0; root < 12; root++) {
    for (const c of Chords.chordsForRoot(root)) {
      const rootName = c.name.split('/')[0].match(/^[A-G]#?/)[0];
      assert.strictEqual(Chords.NOTE_NAMES.indexOf(rootName), root, c.name);
    }
  }
});

test('open shapes are used where they exist, barre shapes elsewhere', () => {
  const shape = (root, name) => Chords.chordsForRoot(root).find((c) => c.name === name).frets;
  assert.deepStrictEqual(shape(0, 'C'), [null, 3, 2, 0, 1, 0]);
  assert.deepStrictEqual(shape(0, 'C7'), [null, 3, 2, 3, 1, 0]);
  assert.deepStrictEqual(shape(9, 'Am'), [null, 0, 2, 2, 1, 0]);
  assert.deepStrictEqual(shape(9, 'Asus4'), [null, 0, 2, 2, 3, 0]);
  assert.deepStrictEqual(shape(2, 'Dsus2'), [null, null, 0, 2, 3, 0]);
  assert.deepStrictEqual(shape(4, 'Esus2'), [0, 2, 4, 4, 0, 0]);
  // Cm has no open shape: the A shape barred at fret 3 is the lowest.
  assert.deepStrictEqual(shape(0, 'Cm'), [null, 3, 5, 5, 4, 3]);
  // Cmaj7 and Csus2 are barres at fret 3 too.
  assert.deepStrictEqual(shape(0, 'Cmaj7'), [null, 3, 5, 4, 5, 3]);
  assert.deepStrictEqual(shape(0, 'Csus2'), [null, 3, 5, 5, 3, 3]);
});

test('slash chords sit under their top note with the bass note in the name', () => {
  const e = Chords.chordsForRoot(4).map((c) => c.name);
  assert.ok(e.includes('E/A'));
  assert.ok(e.includes('E/G#'));
  assert.ok(Chords.chordsForRoot(9).map((c) => c.name).includes('Am/G'));
  const ea = Chords.SLASH_CHORDS.find((c) => c.name === 'E/A');
  assert.deepStrictEqual(ea.frets, [null, 0, 2, 1, 0, 0]);
});

test('transposeName moves both notes of a slash chord', () => {
  assert.strictEqual(Chords.transposeName('E/A', 2), 'F#/B');
  assert.strictEqual(Chords.transposeName('Am/G', 2), 'Bm/A');
});

test('a tab with a capo shows sounding names and fingered shapes', () => {
  const got = Chords.gridChord(Chords.chordsForRoot(0).find((c) => c.name === 'C'), 2);
  assert.strictEqual(got.name, 'D');
  assert.strictEqual(got.shape, 'C');
  const slash = Chords.gridChord(Chords.SLASH_CHORDS.find((c) => c.name === 'E/A'), 2);
  assert.strictEqual(slash.name, 'F#/B');
});

