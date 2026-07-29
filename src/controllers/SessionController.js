/**
 * src/controllers/SessionController.js
 * Meeting session mood system — Firestore sync, theme application, music, GIF triggers.
 */

import { FIREBASE_CONFIG } from "../config/config.js";
import { buildSessionPicker, buildFabTray, MOODS } from "../ui/sessionTemplates.js";
import { BackgroundMusic } from "../utils/backgroundMusic.js";

const MOOD_GIF_TRIGGERS = {
  romance: {
    "love": "romantic love",
    "miss you": "missing you love",
    "beautiful": "roses beautiful",
    "heart": "heart love animation",
    "kiss": "kiss romantic",
  },
  soccer: {
    "goal": "goal soccer celebration",
    "foul": "referee red card",
    "offside": "offside call soccer",
    "shoot": "soccer shooting goal",
    "bafana": "south africa celebration",
  },
  birthday: {
    "happy birthday": "birthday cake celebration",
    "wish": "birthday balloons wish",
    "celebrate": "confetti celebration",
    "cake": "birthday cake",
  },
  gaming: {
    "gg": "win gaming victory",
    "noob": "noob gaming fail",
    "clutch": "clutch gaming play",
    "win": "victory gaming",
    "lose": "game over loss",
  },
  party: {
    "lit": "lit fire party",
    "dance": "dancing party",
    "party": "party celebration",
    "vibe": "vibes dancing",
  },
  african: {
    "amapiano": "amapiano dance",
    "eish": null,
    "sawubona": "hello greeting african",
    "lekker": "cool south africa",
    "siyabonga": "thank you grateful",
  },
  church: {
    "amen": "amen praise",
    "hallelujah": "hallelujah worship",
    "pray": "praying hands",
    "blessed": "blessed grateful",
    "worship": "worship praise",
  },
  classroom: {
    "question": "raising hand question",
    "homework": "studying homework",
    "teacher": "teacher classroom",
    "exam": "exam stress",
    "smart": "genius smart",
  },
  lofi: {
    "chill": "chill relaxing",
    "vibes": "aesthetic vibes",
    "relax": "relaxing calm",
    "coffee": "coffee cozy",
    "rain": "rain aesthetic",
  },
  horror: {
    "scary": "scary horror",
    "ghost": "ghost spooky",
    "scream": "screaming horror",
    "dark": "dark scary",
    "boo": "jump scare",
  },
};

export class SessionController {
  constructor(container) {
    this.container = container;
    this._db = null;
    this._channelId = null;
    this._localUid = null;
    this._isHost = false;
    this._currentMood = null;
    this._unsub = null;
    this._music = new BackgroundMusic();
    this._selectedMood = null;
    this._init();
  }

  _init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._db = firebase.firestore();
  }

  async init(channelId, localUid, isHost, gifReactions) {
    this._channelId = channelId;
    this._localUid = localUid;
    this._isHost = isHost;
    this._gifReactions = gifReactions || null;
    this._listen();
    this._initDrawerSwipe();

    if (isHost) {
      await this._db.collection("meetings").doc(channelId).set({
        session: { active: null, setBy: null, setAt: null },
      }, { merge: true }).catch(() => {});
      setTimeout(() => this._showHostMoodPrompt(), 1500);
    }
  }

  destroy() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
    this._music.stop();
    this._clearMoodUI();
    this._channelId = null;
    this._currentMood = null;
  }

  _listen() {
    if (!this._db || !this._channelId) return;
    this._unsub = this._db.collection("meetings").doc(this._channelId)
      .onSnapshot(snap => {
        const data = snap.data();
        if (!data?.session) return;
        const mood = data.session.active || null;
        if (mood !== this._currentMood) {
          this._currentMood = mood;
          this._applyMood(mood);
        }
      });
  }

  async _setMood(moodId) {
    if (!this._isHost || !this._db || !this._channelId) return;
    await this._db.collection("meetings").doc(this._channelId).set({
      session: { active: moodId || null, setBy: this._localUid, setAt: Date.now() },
    }, { merge: true });
  }

  _applyMood(mood) {
    const screen = this.container.querySelector("#meeting-screen");
    if (!screen) return;

    if (!mood) {
      screen.removeAttribute("data-mood");
      this._music.stop();
      this._removeAnimationLayer();
      this._updateFabLabel();
      if (this._gifReactions) this._gifReactions.setMoodTriggers({});
      return;
    }

    screen.setAttribute("data-mood", mood);
    this._music.play(mood);
    this._createAnimationLayer(mood);
    this._updateFabLabel();
    if (this._gifReactions) this._gifReactions.setMoodTriggers(MOOD_GIF_TRIGGERS[mood] || {});
  }

  _clearMoodUI() {
    const screen = this.container.querySelector("#meeting-screen");
    if (screen) screen.removeAttribute("data-mood");
    this._removeAnimationLayer();
  }

  getMoodGifTriggers() {
    if (!this._currentMood) return {};
    return MOOD_GIF_TRIGGERS[this._currentMood] || {};
  }

  // ── Animation layers ───────────────────────────────────────

  _removeAnimationLayer() {
    this.container.querySelector("#mood-anim-layer")?.remove();
  }

  _createAnimationLayer(mood) {
    this._removeAnimationLayer();
    const layer = document.createElement("div");
    layer.id = "mood-anim-layer";
    layer.className = `mood-anim mood-anim-${mood}`;

    const count = { romance: 20, soccer: 0, birthday: 30, gaming: 40, party: 15, african: 0 }[mood] || 0;

    if (mood === "romance") {
      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "mood-particle mood-heart";
        p.innerHTML = "&#9829;";
        p.style.left = Math.random() * 100 + "%";
        p.style.animationDelay = Math.random() * 8 + "s";
        p.style.animationDuration = (6 + Math.random() * 6) + "s";
        p.style.fontSize = (10 + Math.random() * 14) + "px";
        p.style.opacity = 0.3 + Math.random() * 0.4;
        layer.appendChild(p);
      }
    } else if (mood === "birthday") {
      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "mood-particle mood-confetti";
        const colors = ["#ffd700","#ff69b4","#00bfff","#ff6347","#9b59b6","#2ecc71"];
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        p.style.left = Math.random() * 100 + "%";
        p.style.animationDelay = Math.random() * 5 + "s";
        p.style.animationDuration = (3 + Math.random() * 4) + "s";
        p.style.width = (4 + Math.random() * 6) + "px";
        p.style.height = (8 + Math.random() * 8) + "px";
        layer.appendChild(p);
      }
    } else if (mood === "gaming") {
      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "mood-particle mood-matrix";
        const chars = "01アイウエオカキクケコ";
        p.textContent = chars[Math.floor(Math.random() * chars.length)];
        p.style.left = Math.random() * 100 + "%";
        p.style.animationDelay = Math.random() * 10 + "s";
        p.style.animationDuration = (4 + Math.random() * 8) + "s";
        p.style.fontSize = (10 + Math.random() * 8) + "px";
        layer.appendChild(p);
      }
    } else if (mood === "party") {
      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "mood-particle mood-disco";
        p.style.left = Math.random() * 100 + "%";
        p.style.top = Math.random() * 100 + "%";
        p.style.animationDelay = Math.random() * 3 + "s";
        p.style.animationDuration = (2 + Math.random() * 3) + "s";
        p.style.width = p.style.height = (3 + Math.random() * 8) + "px";
        layer.appendChild(p);
      }
    }

    const screen = this.container.querySelector("#meeting-screen");
    if (screen) screen.appendChild(layer);
  }

  // ── Slide Drawer ────────────────────────────────────────────

  toggleDrawer() {
    const drawer = this.container.querySelector("#moodDrawer");
    if (!drawer) return;
    const isOpen = drawer.classList.contains("mood-drawer-open");
    if (isOpen) this.closeDrawer();
    else this.openDrawer();
  }

  openDrawer() {
    const drawer = this.container.querySelector("#moodDrawer");
    if (!drawer) return;
    drawer.classList.add("mood-drawer-open");
    this._renderDrawerList();
  }

  closeDrawer() {
    const drawer = this.container.querySelector("#moodDrawer");
    if (drawer) drawer.classList.remove("mood-drawer-open");
  }

  _renderDrawerList() {
    const list = this.container.querySelector("#moodDrawerList");
    const activeLabel = this.container.querySelector("#moodDrawerActive");
    if (!list) return;

    const items = [
      { id: "", name: "Default", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>` },
      ...MOODS,
    ];

    list.innerHTML = items.map(m => {
      const id = m.id || "";
      const isActive = (this._currentMood || "") === id;
      const colorDots = m.colors ? m.colors.map(c => `<span style="width:8px;height:8px;border-radius:50%;background:${c};"></span>`).join("") : "";
      return `<button class="mood-drawer-item ${isActive ? "mood-drawer-item-active" : ""} ${!this._isHost && !isActive ? "mood-drawer-disabled" : ""}" data-mood="${id}">
        <span class="mood-drawer-item-icon">${m.icon}</span>
        <span class="mood-drawer-item-name">${m.name}</span>
        <span class="mood-drawer-item-colors">${colorDots}</span>
        ${isActive ? '<span class="mood-drawer-item-dot"></span>' : ""}
      </button>`;
    }).join("");

    if (activeLabel) {
      const active = MOODS.find(m => m.id === this._currentMood);
      activeLabel.textContent = active ? active.name : "None";
    }

    if (this._isHost) {
      list.querySelectorAll(".mood-drawer-item").forEach(btn => {
        btn.onclick = async () => {
          const mood = btn.dataset.mood || null;
          list.querySelectorAll(".mood-drawer-item").forEach(b => b.classList.remove("mood-drawer-item-active"));
          btn.classList.add("mood-drawer-item-active");
          await this._setMood(mood);
          setTimeout(() => this.closeDrawer(), 500);
        };
      });
    }
  }

  _updateFabLabel() {
    const activeLabel = this.container.querySelector("#moodDrawerActive");
    if (activeLabel) {
      const active = MOODS.find(m => m.id === this._currentMood);
      activeLabel.textContent = active ? active.name : "None";
    }
    const tab = this.container.querySelector("#moodDrawerTab");
    if (tab) {
      tab.classList.toggle("mood-tab-active", !!this._currentMood);
    }
  }

  _initDrawerSwipe() {
    const drawer = this.container.querySelector("#moodDrawer");
    if (!drawer) return;
    let startX = 0, startY = 0;
    drawer.addEventListener("touchstart", (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    drawer.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dy > 50) return;
      if (dx > 60) this.closeDrawer();
      else if (dx < -60) this.openDrawer();
    }, { passive: true });
  }

  _showHostMoodPrompt() {
    this.openDrawer();
  }

  // ── Picker modal ───────────────────────────────────────────

  showPicker() {
    this.container.querySelector("#sessionOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildSessionPicker(this._currentMood, this._isHost));
    this._selectedMood = this._currentMood || "";
    this._bindPickerEvents();
  }

  _bindPickerEvents() {
    const overlay = this.container.querySelector("#sessionOverlay");
    if (!overlay) return;

    overlay.querySelector("#sessionCloseBtn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelectorAll(".mood-card").forEach(card => {
      card.onclick = () => {
        overlay.querySelectorAll(".mood-card").forEach(c => c.classList.remove("mood-card-selected"));
        card.classList.add("mood-card-selected");
        this._selectedMood = card.dataset.mood;
      };
    });

    const applyBtn = overlay.querySelector("#sessionApplyBtn");
    if (applyBtn) {
      applyBtn.onclick = async () => {
        applyBtn.disabled = true;
        applyBtn.textContent = "Applying…";
        await this._setMood(this._selectedMood || null);
        overlay.remove();
      };
    }
  }

  // ── Music mute toggle (for top bar icon) ───────────────────

  toggleMusicMute() {
    return this._music.toggleMute();
  }

  get isMusicMuted() { return this._music.isMuted; }
  get currentMood() { return this._currentMood; }
}
