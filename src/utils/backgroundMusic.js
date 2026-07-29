/**
 * src/utils/backgroundMusic.js
 * Web Audio API background music — procedurally generated ambient per mood.
 * Volume never exceeds 15%. Fade in/out 3 seconds.
 */

const MAX_VOL = 0.15;
const FADE_MS = 3000;

export class BackgroundMusic {
  constructor() {
    this._ctx = null;
    this._gainNode = null;
    this._sources = [];
    this._playing = false;
    this._muted = false;
    this._currentMood = null;
    this._fadeInterval = null;
  }

  play(mood) {
    if (this._currentMood === mood && this._playing) return;
    this.stop().then(() => {
      this._currentMood = mood;
      this._initContext();
      this._generateMoodMusic(mood);
      this._fadeIn();
      this._playing = true;
    });
  }

  async stop() {
    if (!this._playing) return;
    await this._fadeOut();
    this._cleanup();
    this._playing = false;
    this._currentMood = null;
  }

  mute() {
    this._muted = true;
    if (this._gainNode) this._gainNode.gain.setTargetAtTime(0, this._ctx.currentTime, 0.3);
  }

  unmute() {
    this._muted = false;
    if (this._gainNode) this._gainNode.gain.setTargetAtTime(MAX_VOL, this._ctx.currentTime, 0.3);
  }

  toggleMute() {
    if (this._muted) this.unmute(); else this.mute();
    return this._muted;
  }

  get isMuted() { return this._muted; }
  get isPlaying() { return this._playing; }

  _initContext() {
    if (this._ctx) return;
    this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._gainNode = this._ctx.createGain();
    this._gainNode.gain.value = 0;
    this._gainNode.connect(this._ctx.destination);
  }

  _fadeIn() {
    if (!this._gainNode || !this._ctx) return;
    const target = this._muted ? 0 : MAX_VOL;
    this._gainNode.gain.setTargetAtTime(target, this._ctx.currentTime, FADE_MS / 5000);
  }

  _fadeOut() {
    return new Promise(resolve => {
      if (!this._gainNode || !this._ctx) { resolve(); return; }
      this._gainNode.gain.setTargetAtTime(0, this._ctx.currentTime, FADE_MS / 5000);
      setTimeout(resolve, FADE_MS);
    });
  }

  _cleanup() {
    this._sources.forEach(s => { try { s.stop(); } catch (_) {} });
    this._sources = [];
    if (this._ctx && this._ctx.state !== "closed") {
      try { this._ctx.close(); } catch (_) {}
    }
    this._ctx = null;
    this._gainNode = null;
  }

  _generateMoodMusic(mood) {
    const gen = {
      romance:   () => this._genAmbientPad([261.63, 329.63, 392.00, 493.88], 0.4, "sine"),
      soccer:    () => this._genAmbientPad([196.00, 246.94, 293.66, 392.00], 0.3, "triangle"),
      birthday:  () => this._genAmbientPad([329.63, 392.00, 493.88, 587.33], 0.35, "sine"),
      gaming:    () => this._genAmbientPad([130.81, 164.81, 196.00, 261.63], 0.25, "sawtooth"),
      party:     () => this._genAmbientPad([220.00, 277.18, 329.63, 440.00], 0.35, "triangle"),
      african:   () => this._genAmbientPad([196.00, 261.63, 329.63, 392.00], 0.4, "sine"),
      church:    () => this._genAmbientPad([220.00, 277.18, 329.63, 440.00], 0.3, "sine"),
      classroom: () => this._genAmbientPad([261.63, 329.63, 392.00, 523.25], 0.2, "sine"),
      lofi:      () => this._genAmbientPad([174.61, 220.00, 261.63, 329.63], 0.4, "sine"),
      horror:    () => this._genAmbientPad([110.00, 130.81, 155.56, 185.00], 0.2, "sawtooth"),
    };
    (gen[mood] || gen.romance)();
  }

  _genAmbientPad(freqs, oscVol, waveType) {
    if (!this._ctx || !this._gainNode) return;

    // Pad layer — sustained chords
    freqs.forEach((freq, i) => {
      const osc = this._ctx.createOscillator();
      const oscGain = this._ctx.createGain();
      osc.type = waveType;
      osc.frequency.value = freq;
      oscGain.gain.value = oscVol / freqs.length;

      // Subtle vibrato
      const lfo = this._ctx.createOscillator();
      const lfoGain = this._ctx.createGain();
      lfo.type = "sine";
      lfo.frequency.value = 0.3 + i * 0.1;
      lfoGain.gain.value = freq * 0.003;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();
      this._sources.push(lfo);

      osc.connect(oscGain);
      oscGain.connect(this._gainNode);
      osc.start();
      this._sources.push(osc);
    });

    // Noise layer for texture
    const bufferSize = this._ctx.sampleRate * 4;
    const noiseBuffer = this._ctx.createBuffer(1, bufferSize, this._ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = (Math.random() * 2 - 1) * 0.015;

    const noiseSource = this._ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const noiseFilter = this._ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 400;

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(this._gainNode);
    noiseSource.start();
    this._sources.push(noiseSource);

    // Gentle arpeggio pings
    this._pingLoop(freqs, waveType);
  }

  _pingLoop(freqs, waveType) {
    if (!this._ctx || !this._gainNode) return;
    let idx = 0;
    const interval = setInterval(() => {
      if (!this._ctx || !this._playing) { clearInterval(interval); return; }
      const freq = freqs[idx % freqs.length] * (Math.random() > 0.5 ? 2 : 1);
      const osc = this._ctx.createOscillator();
      const env = this._ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0.06, this._ctx.currentTime);
      env.gain.exponentialRampToValueAtTime(0.001, this._ctx.currentTime + 2);
      osc.connect(env);
      env.connect(this._gainNode);
      osc.start();
      osc.stop(this._ctx.currentTime + 2);
      idx++;
    }, 3000 + Math.random() * 2000);
  }
}
