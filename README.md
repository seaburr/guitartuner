# Guitar Tuner

A small browser tuner for guitar, bass, ukulele and banjo. It synthesizes the strings
with the Web Audio API, draws an animated neck, and can listen to your instrument
through the microphone to show whether a string is sharp or flat.

- Click a string: it plays now and repeats every 2.4 seconds.
- Click the same string again, or press Esc or Space, to stop.
- Click a different string to switch the loop to it.
- Keys 1-6 do the same as clicking strings, lowest to highest (fewer keys for shorter instruments).
- Left and Right arrow keys switch to the previous or next note (lowest first) and loop it. With nothing playing, Right starts the lowest string and Left the highest.

## Instruments and tunings

- Guitar (6-string): Standard (EADGBE), Drop D, half step down, Eb standard, full step down,
  Drop C, DADGAD, D-G-C-G-C-D, Open G, Open D.
- Bass (4-string): standard EADG, drop D (DADG).
- Ukulele: standard GCEA (re-entrant, G is the high string), low G (G3 C4 E4 A4).
- Banjo (5-string): open G (gDGBD), double C (gCGBD).
- Custom: your own tuning with 3 to 6 strings, from the custom tuning editor.

## Chords tab

Switch to the "Chords" tab for:

- Chords by note: 12 note tabs (C to B). Each tab lists the chords on that note: major, minor (m),
  7, m7, maj7, sus2 and sus4, plus slash chords with that note on top (E/A, E/G#, C/G, D/F# and others).
  Open shapes are used where they exist; elsewhere the lowest barre shape on the neck is shown.
  Each chord has a Play button that strums it.
- Chord progressions in any of the 12 keys: Pop (I V vi IV), Doo-wop (I vi IV V),
  Four chords (I IV V I), Circle (I vi ii V) and Turnaround (ii V I). The chords are worked out
  from the key, upper-case numerals are major and lower-case are minor. "Play progression"
  strums each chord in turn.

### Capo

The "Capo" selector (none, or fret 1 to 12) transposes the chords. With a capo at fret N:

- The chord name is the sounding one: each shape moves up N semitones (Am with capo 2 shows Bm).
- The shape you finger is shown under the name ("Shape: Am (capo 2)"). Strumming plays the sounding chord.
- The diagram shows the neck with the capo as a bar. Fretted notes move up N frets, and open
  strings sound at the capo.
- In progressions the key is the sounding key. The shapes you finger are the chords N semitones lower,
  and a chord with no shape for that fingering is skipped.

Shapes are for standard tuning only. A chord with no shape in the library shows
"No open shape in this library." and is skipped when playing. Keys 1-6 and the arrow keys
do nothing while the Chords tab is open.

## Tuning meter

Press "Start microphone" and allow access in the browser. The meter compares what it hears
with the nearest string of the selected tuning and shows the difference in cents
(within 5 cents counts as in tune). Audio is analysed in the browser and never sent anywhere.
Microphone access needs a secure page (https or localhost). The app asks the browser to turn
off echo cancellation, noise suppression and auto gain, so the pitch stays accurate.

## Custom tuning editor

Open "Custom tuning editor", choose the number of strings, type each note (for example
E2, F#3, Bb1), and press "Save and use". The tuning and your last selected tuning are saved
in this browser's localStorage (keys `guitar-tuner.custom` and `guitar-tuner.last`).
"Delete saved tuning" removes the custom one. Nothing is sent to a server.

## Run locally

No build step. Serve the `public/` folder with any static server, for example:

    python -m http.server 8080 --directory public

then open http://localhost:8080.

Or with Docker:

    docker build -t guitar-tuner .
    docker run -p 8080:8080 guitar-tuner

The container listens on `PORT` (default 8080) and runs as user 10001.

## Test

The tuning math (`public/tunings.js`), pitch detection (`public/pitch.js`) and chord data
(`public/chords.js`) are covered by
Node's built-in test runner (no dependencies, no network):

    node --test tests/

Requires Node 18 or newer. The preview runtime is static, so it does not run these tests.

## Files

- `public/index.html`, `public/style.css`: layout, meter and editor styling.
- `public/tunings.js`: instruments, tuning presets, note-to-frequency math, custom tuning validation.
- `public/pitch.js`: autocorrelation pitch detection, cents and nearest-string helpers.
- `public/chords.js`: chord shapes, progressions in any key, strum frequencies.
- `public/app.js`: audio synthesis, neck animation, input, microphone meter, custom editor, tabs, chords.
- `tests/tunings.test.js`, `tests/pitch.test.js`, `tests/chords.test.js`: unit tests.

## Configuration

There are no environment variables or secrets. The only runtime setting is `PORT`
for the Docker image.

## Assumptions

- "DADGAG" in the brief was read as DADGAD, the common alternate tuning.
- Audio needs a user gesture in some browsers, so the first click or key press starts sound.
- Tones are synthesized (triangle plus octave partial), not recorded samples.
- Pitch detection is a simple autocorrelation: it works best with one string ringing at a time.
- Banjo and ukulele presets use the common forms; the banjo strings are listed lowest pitch first.
