// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const Pitch = require('../public/pitch.js');
const Tunings = require('../public/tunings.js');

const RATE = 44100;

function sine(freq, length, amp = 0.5) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = amp * Math.sin(2 * Math.PI * freq * i / RATE);
  return out;
}

test('detects sine tones within half a hertz', () => {
  for (const f of [82.41, 110, 196, 329.63]) {
    const got = Pitch.detectPitch(sine(f, 4096), RATE);
    assert.ok(got !== null, 'no pitch for ' + f);
    assert.ok(Math.abs(got - f) < 0.5, f + ' detected as ' + got);
  }
});

test('detects a low bass string', () => {
  const got = Pitch.detectPitch(sine(41.2, 8192), RATE);
  assert.ok(got !== null && Math.abs(got - 41.2) < 0.5, 'got ' + got);
});

test('silence gives no pitch', () => {
  assert.strictEqual(Pitch.detectPitch(new Float32Array(4096), RATE), null);
});

test('cents: sharp is positive, flat is negative, octave is 1200', () => {
  assert.ok(Math.abs(Pitch.centsBetween(440, 440)) < 1e-9);
  assert.ok(Pitch.centsBetween(445, 440) > 0);
  assert.ok(Pitch.centsBetween(435, 440) < 0);
  assert.ok(Math.abs(Pitch.centsBetween(880, 440) - 1200) < 1e-6);
});

test('nearest string picks the closest target', () => {
  const freqs = Tunings.getTuning('standard').notes.map(Tunings.noteToFreq);
  assert.strictEqual(Pitch.nearestString(110.5, freqs), 1); // A2
  assert.strictEqual(Pitch.nearestString(330, freqs), 5);   // high E4 is 329.63
});
