/**
 * src/controllers/ProfileController.js
 * Profile dashboard, edit profile, friends, blocking, find users.
 */

import { FIREBASE_CONFIG, EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST } from "../config/config.js";
import { buildProfileDashboard, buildEditProfileModal, buildEditBioModal, buildUserItem, buildPublicProfile, buildFriendProfilePage } from "../ui/profileTemplates.js";
import { buildGroupInvitePreviewHtml } from "../ui/chatTemplates.js";
import { crolixConfirm, crolixAlert } from "../utils/confirmModal.js";
import { startSpotlightTour } from "../utils/tour.js";
import { startPremiumCheckout } from "../utils/billing.js";
import { AuthController } from "./AuthController.js";
import { RoomController } from "./RoomController.js";
import { ChatController } from "./ChatController.js";
import { CategoryController } from "./CategoryController.js";
import { RecordingsController } from "./RecordingsController.js";
import { ICONS } from "../ui/icons.js";
import { EmojiPicker } from "../ui/emojiPicker.js";

const SESSION_KEY = "crolixUser";

export class ProfileController {
  constructor(container, onStartMeeting, onLogout) {
    this.container = container;
    this.onStartMeeting = onStartMeeting;
    this.onLogout = onLogout;
    this._db = null;
    this._emailjsReady = false;
    this._user = null;
    this._fullUserData = null;
    this._popoverClickHandler = null;
    this._emojiPicker = new EmojiPicker();
    this._roomController = new RoomController(container);
    this._chatController = new ChatController(container, onStartMeeting);
    this._categoryController = new CategoryController(
      container,
      (userId) => this._openChatWithFriend(userId),
      (meetId, myName) => this.callUser(meetId, myName),
      (groupId) => this._openGroupDirect(groupId),
    );
    this._recordingsController = new RecordingsController(container);
    this._init();
  }

  _init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._db = firebase.firestore();
    if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); this._emailjsReady = true; }
    else {
      const check = setInterval(() => {
        if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); this._emailjsReady = true; clearInterval(check); }
      }, 500);
    }
  }

  async show(session) {
    this._user = session;
    await this._loadFullUserData();
    this._render();
    this._startPresence();
    this._listenIncomingCalls();
    this._maybeStartTour();
  }

  _maybeStartTour() {
    const key = `crolixTourSeen_${this._user.userId}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    setTimeout(() => this._startTour(), 800);
  }

  _startTour() {
    const screen = this.container.querySelector("#profile-screen");
    if (!screen) return;
    const scoped = (sel) => `#profile-screen ${sel}`;
    startSpotlightTour([
      { selector: scoped("#profileStartMeeting"), title: "Start meetings instantly", desc: "Get a unique Meeting ID and jump straight into a call — share it with anyone to invite them." },
      { selector: scoped('.phome-feat-card[data-feat="chat"]'), title: "Message & group chat", desc: "Chat one-on-one, or create private group chats that only invited members can see." },
      { selector: scoped('.phome-feat-card[data-feat="publicRoom"]'), title: "Share moments", desc: "Post photos, videos, or updates publicly for your friends to see." },
      { selector: scoped('.phome-feat-card[data-feat="friends"]'), title: "Friends", desc: "Add friends, manage requests, and build your network." },
      { selector: scoped('.phome-feat-card[data-feat="privateRoom"]'), title: "Private Vault", desc: "Your secret space — posts here stay hidden and only visible with your permission." },
      { selector: scoped('.phome-feat-card[data-feat="find"]'), title: "Find people", desc: "Search anyone by their Meeting ID and call them directly." },
      { selector: scoped('.phome-feat-card[data-feat="schedule"]'), title: "Schedule ahead", desc: "Plan a meeting for later and send invites straight to people's email." },
    ]);
  }

  _startPresence() {
    if (!this._db || !this._user?.userId) return;
    const ref = this._db.collection("users").doc(this._user.userId);
    ref.update({ online: true, lastSeen: Date.now() }).catch(() => {});

    this._presenceInterval = setInterval(() => {
      ref.update({ online: true, lastSeen: Date.now() }).catch(() => {});
    }, 60000);

    this._beforeUnloadHandler = () => {
      ref.update({ online: false, lastSeen: Date.now() }).catch(() => {});
    };
    window.addEventListener("beforeunload", this._beforeUnloadHandler);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) ref.update({ online: false, lastSeen: Date.now() }).catch(() => {});
      else ref.update({ online: true, lastSeen: Date.now() }).catch(() => {});
    });
  }

  _stopPresence() {
    if (this._presenceInterval) { clearInterval(this._presenceInterval); this._presenceInterval = null; }
    if (this._beforeUnloadHandler) window.removeEventListener("beforeunload", this._beforeUnloadHandler);
    if (this._db && this._user?.userId) {
      this._db.collection("users").doc(this._user.userId).update({ online: false, lastSeen: Date.now() }).catch(() => {});
    }
  }

  // ── Call System ─────────────────────────────────────────────

  async callUser(meetId, myName) {
    if (!meetId) return;
    try {
      const idDoc = await this._db.collection("meetingIds").doc(meetId).get();
      if (!idDoc.exists) { this.onStartMeeting(meetId, myName); return; }

      const targetUserId = idDoc.data().userId;
      const targetDoc = await this._db.collection("users").doc(targetUserId).get();
      if (!targetDoc.exists) { this.onStartMeeting(meetId, myName); return; }

      const target = { ...targetDoc.data(), userId: targetDoc.id };
      const isOnline = target.online && target.lastSeen && (Date.now() - target.lastSeen < 120000);

      if (isOnline) {
        this._showOutgoingCall(target, meetId, myName);
        await this._db.collection("incomingCalls").doc(targetUserId).set({
          callerId: this._user.userId,
          callerName: this._user.name,
          callerPic: this._user.profilePicBase64 || "",
          meetingId: this._user.meetingId,
          status: "ringing",
          createdAt: Date.now(),
        });
        this._outCallUnsub = this._db.collection("incomingCalls").doc(targetUserId).onSnapshot(snap => {
          const data = snap.data();
          if (!data) return;
          if (data.status === "answered") {
            this._hideOutgoingCall();
            this.onStartMeeting(this._user.meetingId, myName);
          } else if (data.status === "declined") {
            const label = this.container.querySelector("#outCallStatus");
            if (label) { label.textContent = "Call declined"; label.style.color = "#f87171"; }
            setTimeout(() => this._hideOutgoingCall(), 2000);
          }
        });
        setTimeout(() => {
          const overlay = this.container.querySelector("#outgoingCallOverlay");
          if (overlay && overlay.style.display !== "none") {
            const label = this.container.querySelector("#outCallStatus");
            if (label) label.textContent = "No answer";
            this._sendMissedCallEmail(target);
            setTimeout(() => this._hideOutgoingCall(), 2000);
          }
        }, 30000);
      } else {
        this._sendMissedCallEmail(target);
        this.onStartMeeting(this._user.meetingId, myName);
      }
    } catch (err) {
      console.error("Call error:", err);
      this.onStartMeeting(meetId, myName);
    }
  }

  _showOutgoingCall(target, meetId, myName) {
    const overlay = this.container.querySelector("#outgoingCallOverlay");
    if (!overlay) return;
    const picHtml = target.profilePicBase64
      ? `<img src="${target.profilePicBase64}" alt="${target.name}" />`
      : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);font-size:36px;">${(target.name || "?").charAt(0).toUpperCase()}</div>`;
    this.container.querySelector("#outCallAvatar").innerHTML = picHtml;
    this.container.querySelector("#outCallName").textContent = target.name;
    this.container.querySelector("#outCallStatus").textContent = "Calling…";
    this.container.querySelector("#outCallStatus").style.color = "";
    overlay.style.display = "flex";

    this.container.querySelector("#outCallCancel").onclick = () => this._hideOutgoingCall();
  }

  _hideOutgoingCall() {
    const overlay = this.container.querySelector("#outgoingCallOverlay");
    if (overlay) overlay.style.display = "none";
    if (this._outCallUnsub) { this._outCallUnsub(); this._outCallUnsub = null; }
  }

  _listenIncomingCalls() {
    if (!this._db || !this._user?.userId) return;
    this._inCallUnsub = this._db.collection("incomingCalls").doc(this._user.userId)
      .onSnapshot(snap => {
        const data = snap.data();
        if (!data || data.status !== "ringing") return;
        if (Date.now() - data.createdAt > 35000) return;
        this._showIncomingCall(data);
      });
  }

  _showIncomingCall(callData) {
    const overlay = this.container.querySelector("#incomingCallOverlay");
    if (!overlay) return;
    const picHtml = callData.callerPic
      ? `<img src="${callData.callerPic}" alt="${callData.callerName}" />`
      : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);font-size:36px;">${(callData.callerName || "?").charAt(0).toUpperCase()}</div>`;
    this.container.querySelector("#inCallAvatar").innerHTML = picHtml;
    this.container.querySelector("#inCallName").textContent = callData.callerName;
    overlay.style.display = "flex";

    this._playRingtone();

    this.container.querySelector("#inCallAnswer").onclick = async () => {
      this._stopRingtone();
      overlay.style.display = "none";
      await this._db.collection("incomingCalls").doc(this._user.userId).update({ status: "answered" }).catch(() => {});
      this.onStartMeeting(callData.meetingId, this._user.name);
    };

    this.container.querySelector("#inCallDecline").onclick = async () => {
      this._stopRingtone();
      overlay.style.display = "none";
      await this._db.collection("incomingCalls").doc(this._user.userId).update({ status: "declined" }).catch(() => {});
    };
  }

  _playRingtone() {
    if (this._ringtoneCtx) return;
    try {
      this._ringtoneCtx = new AudioContext();
      const play = () => {
        if (!this._ringtoneCtx) return;
        const osc = this._ringtoneCtx.createOscillator();
        const gain = this._ringtoneCtx.createGain();
        osc.connect(gain); gain.connect(this._ringtoneCtx.destination);
        osc.frequency.value = 440; osc.type = "sine";
        gain.gain.setValueAtTime(0.15, this._ringtoneCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this._ringtoneCtx.currentTime + 0.8);
        osc.start(); osc.stop(this._ringtoneCtx.currentTime + 0.8);
      };
      play();
      this._ringtoneLoop = setInterval(play, 2000);
    } catch (_) {}
  }

  _stopRingtone() {
    if (this._ringtoneLoop) { clearInterval(this._ringtoneLoop); this._ringtoneLoop = null; }
    if (this._ringtoneCtx) { this._ringtoneCtx.close().catch(() => {}); this._ringtoneCtx = null; }
  }

  _sendMissedCallEmail(target) {
    if (!window.emailjs || !target.email) return;
    window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, {
      to_email: target.email,
      from_name: this._user.name,
      meeting_id: this._user.meetingId,
      date_time: new Date().toLocaleString("en-ZA"),
      message: `You missed a call from ${this._user.name} on CrolixMeet. Join their meeting: ${this._user.meetingId}`,
      guest_email: target.email,
      initials: this._user.name.charAt(0),
    }).catch(err => console.warn("Missed call email failed:", err));
  }

  _showFullPicture(picBase64, name) {
    const existing = document.querySelector(".profile-pic-viewer");
    if (existing) existing.remove();

    const viewer = document.createElement("div");
    viewer.className = "profile-pic-viewer";

    const imgHtml = picBase64
      ? `<img src="${picBase64}" alt="${name || ""}" />`
      : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);">${(name || "?").charAt(0).toUpperCase()}</div>`;

    viewer.innerHTML = `${imgHtml}<button class="ppv-close">✕</button><div class="ppv-name">${name || ""}</div>`;
    document.body.appendChild(viewer);

    viewer.querySelector(".ppv-close").onclick = () => viewer.remove();
    viewer.onclick = (e) => { if (e.target === viewer) viewer.remove(); };
  }

  async _loadFullUserData() {
    try {
      const doc = await this._db.collection("users").doc(this._user.userId).get();
      if (doc.exists) {
        this._fullUserData = { ...doc.data(), userId: doc.id };
        this._user.name = this._fullUserData.name;
        this._user.profilePicBase64 = this._fullUserData.profilePicBase64;
        this._user.isPremium = !!this._fullUserData.isPremium;
        localStorage.setItem(SESSION_KEY, JSON.stringify(this._user));
      }
    } catch (err) {
      console.warn("Failed to load user data:", err);
      this._fullUserData = { ...this._user, friends: [], blocked: [], pendingFriends: [] };
    }
  }

  _render() {
    this.container.innerHTML = buildProfileDashboard(this._user);
    this._bindEvents();
    this._renderBio();
    this._updateStats();
    this._roomController.setUser(this._user, this._fullUserData);
    this._roomController.loadPublicRoom();
    this._chatController.setUser(this._user, this._fullUserData);
    this._categoryController.setUser(this._user, this._fullUserData);
    this._recordingsController.setUser(this._user);
    this._loadFriends();
    this._loadPending();
    this._loadSentRequests();
    this._loadBlocked();
  }

  _updateStats() {
    const friendCount = this.container.querySelector("#statFriendsCount");
    if (friendCount) {
      const n = Array.isArray(this._fullUserData?.friends) ? this._fullUserData.friends.length : 0;
      friendCount.textContent = n;
    }

    const uid = this._user?.userId;
    if (!uid || !this._db) return;

    const msgEl = this.container.querySelector("#statUnreadCount");
    if (msgEl) {
      this._db.collection("chats")
        .where("participants", "array-contains", uid)
        .get()
        .then(snap => { if (msgEl.isConnected) msgEl.textContent = snap.size; })
        .catch(() => {});
    }

    const postEl = this.container.querySelector("#statPostsCount");
    if (postEl) {
      this._db.collection("users").doc(uid).collection("publicPosts")
        .get()
        .then(snap => { if (postEl.isConnected) postEl.textContent = snap.size; })
        .catch(() => {});
    }
  }

  _navigateTo(page) {
    const screen = this.container.querySelector("#profile-screen");
    if (!screen) return;

    screen.querySelectorAll(".pnav-btn[data-page]").forEach(b => b.classList.remove("active"));
    screen.querySelectorAll(".pmobile-btn[data-page]").forEach(b => b.classList.remove("active"));
    screen.querySelectorAll(".ppage").forEach(p => p.classList.remove("active"));

    screen.querySelectorAll(`[data-page="${page}"]`).forEach(b => b.classList.add("active"));
    const target = screen.querySelector(`#page-${page}`);
    if (target) target.classList.add("active");

    if (page === "publicRoom") this._roomController.loadPublicRoom();
    if (page === "privateRoom") this._roomController.loadPrivateRoom();
    if (page === "chat") this._chatController.render();
    if (page !== "chat") this._chatController.cleanup();
    if (page === "categories") this._categoryController.render();
    if (page === "recordings") this._recordingsController.render();
  }

  _openChatWithFriend(userId) {
    this._navigateTo("chat");
    this._chatController.openDirectChat(userId);
  }

  _openGroupDirect(groupId) {
    this._navigateTo("chat");
    this._chatController.openGroupDirect(groupId);
  }

  async handleGroupInviteFromUrl(code) {
    const result = await this._chatController.resolveGroupInvite(code);

    if (result.status === "invalid") {
      await crolixAlert("This invite link is no longer valid.", { title: "Invite expired", icon: "warning" });
      return;
    }
    if (result.status === "already-member") {
      this._openGroupDirect(result.groupId);
      return;
    }

    const ok = await crolixConfirm(buildGroupInvitePreviewHtml(result.group), {
      title: "Join Group?", confirmText: "Join", icon: "info",
    });
    if (!ok) return;

    await this._chatController.joinGroup(result.group.id);
    this._openGroupDirect(result.group.id);
  }

  async _showUpgradeFlow() {
    const ok = await crolixConfirm(
      "Upgrade to Premium ($9.99/mo) for unlimited meeting length — no more time caps. You'll be taken to Stripe to pay securely.",
      { title: "Upgrade to Premium?", confirmText: "Continue to payment", icon: "success" }
    );
    if (!ok) return;
    try {
      await startPremiumCheckout(this._user.userId, this._user.email);
    } catch (err) {
      console.error("Upgrade error:", err);
      crolixAlert("Failed to start checkout. Please try again.", { title: "Error", icon: "error" });
    }
  }

  _bindEvents() {
    const screen = this.container.querySelector("#profile-screen");
    const navigateTo = (page) => this._navigateTo(page);

    screen.querySelectorAll(".pnav-btn[data-page]").forEach(btn => {
      btn.onclick = () => navigateTo(btn.dataset.page);
    });
    screen.querySelectorAll(".pmobile-btn[data-page]").forEach(btn => {
      btn.onclick = () => navigateTo(btn.dataset.page);
    });

    // ── Home feature cards ──
    screen.querySelectorAll(".phome-feat-card[data-feat]").forEach(card => {
      card.onclick = () => {
        const feat = card.dataset.feat;
        if (feat === "schedule") {
          // Schedule is inside the video call screen — trigger via the VideoCall start meeting button
          this.onStartMeeting("", "");
        } else {
          navigateTo(feat);
        }
      };
    });

    // ── Friends sub-tabs ──
    screen.querySelectorAll(".pfriends-tab").forEach(tab => {
      tab.onclick = () => {
        screen.querySelectorAll(".pfriends-tab").forEach(t => t.classList.remove("active"));
        screen.querySelectorAll(".pfriends-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        screen.querySelector(`#ftab-${tab.dataset.ftab}`).classList.add("active");
      };
    });

    // ── Sidebar avatar → profile card ──
    const sidebarAvatar = screen.querySelector("#sidebarAvatar");
    const profileCard = screen.querySelector("#sidebarProfileCard");
    if (sidebarAvatar && profileCard) {
      sidebarAvatar.onclick = (e) => {
        e.stopPropagation();
        profileCard.style.display = profileCard.style.display === "none" ? "" : "none";
      };
      if (this._popoverClickHandler) document.removeEventListener("click", this._popoverClickHandler);
      this._popoverClickHandler = (e) => {
        if (!profileCard.contains(e.target) && e.target !== sidebarAvatar && !sidebarAvatar.contains(e.target)) {
          profileCard.style.display = "none";
        }
      };
      document.addEventListener("click", this._popoverClickHandler);
      // View full picture
      const viewPicBtn = screen.querySelector("#sidebarViewPic");
      const cardPic = screen.querySelector("#sidebarCardPic");
      if (viewPicBtn) viewPicBtn.onclick = () => { profileCard.style.display = "none"; this._showFullPicture(this._user.profilePicBase64, this._user.name); };
      if (cardPic) cardPic.onclick = () => { profileCard.style.display = "none"; this._showFullPicture(this._user.profilePicBase64, this._user.name); };
      // Go to profile home
      const goHome = screen.querySelector("#sidebarGoHome");
      if (goHome) goHome.onclick = () => { profileCard.style.display = "none"; navigateTo("home"); };
    }

    // Also make the home page profile pic clickable for fullscreen
    const homePic = screen.querySelector("#heroProfilePic");
    if (homePic) { homePic.style.cursor = "pointer"; homePic.onclick = () => this._showFullPicture(this._user.profilePicBase64, this._user.name); }

    // Email reveal toggle
    const emailToggle = screen.querySelector("#heroEmailToggle");
    const emailSpan   = screen.querySelector("#heroEmail");
    if (emailToggle && emailSpan) {
      let shown = false;
      emailToggle.onclick = () => {
        shown = !shown;
        emailSpan.textContent = shown ? emailSpan.dataset.email : "••••••••••••••••••";
        emailSpan.style.color = shown ? "rgba(255,255,255,0.65)" : "";
      };
    }

    // Copy meeting ID
    screen.querySelector("#copyMeetIdBtn").onclick = () => {
      navigator.clipboard.writeText(this._user.meetingId).catch(() => {});
      const btn = screen.querySelector("#copyMeetIdBtn");
      const origHtml = btn.innerHTML;
      btn.classList.add("copied");
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => { btn.classList.remove("copied"); btn.innerHTML = origHtml; }, 2000);
    };

    // Start meeting
    screen.querySelector("#profileStartMeeting").onclick = () => {
      this.onStartMeeting(this._user.meetingId, this._user.name);
    };

    // Replay tour
    const tourHelpBtn = screen.querySelector("#tourHelpBtn");
    if (tourHelpBtn) tourHelpBtn.onclick = () => this._startTour();

    // Edit profile
    screen.querySelector("#profileEditBtn").onclick = () => navigateTo("profile");

    // Profile page: edit profile + edit bio
    const profilePageEditBtn = screen.querySelector("#profilePageEditBtn");
    if (profilePageEditBtn) profilePageEditBtn.onclick = () => this._showEditModal();
    screen.querySelector("#editBioBtn").onclick = () => this._showEditBioModal();

    // Logout
    screen.querySelector("#profileLogoutBtn").onclick = () => {
      this._stopPresence();
      AuthController.clearSession();
      this.onLogout();
    };

    // Find someone
    screen.querySelector("#findSearchBtn").onclick = () => this._handleSearch();
    screen.querySelector("#findMeetIdInput").onkeydown = (e) => { if (e.key === "Enter") this._handleSearch(); };

    // Room buttons
    screen.querySelector("#publicUploadBtn").onclick = () => this._roomController.showUploadModal("public");
    screen.querySelector("#privateUploadBtn").onclick = () => this._roomController.showUploadModal("private");
    screen.querySelector("#manageAccessBtn").onclick = () => this._roomController.showAccessModal();
  }

  // ── Edit Profile ───────────────────────────────────────────
  _showEditModal() {
    const existing = this.container.querySelector("#editProfileOverlay");
    if (existing) existing.remove();
    this.container.insertAdjacentHTML("beforeend", buildEditProfileModal(this._user));

    const overlay = this.container.querySelector("#editProfileOverlay");
    let newPic = null;

    const resetVaultBtn = overlay.querySelector("#resetVaultAccessBtn");
    if (resetVaultBtn) resetVaultBtn.onclick = () => this._categoryController.showResetVaultAccessFlow();

    const upgradeBtn = overlay.querySelector("#upgradePremiumBtn");
    if (upgradeBtn && !this._user.isPremium) upgradeBtn.onclick = () => this._showUpgradeFlow();

    const preview = overlay.querySelector("#editAvatarPreview");
    const fileInput = overlay.querySelector("#editAvatarInput");
    preview.onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 256;
          let w = img.width, h = img.height;
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          newPic = compressed;
          preview.innerHTML = `<img src="${compressed}" alt="Profile" />`;
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };

    overlay.querySelector("#editCancelBtn").onclick = () => { this._emojiPicker.hide(); overlay.remove(); };
    overlay.onclick = (e) => { if (e.target === overlay) { this._emojiPicker.hide(); overlay.remove(); } };

    const nameEmojiBtn = overlay.querySelector("#nameEmojiBtn");
    const nameInput    = overlay.querySelector("#editNameInput");
    if (nameEmojiBtn) nameEmojiBtn.onclick = (e) => { e.stopPropagation(); this._emojiPicker.toggle(nameInput, nameEmojiBtn); };

    overlay.querySelector("#editSaveBtn").onclick = async () => {
      const name = overlay.querySelector("#editNameInput").value.trim();
      const errBanner = overlay.querySelector("#edit-error");
      if (!name) {
        errBanner.textContent = "Name is required";
        errBanner.classList.add("visible");
        return;
      }

      const btn = overlay.querySelector("#editSaveBtn");
      btn.disabled = true; btn.textContent = "Saving…";

      try {
        const updates = { name };
        if (newPic) updates.profilePicBase64 = newPic;
        await this._db.collection("users").doc(this._user.userId).update(updates);

        this._user.name = name;
        if (newPic) this._user.profilePicBase64 = newPic;
        localStorage.setItem(SESSION_KEY, JSON.stringify(this._user));

        overlay.remove();
        this._render();
      } catch (err) {
        console.error("Edit save error:", err);
        errBanner.textContent = "Failed to save. Please try again.";
        errBanner.classList.add("visible");
        btn.disabled = false; btn.textContent = "Save Changes";
      }
    };
  }

  // ── Bio / Interests / Links ─────────────────────────────────
  _renderBio() {
    const bioText = this.container.querySelector("#bioText");
    const bioInterests = this.container.querySelector("#bioInterests");
    const bioLinks = this.container.querySelector("#bioLinks");
    if (!bioText) return;

    const data = this._fullUserData || {};
    const bio = data.bio || "";
    const interests = data.interests || [];
    const links = data.links || [];

    if (bio) {
      const escaped = bio.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const rendered = escaped.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a class="bio-inline-link" href="$1" target="_blank" rel="noopener">$1</a>'
      ).replace(/\n/g, "<br>");
      bioText.innerHTML = rendered;
      bioText.classList.remove("bio-empty");
    } else {
      bioText.innerHTML = '<span class="bio-placeholder">Tell the world about yourself — add a bio, your interests, and links!</span>';
      bioText.classList.add("bio-empty");
    }

    if (interests.length) {
      bioInterests.innerHTML = interests.map(t => `<span class="bio-tag">${t}</span>`).join("");
      bioInterests.style.display = "";
    } else {
      bioInterests.innerHTML = "";
      bioInterests.style.display = "none";
    }

    if (links.length) {
      bioLinks.innerHTML = links.map(l =>
        `<a class="bio-link-pill" href="${l.url}" target="_blank" rel="noopener">${l.label || l.url}</a>`
      ).join("");
      bioLinks.style.display = "";
    } else {
      bioLinks.innerHTML = "";
      bioLinks.style.display = "none";
    }
  }

  _showEditBioModal() {
    const existing = this.container.querySelector("#editBioOverlay");
    if (existing) existing.remove();
    this.container.insertAdjacentHTML("beforeend", buildEditBioModal(this._fullUserData));

    const overlay = this.container.querySelector("#editBioOverlay");
    const textarea = overlay.querySelector("#bioTextInput");
    const charCount = overlay.querySelector("#bioCharCount");

    textarea.addEventListener("input", () => {
      charCount.textContent = `${textarea.value.length}/300`;
    });

    overlay.querySelector("#bioCancelBtn").onclick = () => { this._emojiPicker.hide(); overlay.remove(); };
    overlay.onclick = (e) => { if (e.target === overlay) { this._emojiPicker.hide(); overlay.remove(); } };

    const bioEmojiBtn = overlay.querySelector("#bioEmojiBtn");
    const interestsEmojiBtn = overlay.querySelector("#interestsEmojiBtn");
    const interestsInput = overlay.querySelector("#bioInterestsInput");
    if (bioEmojiBtn) bioEmojiBtn.onclick = (e) => { e.stopPropagation(); this._emojiPicker.toggle(textarea, bioEmojiBtn); };
    if (interestsEmojiBtn) interestsEmojiBtn.onclick = (e) => { e.stopPropagation(); this._emojiPicker.toggle(interestsInput, interestsEmojiBtn); };

    // Add link row
    overlay.querySelector("#bioAddLinkBtn").onclick = () => {
      const editor = overlay.querySelector("#bioLinksEditor");
      const idx = editor.querySelectorAll(".bio-link-row").length;
      const row = document.createElement("div");
      row.className = "bio-link-row";
      row.dataset.idx = idx;
      row.innerHTML = `
        <input type="text" class="bio-link-label-input" placeholder="Label (e.g. Portfolio)" />
        <input type="url" class="bio-link-url-input" placeholder="https://..." />
        <button class="bio-link-remove" data-idx="${idx}">✕</button>`;
      editor.appendChild(row);
      this._bindLinkRemoveButtons(overlay);
    };
    this._bindLinkRemoveButtons(overlay);

    // Save
    overlay.querySelector("#bioSaveBtn").onclick = async () => {
      const btn = overlay.querySelector("#bioSaveBtn");
      const errBanner = overlay.querySelector("#bio-error");
      btn.disabled = true; btn.textContent = "Saving…";

      const bio = textarea.value.trim().slice(0, 300);
      const interestsRaw = overlay.querySelector("#bioInterestsInput").value;
      const interests = interestsRaw.split(",").map(t => t.trim()).filter(Boolean).slice(0, 20);

      const linkRows = overlay.querySelectorAll(".bio-link-row");
      const links = [];
      linkRows.forEach(row => {
        const label = row.querySelector(".bio-link-label-input").value.trim();
        const url = row.querySelector(".bio-link-url-input").value.trim();
        if (url) links.push({ label: label || url, url });
      });

      try {
        await this._db.collection("users").doc(this._user.userId).update({ bio, interests, links });
        if (this._fullUserData) {
          this._fullUserData.bio = bio;
          this._fullUserData.interests = interests;
          this._fullUserData.links = links;
        }
        overlay.remove();
        this._renderBio();
      } catch (err) {
        console.error("Bio save error:", err);
        errBanner.textContent = "Failed to save. Please try again.";
        errBanner.classList.add("visible");
        btn.disabled = false; btn.textContent = "Save";
      }
    };
  }

  _bindLinkRemoveButtons(overlay) {
    overlay.querySelectorAll(".bio-link-remove").forEach(btn => {
      btn.onclick = () => btn.closest(".bio-link-row").remove();
    });
  }

  // ── Friends List ───────────────────────────────────────────
  async _loadFriends() {
    const list = this.container.querySelector("#friendsList");
    const empty = this.container.querySelector("#friendsEmpty");
    if (!list) return;

    const friends = this._fullUserData?.friends || [];
    if (friends.length === 0) { list.innerHTML = ""; empty.style.display = ""; return; }

    empty.style.display = "none";
    list.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';

    try {
      const friendUsers = await this._fetchUsersByIds(friends);
      list.innerHTML = "";
      friendUsers.forEach(u => {
        list.insertAdjacentHTML("beforeend", buildUserItem(u, [
          { label: "View", cls: "add", action: "view" },
          { label: "Call", cls: "call", action: "call" },
          { label: "Remove", cls: "remove", action: "remove" },
        ]));
      });
      this._bindUserActions(list);
    } catch (_) {
      list.innerHTML = '<div class="profile-empty">Failed to load friends</div>';
    }
  }

  async _loadPending() {
    const list = this.container.querySelector("#pendingList");
    const empty = this.container.querySelector("#pendingEmpty");
    if (!list) return;

    const pending = this._fullUserData?.pendingFriends || [];
    ["#pendingBadge", "#pendingBadgeMobile", "#pendingBadgeInline"].forEach(sel => {
      const badge = this.container.querySelector(sel);
      if (badge) {
        if (pending.length > 0) { badge.style.display = ""; badge.textContent = pending.length; }
        else { badge.style.display = "none"; }
      }
    });
    if (pending.length === 0) { list.innerHTML = ""; empty.style.display = ""; return; }

    empty.style.display = "none";
    list.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';

    try {
      const pendingUsers = await this._fetchUsersByIds(pending);
      list.innerHTML = "";
      pendingUsers.forEach(u => {
        list.insertAdjacentHTML("beforeend", buildUserItem(u, [
          { label: "Accept", cls: "accept", action: "accept" },
          { label: "Decline", cls: "decline", action: "decline" },
          { label: "Block", cls: "block", action: "block" },
        ]));
      });
      this._bindUserActions(list);
    } catch (_) {
      list.innerHTML = '<div class="profile-empty">Failed to load requests</div>';
    }
  }

  async _loadSentRequests() {
    const list = this.container.querySelector("#sentList");
    const empty = this.container.querySelector("#sentEmpty");
    const badge = this.container.querySelector("#sentBadge");
    if (!list) return;

    const sent = this._fullUserData?.sentRequests || [];
    if (badge) {
      if (sent.length > 0) { badge.style.display = ""; badge.textContent = sent.length; }
      else { badge.style.display = "none"; }
    }
    if (sent.length === 0) { list.innerHTML = ""; empty.style.display = ""; return; }

    empty.style.display = "none";
    list.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';

    try {
      const sentUsers = await this._fetchUsersByIds(sent);
      list.innerHTML = "";
      sentUsers.forEach(u => {
        list.insertAdjacentHTML("beforeend", buildUserItem(u, [
          { label: "Cancel", cls: "decline", action: "cancelRequest" },
        ]));
      });
      this._bindUserActions(list);
    } catch (_) {
      list.innerHTML = '<div class="profile-empty">Failed to load</div>';
    }
  }

  async _loadBlocked() {
    const list = this.container.querySelector("#blockedList");
    const empty = this.container.querySelector("#blockedEmpty");
    if (!list) return;

    const blocked = this._fullUserData?.blocked || [];
    if (blocked.length === 0) { list.innerHTML = ""; empty.style.display = ""; return; }

    empty.style.display = "none";
    list.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';

    try {
      const blockedUsers = await this._fetchUsersByIds(blocked);
      list.innerHTML = "";
      blockedUsers.forEach(u => {
        list.insertAdjacentHTML("beforeend", buildUserItem(u, [
          { label: "Unblock", cls: "unblock", action: "unblock" },
        ]));
      });
      this._bindUserActions(list);
    } catch (_) {
      list.innerHTML = '<div class="profile-empty">Failed to load blocked users</div>';
    }
  }

  _bindUserActions(list) {
    // Make entire friend row clickable (except buttons)
    list.querySelectorAll(".profile-user-item").forEach(item => {
      const info = item.querySelector(".profile-user-info");
      const pic = item.querySelector(".profile-user-pic");
      if (info) { info.style.cursor = "pointer"; info.onclick = () => this._openFriendProfile(item.dataset.meetid); }
      if (pic) { pic.style.cursor = "pointer"; pic.onclick = () => this._openFriendProfile(item.dataset.meetid); }
    });

    list.querySelectorAll(".profile-user-btn").forEach(btn => {
      btn.onclick = async () => {
        const action = btn.dataset.action;
        const meetId = btn.closest(".profile-user-item")?.dataset.meetid;
        if (!meetId) return;

        if (action === "view") { this._openFriendProfile(meetId); return; }

        btn.disabled = true;
        const targetUserId = await this._getUserIdByMeetId(meetId);
        if (!targetUserId) { btn.disabled = false; return; }

        try {
          if (action === "call") { this.callUser(meetId, this._user.name); return; }
          if (action === "accept") await this._acceptFriend(targetUserId);
          if (action === "decline") await this._declineFriend(targetUserId);
          if (action === "remove") await this._removeFriend(targetUserId);
          if (action === "block") await this._blockUser(targetUserId);
          if (action === "unblock") await this._unblockUser(targetUserId);
          if (action === "cancelRequest") await this._cancelFriendRequest(targetUserId);

          await this._loadFullUserData();
          this._loadFriends();
          this._loadPending();
          this._loadSentRequests();
          this._loadBlocked();
        } catch (err) {
          console.error("Action error:", err);
          btn.disabled = false;
        }
      };
    });
  }

  // ── Friend Actions ─────────────────────────────────────────
  async _sendFriendRequest(targetUserId) {
    const batch = this._db.batch();
    const myRef = this._db.collection("users").doc(this._user.userId);
    const targetRef = this._db.collection("users").doc(targetUserId);
    batch.update(targetRef, { pendingFriends: firebase.firestore.FieldValue.arrayUnion(this._user.userId) });
    batch.update(myRef, { sentRequests: firebase.firestore.FieldValue.arrayUnion(targetUserId) });
    await batch.commit();
    this._sendFriendRequestEmail(targetUserId);
  }

  async _cancelFriendRequest(targetUserId) {
    const batch = this._db.batch();
    const myRef = this._db.collection("users").doc(this._user.userId);
    const targetRef = this._db.collection("users").doc(targetUserId);
    batch.update(myRef, { sentRequests: firebase.firestore.FieldValue.arrayRemove(targetUserId) });
    batch.update(targetRef, { pendingFriends: firebase.firestore.FieldValue.arrayRemove(this._user.userId) });
    await batch.commit();
  }

  async _acceptFriend(targetUserId) {
    const batch = this._db.batch();
    const myRef = this._db.collection("users").doc(this._user.userId);
    const targetRef = this._db.collection("users").doc(targetUserId);

    batch.update(myRef, {
      pendingFriends: firebase.firestore.FieldValue.arrayRemove(targetUserId),
      friends: firebase.firestore.FieldValue.arrayUnion(targetUserId),
    });
    batch.update(targetRef, {
      friends: firebase.firestore.FieldValue.arrayUnion(this._user.userId),
      sentRequests: firebase.firestore.FieldValue.arrayRemove(this._user.userId),
    });
    await batch.commit();
  }

  async _declineFriend(targetUserId) {
    const batch = this._db.batch();
    const myRef = this._db.collection("users").doc(this._user.userId);
    const targetRef = this._db.collection("users").doc(targetUserId);
    batch.update(myRef, { pendingFriends: firebase.firestore.FieldValue.arrayRemove(targetUserId) });
    batch.update(targetRef, { sentRequests: firebase.firestore.FieldValue.arrayRemove(this._user.userId) });
    await batch.commit();
  }

  async _removeFriend(targetUserId) {
    const batch = this._db.batch();
    const myRef = this._db.collection("users").doc(this._user.userId);
    const targetRef = this._db.collection("users").doc(targetUserId);
    batch.update(myRef, { friends: firebase.firestore.FieldValue.arrayRemove(targetUserId) });
    batch.update(targetRef, { friends: firebase.firestore.FieldValue.arrayRemove(this._user.userId) });
    await batch.commit();
  }

  async _blockUser(targetUserId) {
    const batch = this._db.batch();
    const myRef = this._db.collection("users").doc(this._user.userId);
    const targetRef = this._db.collection("users").doc(targetUserId);
    batch.update(myRef, {
      blocked: firebase.firestore.FieldValue.arrayUnion(targetUserId),
      friends: firebase.firestore.FieldValue.arrayRemove(targetUserId),
      pendingFriends: firebase.firestore.FieldValue.arrayRemove(targetUserId),
    });
    batch.update(targetRef, { friends: firebase.firestore.FieldValue.arrayRemove(this._user.userId) });
    await batch.commit();
  }

  async _unblockUser(targetUserId) {
    await this._db.collection("users").doc(this._user.userId).update({
      blocked: firebase.firestore.FieldValue.arrayRemove(targetUserId),
    });
  }

  _sendFriendRequestEmail(targetUserId) {
    if (!this._emailjsReady || !window.emailjs) return;
    this._db.collection("users").doc(targetUserId).get().then(doc => {
      if (!doc.exists) return;
      const target = doc.data();
      window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, {
        to_email: target.email,
        from_name: "CrolixMeet",
        subject: "New Friend Request",
        meeting_id: this._user.meetingId,
        message: `${this._user.name} wants to be your friend on CrolixMeet! Open CrolixMeet and check your pending requests to accept or decline.`,
        date_time: new Date().toLocaleString(),
        guest_email: target.email,
        initials: this._user.name.split(" ").map(w => w[0]).join("").toUpperCase(),
      }).catch(err => console.warn("Friend request email failed:", err));
    }).catch(() => {});
  }

  // ── Find / Search ──────────────────────────────────────────
  async _handleSearch() {
    const input = this.container.querySelector("#findMeetIdInput");
    const results = this.container.querySelector("#findResults");
    const meetId = input.value.trim().toLowerCase();

    if (await this._categoryController.isHiddenTrigger(meetId)) {
      input.value = "";
      results.innerHTML = "";
      this._categoryController.triggerHiddenUnlock();
      return;
    }
    if (!meetId) return;
    if (meetId === this._user.meetingId) {
      results.innerHTML = '<div class="profile-empty">That\'s your own Meeting ID!</div>';
      return;
    }

    results.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Searching…</div>';

    try {
      const idDoc = await this._db.collection("meetingIds").doc(meetId).get();
      if (!idDoc.exists) {
        results.innerHTML = '<div class="profile-empty"><div class="profile-empty-icon">🔍</div>No user found with this Meeting ID</div>';
        return;
      }

      const targetUserId = idDoc.data().userId;
      const userDoc = await this._db.collection("users").doc(targetUserId).get();
      if (!userDoc.exists) {
        results.innerHTML = '<div class="profile-empty"><div class="profile-empty-icon">🔍</div>User not found</div>';
        return;
      }

      const targetData = { ...userDoc.data(), userId: userDoc.id };

      // Check if blocked
      if ((targetData.blocked || []).includes(this._user.userId)) {
        results.innerHTML = '<div class="profile-empty"><div class="profile-empty-icon">🔍</div>User not found</div>';
        return;
      }

      // Determine relationship
      const myFriends = this._fullUserData?.friends || [];
      const myPending = this._fullUserData?.pendingFriends || [];
      const targetPending = targetData.pendingFriends || [];
      let relationship = "none";
      if (myFriends.includes(targetUserId)) relationship = "friend";
      else if (targetPending.includes(this._user.userId)) relationship = "pending-sent";
      else if (myPending.includes(targetUserId)) relationship = "pending-received";

      results.innerHTML = buildPublicProfile(targetData, relationship);
      this._bindPublicProfileActions(results, targetData, relationship);
    } catch (err) {
      console.error("Search error:", err);
      results.innerHTML = '<div class="profile-empty">Search failed. Please try again.</div>';
    }
  }

  // ── Friend Profile Full Page ────────────────────────────────
  async _openFriendProfile(meetId) {
    if (!meetId) return;
    const screen = this.container.querySelector("#profile-screen");
    const content = screen.querySelector("#friendProfileContent");
    const page = screen.querySelector("#page-friendProfile");

    // Navigate to the friend profile page
    screen.querySelectorAll(".pnav-btn[data-page]").forEach(b => b.classList.remove("active"));
    screen.querySelectorAll(".pmobile-btn[data-page]").forEach(b => b.classList.remove("active"));
    screen.querySelectorAll(".ppage").forEach(p => p.classList.remove("active"));
    page.classList.add("active");

    content.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading profile…</div>';

    // Back button
    screen.querySelector("#friendProfileBack").onclick = () => {
      screen.querySelectorAll(".ppage").forEach(p => p.classList.remove("active"));
      screen.querySelector("#page-friends").classList.add("active");
      screen.querySelectorAll(".pnav-btn[data-page='friends']").forEach(b => b.classList.add("active"));
      screen.querySelectorAll(".pmobile-btn[data-page='friends']").forEach(b => b.classList.add("active"));
    };

    try {
      const idDoc = await this._db.collection("meetingIds").doc(meetId).get();
      if (!idDoc.exists) { content.innerHTML = '<div class="profile-empty">User not found</div>'; return; }

      const targetUserId = idDoc.data().userId;
      const userDoc = await this._db.collection("users").doc(targetUserId).get();
      if (!userDoc.exists) { content.innerHTML = '<div class="profile-empty">User not found</div>'; return; }

      const targetData = { ...userDoc.data(), userId: userDoc.id };

      // Check blocked
      if ((targetData.blocked || []).includes(this._user.userId)) {
        content.innerHTML = '<div class="profile-empty"><div class="profile-empty-icon">🔍</div>User not found</div>';
        return;
      }

      // Determine relationship
      const myFriends = this._fullUserData?.friends || [];
      let relationship = "none";
      if (myFriends.includes(targetUserId)) relationship = "friend";
      else if ((targetData.pendingFriends || []).includes(this._user.userId)) relationship = "pending-sent";

      const hasPrivateAccess = (targetData.privateRoomAccess || []).includes(this._user.userId);

      content.innerHTML = buildFriendProfilePage(targetData, relationship, hasPrivateAccess);

      // Bind actions inside the profile
      this._bindFriendProfileActions(content, targetData, hasPrivateAccess);

      // Clickable profile pic for fullscreen
      const friendPic = content.querySelector(".pfp-hero-pic");
      if (friendPic) {
        friendPic.style.cursor = "pointer";
        friendPic.onclick = () => this._showFullPicture(targetData.profilePicBase64, targetData.name);
      }

      // Auto-load public room
      const publicGrid = content.querySelector("#fpPublicGrid");
      const publicEmpty = content.querySelector("#fpPublicEmpty");
      if (publicGrid) {
        await this._roomController.loadUserPublicRoom(targetUserId, publicGrid);
        if (publicGrid.children.length === 0) publicEmpty.style.display = "";
      }
    } catch (err) {
      console.error("Open friend profile error:", err);
      content.innerHTML = '<div class="profile-empty">Failed to load profile</div>';
    }
  }

  _bindFriendProfileActions(container, targetData, hasPrivateAccess) {
    const callBtn = container.querySelector("#fpCallBtn");
    if (callBtn) callBtn.onclick = () => this.callUser(targetData.meetingId, this._user.name);

    const removeBtn = container.querySelector("#fpRemoveBtn");
    if (removeBtn) {
      removeBtn.onclick = async () => {
        removeBtn.disabled = true; removeBtn.textContent = "Removing…";
        await this._removeFriend(targetData.userId);
        await this._loadFullUserData();
        this._loadFriends();
        // Go back to friends
        const screen = this.container.querySelector("#profile-screen");
        screen.querySelectorAll(".ppage").forEach(p => p.classList.remove("active"));
        screen.querySelector("#page-friends").classList.add("active");
        screen.querySelectorAll(".pnav-btn[data-page='friends']").forEach(b => b.classList.add("active"));
        screen.querySelectorAll(".pmobile-btn[data-page='friends']").forEach(b => b.classList.add("active"));
      };
    }

    const addBtn = container.querySelector("#fpAddBtn");
    if (addBtn) {
      addBtn.onclick = async () => {
        addBtn.disabled = true; addBtn.textContent = "Sending…";
        await this._sendFriendRequest(targetData.userId);
        addBtn.textContent = "Request Sent";
        addBtn.style.opacity = "0.6";
      };
    }

    // Room tab switching
    container.querySelectorAll(".pfp-room-tab").forEach(tab => {
      tab.onclick = () => {
        container.querySelectorAll(".pfp-room-tab").forEach(t => t.classList.remove("active"));
        container.querySelectorAll(".pfp-room-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        const panel = container.querySelector(`#fpRoom-${tab.dataset.room}`);
        if (panel) panel.classList.add("active");

        // Lazy-load private room on first click
        if (tab.dataset.room === "private" && hasPrivateAccess) {
          const privateGrid = container.querySelector("#fpPrivateGrid");
          const privateEmpty = container.querySelector("#fpPrivateEmpty");
          if (privateGrid && privateGrid.children.length === 0 && privateEmpty.style.display === "none") {
            this._roomController.loadUserPrivateRoom(targetData.userId, targetData, privateGrid).then(() => {
              if (privateGrid.children.length === 0) privateEmpty.style.display = "";
            });
          }
        }
      };
    });
  }

  _bindPublicProfileActions(container, targetData, relationship) {
    const callBtn = container.querySelector("#publicCallBtn");
    if (callBtn) callBtn.onclick = () => this.callUser(targetData.meetingId, this._user.name);

    const viewRoomBtn = container.querySelector("#publicViewRoomBtn");
    if (viewRoomBtn) {
      let roomLoaded = false;
      viewRoomBtn.onclick = () => {
        if (roomLoaded) {
          const grid = container.querySelector("#publicProfileRoomGrid");
          grid.style.display = grid.style.display === "none" ? "" : "none";
          viewRoomBtn.textContent = grid.style.display === "none" ? "🌍 View Public Room" : "🌍 Hide Public Room";
          return;
        }
        roomLoaded = true;
        viewRoomBtn.textContent = "🌍 Hide Public Room";
        const grid = container.querySelector("#publicProfileRoomGrid");
        this._roomController.loadUserPublicRoom(targetData.userId, grid);
      };
    }

    const addBtn = container.querySelector("#publicAddFriend");
    if (addBtn) {
      addBtn.onclick = async () => {
        addBtn.disabled = true; addBtn.textContent = "Sending…";
        try {
          await this._sendFriendRequest(targetData.userId);
          addBtn.textContent = "Request Sent";
          addBtn.style.opacity = "0.6";
          addBtn.style.cursor = "default";
        } catch (err) {
          console.error("Add friend error:", err);
          addBtn.disabled = false; addBtn.textContent = "+ Add Friend";
        }
      };
    }

    const acceptBtn = container.querySelector("#publicAcceptFriend");
    if (acceptBtn) {
      acceptBtn.onclick = async () => {
        acceptBtn.disabled = true; acceptBtn.textContent = "Accepting…";
        try {
          await this._acceptFriend(targetData.userId);
          await this._loadFullUserData();
          acceptBtn.textContent = "Friends ✓";
          acceptBtn.style.opacity = "0.6";
          this._loadFriends();
          this._loadPending();
        } catch (err) {
          console.error("Accept error:", err);
          acceptBtn.disabled = false; acceptBtn.textContent = "Accept Request";
        }
      };
    }

    const removeBtn = container.querySelector("#publicRemoveFriend");
    if (removeBtn) {
      removeBtn.onclick = async () => {
        removeBtn.disabled = true; removeBtn.textContent = "Removing…";
        try {
          await this._removeFriend(targetData.userId);
          await this._loadFullUserData();
          this._loadFriends();
          this._handleSearch();
        } catch (err) {
          console.error("Remove error:", err);
          removeBtn.disabled = false; removeBtn.textContent = "Remove Friend";
        }
      };
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  async _fetchUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) return [];
    const results = [];
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 10) {
      chunks.push(userIds.slice(i, i + 10));
    }
    for (const chunk of chunks) {
      const snapshot = await this._db.collection("users")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk)
        .get();
      snapshot.forEach(doc => results.push({ ...doc.data(), userId: doc.id }));
    }
    return results;
  }

  async _getUserIdByMeetId(meetId) {
    try {
      const doc = await this._db.collection("meetingIds").doc(meetId).get();
      return doc.exists ? doc.data().userId : null;
    } catch (_) { return null; }
  }

  sendMissedCallEmail(targetMeetId) {
    if (!this._emailjsReady || !window.emailjs) return;
    this._db.collection("meetingIds").doc(targetMeetId).get().then(async idDoc => {
      if (!idDoc.exists) return;
      const targetDoc = await this._db.collection("users").doc(idDoc.data().userId).get();
      if (!targetDoc.exists) return;
      const target = targetDoc.data();

      if ((target.blocked || []).includes(this._user.userId)) return;

      window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, {
        to_email: target.email,
        from_name: "CrolixMeet",
        subject: "Missed Call on CrolixMeet",
        meeting_id: targetMeetId,
        message: `You missed a call from ${this._user.name} on CrolixMeet. Their Meeting ID is: ${this._user.meetingId}. Open CrolixMeet to call them back!`,
        date_time: new Date().toLocaleString(),
        guest_email: target.email,
        initials: this._user.name.split(" ").map(w => w[0]).join("").toUpperCase(),
      }).catch(err => console.warn("Missed call email failed:", err));
    }).catch(() => {});
  }
}
