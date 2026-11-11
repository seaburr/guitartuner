/*
 * Tuning presets and pitch math. Works in the browser (global `Tunings`)
 * and in Node (module.exports) so it can be unit tested.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Tunings = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const NOTE_OFFSETS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Scientific pitch name ("E2", "F#3", "Bb3") -> MIDI number (A4 = 69).
  function noteToMidi(name) {
    const m = /^([A-G])(#|b)?(-?\d)$/.exec(String(name).trim());
    if (!m) throw new Error('Bad note name: ' + name);
    let semitone = NOTE_OFFSETS[m[1]];
    if (m[2] === '#') semitone += 1;
    if (m[2] === 'b') semitone -= 1;
    return (parseInt(m[3], 10) + 1) * 12 + semitone;
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function noteToFreq(name) {
    return midiToFreq(noteToMidi(name));
  }

  // Notes are listed from the lowest-pitched string to the highest, except
  // ukulele, which uses its re-entrant (physical) order G C E A.
  const TUNINGS = [
    { id: 'standard', instrument: 'guitar', name: 'Standard (EADGBE)', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
    { id: 'drop-d', instrument: 'guitar', name: 'Drop D (DADGBE)', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
    { id: 'half-down', instrument: 'guitar', name: 'Half step down (Eb Ab Db Gb Bb Eb)', notes: ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'] },
    { id: 'eb', instrument: 'guitar', name: 'Eb standard (Eb Ab Db Gb Bb Eb)', notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
    { id: 'full-down', instrument: 'guitar', name: 'Full step down (DGCFAD)', notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
    { id: 'drop-c', instrument: 'guitar', name: 'Drop C (CGCFAD)', notes: ['C2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
    { id: 'dadgad', instrument: 'guitar', name: 'DADGAD', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
    { id: 'dgcgcd', instrument: 'guitar', name: 'D-G-C-G-C-D', notes: ['D2', 'G2', 'C3', 'G3', 'C4', 'D4'] },
    { id: 'open-g', instrument: 'guitar', name: 'Open G (DGDGBD)', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
    { id: 'open-d', instrument: 'guitar', name: 'Open D (DADF#AD)', notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
    { id: 'dgdgdg', instrument: 'guitar', name: 'DGDGDG (all open G fifths)', notes: ['D2', 'G2', 'D3', 'G3', 'D4', 'G4'] },
    { id: 'double-drop-d', instrument: 'guitar', name: 'Double drop D (DADGBD)', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'D4'] },
    { id: 'ggdgdd', instrument: 'guitar', name: 'Ggdgdd (QOTSA)', notes: ['G2', 'G2', 'D3', 'G3', 'D4', 'D4'] },
    { id: 'drop-c-sharp', instrument: 'guitar', name: 'Drop C# (C#F#BEG#C#)', notes: ['C#1', 'F#1', 'B1', 'E2', 'G#2', 'C#3'] },
    { id: 'drop-b', instrument: 'guitar', name: 'Drop B (BF#BEG#C#)', notes: ['B1', 'F#2', 'B2', 'E3', 'G#3', 'C#4'] },
    { id: 'drop-a', instrument: 'guitar', name: 'Drop A (AEADF#B)', notes: ['A1', 'E2', 'A2', 'D3', 'F#3', 'B3'] },
    { id: 'bass-standard', instrument: 'bass', name: 'Bass standard 4-string (EADG)', notes: ['E1', 'A1', 'D2', 'G2'] },
    { id: 'bass-drop-d', instrument: 'bass', name: 'Bass drop D 4-string (DADG)', notes: ['D1', 'A1', 'D2', 'G2'] },
    { id: 'ukulele-standard', instrument: 'ukulele', name: 'Ukulele standard (GCEA, re-entrant)', notes: ['G4', 'C4', 'E4', 'A4'], reentrant: true },
    { id: 'ukulele-low-g', instrument: 'ukulele', name: 'Ukulele low G (GCEA, low G)', notes: ['G3', 'C4', 'E4', 'A4'] },
    { id: 'banjo-open-g', instrument: 'banjo', name: 'Banjo 5-string open G (gDGBD)', notes: ['D3', 'G3', 'B3', 'D4', 'G4'] },
    { id: 'banjo-double-c', instrument: 'banjo', name: 'Banjo 5-string double C (gCGBD)', notes: ['C3', 'G3', 'C4', 'D4', 'G4'] },
  ];

  const INSTRUMENTS = [
    { id: 'guitar', label: 'Guitar (6-string)' },
    { id: 'bass', label: 'Bass (4-string)' },
    { id: 'ukulele', label: 'Ukulele' },
    { id: 'banjo', label: 'Banjo (5-string)' },
  ];

  const CUSTOM_ID = 'custom';
  const MIN_STRINGS = 3;
  const MAX_STRINGS = 6;

  function getTuning(id) {
    return TUNINGS.find((t) => t.id === id) || TUNINGS[0];
  }

  // Checks a list of note names for a custom tuning. Returns an error message
  // string, or null when the list is valid.
  function validateNotes(notes) {
    if (!Array.isArray(notes)) return 'Notes must be a list.';
    if (notes.length < MIN_STRINGS || notes.length > MAX_STRINGS) {
      return 'Use between ' + MIN_STRINGS + ' and ' + MAX_STRINGS + ' strings.';
    }
    for (const n of notes) {
      try {
        const midi = noteToMidi(n);
        if (midi < 24 || midi > 84) return 'Note ' + n + ' is outside the supported range (C1 to C6).';
      } catch (e) {
        return 'Bad note name "' + n + '". Use a letter, optional # or b, and an octave, e.g. E2 or F#3.';
      }
    }
    return null;
  }

  // Builds a custom tuning object from a list of note names, or returns null
  // if the list is invalid.
  function makeCustomTuning(notes) {
    if (validateNotes(notes)) return null;
    return {
      id: CUSTOM_ID,
      instrument: 'custom',
      name: 'Custom (' + notes.join(' ') + ')',
      notes: notes.map((n) => n.trim()),
    };
  }

  function describeTuning(tuning) {
    return tuning.notes.map((n) => ({ note: n, freq: noteToFreq(n) }));
  }

  return {
    noteToMidi, midiToFreq, noteToFreq, TUNINGS, INSTRUMENTS, CUSTOM_ID,
    MIN_STRINGS, MAX_STRINGS, getTuning, validateNotes, makeCustomTuning, describeTuning,
  };
});
