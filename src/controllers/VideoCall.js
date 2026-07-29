/**
 * src/controllers/VideoCall.js
 * Main app controller — Agora RTC, Firebase presence, UI state.
 */

import { AGORA_APP_ID, FIREBASE_CONFIG, EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, EMAILJS_TEMPLATE_GUEST, HOST_EMAIL } from "../config/config.js";
import { ICONS } from "../ui/icons.js";
import { buildJoinScreen, buildMeetingScreen, buildScheduleModal, buildSuccessToast, buildScreenZoomOverlay, buildNotifContainer } from "../ui/templates.js";
import { gradientForName } from "../utils/avatar.js";
import { initLogoAbsorption } from "../utils/logoAnimation.js";
import { ScreenZoomController } from "../utils/screenZoom.js";
import { GifReactions } from "../utils/gifReactions.js";
import { SessionController } from "./SessionController.js";
import { crolixAlert } from "../utils/confirmModal.js";

export class VideoCall {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.appId = AGORA_APP_ID;
    this.token = null;
    this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    this.localTracks = []; this.screenTrack = null;
    this.joined = false; this.joining = false;
    this.audioMuted = true; this.videoMuted = true; this.screenSharing = false;
    this.timerInterval = null; this.secondsElapsed = 0; this._emailjsReady = false;
    this._prewarmDone = false; this._prewarmPending = false; this._prewarmedTracks = null;
    this._db = null; this._participantRef = null; this._unsubscribe = null;
    this._channelId = null; this._localUid = null; this._localName = null;
    this._userSession = null;
    this._participants = {}; this._seenUids = new Set();
    this._initialLoad = true; this._presenceWritten = false;
    this._logoAnimCleanup = null; this._presencePromise = null;
    this._remoteScreenTracks = {};
    this._meetChatMsgUnsub = null; this._meetChatTypingUnsub = null;
    this._meetChatGuestUnsub = null; this._meetChatTargetUid = null; this._meetChatTypingTimer = null;
    this._meetingStatusUnsub = null; this._meetingEndTimeout = null; this._hostTimerMins = 5;
    this._initFirebase(); this._buildUI(); this._bindEvents(); this._loadEmailJS();
    this._logoAnimCleanup = initLogoAbsorption(this.container);
    this._screenZoom = new ScreenZoomController(this.container);
    this._gifReactions = new GifReactions(this.container);
    this._sessionController = new SessionController(this.container);
  }

  _initFirebase() {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      this._db = firebase.firestore();
      console.log("✅ Firebase ready");
    } catch (err) { console.error("Firebase init failed:", err); }
  }

  async _prewarmTracks() {
    if (this._prewarmDone || this._prewarmPending) return;
    this._prewarmPending = true;
    try {
      this._prewarmedTracks = await AgoraRTC.createMicrophoneAndCameraTracks();
      await this._prewarmedTracks[0].setEnabled(false);
      await this._prewarmedTracks[1].setEnabled(false);
      this._prewarmDone = true;
    } catch (_) { this._prewarmedTracks = null; }
    this._prewarmPending = false;
  }

  _showNotif(message, type = "join") {
    const c = this.container.querySelector("#notif-container");
    if (!c) return;
    const notif = document.createElement("div");
    notif.className = `notif-toast notif-${type}`;
    const icon = type === "join" ? `<span class="notif-icon notif-icon-join">→</span>` : `<span class="notif-icon notif-icon-leave">←</span>`;
    notif.innerHTML = `${icon}<span class="notif-msg">${message}</span>`;
    c.appendChild(notif);
    requestAnimationFrame(() => notif.classList.add("notif-show"));
    setTimeout(() => { notif.classList.remove("notif-show"); setTimeout(() => notif.remove(), 400); }, 4000);
  }

  _showBeamIn(name) {
    const overlay = document.createElement("div");
    overlay.className = "beam-in-overlay";
    const grad = gradientForName(name);
    const initial = (name || "?").charAt(0).toUpperCase();
    overlay.innerHTML = `
      <div class="beam-flash"></div>
      <div class="beam-ring"></div>
      <div class="beam-ring"></div>
      <div class="beam-column"></div>
      <div class="beam-cube-wrap">
        <div class="beam-cube" style="background:${grad};">
          <span class="beam-cube-initial">${initial}</span>
          <span class="beam-cube-name">${name}</span>
        </div>
      </div>
      <div class="beam-joined-label">${name} joined</div>
    `;
    const particleCount = 12;
    const cubeCenter = { x: window.innerWidth / 2, y: window.innerHeight * 0.27 };
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement("div");
      p.className = "beam-particle";
      const angle = (Math.PI * 2 * i) / particleCount;
      const dist = 40 + Math.random() * 60;
      p.style.left = cubeCenter.x + "px";
      p.style.top = cubeCenter.y + "px";
      p.style.setProperty("--px", Math.cos(angle) * dist + "px");
      p.style.setProperty("--py", Math.sin(angle) * dist + "px");
      p.style.animationDelay = (0.5 + Math.random() * 0.3) + "s";
      overlay.appendChild(p);
    }
    document.body.appendChild(overlay);
    setTimeout(() => {
      overlay.classList.add("beam-out");
      setTimeout(() => overlay.remove(), 600);
    }, 2800);
  }

  async _registerPresence(channelId, uid, name) {
    if (!this._db) return null;
    // Use Firebase userId as doc key to prevent duplicates from multiple tabs
    const fbUid = this._getMyFirebaseUid();
    const docId = fbUid || String(uid);
    const ref = this._db.collection("meetings").doc(channelId).collection("participants").doc(docId);
    this._participantRef = ref;
    const presenceData = { uid: String(uid), firebaseUid: fbUid || "", name, meetingId: channelId, videoMuted: true, audioMuted: true, joinedAt: Date.now() };
    if (this._userSession?.profilePicBase64) presenceData.profilePic = this._userSession.profilePicBase64;
    await ref.set(presenceData);
    this._presenceWritten = true;
    return ref;
  }

  async _deletePresence(channelId, uid) {
    if (!this._db) return;
    if (this._participantRef) { try { await this._participantRef.delete(); return; } catch (_) {} }
    const fbUid = this._getMyFirebaseUid();
    const docId = fbUid || String(uid);
    if (channelId && docId) { try { await this._db.collection("meetings").doc(channelId).collection("participants").doc(docId).delete(); } catch (_) {} }
  }

  _updateVideoState(muted) {
    this._participantRef?.update({ videoMuted: muted }).catch(() => {});
    if (this._localUid && this._participants[this._localUid]) this._participants[this._localUid].videoMuted = muted;
  }

  _updateAudioState(muted) {
    this._participantRef?.update({ audioMuted: muted }).catch(() => {});
    if (this._localUid && this._participants[this._localUid]) this._participants[this._localUid].audioMuted = muted;
  }

  _listenToParticipants(channelId, localUid) {
    if (!this._db) return;
    if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
    this._initialLoad = true;
    this._seenNames = new Set();
    const myFbUid = this._getMyFirebaseUid();
    const colRef = this._db.collection("meetings").doc(channelId).collection("participants");

    // Clean up stale docs from previous sessions before listening
    colRef.get().then(snap => {
      snap.forEach(doc => {
        const data = doc.data();
        if (!data) return;
        // Delete docs older than 12 hours (stale from crashed sessions)
        if (data.joinedAt && (Date.now() - data.joinedAt > 43200000)) {
          doc.ref.delete().catch(() => {});
        }
      });
    }).catch(() => {});

    this._unsubscribe = colRef.onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        const data = change.doc.data();
        if (!data) return;
        const docId = change.doc.id;
        const name = data.name || "Participant";
        const isLocalUser = docId === myFbUid || docId === localUid || String(data.uid) === localUid;
        // Local user's doc may be keyed by Firebase UID while the in-memory
        // entry was pre-populated under the Agora UID — merge into one key.
        const key = isLocalUser ? localUid : docId;

        // Skip duplicate names (same person from stale doc)
        if (change.type === "added" && !isLocalUser && this._seenNames.has(name)) {
          change.doc.ref.delete().catch(() => {});
          return;
        }

        if (change.type === "added") {
          this._participants[key] = { name, videoMuted: data.videoMuted !== false, audioMuted: data.audioMuted !== false, joinedAt: data.joinedAt || Date.now(), profilePic: data.profilePic || null, _fbUid: data.firebaseUid || docId };
          if (!isLocalUser) {
            this._seenNames.add(name);
            let player = document.getElementById(`remote-${docId}`);
            if (!player) player = this.createPlayer(`remote-${docId}`, name, data.profilePic || null);
            this._applyAvatarState(player, name, data.videoMuted !== false);
            if (!this._initialLoad) { this._showBeamIn(name); this._showNotif(`${name} joined the meeting`, "join"); }
          }
          this._seenUids.add(key); this._updateCountDisplay(); this._renderParticipantsList(); this._syncGifParticipants();
        }
        if (change.type === "modified") {
          this._participants[key] = { name, videoMuted: data.videoMuted !== false, audioMuted: data.audioMuted !== false, joinedAt: data.joinedAt || 0, profilePic: data.profilePic || this._participants[key]?.profilePic || null, _fbUid: data.firebaseUid || docId };
          if (!isLocalUser) { const p = document.getElementById(`remote-${docId}`); if (p) this._applyAvatarState(p, name, data.videoMuted !== false); }
          this._renderParticipantsList();
        }
        if (change.type === "removed") {
          const leavingName = this._participants[key]?.name || name;
          delete this._participants[key]; this._seenUids.delete(key); this._seenNames.delete(name);
          if (!isLocalUser) { document.getElementById(`remote-${docId}`)?.remove(); this._showNotif(`${leavingName} left the meeting`, "leave"); }
          this._updateCountDisplay(); this._renderParticipantsList(); this._syncGifParticipants();
        }
      });
      if (this._initialLoad) this._initialLoad = false;
    }, err => console.error("Firestore listener error:", err));
  }

  _updateCountDisplay() {
    if (!this.countEl) return;
    const count = Object.keys(this._participants || {}).length;
    this.countEl.textContent = count;
    const pc = this.container.querySelector("#panel-count");
    if (pc) pc.textContent = count;
  }

  _syncGifParticipants() {
    if (this._gifReactions) this._gifReactions.updateParticipants(this._participants, this._localUid);
  }

  _renderParticipantsList() {
    const list = this.container.querySelector("#participants-list");
    if (!list) return;
    list.innerHTML = "";
    const sorted = Object.entries(this._participants).sort(([uidA, infoA], [uidB, infoB]) => {
      if (uidA === this._localUid) return -1; if (uidB === this._localUid) return 1;
      return (infoA.joinedAt || 0) - (infoB.joinedAt || 0);
    });
    sorted.forEach(([uid, info]) => {
      const isLocal = uid === this._localUid;
      const li = document.createElement("li"); li.className = "participant-item";
      const initial = (info.name || "?").charAt(0).toUpperCase();
      const displayName = isLocal ? `${info.name} (You)` : info.name;
      const grad = gradientForName(info.name || "?");
      const camIcon = info.videoMuted
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14"/><rect x="1" y="6" width="14" height="12" rx="2" ry="2"/></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`;
      const micIcon = info.audioMuted
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/></svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>`;
      const avatarHtml = info.profilePic
        ? `<div class="p-avatar" style="padding:0;overflow:hidden;"><img src="${info.profilePic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" /></div>`
        : `<div class="p-avatar" style="background:${grad};">${initial}</div>`;
      li.innerHTML = `${avatarHtml}<span class="p-name">${displayName}</span><div class="p-indicators"><span class="p-status ${info.audioMuted ? "mic-off" : "mic-on"}">${micIcon}</span><span class="p-status ${info.videoMuted ? "cam-off" : "cam-on"}">${camIcon}</span></div>`;
      list.appendChild(li);
    });
  }

  _toggleParticipantsPanel() {
    const panel = this.container.querySelector("#participants-panel");
    if (!panel) return;
    const isVisible = panel.style.display !== "none";
    panel.style.display = isVisible ? "none" : "flex";
    if (!isVisible) this._renderParticipantsList();
  }

  _applyAvatarState(player, name, videoMuted) {
    if (!player) return;
    const avatar = player.querySelector(".avatar"), nameTag = player.querySelector(".name-tag");
    const avatarName = player.querySelector(".avatar-name"), initial = player.querySelector(".avatar-initial");
    if (nameTag) nameTag.textContent = name; if (avatarName) avatarName.textContent = name;
    if (initial) initial.textContent = name.charAt(0).toUpperCase();
    if (avatar) { avatar.style.background = gradientForName(name); avatar.style.display = videoMuted ? "flex" : "none"; avatar.style.zIndex = videoMuted ? "3" : ""; }
  }

  _patchPlayerName(player, name) {
    if (!player) return;
    const displayName = name.replace(/\s*\(You\)\s*$/, "");
    const nameTag = player.querySelector(".name-tag"), avatarName = player.querySelector(".avatar-name");
    const initial = player.querySelector(".avatar-initial"), avatar = player.querySelector(".avatar");
    if (nameTag) nameTag.textContent = name; if (avatarName) avatarName.textContent = displayName;
    if (initial) initial.textContent = displayName.charAt(0).toUpperCase();
    if (avatar) avatar.style.background = gradientForName(displayName);
  }

  async _resolveName(uid) {
    const cached = this._participants[uid]?.name;
    if (cached) return cached;
    if (this._db && this._channelId) {
      try {
        const snap = await this._db.collection("meetings").doc(this._channelId).collection("participants").doc(String(uid)).get();
        const data = snap.data();
        if (data?.name) {
          if (!this._participants[uid]) this._participants[uid] = { name: data.name, videoMuted: true, audioMuted: true };
          else this._participants[uid].name = data.name;
          return data.name;
        }
      } catch (_) {}
    }
    return "Participant";
  }

  _isScreenShareTrack(videoTrack) {
    if (!videoTrack) return false;
    const msTrack = videoTrack._mediaStreamTrack || (typeof videoTrack.getMediaStreamTrack === "function" ? videoTrack.getMediaStreamTrack() : null);
    if (!msTrack) return false;
    const label = (msTrack.label || "").toLowerCase(), contentHint = (msTrack.contentHint || "").toLowerCase();
    let displaySurface = "";
    try { displaySurface = (msTrack.getSettings?.()?.displaySurface || "").toLowerCase(); } catch (_) {}
    return (["monitor","window","browser"].includes(displaySurface) || ["detail","text"].includes(contentHint) || label.includes("screen") || label.includes("display") || label.includes("entire") || label.includes("window"));
  }

  _markScreenTile(player, uid, track, isRemote) {
    if (!player) return;
    player.classList.add("screen-share-tile");
    player.querySelector(".screen-expand-btn")?.remove(); player.querySelector(".screen-fs-btn")?.remove();
    if (!isRemote) return;
    const expandBtn = document.createElement("button"); expandBtn.className = "screen-expand-btn"; expandBtn.title = "Expand"; expandBtn.innerHTML = `${ICONS.expand} <span>Expand</span>`; player.appendChild(expandBtn);
    const fsBtn = document.createElement("button"); fsBtn.className = "screen-fs-btn"; fsBtn.title = "Fullscreen"; fsBtn.innerHTML = ICONS.fullscreen; player.appendChild(fsBtn);
    const openZoom = () => { const n = this._participants[uid]?.name || "Participant"; this._screenZoom.open(track, n); };
    expandBtn.addEventListener("click", (e) => { e.stopPropagation(); openZoom(); });
    fsBtn.addEventListener("click", (e) => { e.stopPropagation(); if (!this._screenZoom._open) { openZoom(); setTimeout(() => this._screenZoom._requestNativeFullscreen(), 120); } else { this._screenZoom._requestNativeFullscreen(); } });
    player._dblclickHandler = () => openZoom(); player.addEventListener("dblclick", player._dblclickHandler);
  }

  _unmarkScreenTile(player) {
    if (!player) return;
    player.classList.remove("screen-share-tile");
    player.querySelector(".screen-expand-btn")?.remove(); player.querySelector(".screen-fs-btn")?.remove();
    if (player._dblclickHandler) { player.removeEventListener("dblclick", player._dblclickHandler); player._dblclickHandler = null; }
  }

  _addVideoFullscreenBtn(player, uid, track) {
    if (!player || player.querySelector(".video-fs-btn")) return;
    const btn = document.createElement("button"); btn.className = "video-fs-btn"; btn.title = "Fullscreen"; btn.innerHTML = ICONS.fullscreen;
    btn.addEventListener("click", (e) => { e.stopPropagation(); const n = this._participants[uid]?.name || "Participant"; this._screenZoom.open(track, n); setTimeout(() => this._screenZoom._requestNativeFullscreen(), 120); });
    player.appendChild(btn);
  }

  _buildUI() {
    this.container.innerHTML = buildJoinScreen() + buildMeetingScreen() + buildScheduleModal() + buildSuccessToast() + buildScreenZoomOverlay() + buildNotifContainer();
    this.joinScreen = this.container.querySelector("#join-screen"); this.meetingScreen = this.container.querySelector("#meeting-screen");
    this.videoStreams = this.container.querySelector("#video-streams"); this.timerEl = this.container.querySelector("#meeting-timer");
    this.countEl = this.container.querySelector("#count-num"); this.meetingNameEl = this.container.querySelector("#meeting-name");
    // Pre-fill join form from invite link (?join=meetId&name=guestName)
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join"), joinName = params.get("name");
    if (joinId) {
      const chEl = this.container.querySelector("#channelName"); if (chEl) chEl.value = joinId;
      if (joinName) { const nmEl = this.container.querySelector("#username"); if (nmEl && !nmEl.value) nmEl.value = joinName; }
      // Clean URL without reloading
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  _bindEvents() {
    this.container.querySelector("#joinBtn").onclick = () => this.joinChannel();
    this.container.querySelector("#leaveBtn").onclick = () => this._handleLeave();
    this.container.querySelector("#muteAudio").onclick = () => this.toggleAudio();
    this.container.querySelector("#muteVideo").onclick = () => this.toggleVideo();
    this.container.querySelector("#shareScreenBtn").onclick = () => this.shareScreen();
    this.container.querySelector("#premiumBtn").onclick = () => this.openSchedule();
    this.container.querySelector("#schedClose").onclick = () => this.closeSchedule();
    this.container.querySelector("#schedCopyId").onclick = () => this.copyMeetingId();
    this.container.querySelector("#schedLookupBtn").onclick = () => this.lookupInvitee();
    this.container.querySelector("#sched-invite-id").onkeydown = (e) => { if (e.key === "Enter") this.lookupInvitee(); };
    this.container.querySelector("#schedSubmit").onclick = () => this.submitSchedule();
    this.container.querySelector("#schedule-overlay").onclick = (e) => { if (e.target.id === "schedule-overlay") this.closeSchedule(); };
    this.container.querySelector("#channelName").onkeydown = (e) => { if (e.key === "Enter") this.joinChannel(); };
    this.container.querySelector("#username").onkeydown = (e) => { if (e.key === "Enter") this.joinChannel(); };
    const prewarm = () => this._prewarmTracks();
    this.container.querySelector("#username").addEventListener("focus", prewarm, { once: true });
    this.container.querySelector("#channelName").addEventListener("focus", prewarm, { once: true });
    this.container.querySelector("#count").onclick = () => this._toggleParticipantsPanel();
    this.container.querySelector("#closePanelBtn").onclick = () => { const p = this.container.querySelector("#participants-panel"); if (p) p.style.display = "none"; };
    this.container.querySelector("#meetChatBtn").onclick = () => this._toggleMeetChat();
    this.container.querySelector("#moodDrawerTab").onclick = () => this._sessionController.toggleDrawer();
    this.container.querySelector("#musicMuteBtn").onclick = () => this._toggleMusicMute();
    this.container.querySelector("#closeMeetChatBtn").onclick = () => this._closeMeetChat();
    this.container.querySelector("#meetChatBackBtn").onclick = () => this._meetChatBackToList();
    this.container.querySelector("#meetChatSendBtn").onclick = () => this._meetChatSend();
    this.container.querySelector("#meet-chat-input").onkeydown = (e) => { if (e.key === "Enter") this._meetChatSend(); };
    this.container.querySelector("#meet-chat-input").oninput = () => this._meetChatSetTyping();
    const mcAttach = this.container.querySelector("#meetChatAttachBtn");
    const mcFile = this.container.querySelector("#meetChatFileInput");
    if (mcAttach && mcFile) {
      mcAttach.onclick = () => mcFile.click();
      mcFile.onchange = () => { const f = mcFile.files[0]; if (f) this._meetChatSendFile(f); mcFile.value = ""; };
    }
  }

  _loadEmailJS() {
    if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); this._emailjsReady = true; return; }
    const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = () => { window.emailjs.init(EMAILJS_PUBLIC_KEY); this._emailjsReady = true; };
    s.onerror = () => console.error("Failed to load EmailJS SDK.");
    document.head.appendChild(s);
  }

  openSchedule() {
    const overlay = this.container.querySelector("#schedule-overlay");
    const myMeetId = this._channelId || "";
    const mySession = (() => { try { return JSON.parse(localStorage.getItem("crolixUser")); } catch(_){return null;} })();
    this.container.querySelector("#sched-meetid").value = mySession?.meetingId || myMeetId;
    this.container.querySelector("#sched-invite-id").value = "";
    const result = this.container.querySelector("#schedLookupResult");
    if (result) { result.style.display = "none"; result.innerHTML = ""; }
    this._schedInviteTarget = null;
    overlay.style.display = "flex"; requestAnimationFrame(() => overlay.classList.add("open"));
  }

  closeSchedule() {
    const overlay = this.container.querySelector("#schedule-overlay");
    overlay.classList.remove("open"); setTimeout(() => { overlay.style.display = "none"; }, 300);
  }

  copyMeetingId() {
    const val = this.container.querySelector("#sched-meetid").value.trim();
    if (!val) return;
    navigator.clipboard.writeText(val).catch(() => {});
    const btn = this.container.querySelector("#schedCopyId"); btn.classList.add("copied"); setTimeout(() => btn.classList.remove("copied"), 1800);
  }

  async lookupInvitee() {
    const inviteId = this.container.querySelector("#sched-invite-id").value.trim().toLowerCase();
    const resultEl = this.container.querySelector("#schedLookupResult");
    if (!inviteId) { this._schedError("Enter a Meeting ID to look up."); return; }
    if (!this._db) { this._schedError("Database not available."); return; }

    resultEl.style.display = ""; resultEl.innerHTML = '<div style="padding:8px;font-size:12px;color:var(--text-dim);">Looking up…</div>';
    this._schedInviteTarget = null;

    try {
      const idDoc = await this._db.collection("meetingIds").doc(inviteId).get();
      if (!idDoc.exists) { resultEl.innerHTML = '<div style="padding:8px;font-size:12px;color:#f87171;">❌ No user found with this Meeting ID</div>'; return; }
      const userId = idDoc.data().userId;
      const userDoc = await this._db.collection("users").doc(userId).get();
      if (!userDoc.exists) { resultEl.innerHTML = '<div style="padding:8px;font-size:12px;color:#f87171;">❌ User not found</div>'; return; }
      const user = userDoc.data();
      this._schedInviteTarget = { name: user.name, email: user.email, meetingId: inviteId, pic: user.profilePicBase64 };

      const picHtml = user.profilePicBase64
        ? `<img src="${user.profilePicBase64}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;" />`
        : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px;">${(user.name||"?").charAt(0).toUpperCase()}</div>`;
      resultEl.innerHTML = `<div class="sched-user-found">${picHtml}<div><strong>${user.name}</strong><br><span style="font-size:11px;color:var(--text-dim);">${user.email}</span></div><span class="sched-found-check">✓</span></div>`;
    } catch (err) {
      console.error("Lookup error:", err);
      resultEl.innerHTML = '<div style="padding:8px;font-size:12px;color:#f87171;">❌ Lookup failed</div>';
    }
  }

  async submitSchedule() {
    if (!this._emailjsReady || !window.emailjs) { this._schedError("Email service not ready."); return; }
    if (!this._schedInviteTarget) { this._schedError("Look up a user first by their Meeting ID."); return; }

    const get = (id) => this.container.querySelector(`#${id}`).value.trim();
    const date = get("sched-date"), time = get("sched-time"), message = get("sched-message");
    const myMeetId = get("sched-meetid");
    if (!date || !time) { this._schedError("Please select a date and time."); return; }

    const mySession = (() => { try { return JSON.parse(localStorage.getItem("crolixUser")); } catch(_){return null;} })();
    const myName = mySession?.name || this._localName || "Someone";
    const myEmail = mySession?.email || "";

    const btn = this.container.querySelector("#schedSubmit"); btn.disabled = true; btn.textContent = "Sending…";
    const formattedDate = new Date(`${date}T${time}`).toLocaleString("en-ZA", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

    const joinBase = (window.location.origin + window.location.pathname).replace(/\/[^/]*$/, "/");
    // Use %26 for & so the URL inside an HTML href attribute stays valid
    const joinLink = `${joinBase}?join=${encodeURIComponent(myMeetId)}`;

    const senderPic = mySession?.profilePicBase64 || "";

    const inviteParams = {
      to_email: this._schedInviteTarget.email,
      to_name: this._schedInviteTarget.name || "there",
      from_name: myName,
      initials: myName.charAt(0).toUpperCase(),
      sender_pic: senderPic,
      meeting_id: myMeetId,
      date_time: formattedDate,
      guest_email: myEmail,
      message: message || `You have been invited to a meeting on CrolixVmeetChat.`,
      join_link: joinLink,
    };

    try {
      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, inviteParams);
      this.closeSchedule(); this._showSuccessToast(); this._resetScheduleForm();
    } catch (err) { this._schedError(`Failed to send — ${err?.text || err?.message || "Unknown error"}`); }
    finally { btn.disabled = false; btn.innerHTML = `${ICONS.send} Send Invite`; }
  }

  _schedError(msg) {
    this.container.querySelector(".sched-err")?.remove();
    const err = Object.assign(document.createElement("p"), { className: "sched-err", textContent: "⚠ " + msg });
    this.container.querySelector("#schedSubmit").insertAdjacentElement("beforebegin", err);
    setTimeout(() => err.remove(), 4000);
  }

  _resetScheduleForm() {
    ["sched-invite-id","sched-date","sched-time","sched-message"]
      .forEach(id => { const el = this.container.querySelector(`#${id}`); if (el) el.value = ""; });
    this._schedInviteTarget = null;
    const result = this.container.querySelector("#schedLookupResult");
    if (result) { result.style.display = "none"; result.innerHTML = ""; }
  }

  _showSuccessToast() {
    const toast = this.container.querySelector("#sched-success-toast");
    toast.style.display = "flex"; toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => { toast.style.display = "none"; }, 500); }, 4000);
  }

  _pad(n) { return String(n).padStart(2, "0"); }

  startTimer() {
    this.secondsElapsed = 0;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.secondsElapsed++;
      if (this.timerEl) this.timerEl.innerText = `${this._pad(Math.floor(this.secondsElapsed / 60))}:${this._pad(this.secondsElapsed % 60)}`;
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    this.secondsElapsed = 0; if (this.timerEl) this.timerEl.innerText = "00:00";
  }

  createPlayer(id, name, profilePic) {
    const existing = document.getElementById(id); if (existing) return existing;
    const div = document.createElement("div"); div.id = id; div.className = "video-player";
    const avatarInner = profilePic
      ? `<img src="${profilePic}" style="width:clamp(80px,14vw,120px);height:clamp(80px,14vw,120px);border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.32);box-shadow:0 4px 24px rgba(0,0,0,0.25);" alt="${name}" />`
      : `<span class="avatar-initial">${name.charAt(0).toUpperCase()}</span>`;
    div.innerHTML = `<div class="avatar" style="background:${gradientForName(name)}; display:flex; z-index:3;">${avatarInner}<span class="avatar-name">${name}</span></div><div class="name-tag">${name}</div>`;
    this.videoStreams.appendChild(div); return div;
  }

  async joinChannel() {
    if (this.joined || this.joining) return;
    const name = this.container.querySelector("#username").value.trim();
    const channel = this.container.querySelector("#channelName").value.trim();
    if (!name || !channel) { crolixAlert("Please enter your name and a meeting ID.", { title: "Missing info", icon: "warning" }); return; }
    this.joining = true;
    const joinBtn = this.container.querySelector("#joinBtn"); joinBtn.disabled = true; joinBtn.textContent = "Joining…";
    try {
      let tracksPromise;
      if (this._prewarmDone && this._prewarmedTracks) tracksPromise = Promise.resolve(this._prewarmedTracks);
      else if (this._prewarmPending) tracksPromise = new Promise(resolve => { const poll = setInterval(() => { if (!this._prewarmPending) { clearInterval(poll); resolve(this._prewarmedTracks ?? AgoraRTC.createMicrophoneAndCameraTracks()); } }, 100); });
      else tracksPromise = AgoraRTC.createMicrophoneAndCameraTracks();
      this._prewarmDone = false; this._prewarmedTracks = null;
      const [joinedUid, tracks] = await Promise.all([this.client.join(this.appId, channel, this.token, null), tracksPromise]);
      this.localTracks = tracks; this.uid = joinedUid; this._channelId = channel; this._localName = name; this._localUid = String(joinedUid);
      await this.localTracks[0].setEnabled(true); await this.localTracks[1].setEnabled(true);
      await this.client.publish(this.localTracks);
      await this.localTracks[0].setMuted(true); await this.localTracks[1].setMuted(true);

      this.client.on("user-published", async (user, mediaType) => {
        await this.client.subscribe(user, mediaType);
        const uid = String(user.uid), resolvedName = await this._resolveName(uid);
        let player = document.getElementById(`remote-${uid}`);
        if (!player) player = this.createPlayer(`remote-${uid}`, resolvedName);
        this._patchPlayerName(player, resolvedName);
        if (mediaType === "video") {
          user.videoTrack.play(player);
          const avatar = player.querySelector(".avatar"); if (avatar) { avatar.style.display = "none"; avatar.style.zIndex = ""; }
          if (this._isScreenShareTrack(user.videoTrack)) { this._remoteScreenTracks[uid] = user.videoTrack; this._markScreenTile(player, uid, user.videoTrack, true); }
          else this._addVideoFullscreenBtn(player, uid, user.videoTrack);
        }
        if (mediaType === "audio") user.audioTrack.play();
      });

      this.client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
          const uid = String(user.uid), player = document.getElementById(`remote-${uid}`);
          if (player) {
            const pName = this._participants[uid]?.name || "Participant", avatar = player.querySelector(".avatar");
            if (avatar) { avatar.style.background = gradientForName(pName); avatar.style.display = "flex"; avatar.style.zIndex = "3"; }
            if (this._remoteScreenTracks[uid]) { delete this._remoteScreenTracks[uid]; this._unmarkScreenTile(player); if (this._screenZoom._open) this._screenZoom.close(); }
            player.querySelector(".video-fs-btn")?.remove();
          }
        }
      });

      this.client.on("user-left", (user) => {
        const uid = String(user.uid);
        if (!this._participants[uid]) { document.getElementById(`remote-${uid}`)?.remove(); this._updateCountDisplay(); }
        if (this._remoteScreenTracks[uid]) { delete this._remoteScreenTracks[uid]; if (this._screenZoom._open) this._screenZoom.close(); }
      });

      this._participants[this._localUid] = { name, videoMuted: true, audioMuted: true, joinedAt: Date.now() };
      this._listenToParticipants(channel, this._localUid);
      this.joinScreen.style.display = "none"; this.meetingScreen.style.display = "flex";
      this.meetingNameEl.innerText = `Meeting: ${channel}`;
      const localPic = this._userSession?.profilePicBase64 || null;
      const localPlayer = this.createPlayer("local-player", `${name} (You)`, localPic);
      this.localTracks[1].play(localPlayer);
      const localAvatar = localPlayer.querySelector(".avatar"); if (localAvatar) localAvatar.style.display = "flex";
      this.joined = true; this.joining = false; this.startTimer(); this._updateCountDisplay();
      this._presenceWritten = false;
      this._gifReactions.start();
      if (this._isHost()) { this._setMeetingStatus("active"); }
      this._listenMeetingStatus();
      this._sessionController.init(channel, String(joinedUid), this._isHost(), this._gifReactions);
      this._showMusicBtn();
      this._presencePromise = this._registerPresence(channel, joinedUid, name).catch(err => { console.warn("Presence write failed:", err); return null; });
    } catch (err) {
      console.error("Join error:", err); crolixAlert("Could not join: " + (err.message || err), { title: "Join failed", icon: "error" });
      joinBtn.disabled = false; joinBtn.textContent = "Join Now"; this.joining = false; this.joined = false;
      this.joinScreen.style.display = "flex"; this.meetingScreen.style.display = "none";
      this.localTracks.forEach(t => { try { t.stop(); t.close(); } catch (_) {} }); this.localTracks = [];
      this._prewarmDone = false; this._prewarmedTracks = null; this._participants = {}; this._localUid = null; this._presencePromise = null;
      if (this._unsubscribe) { this._unsubscribe(); this._unsubscribe = null; }
      try { await this.client.leave(); } catch (_) {}
    }
  }

  leaveChannel() {
    if (!this.joined && !this.joining) return;
    if (this._screenZoom?._open) this._screenZoom.close();
    if (this._gifReactions) this._gifReactions.stop();
    const pendingPresence = this._presencePromise, snapshotRef = this._participantRef;
    const snapshotChannel = this._channelId, snapshotUid = this._localUid;
    const screenTrack = this.screenTrack, localTracks = this.localTracks.slice();
    const client = this.client, unsubscribe = this._unsubscribe;
    this.joined = false; this.joining = false; this.audioMuted = true; this.videoMuted = true; this.screenSharing = false;
    this._sessionController.destroy();
    const musicBtn = this.container.querySelector("#musicMuteBtn"); if (musicBtn) musicBtn.style.display = "none";
    this._meetChatCleanup();
    if (this._meetingStatusUnsub) { this._meetingStatusUnsub(); this._meetingStatusUnsub = null; }
    if (this._meetingEndTimeout) { clearTimeout(this._meetingEndTimeout); this._meetingEndTimeout = null; }
    const meetChatPanel = this.container.querySelector("#meet-chat-panel"); if (meetChatPanel) meetChatPanel.style.display = "none";
    const meetEndedOverlay = this.container.querySelector("#meetingEndedOverlay"); if (meetEndedOverlay) meetEndedOverlay.style.display = "none";
    const hostOverlay = this.container.querySelector("#hostLeaveOverlay"); if (hostOverlay) hostOverlay.style.display = "none";
    this._participants = {}; this._seenUids.clear(); this._presenceWritten = false;
      this._presencePromise = null;
    this._unsubscribe = null; this._participantRef = null; this._channelId = null; this._localUid = null;
    this._localName = null; this.screenTrack = null; this.localTracks = []; this._remoteScreenTracks = {};
    if (unsubscribe) unsubscribe();
    this.stopTimer();
    this.videoStreams.innerHTML = ""; this.meetingScreen.style.display = "none"; this.joinScreen.style.display = "flex";
    const panel = this.container.querySelector("#participants-panel"); if (panel) panel.style.display = "none";
    const joinBtn = this.container.querySelector("#joinBtn"); if (joinBtn) { joinBtn.disabled = false; joinBtn.textContent = "Join Now"; }
    const muteAudio = this.container.querySelector("#muteAudio"), muteVideo = this.container.querySelector("#muteVideo");
    const shareBtnEl = this.container.querySelector("#shareScreenBtn"), shareLabel = this.container.querySelector("#share-label");
    if (muteAudio)  { muteAudio.classList.add("muted");     muteAudio.innerHTML  = `<span class="btn-icon">${ICONS.micOff}</span><span class="btn-label">Mute</span>`; }
    if (muteVideo)  { muteVideo.classList.add("video-off"); muteVideo.innerHTML  = `<span class="btn-icon">${ICONS.camOff}</span><span class="btn-label">Start Video</span>`; }
    if (shareBtnEl) shareBtnEl.classList.remove("sharing");
    if (shareLabel) shareLabel.innerText = "Share";
    if (this._logoAnimCleanup) this._logoAnimCleanup();
    this._logoAnimCleanup = initLogoAbsorption(this.container);
    this._prewarmDone = false; this._prewarmedTracks = null; this._prewarmPending = false;
    const prewarm = () => this._prewarmTracks();
    this.container.querySelector("#username").addEventListener("focus", prewarm, { once: true });
    this.container.querySelector("#channelName").addEventListener("focus", prewarm, { once: true });
    try { this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }); } catch (_) {}
    (async () => {
      localTracks.forEach(t => { try { t.stop(); t.close(); } catch (_) {} });
      if (screenTrack) { try { screenTrack.stop(); screenTrack.close(); } catch (_) {} }
      if (pendingPresence) { try { await pendingPresence; } catch (_) {} }
      this._participantRef = snapshotRef; await this._deletePresence(snapshotChannel, snapshotUid); this._participantRef = null;
      try { await Promise.race([client.leave(), new Promise((_, rej) => setTimeout(() => rej(new Error("leave timeout")), 3000))]); }
      catch (err) { console.warn("Agora leave (non-fatal):", err.message); }
    })();
  }

  // ── Music mute toggle ───────────────────────────────────────
  _toggleMusicMute() {
    const muted = this._sessionController.toggleMusicMute();
    const btn = this.container.querySelector("#musicMuteBtn");
    if (btn) {
      btn.innerHTML = muted ? ICONS.musicOff : ICONS.musicOn;
      btn.classList.toggle("muted", muted);
    }
  }

  _showMusicBtn() {
    const btn = this.container.querySelector("#musicMuteBtn");
    if (btn) btn.style.display = "";
  }

  // ══════════════════════════════════════════════
  // HOST CONTROLS & MEETING LIFECYCLE
  // ══════════════════════════════════════════════

  _isHost() {
    try {
      const session = JSON.parse(localStorage.getItem("crolixUser"));
      return session?.meetingId === this._channelId;
    } catch (_) { return false; }
  }

  _handleLeave() {
    if (!this.joined && !this.joining) return;
    if (this._isHost()) {
      this._showHostLeaveModal();
    } else {
      this.leaveChannel();
    }
  }

  _showHostLeaveModal() {
    const overlay = this.container.querySelector("#hostLeaveOverlay");
    if (!overlay) return;
    overlay.style.display = "flex";
    const timerPicker = this.container.querySelector("#hostTimerPicker");
    if (timerPicker) timerPicker.style.display = "none";

    this.container.querySelector("#hostEndNow").onclick = () => {
      overlay.style.display = "none";
      this._endMeetingForAll();
    };

    this.container.querySelector("#hostEndTimer").onclick = () => {
      if (timerPicker) timerPicker.style.display = "";
    };

    this.container.querySelector("#hostKeepAlive").onclick = () => {
      overlay.style.display = "none";
      this._setMeetingStatus("alive");
      this.leaveChannel();
    };

    this.container.querySelector("#hostLeaveCancel").onclick = () => {
      overlay.style.display = "none";
    };

    // Timer picker
    this._hostTimerMins = 5;
    this.container.querySelectorAll(".host-timer-opt").forEach(btn => {
      btn.onclick = () => {
        this.container.querySelectorAll(".host-timer-opt").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this._hostTimerMins = parseInt(btn.dataset.mins);
      };
    });

    this.container.querySelector("#hostTimerConfirm").onclick = () => {
      overlay.style.display = "none";
      this._endMeetingWithTimer(this._hostTimerMins);
    };
  }

  async _setMeetingStatus(status, endsAt) {
    if (!this._db || !this._channelId) return;
    const data = { status, updatedAt: Date.now() };
    if (endsAt) data.endsAt = endsAt;
    await this._db.collection("meetings").doc(this._channelId).set(data, { merge: true }).catch(() => {});
  }

  async _endMeetingForAll() {
    await this._setMeetingStatus("ended");
    this.leaveChannel();
  }

  async _endMeetingWithTimer(mins) {
    const endsAt = Date.now() + mins * 60000;
    await this._setMeetingStatus("ending", endsAt);
    this.leaveChannel();
  }

  _listenMeetingStatus() {
    if (!this._db || !this._channelId || this._isHost()) return;
    this._meetingStatusUnsub = this._db.collection("meetings").doc(this._channelId)
      .onSnapshot(snap => {
        const data = snap.data();
        if (!data) return;

        if (data.status === "ended") {
          this._showMeetingEnded("Meeting has ended", "The host ended this meeting.");
        } else if (data.status === "ending" && data.endsAt) {
          const remaining = Math.max(0, data.endsAt - Date.now());
          if (remaining <= 0) {
            this._showMeetingEnded("Meeting has ended", "The host's timer has expired.");
          } else {
            this._showMeetingEndingTimer(remaining);
          }
        }
      });
  }

  _showMeetingEnded(title, msg) {
    const overlay = this.container.querySelector("#meetingEndedOverlay");
    if (!overlay || overlay.style.display !== "none") return;
    overlay.style.display = "flex";
    this.container.querySelector("#meetingEndedTitle").textContent = title;
    this.container.querySelector("#meetingEndedMsg").textContent = msg;
    const countdownEl = this.container.querySelector("#meetingEndedCountdown");
    if (countdownEl) countdownEl.style.display = "";
    let secs = 5;
    const timerEl = this.container.querySelector("#meetingEndedTimer");
    if (timerEl) timerEl.textContent = secs;
    const iv = setInterval(() => {
      secs--;
      if (timerEl) timerEl.textContent = secs;
      if (secs <= 0) { clearInterval(iv); this._forceLeaveMeeting(); }
    }, 1000);

    this.container.querySelector("#meetingEndedLeave").onclick = () => {
      clearInterval(iv);
      this._forceLeaveMeeting();
    };
  }

  _showMeetingEndingTimer(remainingMs) {
    const overlay = this.container.querySelector("#meetingEndedOverlay");
    if (!overlay || overlay.style.display !== "none") return;
    const mins = Math.ceil(remainingMs / 60000);
    overlay.style.display = "flex";
    this.container.querySelector("#meetingEndedTitle").textContent = "Host has left";
    this.container.querySelector("#meetingEndedMsg").textContent = `Meeting will end in ~${mins} minute${mins !== 1 ? "s" : ""}`;
    const countdownEl = this.container.querySelector("#meetingEndedCountdown");
    if (countdownEl) countdownEl.style.display = "none";
    this.container.querySelector("#meetingEndedLeave").textContent = "OK";
    this.container.querySelector("#meetingEndedLeave").onclick = () => {
      overlay.style.display = "none";
    };

    // Set actual timeout to end
    this._meetingEndTimeout = setTimeout(() => {
      this._showMeetingEnded("Meeting has ended", "The host's timer has expired.");
    }, remainingMs);
  }

  _forceLeaveMeeting() {
    const overlay = this.container.querySelector("#meetingEndedOverlay");
    if (overlay) overlay.style.display = "none";
    this.leaveChannel();
  }

  // ══════════════════════════════════════════════
  // MEETING CHAT
  // ══════════════════════════════════════════════

  _meetChatId(a, b) { return [a, b].sort().join("_"); }

  _toggleMeetChat() {
    const panel = this.container.querySelector("#meet-chat-panel");
    if (!panel) return;
    const vis = panel.style.display !== "none";
    panel.style.display = vis ? "none" : "flex";
    if (!vis) this._meetChatRenderUserList();
  }

  _closeMeetChat() {
    const panel = this.container.querySelector("#meet-chat-panel");
    if (panel) panel.style.display = "none";
    this._meetChatCleanup();
  }

  _meetChatCleanup() {
    if (this._meetChatMsgUnsub) { this._meetChatMsgUnsub(); this._meetChatMsgUnsub = null; }
    if (this._meetChatTypingUnsub) { this._meetChatTypingUnsub(); this._meetChatTypingUnsub = null; }
    if (this._meetChatGuestUnsub) { this._meetChatGuestUnsub(); this._meetChatGuestUnsub = null; }
    this._meetChatTargetUid = null;
    clearTimeout(this._meetChatTypingTimer);
  }

  _meetChatRenderUserList() {
    const listEl = this.container.querySelector("#meet-chat-user-list");
    const selectEl = this.container.querySelector("#meet-chat-select");
    const activeEl = this.container.querySelector("#meet-chat-active");
    const guestBlock = this.container.querySelector("#meet-chat-guest-block");
    if (!listEl) return;

    selectEl.style.display = ""; activeEl.style.display = "none"; guestBlock.style.display = "none";
    this._meetChatCleanup();

    const others = Object.entries(this._participants).filter(([uid]) => uid !== this._localUid);
    if (others.length === 0) {
      listEl.innerHTML = '<div class="profile-empty" style="padding:16px;font-size:12px;">No other participants to chat with</div>';
      return;
    }

    listEl.innerHTML = others.map(([uid, info]) => {
      const initial = (info.name || "?").charAt(0).toUpperCase();
      return `<div class="meet-chat-user-item" data-uid="${uid}">
        <div class="p-avatar" style="background:${gradientForName(info.name)};width:30px;height:30px;font-size:12px;">${initial}</div>
        <span class="meet-chat-user-name">${info.name}</span>
      </div>`;
    }).join("");

    listEl.querySelectorAll(".meet-chat-user-item").forEach(item => {
      item.onclick = () => this._meetChatOpenWith(item.dataset.uid);
    });
  }

  async _meetChatOpenWith(targetUid) {
    this._meetChatCleanup();
    this._meetChatTargetUid = targetUid;

    const selectEl = this.container.querySelector("#meet-chat-select");
    const activeEl = this.container.querySelector("#meet-chat-active");
    const guestBlock = this.container.querySelector("#meet-chat-guest-block");

    const targetName = this._participants[targetUid]?.name || "User";
    const nameEl = this.container.querySelector("#meetChatName");
    if (nameEl) nameEl.textContent = targetName;

    const picEl = this.container.querySelector("#meetChatPic");
    if (picEl) {
      const initial = targetName.charAt(0).toUpperCase();
      picEl.innerHTML = `<div class="p-avatar" style="background:${gradientForName(targetName)};width:28px;height:28px;font-size:11px;">${initial}</div>`;
    }

    // Resolve Firestore userId for target
    const targetFirebaseUid = await this._resolveFirebaseUid(targetUid);
    const myFirebaseUid = this._getMyFirebaseUid();

    if (!targetFirebaseUid || !myFirebaseUid) {
      selectEl.style.display = "none"; activeEl.style.display = "none"; guestBlock.style.display = "";
      guestBlock.querySelector(".meet-chat-guest-text").textContent = "Chat not available — sign in required";
      guestBlock.querySelector("#meetChatRequestBtn").style.display = "none";
      return;
    }

    const chatId = this._meetChatId(myFirebaseUid, targetFirebaseUid);

    // Check if this user is one of the two chat owners
    const isChatOwner = chatId.split("_").includes(myFirebaseUid);

    if (isChatOwner) {
      selectEl.style.display = "none"; activeEl.style.display = "flex"; guestBlock.style.display = "none";
      this._meetChatListenMessages(chatId);
      this._meetChatListenTyping(chatId, targetFirebaseUid);
      this._meetChatListenGuestRequests(chatId);
    } else {
      // Third party — check if they have temporary access
      selectEl.style.display = "none"; activeEl.style.display = "none"; guestBlock.style.display = "flex";
      guestBlock.querySelector("#meetChatRequestBtn").style.display = "";
      guestBlock.querySelector("#meetChatRequestBtn").onclick = () => this._meetChatRequestAccess(chatId, myFirebaseUid);
      this._meetChatListenGuestAccess(chatId, myFirebaseUid, targetFirebaseUid);
    }
  }

  _meetChatBackToList() {
    this._meetChatCleanup();
    this._meetChatRenderUserList();
  }

  // ── Messages ───────────────────────────────────────────────

  _meetChatListenMessages(chatId) {
    const messagesEl = this.container.querySelector("#meet-chat-messages");
    if (!messagesEl) return;
    messagesEl.innerHTML = '<div class="profile-loading" style="padding:16px;"><div class="profile-spinner"></div></div>';

    const myUid = this._getMyFirebaseUid();
    this._meetChatMsgUnsub = this._db.collection("chats").doc(chatId)
      .collection("messages").orderBy("createdAt", "asc")
      .onSnapshot(snap => {
        const msgs = [];
        snap.forEach(doc => {
          const d = doc.data();
          if ((d.deletedFor || []).includes(myUid)) return;
          if (d.deletedForEveryone) { msgs.push({ id: doc.id, ...d }); return; }
          msgs.push({ id: doc.id, ...d });
        });
        this._meetChatRenderMessages(msgs, messagesEl, myUid);
      });
  }

  _meetChatRenderMessages(msgs, el, myUid) {
    let html = "";
    let lastDate = "";
    msgs.forEach(msg => {
      const dateStr = new Date(msg.createdAt).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
      if (dateStr !== lastDate) { html += `<div class="chat-date-sep"><span>${dateStr}</span></div>`; lastDate = dateStr; }

      const isOwn = msg.senderId === myUid;
      if (msg.deletedForEveryone) {
        html += `<div class="mchat-row" data-msgid="${msg.id}"><div class="chat-bubble chat-bubble-deleted" style="font-size:11px;">Message deleted</div></div>`;
        return;
      }
      const time = new Date(msg.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
      let content = "";
      if (msg.type === "sticker") { html += `<div class="mchat-row ${isOwn ? "mchat-own" : ""}" data-msgid="${msg.id}"><div class="chat-sticker-msg" style="font-size:36px;">${msg.content}</div></div>`; return; }
      if (msg.type === "gif") content = `<img src="${msg.content}" style="max-width:160px;border-radius:8px;display:block;" />`;
      else if (msg.type === "image") content = `<img src="${msg.content}" style="max-width:160px;border-radius:8px;display:block;cursor:pointer;" />`;
      else if (msg.type === "voice") { const dur = msg.duration ? Math.floor(msg.duration/60)+":"+String(Math.floor(msg.duration%60)).padStart(2,"0") : "0:00"; content = `<span style="cursor:pointer;">🎤 ${dur}</span>`; }
      else if (msg.type === "file") content = `📎 <a href="${msg.content}" download="${msg.fileName||'file'}" style="color:var(--accent-light);font-size:11px;">${msg.fileName||'File'}</a>`;
      else content = this._escHtml(msg.content || "").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:var(--accent-light);">$1</a>').replace(/\n/g, "<br>");

      html += `<div class="mchat-row ${isOwn ? "mchat-own" : ""}" data-msgid="${msg.id}"><div class="chat-bubble">${content}</div><div class="chat-msg-time">${time}</div></div>`;
    });

    if (msgs.length === 0) html = '<div class="profile-empty" style="padding:16px;font-size:11px;">No messages yet</div>';

    const wasBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    el.innerHTML = html;
    if (wasBottom || msgs.length <= 1) el.scrollTop = el.scrollHeight;

    this._resolveMeetChatId(myUid).then(chatId => {
      if (chatId) this._bindMeetChatDeleteActions(el, myUid, chatId);
    });
  }

  async _resolveMeetChatId(myUid) {
    if (!this._meetChatTargetUid) return null;
    const targetFbUid = await this._resolveFirebaseUid(this._meetChatTargetUid);
    if (!targetFbUid) return null;
    return this._meetChatId(myUid, targetFbUid);
  }

  _bindMeetChatDeleteActions(el, myUid, chatId) {
    el.querySelectorAll(".mchat-row[data-msgid]").forEach(row => {
      let holdTimer = null;
      const showMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const msgId = row.dataset.msgid;
        if (!msgId) return;

        const existing = this.container.querySelector("#meetChatCtxMenu");
        if (existing) existing.remove();

        const isOwn = row.classList.contains("mchat-own");
        const menu = document.createElement("div");
        menu.id = "meetChatCtxMenu";
        menu.className = "conv-context-menu";
        menu.style.position = "fixed";
        menu.style.zIndex = "200000";

        const rect = row.getBoundingClientRect();
        menu.style.top = rect.top + "px";
        menu.style.left = (isOwn ? rect.left - 170 : rect.right + 4) + "px";

        menu.innerHTML = `
          <button class="conv-ctx-item" data-action="deleteMe">Delete for me</button>
          ${isOwn ? '<button class="conv-ctx-item conv-ctx-danger" data-action="deleteAll">Delete for everyone</button>' : ""}`;

        document.body.appendChild(menu);

        menu.querySelectorAll(".conv-ctx-item").forEach(btn => {
          btn.onclick = async (ev) => {
            ev.stopPropagation();
            menu.remove();
            if (!chatId) return;
            if (btn.dataset.action === "deleteMe") {
              await this._db.collection("chats").doc(chatId).collection("messages").doc(msgId)
                .update({ deletedFor: firebase.firestore.FieldValue.arrayUnion(myUid) });
            } else if (btn.dataset.action === "deleteAll") {
              const doc = await this._db.collection("chats").doc(chatId).collection("messages").doc(msgId).get();
              if (doc.exists && doc.data().senderId === myUid) {
                if (Date.now() - doc.data().createdAt > 300000) { return; }
                await this._db.collection("chats").doc(chatId).collection("messages").doc(msgId)
                  .update({ deletedForEveryone: true });
              }
            }
          };
        });

        setTimeout(() => {
          const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", close); } };
          document.addEventListener("click", close);
        }, 50);
      };

      row.oncontextmenu = showMenu;
      row.ontouchstart = () => { holdTimer = setTimeout(() => showMenu(new Event("contextmenu")), 600); };
      row.ontouchend = () => clearTimeout(holdTimer);
      row.ontouchmove = () => clearTimeout(holdTimer);
    });
  }


  _escHtml(t) { return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  async _meetChatSend() {
    const input = this.container.querySelector("#meet-chat-input");
    const text = input?.value.trim();
    if (!text || !this._meetChatTargetUid) return;
    input.value = "";

    const myUid = this._getMyFirebaseUid();
    const targetFbUid = await this._resolveFirebaseUid(this._meetChatTargetUid);
    if (!myUid || !targetFbUid) return;

    const chatId = this._meetChatId(myUid, targetFbUid);
    await this._db.collection("chats").doc(chatId).collection("messages").add({
      senderId: myUid, type: "text", content: text, createdAt: Date.now(), deletedFor: [], deletedForEveryone: false,
    }).catch(err => console.error("Meet chat send error:", err));
    this._meetChatClearTyping();
  }

  async _meetChatSendFile(file) {
    if (!file || !this._meetChatTargetUid) return;
    const myUid = this._getMyFirebaseUid();
    const targetFbUid = await this._resolveFirebaseUid(this._meetChatTargetUid);
    if (!myUid || !targetFbUid) return;
    const chatId = this._meetChatId(myUid, targetFbUid);

    if (file.type.startsWith("image/")) {
      const b64 = await this._meetChatCompressImage(file);
      await this._db.collection("chats").doc(chatId).collection("messages").add({
        senderId: myUid, type: "image", content: b64, caption: "", createdAt: Date.now(), deletedFor: [], deletedForEveryone: false,
      });
    } else {
      if (file.size > 716800) { crolixAlert("File too large — max 700KB", { title: "File too large", icon: "warning" }); return; }
      const b64 = await new Promise(r => { const rd = new FileReader(); rd.onload = e => r(e.target.result); rd.readAsDataURL(file); });
      await this._db.collection("chats").doc(chatId).collection("messages").add({
        senderId: myUid, type: "file", content: b64, fileName: file.name, fileSize: file.size, createdAt: Date.now(), deletedFor: [], deletedForEveryone: false,
      });
    }
  }

  _meetChatCompressImage(file) {
    return new Promise(r => {
      const rd = new FileReader();
      rd.onload = e => {
        const img = new Image();
        img.onload = () => {
          const M = 400; let w = img.width, h = img.height;
          if (w > M || h > M) { if (w > h) { h = Math.round(h*M/w); w = M; } else { w = Math.round(w*M/h); h = M; } }
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          r(c.toDataURL("image/jpeg", 0.6));
        };
        img.src = e.target.result;
      };
      rd.readAsDataURL(file);
    });
  }

  // ── Typing ─────────────────────────────────────────────────

  _meetChatSetTyping() {
    if (!this._meetChatTargetUid) return;
    const myUid = this._getMyFirebaseUid();
    (async () => {
      const targetFbUid = await this._resolveFirebaseUid(this._meetChatTargetUid);
      if (!myUid || !targetFbUid) return;
      const chatId = this._meetChatId(myUid, targetFbUid);
      this._db.collection("chats").doc(chatId).collection("typing").doc(myUid).set({ typing: true, at: Date.now() }).catch(() => {});
    })();
    clearTimeout(this._meetChatTypingTimer);
    this._meetChatTypingTimer = setTimeout(() => this._meetChatClearTyping(), 3000);
  }

  _meetChatClearTyping() {
    if (!this._meetChatTargetUid) return;
    const myUid = this._getMyFirebaseUid();
    (async () => {
      const targetFbUid = await this._resolveFirebaseUid(this._meetChatTargetUid);
      if (!myUid || !targetFbUid) return;
      const chatId = this._meetChatId(myUid, targetFbUid);
      this._db.collection("chats").doc(chatId).collection("typing").doc(myUid).delete().catch(() => {});
    })();
    clearTimeout(this._meetChatTypingTimer);
  }

  _meetChatListenTyping(chatId, targetFbUid) {
    this._meetChatTypingUnsub = this._db.collection("chats").doc(chatId)
      .collection("typing").doc(targetFbUid)
      .onSnapshot(snap => {
        const data = snap.data();
        const el = this.container.querySelector("#meet-chat-typing");
        if (!el) return;
        if (data?.typing && (Date.now() - (data.at || 0)) < 10000) {
          el.style.display = "flex";
          const txt = this.container.querySelector("#meetChatTypingText");
          if (txt) txt.textContent = "typing…";
        } else {
          el.style.display = "none";
        }
      });
  }

  // ── Guest access ───────────────────────────────────────────

  async _meetChatRequestAccess(chatId, myFirebaseUid) {
    const btn = this.container.querySelector("#meetChatRequestBtn");
    if (btn) { btn.disabled = true; btn.textContent = "Requested…"; }
    await this._db.collection("chats").doc(chatId).collection("meetingGuests").doc(myFirebaseUid)
      .set({ requestedBy: myFirebaseUid, meetingId: this._channelId, approvedBy: [], requestedAt: Date.now() }).catch(() => {});
    const status = this.container.querySelector("#meetChatGuestStatus");
    if (status) status.textContent = "Waiting for both members to approve…";
  }

  _meetChatListenGuestAccess(chatId, myFirebaseUid, targetFirebaseUid) {
    this._meetChatGuestUnsub = this._db.collection("chats").doc(chatId)
      .collection("meetingGuests").doc(myFirebaseUid)
      .onSnapshot(snap => {
        const data = snap.data();
        if (!data) return;
        const approved = data.approvedBy || [];
        const owners = chatId.split("_");
        if (owners.every(o => approved.includes(o))) {
          // Both approved — show chat
          const guestBlock = this.container.querySelector("#meet-chat-guest-block");
          const activeEl = this.container.querySelector("#meet-chat-active");
          if (guestBlock) guestBlock.style.display = "none";
          if (activeEl) activeEl.style.display = "flex";
          this._meetChatListenMessages(chatId);
          const lockEl = this.container.querySelector("#meetChatLock");
          if (lockEl) { lockEl.textContent = "👁"; lockEl.title = "Guest view"; }
        } else {
          const status = this.container.querySelector("#meetChatGuestStatus");
          if (status) status.textContent = `Approved by ${approved.length}/2 members`;
        }
      });
  }

  _meetChatListenGuestRequests(chatId) {
    const approveEl = this.container.querySelector("#meet-chat-approve");
    if (!approveEl) return;
    const myUid = this._getMyFirebaseUid();

    this._meetChatGuestUnsub = this._db.collection("chats").doc(chatId)
      .collection("meetingGuests").onSnapshot(snap => {
        let html = "";
        snap.forEach(doc => {
          const data = doc.data();
          if (!data || (data.approvedBy || []).includes(myUid)) return;
          const guestUid = doc.id;
          const guestName = this._resolveNameFromParticipants(guestUid);
          html += `<div class="meet-chat-approve-item">
            <span>${guestName} wants to join this chat</span>
            <button class="meet-chat-approve-btn" data-chatid="${chatId}" data-guestid="${guestUid}">Allow</button>
          </div>`;
        });
        approveEl.innerHTML = html;
        approveEl.style.display = html ? "" : "none";
        approveEl.querySelectorAll(".meet-chat-approve-btn").forEach(btn => {
          btn.onclick = async () => {
            btn.disabled = true; btn.textContent = "Approved";
            await this._db.collection("chats").doc(btn.dataset.chatid)
              .collection("meetingGuests").doc(btn.dataset.guestid)
              .update({ approvedBy: firebase.firestore.FieldValue.arrayUnion(myUid) }).catch(() => {});
          };
        });
      });
  }

  _resolveNameFromParticipants(firebaseUid) {
    for (const [uid, info] of Object.entries(this._participants)) {
      if (uid === firebaseUid || info._fbUid === firebaseUid) return info.name;
    }
    return "Someone";
  }

  // ── Resolve Agora UID → Firebase userId ────────────────────

  _getMyFirebaseUid() {
    try { return JSON.parse(localStorage.getItem("crolixUser"))?.userId || null; } catch (_) { return null; }
  }

  async _resolveFirebaseUid(agoraUid) {
    if (!this._db || !this._channelId) return null;
    try {
      const doc = await this._db.collection("meetings").doc(this._channelId)
        .collection("participants").doc(String(agoraUid)).get();
      if (!doc.exists) return null;
      const data = doc.data();
      // Look up user by name+email to get their Firebase userId
      const name = data.name;
      if (!name) return null;
      const snap = await this._db.collection("users").where("name", "==", name).limit(1).get();
      if (snap.empty) return null;
      return snap.docs[0].id;
    } catch (_) { return null; }
  }

  toggleAudio() {
    const track = this.localTracks[0]; if (!track) return;
    this.audioMuted = !this.audioMuted; track.setMuted(this.audioMuted); this._updateAudioState(this.audioMuted);
    const btn = this.container.querySelector("#muteAudio");
    if (this.audioMuted) {
      btn.classList.add("muted"); btn.innerHTML = `<span class="btn-icon">${ICONS.micOff}</span><span class="btn-label">Mute</span>`;
      this._gifReactions.onMicMuted();
    } else {
      btn.classList.remove("muted"); btn.innerHTML = `<span class="btn-icon">${ICONS.micOn}</span><span class="btn-label">Unmute</span>`;
      this._gifReactions.onMicUnmuted();
    }
  }

  toggleVideo() {
    const track = this.localTracks[1]; if (!track) return;
    this.videoMuted = !this.videoMuted; track.setMuted(this.videoMuted);
    const btn = this.container.querySelector("#muteVideo"), player = document.getElementById("local-player"), avatar = player?.querySelector(".avatar");
    if (this.videoMuted) { btn.classList.add("video-off"); btn.innerHTML = `<span class="btn-icon">${ICONS.camOff}</span><span class="btn-label">Start Video</span>`; if (avatar) { avatar.style.display = "flex"; avatar.style.zIndex = "3"; } }
    else { btn.classList.remove("video-off"); btn.innerHTML = `<span class="btn-icon">${ICONS.camOn}</span><span class="btn-label">Stop Video</span>`; if (avatar) { avatar.style.display = "none"; avatar.style.zIndex = ""; } }
    this._updateVideoState(this.videoMuted);
  }

  async shareScreen() {
    const btn = this.container.querySelector("#shareScreenBtn"), shareLabel = this.container.querySelector("#share-label");
    if (!this.screenSharing) {
      try {
        this.screenTrack = await AgoraRTC.createScreenVideoTrack();
        await this.client.unpublish(this.localTracks[1]); await this.client.publish(this.screenTrack);
        const player = this.createPlayer("screen-player", "You (Screen)");
        this.screenTrack.play(player); player.querySelector(".avatar")?.style.setProperty("display", "none");
        this._markScreenTile(player, this._localUid, this.screenTrack, false);
        this.screenSharing = true; btn.classList.add("sharing"); if (shareLabel) shareLabel.innerText = "Stop Share";
      } catch (err) { console.error(err); }
    } else {
      try {
        if (this.screenTrack) { await this.client.unpublish(this.screenTrack); this.screenTrack.stop(); this.screenTrack.close(); this.screenTrack = null; }
        const screenPlayer = document.getElementById("screen-player");
        if (screenPlayer) { this._unmarkScreenTile(screenPlayer); screenPlayer.remove(); }
        await this.client.publish(this.localTracks[1]);
        this.screenSharing = false; btn.classList.remove("sharing"); if (shareLabel) shareLabel.innerText = "Share";
      } catch (err) { console.error(err); }
    }
  }
}
