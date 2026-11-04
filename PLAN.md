# Guitar Tuner - plan

Static site (runtime "static"), files in public/. No server code.
Files: public/{tunings.js, pitch.js, chords.js, app.js, index.html, style.css}, tests/*.test.js

Round 1 (done): six-string guitar, synth tones, neck canvas, keys 1-6.

Round 2 (done): instruments, custom tuning editor, mic tuning meter.

Round 3 (done): Left/Right arrow keys move between notes and loop them.

Round 4 (feedback: chords tab):
- [x] public/chords.js: open chord shapes (standard tuning), roman-numeral progressions in any key, strum frequencies (UMD, testable)
- [x] tests/chords.test.js
- [x] index.html: Tuner / Chords tabs; chords panel with chord cards and progression picker
- [x] style.css: tabs, chord cards, diagrams
- [x] app.js: tab switching, chord diagrams (SVG), strum and play progression, keys ignored on Chords tab
- [x] README updated
- [x] deploy_preview OK (13 files; first deploys missed new files, a re-deploy fixed it), http_request checks /, /chords.js, /app.js
- [x] finish

Round 5 (feedback: capo selector that transposes shapes and names):
- [x] chords.js: checkCapo, transposeName, capoFrets, gridChord; chordForNumeral/progressionChords take a capo
- [x] tests/chords.test.js: capo cases (names, frets, progressions, capo 0 unchanged)
- [x] index.html: Capo select (0 to 12) above the chord grid
- [x] app.js: chordSvg draws the capo bar and physical frets; cards show sounding name and shape
- [x] README capo section
- [x] deploy_preview, http_request checks
- [x] finish

Round 6 (feedback: more common chords, a tab per note):
- [x] chords.js: MOVABLE shapes (E, A, D families) per root, curated open shapes win ties, SLASH_CHORDS, chordsForRoot(root)
- [x] transposeName handles slash chords
- [x] index.html: root-tabs row (C..B), chord grid follows the tab
- [x] app.js: buildRootTabs, setRoot, buildChordCards uses chordsForRoot
- [x] tests/chords.test.js: per-root coverage, open vs barre choice, slash chords, capo on slash
- [x] README updated
- [x] kaisen.json "test": "node --test" (tests now run on deploy; 37 pass)
- [x] fixed vii chord naming (Bdim, no shape) which broke an existing test
- [x] deploy_preview (TESTS PASSED), http_request checks on /, /chords.js, /app.js
- [x] finish

Progressions still use CHORDS only (findChord), so F#m with capo 3 stays skipped (existing test).

Capo model: name = sounding name (shape moved up by capo), frets = physical (fretted +capo, open -> capo).
Progressions: key is the sounding key; shape = name moved down by capo.

Notes: "DADGAG" read as DADGAD. Mic needs a user click (getUserMedia on https).
localStorage keys: guitar-tuner.custom (notes array), guitar-tuner.last (tuning id).
Chords tab: section#tab-chords (hidden until selected). Shapes are standard tuning only.
