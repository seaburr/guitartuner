/*
 * Pitch detection and tuning-meter math. Works in the browser (global
 * `Pitch`) and in Node (module.exports) so it can be unit tested.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Pitch = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN_HZ = 30;
  const MAX_HZ = 1200;
  const MIN_RMS = 0.01;      // below this the input is treated as silence
  const PEAK_RATIO = 0.9;    // accept the first lag reaching 90% of the best correlation

  // Autocorrelation pitch estimate for a block of samples. Returns the
  // frequency in Hz, or null when the signal is too quiet or unclear.
  function detectPitch(samples, sampleRate) {
    const size = samples.length;
    let energy = 0;
    for (let i = 0; i < size; i++) energy += samples[i] * samples[i];
    if (Math.sqrt(energy / size) < MIN_RMS) return null;

    const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
    const maxLag = Math.min(Math.floor(sampleRate / MIN_HZ), Math.floor(size / 2));
    if (maxLag <= minLag + 2) return null;

    // Correlate over a fixed window so every lag is compared fairly.
    const n = size - maxLag;
    const corr = new Float64Array(maxLag + 2);
    let best = 0;
    for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += samples[i] * samples[i + lag];
      corr[lag] = sum;
      if (lag >= minLag && lag <= maxLag && sum > best) best = sum;
    }
    if (best <= 0) return null;

    // Take the shortest lag that is a local peak and close to the best one.
    // This avoids reporting an octave too low.
    let lag = -1;
    for (let l = minLag; l <= maxLag; l++) {
      if (corr[l] >= PEAK_RATIO * best && corr[l] >= corr[l - 1] && corr[l] >= corr[l + 1]) {
        lag = l;
        break;
      }
    }
    if (lag < 0) return null;

    // Parabolic interpolation for a sub-sample period estimate.
    const a = corr[lag - 1], b = corr[lag], c = corr[lag + 1];
    const denom = a - 2 * b + c;
    const shift = denom !== 0 ? 0.5 * (a - c) / denom : 0;
    const period = lag + Math.max(-0.5, Math.min(0.5, shift));
    return sampleRate / period;
  }

  // Cents from target: positive means the measured pitch is sharp.
  function centsBetween(freq, targetFreq) {
    return 1200 * Math.log2(freq / targetFreq);
  }

  // Index of the string whose frequency is closest to freq (in cents).
  function nearestString(freq, freqs) {
    let best = 0, bestDist = Infinity;
    freqs.forEach((f, i) => {
      const d = Math.abs(centsBetween(freq, f));
      if (d < bestDist) { best = i; bestDist = d; }
    });
    return best;
  }

  return { detectPitch, centsBetween, nearestString };
});
