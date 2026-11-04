// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const Tunings = require('../public/tunings.js');

test('note names map to MIDI numbers', () => {
  assert.strictEqual(Tunings.noteToMidi('A4'), 69);
  assert.strictEqual(Tunings.noteToMidi('E2'), 40);
  assert.strictEqual(Tunings.noteToMidi('E4'), 64);
  assert.strictEqual(Tunings.noteToMidi('C4'), 60);
  assert.strictEqual(Tunings.noteToMidi('Bb3'), 58);
  assert.strictEqual(Tunings.noteToMidi('F#3'), 54);
  assert.strictEqual(Tunings.noteToMidi('E1'), 28);
});

test('bad note names throw', () => {
  assert.throws(() => Tunings.noteToMidi('H2'));
  assert.throws(() => Tunings.noteToMidi(''));
});

test('A4 is 440 Hz and octaves double', () => {
  assert.ok(Math.abs(Tunings.noteToFreq('A4') - 440) < 1e-9);
  assert.ok(Math.abs(Tunings.noteToFreq('A5') - 880) < 1e-9);
  assert.ok(Math.abs(Tunings.noteToFreq('E2') - 82.407) < 0.01);
  assert.ok(Math.abs(Tunings.noteToFreq('E1') - 41.203) < 0.01);
});

test('string counts match each instrument', () => {
  const expected = { guitar: 6, bass: 4, ukulele: 4, banjo: 5 };
  for (const t of Tunings.TUNINGS) {
    assert.strictEqual(t.notes.length, expected[t.instrument], t.id);
  }
  for (const inst of Object.keys(expected)) {
    assert.ok(Tunings.TUNINGS.some((t) => t.instrument === inst), 'no preset for ' + inst);
  }
});

test('every preset uses valid notes, ascending unless re-entrant', () => {
  for (const t of Tunings.TUNINGS) {
    assert.strictEqual(Tunings.validateNotes(t.notes), null, t.id);
    if (t.reentrant) continue;
    const midis = t.notes.map(Tunings.noteToMidi);
    for (let i = 1; i < midis.length; i++) {
      assert.ok(midis[i] >= midis[i - 1], t.id + ' not ascending');
    }
  }
});

test('preset ids are unique and include the common modes', () => {
  const ids = Tunings.TUNINGS.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  for (const id of ['standard', 'drop-d', 'eb', 'dadgad', 'dgcgcd', 'bass-standard', 'ukulele-standard', 'banjo-open-g']) {
    assert.ok(ids.includes(id), 'missing ' + id);
  }
});

test('standard and drop D differ only in the low string', () => {
  const std = Tunings.getTuning('standard').notes;
  const dd = Tunings.getTuning('drop-d').notes;
  assert.deepStrictEqual(dd.slice(1), std.slice(1));
  assert.strictEqual(dd[0], 'D2');
});

test('unknown tuning id falls back to standard', () => {
  assert.strictEqual(Tunings.getTuning('nope').id, 'standard');
});

test('validateNotes accepts good lists and rejects bad ones', () => {
  assert.strictEqual(Tunings.validateNotes(['E2', 'A2', 'D3', 'G3']), null);
  assert.ok(Tunings.validateNotes(['E2', 'A2']));
  assert.ok(Tunings.validateNotes(['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'A4']));
  assert.ok(Tunings.validateNotes(['E2', 'A2', 'H3']));
  assert.ok(Tunings.validateNotes(['E2', 'A2', 'D9']));
  assert.ok(Tunings.validateNotes('E2 A2 D3'));
});

test('makeCustomTuning builds a custom tuning or returns null', () => {
  const t = Tunings.makeCustomTuning(['D2', 'A2', 'D3', 'G3']);
  assert.strictEqual(t.id, Tunings.CUSTOM_ID);
  assert.deepStrictEqual(t.notes, ['D2', 'A2', 'D3', 'G3']);
  assert.strictEqual(Tunings.makeCustomTuning(['X9', 'A2', 'D3']), null);
});
