/**
 * src/utils/gifReactions.js
 * Real-time speech-to-GIF reactions.
 * Only active when microphone is unmuted.
 */

import { GIPHY_API_KEY } from "../config/config.js";

const CUSTOM_GIFS = {
  "look":      "./assets/gifs/look.gif",
  "looking":   "./assets/gifs/look.gif",
  "shocked":   "./assets/gifs/shocked.gif",
  "shock":     "./assets/gifs/shocked.gif",
  "telling":   "./assets/gifs/telling.gif",
  "tell":      "./assets/gifs/telling.gif",
};

const TRIGGER_WORDS = {
  "dog":"🐕","cat":"🐱","lion":"🦁","monkey":"🐒","elephant":"🐘",
  "bird":"🐦","fish":"🐟","snake":"🐍",
  "love":"❤️","happy":"😄","sad":"😢","angry":"😡","laugh":"😂",
  "crying":"😭","excited":"🤩","scared":"😨",
  "wow":"😲","fire":"🔥","yes":"✅","no":"❌","lol":"🤣",
  "bruh":"😐","gg":"🏆","slay":"💅","facts":"💯",
  "goal":"⚽","foul":"🟥","shoot":"⚽","basketball":"🏀","rugby":"🏉",
  "pizza":"🍕","burger":"🍔","braai":"🔥","chicken":"🍗","cake":"🎂",
  "amapiano":"🎶","eish":"😳","sawubona":"👋","lekker":"😎",
  "money":"💰","party":"🎉","dance":"💃","music":"🎵",
  "sleep":"😴","rain":"🌧️","sun":"☀️","snow":"❄️",
};

const cooldowns = new Map();
const COOLDOWN_MS = 6000;

export class GifReactions {
  constructor(container) {
    this.container = container;
    this.recognition = null;
    this.active = false;
    this._listening = false;
    this._gifLayer = null;
    this._participantNames = [];
    this._moodTriggers = {};
  }

  updateParticipants(participants, localUid) {
    this._participantNames = Object.entries(participants)
      .filter(([uid]) => uid !== localUid)
      .map(([, info]) => info.name)
      .filter(Boolean);
  }

  setMoodTriggers(triggers) {
    this._moodTriggers = triggers || {};
  }

  start() {
    if (this.active) return;
    this.active = true;
    this._ensureGifLayer();
  }

  stop() {
    this.active = false;
    this._stopListening();
    if (this._gifLayer) { this._gifLayer.remove(); this._gifLayer = null; }
    cooldowns.clear();
  }

  onMicUnmuted() {
    if (!this.active) return;
    this._startListening();
  }

  onMicMuted() {
    this._stopListening();
  }

  _ensureGifLayer() {
    if (this._gifLayer) return;
    this._gifLayer = document.createElement("div");
    this._gifLayer.id = "gif-reaction-layer";
    this._gifLayer.className = "gif-reaction-layer";
    this.container.appendChild(this._gifLayer);
  }

  _startListening() {
    if (this._listening) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    this._ensureGifLayer();
    this.recognition = new SR();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (!event.results[i].isFinal) continue;
        const transcript = event.results[i][0].transcript.toLowerCase().trim();
        if (transcript.length > 1) this._checkTriggers(transcript);
      }
    };

    this.recognition.onerror = (e) => {
      if (["no-speech", "aborted", "network"].includes(e.error)) return;
      if (e.error === "not-allowed") { this._listening = false; return; }
    };

    this.recognition.onend = () => {
      if (!this._listening || !this.active) return;
      setTimeout(() => {
        if (!this._listening || !this.active || !this.recognition) return;
        try { this.recognition.start(); } catch (_) {}
      }, 800);
    };

    try {
      this.recognition.start();
      this._listening = true;
    } catch (_) {}
  }

  _stopListening() {
    this._listening = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (_) {}
      this.recognition = null;
    }
  }

  _checkTriggers(transcript) {
    // 1. Custom local GIFs
    for (const [word, gifUrl] of Object.entries(CUSTOM_GIFS)) {
      if (!transcript.includes(word)) continue;
      if (this._onCooldown(word)) continue;
      cooldowns.set(word, Date.now());
      this._showGif(gifUrl, word);
      return;
    }

    // 2. Mood-specific triggers
    for (const [word, query] of Object.entries(this._moodTriggers)) {
      if (!transcript.includes(word)) continue;
      if (this._onCooldown(`mood:${word}`)) continue;
      cooldowns.set(`mood:${word}`, Date.now());
      if (query === null) {
        this._showFallback(word);
      } else {
        this._tryGiphyOrFallback(query, word);
      }
      return;
    }

    // 3. Participant names
    for (const name of this._participantNames) {
      const lower = name.toLowerCase();
      if (!transcript.includes(lower)) continue;
      if (this._onCooldown(`name:${lower}`)) continue;
      cooldowns.set(`name:${lower}`, Date.now());
      this._showFallback(name, "👋");
      return;
    }

    // 4. Built-in trigger words (emoji only — no Giphy dependency)
    for (const [word, emoji] of Object.entries(TRIGGER_WORDS)) {
      if (!transcript.includes(word)) continue;
      if (this._onCooldown(word)) continue;
      cooldowns.set(word, Date.now());
      this._showFallback(word, emoji);
      return;
    }
  }

  _onCooldown(key) {
    return (Date.now() - (cooldowns.get(key) || 0)) < COOLDOWN_MS;
  }

  async _tryGiphyOrFallback(query, triggerWord) {
    try {
      const params = new URLSearchParams({ api_key: GIPHY_API_KEY, q: query, limit: "8", rating: "g", lang: "en" });
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      if (!data.data || data.data.length === 0) throw new Error("No results");
      const gif = data.data[Math.floor(Math.random() * data.data.length)];
      this._showGif(gif.images.fixed_height.url, triggerWord);
    } catch (_) {
      this._showFallback(triggerWord);
    }
  }

  _showFallback(triggerWord, emoji) {
    if (!this._gifLayer) return;
    const e = emoji || TRIGGER_WORDS[triggerWord] || "✨";

    const wrapper = document.createElement("div");
    wrapper.className = "gif-float-wrapper";

    const pos = this._getSmartPosition();
    wrapper.style.bottom = `${pos.bottom}px`;
    wrapper.style.right = `${pos.right}px`;

    wrapper.innerHTML = `<div class="gif-word-label">${triggerWord}</div><div class="gif-emoji-fallback">${e}</div>`;
    this._gifLayer.appendChild(wrapper);
    requestAnimationFrame(() => wrapper.classList.add("gif-float-animate"));
    setTimeout(() => { wrapper.classList.add("gif-float-exit"); setTimeout(() => wrapper.remove(), 600); }, 4000);
  }

  _showGif(gifUrl, triggerWord) {
    if (!this._gifLayer) return;
    const pos = this._getSmartPosition();

    const wrapper = document.createElement("div");
    wrapper.className = "gif-float-wrapper";
    wrapper.style.bottom = `${pos.bottom}px`;
    wrapper.style.right = `${pos.right}px`;

    const img = document.createElement("img");
    img.src = gifUrl;
    img.alt = triggerWord;
    img.className = "gif-float-img";
    img.style.width = `${pos.size}px`;
    img.style.maxWidth = `${pos.size}px`;
    img.onerror = () => { wrapper.remove(); this._showFallback(triggerWord); };

    wrapper.innerHTML = `<div class="gif-word-label">${triggerWord}</div>`;
    wrapper.appendChild(img);
    this._gifLayer.appendChild(wrapper);
    requestAnimationFrame(() => wrapper.classList.add("gif-float-animate"));
    setTimeout(() => { wrapper.classList.add("gif-float-exit"); setTimeout(() => wrapper.remove(), 600); }, 4500);
  }

  _getSmartPosition() {
    const controlBar = document.querySelector(".controls");
    const controlH = controlBar ? controlBar.offsetHeight : 110;
    const screenActive = !!document.querySelector(".screen-share-tile");
    if (screenActive) return { bottom: controlH + 16, right: 16, size: 120 };
    return { bottom: controlH + 20, right: 20, size: 160 };
  }
}
