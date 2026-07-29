/**
 * src/controllers/ProfileShareController.js
 * Live profile tagging and sharing inside chats.
 *
 * Roles:
 *   TAGGER  — person who tagged (sharedBy === myUid). Full control + navigation.
 *   PARTNER — everyone else in the chat. Sees live view changes + scroll sync.
 *   TAGGED  — whose profile is shared. Completely unaware.
 */

import {
  buildTagSearchPanel,
  buildTagResultsHtml,
  buildSharedProfileCard,
  buildViewBody,
  buildSendInviteDropdown,
} from "../ui/profileShareTemplates.js";

const SCROLL_DEBOUNCE_MS = 500;

export class ProfileShareController {
  constructor(db, container, myUser, onStartMeeting) {
    this._db             = db;
    this._container      = container;
    this._user           = myUser;
    this._onStartMeeting = onStartMeeting;

    this._chatId         = null;
    this._partnerUid     = null;
    this._isGroup        = false;
    this._isTagger       = false;
    this._shareUnsub     = null;
    this._currentShare   = null;
    this._friends        = [];
    this._outsideHandler = null;
    this._stopping       = false;

    // Live-nav state
    this._cachedPosts    = null;   // posts for room view, fetched once per share
    this._scrollTimer    = null;   // debounce timer id for scroll sync
    this._prevView       = null;   // tracks last rendered view to diff
    this._prevScrollPos  = null;   // tracks last scroll to diff
  }

  // ── Called when a chat opens ────────────────────────────────

  init(chatId, partnerUid, isGroup = false) {
    this.cleanup();
    this._chatId     = chatId;
    this._partnerUid = partnerUid;
    this._isGroup    = isGroup;
    this._isTagger   = false;
    this._currentShare = null;
    this._stopping   = false;
    this._cachedPosts = null;
    this._prevView   = null;
    this._prevScrollPos = null;
    this._listenShare();
  }

  cleanup() {
    // If we're the tagger with an active share, close it for everyone before leaving
    if (this._currentShare?.active && this._isTagger && this._chatId) {
      this._chatRoot().collection("sharedProfile").doc("state")
        .update({ active: false }).catch(() => {});
    }
    if (this._shareUnsub) { this._shareUnsub(); this._shareUnsub = null; }
    if (this._scrollTimer) { clearTimeout(this._scrollTimer); this._scrollTimer = null; }
    this._removeCard();
    this._unlockInput();
    this._closeTagPanelNow();
    document.querySelector("#psInviteDropdown")?.remove();
    this._chatId     = null;
    this._currentShare = null;
    this._stopping   = false;
    this._cachedPosts = null;
    this._prevView   = null;
    this._prevScrollPos = null;
  }

  setFriends(friendsData) {
    this._friends = friendsData || [];
  }

  // ── Firestore collection root ───────────────────────────────

  _chatRoot() {
    return this._isGroup
      ? this._db.collection("groups").doc(this._chatId)
      : this._db.collection("chats").doc(this._chatId);
  }

  // ── Firestore listener ──────────────────────────────────────

  _listenShare() {
    if (!this._chatId) return;
    const ref = this._chatRoot().collection("sharedProfile").doc("state");
    const listenChatId = this._chatId;

    this._shareUnsub = ref.onSnapshot(async snap => {
      const data = snap.data();
      if (!data || !data.active) {
        if (this._chatId !== listenChatId) return;
        this._currentShare = null;
        this._prevView     = null;
        this._prevScrollPos = null;
        this._removeCard();
        this._unlockInput();
        return;
      }

      // ── Profile changed? Fetch fresh data ──
      let profileData = this._currentShare?.profileData;
      const profileChanged = !profileData || this._currentShare?.profileUserId !== data.profileUserId;
      if (profileChanged) {
        try {
          const pSnap = await this._db.collection("users").doc(data.profileUserId).get();
          if (!pSnap.exists) return;
          profileData = { ...pSnap.data(), userId: pSnap.id };
        } catch (_) { return; }
        // New profile means cached posts are stale
        this._cachedPosts = null;
        this._prevView    = null;
      }

      if (this._chatId !== listenChatId) return;

      this._currentShare = { ...data, profileData };
      this._isTagger = data.sharedBy === this._user.userId;

      const newView     = data.currentView || "profile";
      const newScrollPos = data.scrollPosition ?? 0;

      if (profileChanged) {
        // Full rebuild on profile switch
        this._renderCard(newView);
        this._prevView      = newView;
        this._prevScrollPos = newScrollPos;
      } else if (newView !== this._prevView) {
        // Partial update: only swap the view body
        this._renderViewChange(newView);
        this._prevView      = newView;
        this._prevScrollPos = newScrollPos;
      } else if (!this._isTagger && newScrollPos !== this._prevScrollPos) {
        // Partner mirrors tagger's scroll position
        this._applyScrollPosition(newScrollPos);
        this._prevScrollPos = newScrollPos;
      }

      if (!this._isTagger) this._lockInput();
    }, err => console.error("ProfileShare listener error:", err));
  }

  // ── Full card render ────────────────────────────────────────

  async _renderCard(view = "profile") {
    if (!this._currentShare?.profileData) return;
    const area = this._getOrCreateShareArea();
    const taggerLabel = this._isTagger ? "You" : (this._getPartnerName() || "Someone");
    area.dataset.mode = "live";

    const posts = await this._getPostsIfNeeded(view);
    area.innerHTML = buildSharedProfileCard(
      this._currentShare.profileData,
      this._isTagger,
      taggerLabel,
      view,
      posts,
    );
    this._bindCardActions(area, view);
    if (!this._isTagger && view !== "profile") this._applyScrollPosition(this._currentShare.scrollPosition || 0);
  }

  // ── Partial view-change render (no full rebuild) ────────────

  async _renderViewChange(view) {
    const card = this._container.querySelector("#psShareCard");
    if (!card || !this._currentShare?.profileData) {
      // Card missing — fall back to full render
      return this._renderCard(view);
    }

    const posts = await this._getPostsIfNeeded(view);
    const profile = this._currentShare.profileData;

    // Toggle expanded class
    card.classList.toggle("ps-card-expanded", view !== "profile");

    // Remove everything after banner and replace with new view body
    const banner = card.querySelector(".ps-live-banner");
    if (!banner) return this._renderCard(view);

    // Remove all siblings after banner
    let node = banner.nextSibling;
    while (node) {
      const next = node.nextSibling;
      card.removeChild(node);
      node = next;
    }

    // Inject new body
    const bodyHtml = buildViewBody(view, profile, posts, this._isTagger);
    const tmp = document.createElement("div");
    tmp.innerHTML = bodyHtml;
    while (tmp.firstChild) card.appendChild(tmp.firstChild);

    // Update banner label
    this._updateBannerLabel(view);

    // Bind new actions
    const area = this._container.querySelector("#psShareArea");
    if (area) this._bindCardActions(area, view);

    if (!this._isTagger && view !== "profile") {
      this._applyScrollPosition(this._currentShare.scrollPosition || 0);
    }
  }

  _updateBannerLabel(view) {
    const labelEl = this._container.querySelector("#psLiveLabel");
    if (!labelEl) return;
    const taggerName = this._isTagger ? "You" : (this._getPartnerName() || "Someone");
    if (view === "room")  { labelEl.textContent = `${taggerName} is browsing their room`; return; }
    if (view === "about") { labelEl.textContent = `${taggerName} is viewing their about`; return; }
    labelEl.textContent = `${taggerName} is sharing a profile`;
  }

  // ── Scroll sync ─────────────────────────────────────────────

  _bindExpandedScrollSync(scrollEl) {
    if (!scrollEl || !this._isTagger) return;
    scrollEl.addEventListener("scroll", () => {
      if (this._scrollTimer) clearTimeout(this._scrollTimer);
      this._scrollTimer = setTimeout(async () => {
        if (!this._chatId || !this._currentShare) return;
        try {
          await this._chatRoot().collection("sharedProfile").doc("state")
            .update({ scrollPosition: Math.round(scrollEl.scrollTop) });
        } catch (_) {}
      }, SCROLL_DEBOUNCE_MS);
    }, { passive: true });
  }

  _applyScrollPosition(pos) {
    if (this._isTagger) return;  // only partners mirror scroll
    const el = this._container.querySelector("#psExpandedBody");
    if (el) el.scrollTop = pos;
  }

  // ── Tagger navigation ────────────────────────────────────────

  async _navigateTo(view) {
    if (!this._chatId || !this._currentShare) return;
    try {
      await this._chatRoot().collection("sharedProfile").doc("state")
        .update({ currentView: view, scrollPosition: 0 });
    } catch (err) { console.error("_navigateTo error:", err); }
  }

  // ── Post loading (cached per share session) ──────────────────

  async _getPostsIfNeeded(view) {
    if (view !== "room") return [];
    if (this._cachedPosts !== null) return this._cachedPosts;
    return this._loadRoomPosts(this._currentShare?.profileUserId);
  }

  async _loadRoomPosts(profileUserId) {
    if (!profileUserId) { this._cachedPosts = []; return []; }
    try {
      const snap = await this._db.collection("users").doc(profileUserId)
        .collection("publicRoom").orderBy("createdAt", "desc").limit(20).get();
      this._cachedPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (_) {
      this._cachedPosts = [];
    }
    return this._cachedPosts;
  }

  // ── Card helpers ────────────────────────────────────────────

  _getOrCreateShareArea() {
    let area = this._container.querySelector("#psShareArea");
    if (!area) {
      area = document.createElement("div");
      area.id = "psShareArea";
      area.className = "ps-share-area";
      const inputBar = this._container.querySelector("#chatInputBar");
      if (inputBar) inputBar.parentNode.insertBefore(area, inputBar);
    }
    return area;
  }

  _removeCard() {
    if (this._scrollTimer) { clearTimeout(this._scrollTimer); this._scrollTimer = null; }
    this._container.querySelector("#psShareArea")?.remove();
  }

  _getPartnerName() {
    const el = this._container.querySelector("#chatHeader .chat-header-name");
    return el ? el.textContent.trim() : "";
  }

  // ── Input locking ───────────────────────────────────────────

  _lockInput() {
    const bar = this._container.querySelector("#chatInputBar");
    if (!bar) return;
    if (!this._container.querySelector("#psInputLock")) {
      const lock = document.createElement("div");
      lock.id = "psInputLock";
      lock.className = "ps-input-lock";
      lock.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Profile share in progress…`;
      bar.parentNode.insertBefore(lock, bar);
    }
    bar.style.pointerEvents = "none";
    bar.style.opacity       = "0.38";
  }

  _unlockInput() {
    const bar = this._container.querySelector("#chatInputBar");
    if (bar) { bar.style.pointerEvents = ""; bar.style.opacity = ""; }
    this._container.querySelector("#psInputLock")?.remove();
  }

  // ── Card action bindings ────────────────────────────────────

  _bindCardActions(area, currentView = "profile") {
    area.querySelector("#psCloseShareBtn")?.addEventListener("click", () => this.stopShare());

    area.querySelector(".ps-copy-id-btn")?.addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.meetid;
      navigator.clipboard.writeText(id).catch(() => {});
      e.currentTarget.style.color = "#4ade80";
      setTimeout(() => { e.currentTarget.style.color = ""; }, 1500);
    });

    // Back button (expanded views only) — clear post cache so Room reloads fresh next visit
    area.querySelector("#psBackBtn")?.addEventListener("click", () => {
      if (this._isTagger) {
        this._cachedPosts = null;
        this._navigateTo("profile");
      }
    });

    if (this._isTagger) {
      area.querySelectorAll(".ps-action-btn[data-action]").forEach(btn => {
        btn.addEventListener("click", () => this._handleTaggerAction(btn.dataset.action));
      });
    }

    // Scroll sync for expanded body
    const expandedBody = area.querySelector("#psExpandedBody");
    if (expandedBody) this._bindExpandedScrollSync(expandedBody);

    const inviteBtn = area.querySelector("#psSendInviteBtn");
    if (inviteBtn) {
      inviteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._showInviteDropdown(inviteBtn);
      });
    }
  }

  _handleTaggerAction(action) {
    const profile = this._currentShare?.profileData;
    if (!profile) return;
    if (action === "call" && this._onStartMeeting) {
      this._onStartMeeting(profile.meetingId, this._user.name);
    } else if (action === "room") {
      this._navigateTo("room");
    } else if (action === "about") {
      this._navigateTo("about");
    } else if (action === "addFriend") {
      this._sendFriendRequest(profile.userId);
    }
  }

  async _sendFriendRequest(targetUserId) {
    try {
      await this._db.collection("users").doc(targetUserId).update({
        pendingRequests: firebase.firestore.FieldValue.arrayUnion(this._user.userId),
      });
      await this._db.collection("users").doc(this._user.userId).update({
        sentRequests: firebase.firestore.FieldValue.arrayUnion(targetUserId),
      });
    } catch (err) { console.error("Friend request error:", err); }
  }

  // ── Invite dropdown ─────────────────────────────────────────

  _showInviteDropdown(anchorEl) {
    document.querySelector("#psInviteDropdown")?.remove();
    const profile = this._currentShare?.profileData;
    if (!profile) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = buildSendInviteDropdown(profile.name);
    const el = wrap.firstElementChild;
    document.body.appendChild(el);

    const rect = anchorEl.getBoundingClientRect();
    const dropH = el.offsetHeight || 200;
    const top = rect.top - dropH - 8;
    el.style.cssText = `position:fixed;top:${Math.max(8, top)}px;left:${Math.max(8, rect.left - 100)}px;z-index:999999;`;

    el.querySelectorAll(".ps-invite-opt").forEach(btn => {
      btn.addEventListener("click", () => {
        this._handlePartnerInvite(btn.dataset.type, profile);
        el.remove();
      });
    });

    setTimeout(() => {
      const h = (e) => { if (!el.contains(e.target)) { el.remove(); document.removeEventListener("click", h); } };
      document.addEventListener("click", h);
    }, 0);
  }

  async _handlePartnerInvite(type, profile) {
    if (type === "joinChat") {
      try {
        await this._db.collection("users").doc(profile.userId)
          .collection("notifications").add({
            type:      "chat_invite",
            fromName:  this._user.name,
            fromUid:   this._user.userId,
            chatId:    this._chatId,
            message:   `${this._user.name} invited you to join a chat`,
            createdAt: Date.now(),
          });
      } catch (err) { console.error("Chat invite error:", err); }
    } else if (type === "meeting") {
      if (this._onStartMeeting) this._onStartMeeting(profile.meetingId, this._user.name);
    } else if (type === "addFriend") {
      await this._sendFriendRequest(profile.userId);
    }
  }

  // ── Start share ─────────────────────────────────────────────

  async startShare(friendData) {
    if (!this._chatId) return;

    let profileData = friendData;
    try {
      const snap = await this._db.collection("users").doc(friendData.userId).get();
      if (snap.exists) profileData = { ...snap.data(), userId: snap.id };
    } catch (_) {}

    const viewers = this._partnerUid ? [this._partnerUid] : [];

    try {
      await this._chatRoot().collection("sharedProfile").doc("state").set({
        active:        true,
        profileUserId: profileData.userId,
        sharedBy:      this._user.userId,
        startedAt:     Date.now(),
        currentView:   "profile",
        scrollPosition: 0,
        viewers,
      });
      this._closeTagPanel();
    } catch (err) {
      console.error("startShare error:", err);
      this._closeTagPanel();
    }
  }

  // ── Stop share ──────────────────────────────────────────────

  async stopShare() {
    if (!this._chatId || !this._currentShare || this._stopping) return;
    this._stopping = true;

    // Snapshot both refs before any await — this._chatId could be cleared mid-flight
    const stateRef = this._chatRoot().collection("sharedProfile").doc("state");
    const msgsRef  = this._chatRoot().collection("messages");
    const profile  = this._currentShare.profileData;

    try {
      await stateRef.update({ active: false });
    } catch (_) {}

    if (profile) {
      try {
        await msgsRef.add({
          type:               "profile_share",
          senderId:           this._user.userId,
          profileId:          profile.userId,
          profileName:        profile.name || "",
          profilePic:         profile.profilePicBase64 || "",
          content:            `Shared ${profile.name || "a"} profile`,
          createdAt:          Date.now(),
          deletedFor:         [],
          deletedForEveryone: false,
          readBy:             [],
        });
      } catch (_) {}
    }

    this._removeCard();
    this._unlockInput();
    this._currentShare = null;
    this._cachedPosts  = null;
    this._prevView     = null;
    this._stopping     = false;
  }

  // ── Tag search panel ────────────────────────────────────────

  async openTagPanel() {
    const existing = this._container.querySelector("#chatTagPanel");
    if (existing) { this._closeTagPanelNow(); return; }

    const friends = await this._fetchMutualFriends();
    this.setFriends(friends);

    const inputBar = this._container.querySelector("#chatInputBar");
    if (!inputBar) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = buildTagSearchPanel(friends);
    const panel = wrap.firstElementChild;
    inputBar.parentNode.insertBefore(panel, inputBar);

    requestAnimationFrame(() => panel.classList.add("ps-tag-panel-open"));

    const searchInput = panel.querySelector("#chatTagSearch");
    if (searchInput) {
      searchInput.focus();
      searchInput.addEventListener("input", () => {
        const q = searchInput.value.trim().toLowerCase();
        const filtered = q
          ? this._friends.filter(f =>
              (f.name || "").toLowerCase().includes(q) ||
              (f.meetingId || "").toLowerCase().includes(q))
          : this._friends;
        const resultsEl = panel.querySelector("#chatTagResults");
        if (resultsEl) resultsEl.innerHTML = buildTagResultsHtml(filtered);
        this._bindTagButtons(panel);
      });
    }

    panel.querySelector("#chatTagPanelClose")?.addEventListener("click", () => this._closeTagPanel());
    this._bindTagButtons(panel);

    if (this._outsideHandler) document.removeEventListener("click", this._outsideHandler);
    this._outsideHandler = (e) => {
      if (!panel.contains(e.target) && !e.target.closest("#chatTagBtn")) {
        this._closeTagPanel();
      }
    };
    setTimeout(() => document.addEventListener("click", this._outsideHandler), 0);
  }

  _bindTagButtons(panel) {
    panel.querySelectorAll(".ps-tag-btn").forEach(btn => {
      btn.onclick = () => {
        const uid = btn.dataset.userid;
        const friend = this._friends.find(f => f.userId === uid);
        if (friend) this.startShare(friend);
      };
    });
  }

  _closeTagPanel() {
    const panel = this._container.querySelector("#chatTagPanel");
    if (panel) {
      panel.classList.remove("ps-tag-panel-open");
      const ref = panel;
      setTimeout(() => { if (ref.parentNode) ref.remove(); }, 260);
    }
    if (this._outsideHandler) {
      document.removeEventListener("click", this._outsideHandler);
      this._outsideHandler = null;
    }
  }

  _closeTagPanelNow() {
    this._container.querySelector("#chatTagPanel")?.remove();
    if (this._outsideHandler) {
      document.removeEventListener("click", this._outsideHandler);
      this._outsideHandler = null;
    }
  }

  // ── Mutual friends fetch ────────────────────────────────────

  async _fetchMutualFriends() {
    try {
      const myDoc = await this._db.collection("users").doc(this._user.userId).get();
      const friendIds = myDoc.data()?.friends || [];
      if (friendIds.length === 0) return [];

      const results = [];
      for (let i = 0; i < friendIds.length; i += 10) {
        const chunk = friendIds.slice(i, i + 10);
        const snap = await this._db.collection("users")
          .where(firebase.firestore.FieldPath.documentId(), "in", chunk).get();
        snap.forEach(doc => results.push({ ...doc.data(), userId: doc.id }));
      }
      return results.filter(f => (f.friends || []).includes(this._user.userId));
    } catch (err) {
      console.error("Fetch mutual friends error:", err);
      return [];
    }
  }

  // ── Read-only historical card ───────────────────────────────

  async showHistoryCard(profileId) {
    if (!profileId) return;
    if (this._currentShare?.active) return;

    try {
      const snap = await this._db.collection("users").doc(profileId).get();
      if (!snap.exists) return;
      const profile = { ...snap.data(), userId: snap.id };

      const area = this._getOrCreateShareArea();
      area.dataset.mode = "history";
      area.innerHTML = buildSharedProfileCard(profile, false, profile.name);

      const banner = area.querySelector(".ps-live-banner");
      if (banner) {
        banner.classList.add("ps-banner-history");
        const dot   = banner.querySelector(".ps-live-dot");
        const badge = banner.querySelector(".ps-live-badge");
        const label = banner.querySelector(".ps-live-label");
        if (dot)   { dot.style.background = "#94a3b8"; dot.style.animation = "none"; }
        if (badge) { badge.textContent = "PAST"; badge.style.background = "rgba(148,163,184,0.15)"; badge.style.color = "#94a3b8"; }
        if (label) label.textContent = `${profile.name}'s profile — read-only`;

        const closeBtn = document.createElement("button");
        closeBtn.className = "ps-close-btn";
        closeBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
        closeBtn.addEventListener("click", () => this._removeCard());
        banner.appendChild(closeBtn);
      }

      area.querySelectorAll(".ps-action-btn, .ps-send-invite-btn").forEach(b => {
        b.disabled = true;
        b.classList.add("ps-action-disabled");
        b.style.pointerEvents = "none";
      });

      area.querySelector(".ps-copy-id-btn")?.addEventListener("click", (e) => {
        navigator.clipboard.writeText(e.currentTarget.dataset.meetid).catch(() => {});
      });
    } catch (err) { console.error("History card error:", err); }
  }
}
