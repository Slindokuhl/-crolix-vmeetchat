/**
 * src/controllers/ChatController.js
 * Real-time 1-on-1 chat — messages, voice notes, stickers, files, typing, delete.
 */

import { FIREBASE_CONFIG, GIPHY_API_KEY, LOCAL_GIFS, PUBLIC_WEB_URL } from "../config/config.js";
import { crolixConfirm, crolixAlert } from "../utils/confirmModal.js";
import { buildChatPage, buildConvItem, buildChatHeader, buildMessageBubble, buildDateSeparator, buildDisappearMenu, buildGroupConvItem, buildCreateGroupModal, buildGroupHeader, buildGroupInfoPanel, buildChatMenu, buildConvContextMenu, buildInviteLinkModal } from "../ui/chatTemplates.js";
import { ProfileShareController } from "./ProfileShareController.js";

function _chatId(a, b) { return [a, b].sort().join("_"); }
function _escapeHtml(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

export class ChatController {
  constructor(container, onStartMeeting) {
    this.container = container;
    this.onStartMeeting = onStartMeeting;
    this._db = null;
    this._user = null;
    this._fullUserData = null;
    this._activeChatUserId = null;
    this._activeChatUser = null;
    this._msgUnsub = null;
    this._typingUnsub = null;
    this._typingTimer = null;
    this._isRecording = false;
    this._mediaRecorder = null;
    this._audioChunks = [];
    this._recordStart = 0;
    this._recordTimer = null;
    this._contextMsgId = null;
    this._activeGroupId = null;
    this._activeGroup = null;
    this._groupMembers = {};
    this._profileShare = null;
    this._init();
  }

  _init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._db = firebase.firestore();
  }

  setUser(session, fullUserData) {
    this._user = session;
    this._fullUserData = fullUserData;
    // Initialise profile share controller (lazy, needs container to be rendered)
    if (!this._profileShare) {
      this._profileShare = new ProfileShareController(
        this._db,
        this.container,
        this._user,
        this.onStartMeeting,
      );
    }
  }

  // ── Render chat page into the ppage container ──────────────

  render() {
    const page = this.container.querySelector("#page-chat");
    if (!page) return;
    page.querySelector(".ppage-inner").innerHTML = buildChatPage(this._user);
    this._bindChatEvents();
    this._loadConversations();
  }

  cleanup() {
    if (this._msgUnsub) { this._msgUnsub(); this._msgUnsub = null; }
    if (this._typingUnsub) { this._typingUnsub(); this._typingUnsub = null; }
    if (this._presenceUnsub) { this._presenceUnsub(); this._presenceUnsub = null; }
    this._profileShare?.cleanup();
    this._stopRecording(true);
  }

  // ── Public entry points for opening a specific conversation from outside the Chat page ──

  openDirectChat(userId) {
    this.render();
    this._openChat(userId);
  }

  openGroupDirect(groupId) {
    this.render();
    this._openGroupChat(groupId);
  }

  // ── Conversation list ──────────────────────────────────────

  async _loadConversations() {
    const listEl = this.container.querySelector("#chatConvList");
    if (!listEl) return;

    const friends = this._fullUserData?.friends || [];
    if (friends.length === 0) {
      listEl.innerHTML = '<div class="profile-empty" style="padding:24px;"><div class="profile-empty-icon">💬</div>Add friends to start chatting!</div>';
      return;
    }

    listEl.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div></div>';

    try {
      const friendUsers = await this._fetchUsersByIds(friends);
      const convs = [];

      for (const f of friendUsers) {
        const chatId = _chatId(this._user.userId, f.userId);
        let lastMessage = "";
        let lastMessageAt = 0;

        try {
          const lastSnap = await this._db.collection("chats").doc(chatId)
            .collection("messages").orderBy("createdAt", "desc").limit(1).get();
          if (!lastSnap.empty) {
            const lastMsg = lastSnap.docs[0].data();
            if (lastMsg.deletedForEveryone) lastMessage = "🚫 Message deleted";
            else if (lastMsg.type === "sticker") lastMessage = lastMsg.content;
            else if (lastMsg.type === "image") lastMessage = "📷 Image";
            else if (lastMsg.type === "voice") lastMessage = "🎤 Voice note";
            else if (lastMsg.type === "gif") lastMessage = "🎬 GIF";
            else if (lastMsg.type === "file") lastMessage = "📎 " + (lastMsg.fileName || "File");
            else lastMessage = lastMsg.content || "";
            lastMessageAt = lastMsg.createdAt || 0;
          }
        } catch (_) {}

        const isOnline = f.online && f.lastSeen && (Date.now() - f.lastSeen < 120000);
        convs.push({ ...f, lastMessage, lastMessageAt, online: isOnline });
      }

      convs.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

      // Load groups
      const groups = await this._loadGroups();

      // Merge and sort by last message time
      const allItems = [
        ...convs.map(c => ({ ...c, _type: "dm", _id: c.userId })),
        ...groups.map(g => ({ ...g, _type: "group", _id: g.id })),
      ].sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));

      // Split archived vs active
      const archivedIds = this._getArchivedIds().map(a => a.id);
      const active = allItems.filter(i => !archivedIds.includes(i._id));
      const archived = allItems.filter(i => archivedIds.includes(i._id));

      let html = active.map(item => item._type === "group" ? buildGroupConvItem(item) : buildConvItem(item)).join("");

      if (archived.length > 0) {
        html += `<div class="chat-archived-header" id="chatArchivedToggle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>
          Archived (${archived.length})
        </div>`;
        html += `<div class="chat-archived-list" id="chatArchivedList" style="display:none;">`;
        html += archived.map(item => item._type === "group" ? buildGroupConvItem(item) : buildConvItem(item)).join("");
        html += `</div>`;
      }

      if (active.length === 0 && archived.length === 0) {
        html = '<div class="profile-empty" style="padding:24px;"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>No chats yet. Add friends to start!</div>';
      }

      listEl.innerHTML = html;

      // Archived toggle
      const archivedToggle = listEl.querySelector("#chatArchivedToggle");
      if (archivedToggle) {
        archivedToggle.onclick = () => {
          const list = listEl.querySelector("#chatArchivedList");
          if (list) list.style.display = list.style.display === "none" ? "" : "none";
          archivedToggle.classList.toggle("chat-archived-open");
        };
      }

      // Click handlers
      listEl.querySelectorAll(".chat-conv-item:not(.chat-conv-group)").forEach(item => {
        item.onclick = () => this._openChat(item.dataset.userid);
      });
      listEl.querySelectorAll(".chat-conv-group").forEach(item => {
        item.onclick = () => this._openGroupChat(item.dataset.groupid);
      });

      // Long-press / right-click context menu on conversations
      this._bindConvContextMenus(listEl);
    } catch (err) {
      console.error("Load conversations error:", err);
      listEl.innerHTML = '<div class="profile-empty">Failed to load chats</div>';
    }
  }

  // ── Open a chat ────────────────────────────────────────────

  async _openChat(targetUserId) {
    if (this._msgUnsub) { this._msgUnsub(); this._msgUnsub = null; }
    if (this._typingUnsub) { this._typingUnsub(); this._typingUnsub = null; }

    this._activeChatUserId = targetUserId;
    const chatWindow = this.container.querySelector("#chatWindow");
    const emptyState = this.container.querySelector("#chatEmptyState");
    const activeChat = this.container.querySelector("#chatActive");
    const sidebar = this.container.querySelector("#chatSidebar");

    emptyState.style.display = "none";
    activeChat.style.display = "flex";
    sidebar.classList.add("chat-has-active");

    try {
      const userDoc = await this._db.collection("users").doc(targetUserId).get();
      this._activeChatUser = userDoc.exists ? { ...userDoc.data(), userId: userDoc.id } : { name: "User", userId: targetUserId };
    } catch (_) {
      this._activeChatUser = { name: "User", userId: targetUserId };
    }

    const headerEl = this.container.querySelector("#chatHeader");
    headerEl.innerHTML = buildChatHeader(this._activeChatUser);

    this._bindChatHeaderActions();
    const chatId = _chatId(this._user.userId, this._activeChatUserId);
    this._cleanExpiredMessages(chatId);
    this._listenMessages();
    this._listenTyping();
    this._listenPresence();

    // Init live profile share for this DM
    if (this._profileShare) {
      this._profileShare.init(chatId, this._activeChatUserId, false);
    }

    this.container.querySelector("#chatMessages").innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div></div>';
  }

  _closeChat() {
    if (this._msgUnsub) { this._msgUnsub(); this._msgUnsub = null; }
    if (this._typingUnsub) { this._typingUnsub(); this._typingUnsub = null; }
    if (this._presenceUnsub) { this._presenceUnsub(); this._presenceUnsub = null; }
    this._profileShare?.cleanup();
    this._activeChatUserId = null;
    this._activeChatUser = null;

    const emptyState = this.container.querySelector("#chatEmptyState");
    const activeChat = this.container.querySelector("#chatActive");
    const sidebar = this.container.querySelector("#chatSidebar");

    if (emptyState) emptyState.style.display = "";
    if (activeChat) activeChat.style.display = "none";
    if (sidebar) sidebar.classList.remove("chat-has-active");
  }

  // ── Real-time message listener ─────────────────────────────

  _listenMessages() {
    const chatId = _chatId(this._user.userId, this._activeChatUserId);
    const messagesEl = this.container.querySelector("#chatMessages");

    this._msgUnsub = this._db.collection("chats").doc(chatId)
      .collection("messages").orderBy("createdAt", "asc")
      .onSnapshot(snap => {
        const msgs = [];
        snap.forEach(doc => {
          const d = doc.data();
          if ((d.deletedFor || []).includes(this._user.userId)) return;
          msgs.push({ id: doc.id, ...d });
        });

        this._renderMessages(msgs, messagesEl);
      }, err => {
        console.error("Messages listener error:", err);
      });
  }

  _renderMessages(msgs, el) {
    let html = "";
    let lastDateStr = "";

    msgs.forEach(msg => {
      const dateStr = new Date(msg.createdAt).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
      if (dateStr !== lastDateStr) {
        html += buildDateSeparator(dateStr);
        lastDateStr = dateStr;
      }
      const isOwn = msg.senderId === this._user.userId;
      const senderPic = isOwn ? this._user.profilePicBase64 : (this._activeChatUser?.profilePicBase64 || null);
      const senderName = isOwn ? this._user.name : (this._activeChatUser?.name || "");
      html += buildMessageBubble(msg, isOwn, senderPic, senderName);
    });

    if (msgs.length === 0) {
      html = '<div class="profile-empty" style="padding:40px;"><div class="profile-empty-icon">💬</div>No messages yet.<br>Say hello!</div>';
    }

    const wasAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 60;
    el.innerHTML = html;
    if (wasAtBottom || msgs.length <= 1) el.scrollTop = el.scrollHeight;

    this._bindMessageActions(el);
    this._bindImageLightbox(el);
    this._bindVoicePlayback(el);
    this._markUnreadAsRead(msgs);
  }

  _renderGroupMessages(msgs, el) {
    let html = "";
    let lastDateStr = "";
    msgs.forEach(msg => {
      const dateStr = new Date(msg.createdAt).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" });
      if (dateStr !== lastDateStr) { html += buildDateSeparator(dateStr); lastDateStr = dateStr; }
      const isOwn = msg.senderId === this._user.userId;
      const member = this._groupMembers[msg.senderId] || {};
      const senderPic = isOwn ? this._user.profilePicBase64 : (member.profilePicBase64 || null);
      const senderName = isOwn ? this._user.name : (member.name || "Member");
      html += buildMessageBubble(msg, isOwn, senderPic, senderName);
    });
    if (msgs.length === 0) html = '<div class="profile-empty" style="padding:40px;">No messages yet. Start the conversation!</div>';

    const wasAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 60;
    el.innerHTML = html;
    if (wasAtBottom || msgs.length <= 1) el.scrollTop = el.scrollHeight;
    this._bindMessageActions(el);
    this._bindImageLightbox(el);
    this._bindVoicePlayback(el);
    this._markUnreadAsRead(msgs);
  }

  async _markUnreadAsRead(msgs) {
    const ref = this._getActiveChatRef();
    if (!ref) return;
    const unread = msgs.filter(m => m.senderId !== this._user.userId && !(m.readBy || []).includes(this._user.userId));
    if (unread.length === 0) return;
    const batch = this._db.batch();
    unread.forEach(m => {
      batch.update(ref.collection("messages").doc(m.id), { readBy: firebase.firestore.FieldValue.arrayUnion(this._user.userId) });
    });
    await batch.commit().catch(() => {});
  }

  // ── Send messages ──────────────────────────────────────────

  async _sendMessage(type, content, extra = {}) {
    // Route to group send if in a group chat
    if (this._activeGroupId) { this._sendGroupMessage(type, content, extra); return; }
    if (!this._activeChatUserId) return;
    const chatId = _chatId(this._user.userId, this._activeChatUserId);

    const msg = {
      senderId: this._user.userId,
      type,
      content,
      createdAt: Date.now(),
      deletedFor: [],
      deletedForEveryone: false,
      readBy: [],
      ...extra,
    };

    try {
      await this._db.collection("chats").doc(chatId).collection("messages").add(msg);
      this._clearTypingIndicator();
      this._loadConversations();
    } catch (err) {
      console.error("Send message error:", err);
    }
  }

  _sendText() {
    const input = this.container.querySelector("#chatTextInput");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    input.style.height = "auto";
    this._sendMessage("text", text);
  }

  _sendSticker(sticker) {
    this._sendMessage("sticker", sticker);
    const panel = this.container.querySelector("#chatStickerPanel");
    if (panel) panel.style.display = "none";
  }

  async _sendImage(file) {
    if (!file || !file.type.startsWith("image/")) return;
    const b64 = await this._compressImage(file, 600, 0.6);
    const caption = "";
    this._sendMessage("image", b64, { caption });
  }

  async _sendFile(file) {
    if (!file) return;
    if (file.size > 716800) { crolixAlert("File too large — max 700KB", { title: "File too large", icon: "warning" }); return; }
    const b64 = await this._readFileAsDataURL(file);
    this._sendMessage("file", b64, { fileName: file.name, fileSize: file.size });
  }

  _sendGif(url) {
    this._sendMessage("gif", url);
    const panel = this.container.querySelector("#chatGifPanel");
    if (panel) panel.style.display = "none";
  }

  _loadLocalGifs() {
    const grid = this.container.querySelector("#chatGifGrid");
    if (!grid) return;
    if (!LOCAL_GIFS || LOCAL_GIFS.length === 0) {
      grid.innerHTML = '<div class="chat-gif-hint">No GIFs yet — add files to assets/gifs/</div>';
      return;
    }
    grid.innerHTML = LOCAL_GIFS.map(g =>
      `<div class="chat-gif-local" data-src="${g.file}">
        <img class="chat-gif-item" src="${g.file}" alt="${g.name}" loading="lazy" />
        <span class="chat-gif-label">${g.name}</span>
      </div>`
    ).join("");
    grid.querySelectorAll(".chat-gif-local").forEach(el => {
      el.onclick = () => {
        this._sendMessage("gif", el.dataset.src);
        const panel = this.container.querySelector("#chatGifPanel");
        if (panel) panel.style.display = "none";
      };
    });
  }

  async _searchGifs(query) {
    const grid = this.container.querySelector("#chatGifGrid");
    if (!grid) return;
    if (!query) { this._loadLocalGifs(); return; }

    grid.innerHTML = '<div class="profile-loading" style="padding:12px;"><div class="profile-spinner" style="width:24px;height:24px;"></div></div>';

    try {
      const params = new URLSearchParams({ api_key: GIPHY_API_KEY, q: query, limit: "20", rating: "g", lang: "en" });
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?${params}`);
      if (!res.ok) throw new Error("Giphy API error");
      const data = await res.json();
      if (!data.data || data.data.length === 0) { this._loadLocalGifs(); return; }

      grid.innerHTML = data.data.map(g => {
        const url = g.images.fixed_height_small?.url || g.images.fixed_height?.url;
        const full = g.images.fixed_height?.url || url;
        return `<img class="chat-gif-item" src="${url}" data-full="${full}" alt="${g.title || ""}" loading="lazy" />`;
      }).join("");
      grid.querySelectorAll(".chat-gif-item").forEach(img => {
        img.onclick = () => this._sendGif(img.dataset.full);
      });
    } catch (err) {
      console.warn("Giphy failed, showing local GIFs:", err);
      this._loadLocalGifs();
    }
  }

  // ── Voice recording ────────────────────────────────────────

  async _startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this._audioChunks = [];
      this._mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });

      this._mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this._audioChunks.push(e.data);
      };

      this._mediaRecorder.start();
      this._isRecording = true;
      this._recordStart = Date.now();

      const overlay = this.container.querySelector("#chatVoiceOverlay");
      if (overlay) overlay.style.display = "flex";

      this._recordTimer = setInterval(() => {
        const elapsed = Math.floor((Date.now() - this._recordStart) / 1000);
        const timerEl = this.container.querySelector("#chatVoiceTimer");
        if (timerEl) timerEl.textContent = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
        if (elapsed >= 60) this._finishRecording();
      }, 500);

    } catch (err) {
      console.warn("Microphone access denied:", err);
    }
  }

  _stopRecording(discard = false) {
    if (this._recordTimer) { clearInterval(this._recordTimer); this._recordTimer = null; }
    const overlay = this.container.querySelector("#chatVoiceOverlay");
    if (overlay) overlay.style.display = "none";

    if (this._mediaRecorder && this._mediaRecorder.state !== "inactive") {
      this._mediaRecorder.stop();
      this._mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
    this._isRecording = false;
    if (discard) { this._audioChunks = []; this._mediaRecorder = null; }
  }

  async _finishRecording() {
    const duration = (Date.now() - this._recordStart) / 1000;

    return new Promise(resolve => {
      this._mediaRecorder.onstop = async () => {
        const blob = new Blob(this._audioChunks, { type: "audio/webm" });
        this._audioChunks = [];
        this._mediaRecorder.stream.getTracks().forEach(t => t.stop());
        this._mediaRecorder = null;

        if (blob.size > 900000) { crolixAlert("Voice note too long — keep it under 60 seconds", { title: "Too long", icon: "warning" }); resolve(); return; }

        const reader = new FileReader();
        reader.onload = () => {
          this._sendMessage("voice", reader.result, { duration: Math.round(duration) });
          resolve();
        };
        reader.readAsDataURL(blob);
      };

      if (this._recordTimer) { clearInterval(this._recordTimer); this._recordTimer = null; }
      const overlay = this.container.querySelector("#chatVoiceOverlay");
      if (overlay) overlay.style.display = "none";

      if (this._mediaRecorder && this._mediaRecorder.state !== "inactive") {
        this._mediaRecorder.stop();
      }
      this._isRecording = false;
    });
  }

  // ── Typing indicator ───────────────────────────────────────

  _setTyping() {
    if (!this._activeChatUserId) return;
    const chatId = _chatId(this._user.userId, this._activeChatUserId);
    this._db.collection("chats").doc(chatId).collection("typing").doc(this._user.userId)
      .set({ typing: true, at: Date.now() }).catch(() => {});

    clearTimeout(this._typingTimer);
    this._typingTimer = setTimeout(() => this._clearTypingIndicator(), 3000);
  }

  _clearTypingIndicator() {
    if (!this._activeChatUserId) return;
    const chatId = _chatId(this._user.userId, this._activeChatUserId);
    this._db.collection("chats").doc(chatId).collection("typing").doc(this._user.userId)
      .delete().catch(() => {});
    clearTimeout(this._typingTimer);
  }

  _listenTyping() {
    if (!this._activeChatUserId) return;
    const chatId = _chatId(this._user.userId, this._activeChatUserId);

    this._typingUnsub = this._db.collection("chats").doc(chatId)
      .collection("typing").doc(this._activeChatUserId)
      .onSnapshot(snap => {
        const data = snap.data();
        const typingEl = this.container.querySelector("#chatTyping");
        if (!typingEl) return;

        if (data?.typing && (Date.now() - (data.at || 0)) < 10000) {
          typingEl.style.display = "flex";
          const text = this.container.querySelector("#chatTypingText");
          if (text) text.textContent = `${this._activeChatUser?.name || "User"} is typing…`;
        } else {
          typingEl.style.display = "none";
        }
      });
  }

  // ── Presence / online status ────────────────────────────────

  _listenPresence() {
    if (!this._activeChatUserId) return;
    this._presenceUnsub = this._db.collection("users").doc(this._activeChatUserId)
      .onSnapshot(snap => {
        const data = snap.data();
        if (!data) return;

        const dotEl = this.container.querySelector("#chatOnlineDot");
        const statusEl = this.container.querySelector("#chatHeaderStatus");
        if (!statusEl) return;

        const isOnline = data.online && data.lastSeen && (Date.now() - data.lastSeen < 120000);

        if (isOnline) {
          statusEl.textContent = "Online";
          statusEl.className = "chat-header-status chat-status-online";
          if (dotEl) dotEl.style.display = "";
        } else {
          statusEl.textContent = data.lastSeen ? `Last seen ${this._formatLastSeen(data.lastSeen)}` : "Offline";
          statusEl.className = "chat-header-status chat-status-offline";
          if (dotEl) dotEl.style.display = "none";
        }
      });
  }

  _formatLastSeen(ts) {
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    const d = new Date(ts);
    const today = new Date();
    if (d.getDate() === today.getDate() - 1) return "yesterday at " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" }) + " at " + d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  }

  // ── Delete messages ────────────────────────────────────────

  _getActiveChatRef() {
    if (this._activeGroupId) return this._db.collection("groups").doc(this._activeGroupId);
    if (this._activeChatUserId) return this._db.collection("chats").doc(_chatId(this._user.userId, this._activeChatUserId));
    return null;
  }

  async _deleteForMe(msgId) {
    const ref = this._getActiveChatRef();
    if (!ref) return;
    await ref.collection("messages").doc(msgId)
      .update({ deletedFor: firebase.firestore.FieldValue.arrayUnion(this._user.userId) });
  }

  async _deleteForEveryone(msgId) {
    const ref = this._getActiveChatRef();
    if (!ref) return;
    const doc = await ref.collection("messages").doc(msgId).get();
    if (!doc.exists) return;
    const data = doc.data();
    if (data.senderId !== this._user.userId) return;
    if (Date.now() - data.createdAt > 300000) { crolixAlert("You can only delete for everyone within 5 minutes of sending", { title: "Too late", icon: "warning" }); return; }
    await ref.collection("messages").doc(msgId).update({ deletedForEveryone: true });
  }

  // ── Clear chat (delete all messages for me) ────────────────

  async _clearChat() {
    const ref = this._getActiveChatRef();
    if (!ref) return;
    if (!await crolixConfirm("All messages will be hidden for you only. Others can still see them.", { title: "Clear chat?", confirmText: "Clear", icon: "warning" })) return;
    const snap = await ref.collection("messages").get();
    const batch = this._db.batch();
    snap.forEach(doc => {
      batch.update(doc.ref, { deletedFor: firebase.firestore.FieldValue.arrayUnion(this._user.userId) });
    });
    await batch.commit();
  }

  // ── Delete entire chat (remove from Firestore) ─────────────

  async _deleteChat() {
    if (!await crolixConfirm("This will permanently delete all messages. This cannot be undone.", { title: "Delete chat?", confirmText: "Delete", danger: true, icon: "delete" })) return;
    const ref = this._getActiveChatRef();
    if (!ref) return;
    const snap = await ref.collection("messages").get();
    const batch = this._db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    await ref.delete().catch(() => {});
    this._closeChat();
    this._loadConversations();
  }

  // ── Archive chat ───────────────────────────────────────────

  async _archiveChat(targetId, isGroup) {
    const archiveKey = `crolixArchived_${this._user.userId}`;
    const archived = JSON.parse(localStorage.getItem(archiveKey) || "[]");
    const entry = { id: targetId, type: isGroup ? "group" : "dm" };
    if (!archived.find(a => a.id === targetId)) archived.push(entry);
    localStorage.setItem(archiveKey, JSON.stringify(archived));
    this._closeChat();
    this._loadConversations();
  }

  async _unarchiveChat(targetId) {
    const archiveKey = `crolixArchived_${this._user.userId}`;
    let archived = JSON.parse(localStorage.getItem(archiveKey) || "[]");
    archived = archived.filter(a => a.id !== targetId);
    localStorage.setItem(archiveKey, JSON.stringify(archived));
    this._loadConversations();
  }

  _getArchivedIds() {
    const archiveKey = `crolixArchived_${this._user.userId}`;
    return JSON.parse(localStorage.getItem(archiveKey) || "[]");
  }

  // ── Clear chat from conv list (long press) ─────────────────

  async _clearChatById(chatId) {
    if (!await crolixConfirm("All messages will be hidden for you only.", { title: "Clear chat?", confirmText: "Clear", icon: "warning" })) return;
    try {
      const snap = await this._db.collection("chats").doc(chatId).collection("messages").get();
      const batch = this._db.batch();
      snap.forEach(doc => batch.update(doc.ref, { deletedFor: firebase.firestore.FieldValue.arrayUnion(this._user.userId) }));
      if (!snap.empty) await batch.commit();
    } catch (_) {}
    this._loadConversations();
  }

  async _deleteChatById(chatId) {
    if (!await crolixConfirm("This will permanently delete all messages.", { title: "Delete chat?", confirmText: "Delete", danger: true, icon: "delete" })) return;
    try {
      const snap = await this._db.collection("chats").doc(chatId).collection("messages").get();
      const batch = this._db.batch();
      snap.forEach(doc => batch.delete(doc.ref));
      if (!snap.empty) await batch.commit();
      await this._db.collection("chats").doc(chatId).delete().catch(() => {});
    } catch (_) {}
    this._loadConversations();
  }

  // ── Block in chat ──────────────────────────────────────────

  async _blockInChat() {
    if (!this._activeChatUserId) return;
    const userId = this._activeChatUserId;
    if (!await crolixConfirm(`${this._activeChatUser?.name || "This user"} will be blocked and removed from your friends.`, { title: "Block user?", confirmText: "Block", danger: true, icon: "block" })) return;

    await this._db.collection("users").doc(this._user.userId).update({
      blocked: firebase.firestore.FieldValue.arrayUnion(userId),
      friends: firebase.firestore.FieldValue.arrayRemove(userId),
    });
    await this._db.collection("users").doc(userId).update({
      friends: firebase.firestore.FieldValue.arrayRemove(this._user.userId),
    });

    this._closeChat();
    this._loadConversations();
  }

  // ── Bind all events ────────────────────────────────────────

  _bindChatEvents() {
    // Send text
    const sendBtn = this.container.querySelector("#chatSendBtn");
    if (sendBtn) sendBtn.onclick = () => this._sendText();

    // Text input — typing + send on Enter
    const textInput = this.container.querySelector("#chatTextInput");
    if (textInput) {
      textInput.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this._sendText(); }
      };
      textInput.oninput = () => {
        textInput.style.height = "auto";
        textInput.style.height = Math.min(textInput.scrollHeight, 120) + "px";
        this._setTyping();
      };
    }

    // Attach file/image
    const attachBtn = this.container.querySelector("#chatAttachBtn");
    const fileInput = this.container.querySelector("#chatFileInput");
    if (attachBtn && fileInput) {
      attachBtn.onclick = () => fileInput.click();
      fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (!file) return;
        if (file.type.startsWith("image/")) this._sendImage(file);
        else this._sendFile(file);
        fileInput.value = "";
      };
    }

    // Stickers
    const stickerBtn = this.container.querySelector("#chatStickerBtn");
    const stickerPanel = this.container.querySelector("#chatStickerPanel");
    const gifPanel = this.container.querySelector("#chatGifPanel");
    if (stickerBtn && stickerPanel) {
      stickerBtn.onclick = () => {
        if (gifPanel) gifPanel.style.display = "none";
        stickerPanel.style.display = stickerPanel.style.display === "none" ? "grid" : "none";
      };
      stickerPanel.querySelectorAll(".chat-sticker-item").forEach(btn => {
        btn.onclick = () => this._sendSticker(btn.dataset.sticker);
      });
    }

    // GIF search
    const gifBtn = this.container.querySelector("#chatGifBtn");
    if (gifBtn && gifPanel) {
      gifBtn.onclick = () => {
        if (stickerPanel) stickerPanel.style.display = "none";
        const showing = gifPanel.style.display === "none";
        gifPanel.style.display = showing ? "flex" : "none";
        if (showing) this._loadLocalGifs();
      };
      let gifTimer = null;
      const gifSearch = this.container.querySelector("#chatGifSearch");
      if (gifSearch) {
        gifSearch.oninput = () => {
          clearTimeout(gifTimer);
          gifTimer = setTimeout(() => this._searchGifs(gifSearch.value.trim()), 500);
        };
      }
    }

    // Voice
    const voiceBtn = this.container.querySelector("#chatVoiceBtn");
    if (voiceBtn) {
      voiceBtn.onclick = () => {
        if (this._isRecording) this._finishRecording();
        else this._startRecording();
      };
    }
    const voiceCancelBtn = this.container.querySelector("#chatVoiceCancelBtn");
    if (voiceCancelBtn) voiceCancelBtn.onclick = () => this._stopRecording(true);
    const voiceSendBtn = this.container.querySelector("#chatVoiceSendBtn");
    if (voiceSendBtn) voiceSendBtn.onclick = () => this._finishRecording();

    // Tag a friend (live profile share)
    const tagBtn = this.container.querySelector("#chatTagBtn");
    if (tagBtn) tagBtn.onclick = () => this._profileShare?.openTagPanel();

    // New Group
    const newGroupBtn = this.container.querySelector("#chatNewGroupBtn");
    if (newGroupBtn) newGroupBtn.onclick = () => this._showCreateGroupModal();

    // Close context menu / panels on click outside
    document.addEventListener("click", (e) => {
      const ctx = this.container.querySelector("#chatContextMenu");
      if (ctx && !ctx.contains(e.target)) ctx.style.display = "none";
      const dp = this.container.querySelector("#chatDisappearPanel");
      if (dp && !dp.contains(e.target) && !e.target.closest("#chatDisappearBtn")) dp.remove();
    });
  }

  _bindChatHeaderActions() {
    const backBtn = this.container.querySelector("#chatBackBtn");
    if (backBtn) backBtn.onclick = () => this._closeChat();

    const callBtn = this.container.querySelector("#chatCallBtn");
    if (callBtn && this._activeChatUser?.meetingId) {
      callBtn.onclick = () => this.onStartMeeting(this._activeChatUser.meetingId, this._user.name);
    }

    const blockBtn = this.container.querySelector("#chatBlockBtn");
    if (blockBtn) blockBtn.onclick = () => this._blockInChat();

    const disappearBtn = this.container.querySelector("#chatDisappearBtn");
    if (disappearBtn) disappearBtn.onclick = () => this._showDisappearMenu();

    const menuBtn = this.container.querySelector("#chatMenuBtn");
    if (menuBtn) menuBtn.onclick = (e) => { e.stopPropagation(); this._showChatMenu(); };
  }

  _showChatMenu() {
    const existing = this.container.querySelector("#chatDropdownMenu");
    if (existing) { existing.remove(); return; }

    const activeEl = this.container.querySelector("#chatActive");
    if (!activeEl) return;
    const isGroup = !!this._activeGroupId;
    activeEl.insertAdjacentHTML("beforeend", buildChatMenu(isGroup));

    const menu = this.container.querySelector("#chatDropdownMenu");
    menu.querySelectorAll(".chat-dropdown-item").forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        menu.remove();
        const action = btn.dataset.action;
        if (action === "clearChat") await this._clearChat();
        else if (action === "deleteChat") await this._deleteChat();
        else if (action === "archiveChat") {
          const targetId = this._activeChatUserId || this._activeGroupId;
          await this._archiveChat(targetId, !!this._activeGroupId);
        }
      };
    });
    setTimeout(() => {
      const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", close); } };
      document.addEventListener("click", close);
    }, 50);
  }

  _bindConvContextMenus(listEl) {
    listEl.querySelectorAll(".chat-conv-item, .chat-conv-group").forEach(item => {
      let holdTimer = null;
      const showCtx = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const existing = this.container.querySelector("#convContextMenu");
        if (existing) existing.remove();

        const isGroup = item.classList.contains("chat-conv-group");
        const targetId = isGroup ? item.dataset.groupid : item.dataset.userid;
        const isArchived = this._getArchivedIds().map(a => a.id).includes(targetId);

        const menu = document.createElement("div");
        menu.className = "conv-context-menu";
        menu.id = "convContextMenu";
        menu.innerHTML = `
          ${isArchived
            ? `<button class="conv-ctx-item" data-action="unarchive"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>Unarchive</button>`
            : `<button class="conv-ctx-item" data-action="archive"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/></svg>Archive</button>`
          }
          <button class="conv-ctx-item" data-action="clearAll"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Clear chat</button>
          <button class="conv-ctx-item conv-ctx-danger" data-action="deleteAll"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>Delete chat</button>`;

        const rect = item.getBoundingClientRect();
        const sidebar = this.container.querySelector("#chatSidebar");
        const sRect = sidebar ? sidebar.getBoundingClientRect() : { top: 0, left: 0 };
        menu.style.position = "absolute";
        menu.style.top = (rect.top - sRect.top + rect.height / 2) + "px";
        menu.style.left = (rect.width / 2) + "px";
        menu.style.zIndex = "100";
        (sidebar || listEl).appendChild(menu);

        menu.querySelectorAll(".conv-ctx-item").forEach(btn => {
          btn.onclick = async (ev) => {
            ev.stopPropagation();
            menu.remove();
            const action = btn.dataset.action;
            if (action === "archive") this._archiveChat(targetId, isGroup);
            else if (action === "unarchive") this._unarchiveChat(targetId);
            else if (action === "clearAll") {
              const chatRef = isGroup ? item.dataset.groupid : _chatId(this._user.userId, targetId);
              if (isGroup) {
                if (!await crolixConfirm("All messages will be hidden for you only.", { title: "Clear chat?", confirmText: "Clear", icon: "warning" })) return;
                const snap = await this._db.collection("groups").doc(chatRef).collection("messages").get();
                const batch = this._db.batch();
                snap.forEach(d => batch.update(d.ref, { deletedFor: firebase.firestore.FieldValue.arrayUnion(this._user.userId) }));
                if (!snap.empty) await batch.commit();
              } else { await this._clearChatById(chatRef); }
              this._loadConversations();
            }
            else if (action === "deleteAll") {
              const chatRef = isGroup ? item.dataset.groupid : _chatId(this._user.userId, targetId);
              if (isGroup) {
                if (!await crolixConfirm("This will permanently delete all group messages.", { title: "Delete group chat?", confirmText: "Delete", danger: true, icon: "delete" })) return;
                const snap = await this._db.collection("groups").doc(chatRef).collection("messages").get();
                const batch = this._db.batch();
                snap.forEach(d => batch.delete(d.ref));
                if (!snap.empty) await batch.commit();
              } else { await this._deleteChatById(chatRef); }
              this._loadConversations();
            }
          };
        });

        setTimeout(() => {
          const close = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("click", close); } };
          document.addEventListener("click", close);
        }, 50);
      };

      item.oncontextmenu = showCtx;
      item.ontouchstart = () => { holdTimer = setTimeout(() => showCtx(new Event("contextmenu")), 600); };
      item.ontouchend = () => clearTimeout(holdTimer);
      item.ontouchmove = () => clearTimeout(holdTimer);
    });
  }

  async _showDisappearMenu() {
    if (!this._activeChatUserId && !this._activeGroupId) return;
    const ref = this._getActiveChatRef();
    if (!ref) return;
    const chatId = ref.path;
    let current = "0";
    try {
      const doc = await ref.get();
      if (doc.exists) current = String(doc.data().disappearAfter || "0");
    } catch (_) {}

    const existing = this.container.querySelector("#chatDisappearPanel");
    if (existing) { existing.remove(); return; }

    const activeEl = this.container.querySelector("#chatActive");
    if (!activeEl) return;
    activeEl.insertAdjacentHTML("beforeend", buildDisappearMenu(current));

    const panel = this.container.querySelector("#chatDisappearPanel");
    panel.querySelectorAll(".chat-disappear-opt").forEach(btn => {
      btn.onclick = async () => {
        const val = parseInt(btn.dataset.val);
        await ref.set({ disappearAfter: val }, { merge: true });
        panel.remove();
        const label = val === 0 ? "" : btn.querySelector("strong").textContent;
        if (val > 0) this._showNotifInChat(`Disappearing messages set to ${label}`);
        else this._showNotifInChat("Disappearing messages turned off");
      };
    });
  }

  _showNotifInChat(text) {
    const msgs = this.container.querySelector("#chatMessages");
    if (!msgs) return;
    const div = document.createElement("div");
    div.className = "chat-system-msg";
    div.textContent = text;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => div.remove(), 4000);
  }

  async _cleanExpiredMessages(chatId) {
    try {
      const chatDoc = await this._db.collection("chats").doc(chatId).get();
      const disappearAfter = chatDoc.exists ? (chatDoc.data().disappearAfter || 0) : 0;
      if (!disappearAfter) return;

      const cutoff = Date.now() - disappearAfter;
      const expired = await this._db.collection("chats").doc(chatId)
        .collection("messages").where("createdAt", "<", cutoff).limit(50).get();
      const batch = this._db.batch();
      expired.forEach(doc => batch.delete(doc.ref));
      if (!expired.empty) await batch.commit();
    } catch (_) {}
  }

  // ══════════════════════════════════════════════
  // GROUP CHAT
  // ══════════════════════════════════════════════

  async _showCreateGroupModal() {
    const friends = this._fullUserData?.friends || [];
    if (friends.length === 0) { crolixAlert("Add friends first before creating a group.", { title: "No friends yet", icon: "info" }); return; }

    const friendUsers = await this._fetchUsersByIds(friends);
    const existing = this.container.querySelector("#createGroupOverlay");
    if (existing) existing.remove();
    this.container.insertAdjacentHTML("beforeend", buildCreateGroupModal(friendUsers));

    const overlay = this.container.querySelector("#createGroupOverlay");
    overlay.querySelector("#groupCancelBtn").onclick = () => overlay.remove();
    overlay.querySelector("#groupCreateBtn").onclick = () => this._createGroup(overlay);
  }

  async _createGroup(overlay) {
    const name = overlay.querySelector("#groupNameInput").value.trim();
    const desc = overlay.querySelector("#groupDescInput").value.trim();
    const errEl = overlay.querySelector("#group-error");

    if (!name) { errEl.textContent = "Group name is required"; errEl.style.display = ""; return; }

    const checked = overlay.querySelectorAll("#groupMemberList input:checked");
    if (checked.length === 0) { errEl.textContent = "Select at least one member"; errEl.style.display = ""; return; }

    const members = [this._user.userId];
    checked.forEach(cb => members.push(cb.value));

    const btn = overlay.querySelector("#groupCreateBtn");
    btn.disabled = true; btn.textContent = "Creating…";

    try {
      await this._db.collection("groups").add({
        name,
        description: desc,
        avatar: "",
        members,
        createdBy: this._user.userId,
        createdAt: Date.now(),
      });
      overlay.remove();
      this._loadConversations();
    } catch (err) {
      console.error("Create group error:", err);
      errEl.textContent = "Failed to create group"; errEl.style.display = "";
      btn.disabled = false; btn.textContent = "Create Group";
    }
  }

  async _getHiddenLinkedGroupIds() {
    try {
      const snap = await this._db.collection("users").doc(this._user.userId)
        .collection("categories").where("hidden", "==", true).get();
      const ids = new Set();
      snap.forEach(doc => { const linkedGroupId = doc.data().linkedGroupId; if (linkedGroupId) ids.add(linkedGroupId); });
      return ids;
    } catch (_) {
      return new Set();
    }
  }

  async _loadGroups() {
    try {
      const hiddenLinkedIds = await this._getHiddenLinkedGroupIds();
      const snap = await this._db.collection("groups")
        .where("members", "array-contains", this._user.userId).get();
      const groups = [];
      for (const doc of snap.docs) {
        if (hiddenLinkedIds.has(doc.id)) continue;
        const data = { id: doc.id, ...doc.data() };
        let lastMessage = "", lastMessageAt = 0;
        try {
          const lastSnap = await this._db.collection("groups").doc(doc.id)
            .collection("messages").orderBy("createdAt", "desc").limit(1).get();
          if (!lastSnap.empty) {
            const m = lastSnap.docs[0].data();
            if (m.type === "gif") lastMessage = "🎬 GIF";
            else if (m.type === "image") lastMessage = "📷 Image";
            else if (m.type === "sticker") lastMessage = m.content;
            else if (m.type === "voice") lastMessage = "🎤 Voice";
            else lastMessage = m.content || "";
            lastMessageAt = m.createdAt || 0;
          }
        } catch (_) {}
        groups.push({ ...data, lastMessage, lastMessageAt });
      }
      return groups;
    } catch (err) {
      console.error("Load groups error:", err);
      return [];
    }
  }

  async _openGroupChat(groupId) {
    if (this._msgUnsub) { this._msgUnsub(); this._msgUnsub = null; }
    if (this._typingUnsub) { this._typingUnsub(); this._typingUnsub = null; }

    this._activeChatUserId = null;
    this._activeGroupId = groupId;

    const emptyState = this.container.querySelector("#chatEmptyState");
    const activeChat = this.container.querySelector("#chatActive");
    const sidebar = this.container.querySelector("#chatSidebar");

    emptyState.style.display = "none";
    activeChat.style.display = "flex";
    sidebar.classList.add("chat-has-active");

    try {
      const groupDoc = await this._db.collection("groups").doc(groupId).get();
      this._activeGroup = groupDoc.exists ? { id: groupDoc.id, ...groupDoc.data() } : null;
    } catch (_) { this._activeGroup = null; }

    if (!this._activeGroup) return;

    // Load member profiles for avatars
    this._groupMembers = {};
    try {
      const memberUsers = await this._fetchUsersByIds(this._activeGroup.members);
      memberUsers.forEach(u => { this._groupMembers[u.userId] = u; });
    } catch (_) {}

    const headerEl = this.container.querySelector("#chatHeader");
    headerEl.innerHTML = buildGroupHeader(this._activeGroup);
    this._bindGroupHeaderActions();
    this._listenGroupMessages();

    // Init live profile share for this group
    if (this._profileShare) {
      this._profileShare.init(groupId, null, true);
    }

    this.container.querySelector("#chatMessages").innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div></div>';
  }

  _listenGroupMessages() {
    const messagesEl = this.container.querySelector("#chatMessages");
    if (!messagesEl || !this._activeGroupId) return;

    this._msgUnsub = this._db.collection("groups").doc(this._activeGroupId)
      .collection("messages").orderBy("createdAt", "asc")
      .onSnapshot(snap => {
        const msgs = [];
        snap.forEach(doc => {
          const d = doc.data();
          if ((d.deletedFor || []).includes(this._user.userId)) return;
          msgs.push({ id: doc.id, ...d });
        });
        this._renderGroupMessages(msgs, messagesEl);
      });
  }

  async _sendGroupMessage(type, content, extra = {}) {
    if (!this._activeGroupId) return;
    await this._db.collection("groups").doc(this._activeGroupId).collection("messages").add({
      senderId: this._user.userId, type, content, createdAt: Date.now(), deletedFor: [], deletedForEveryone: false, readBy: [], ...extra,
    }).catch(err => console.error("Group send error:", err));
  }

  _bindGroupHeaderActions() {
    const backBtn = this.container.querySelector("#chatBackBtn");
    if (backBtn) backBtn.onclick = () => { this._activeGroupId = null; this._activeGroup = null; this._closeChat(); this._loadConversations(); };

    const infoBtn = this.container.querySelector("#chatGroupInfoBtn");
    if (infoBtn) infoBtn.onclick = () => this._showGroupInfo();
  }

  async _showGroupInfo() {
    if (!this._activeGroup) return;
    const members = Object.values(this._groupMembers);
    const isAdmin = this._activeGroup.createdBy === this._user.userId;

    const existing = this.container.querySelector("#groupInfoPanel");
    if (existing) { existing.remove(); return; }

    const activeEl = this.container.querySelector("#chatActive");
    activeEl.insertAdjacentHTML("beforeend", buildGroupInfoPanel(this._activeGroup, members, isAdmin));

    const panel = this.container.querySelector("#groupInfoPanel");
    panel.querySelector("#groupInfoCloseBtn").onclick = () => panel.remove();

    panel.querySelector("#groupInfoLeaveBtn").onclick = async () => {
      if (!await crolixConfirm("You will no longer receive messages from this group.", { title: "Leave group?", confirmText: "Leave", danger: true, icon: "warning" })) return;
      await this._db.collection("groups").doc(this._activeGroupId).update({
        members: firebase.firestore.FieldValue.arrayRemove(this._user.userId),
      });
      panel.remove();
      this._activeGroupId = null; this._activeGroup = null;
      this._closeChat(); this._loadConversations();
    };

    panel.querySelectorAll(".group-remove-member").forEach(btn => {
      btn.onclick = async () => {
        await this._db.collection("groups").doc(this._activeGroupId).update({
          members: firebase.firestore.FieldValue.arrayRemove(btn.dataset.uid),
        });
        panel.remove(); this._showGroupInfo();
      };
    });

    const inviteBtn = panel.querySelector("#groupInfoInviteBtn");
    if (inviteBtn) inviteBtn.onclick = () => this._showInviteLinkModal(this._activeGroup);
  }

  // ── Group invite links ──────────────────────────────────────

  _generateInviteCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let code = "";
    for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  async _showInviteLinkModal(group) {
    if (!group.inviteCode) {
      const code = this._generateInviteCode();
      try {
        await this._db.collection("groups").doc(group.id).update({ inviteCode: code });
        group.inviteCode = code;
      } catch (err) {
        console.error("Generate invite link error:", err);
        crolixAlert("Failed to create an invite link. Please try again.", { title: "Error", icon: "error" });
        return;
      }
    }

    this._renderInviteLinkModal(group);
  }

  _renderInviteLinkModal(group) {
    this.container.querySelector("#inviteLinkOverlay")?.remove();
    const base = PUBLIC_WEB_URL || `${window.location.origin}${window.location.pathname}`;
    const link = `${base}?joinGroup=${group.inviteCode}`;
    const isAdmin = group.createdBy === this._user.userId;
    this.container.insertAdjacentHTML("beforeend", buildInviteLinkModal(link, isAdmin));

    const overlay = this.container.querySelector("#inviteLinkOverlay");
    overlay.querySelector("#inviteLinkCloseBtn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const copyBtn = overlay.querySelector("#inviteLinkCopyBtn");
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(link).catch(() => {});
      const orig = copyBtn.textContent;
      copyBtn.textContent = "Copied!";
      setTimeout(() => { copyBtn.textContent = orig; }, 2000);
    };

    const resetBtn = overlay.querySelector("#inviteLinkResetBtn");
    if (resetBtn) resetBtn.onclick = () => this._resetInviteLink(group);
  }

  async _resetInviteLink(group) {
    const ok = await crolixConfirm(
      "Anyone who still has the old link will no longer be able to join with it.",
      { title: "Reset invite link?", confirmText: "Reset", danger: true, icon: "warning" }
    );
    if (!ok) return;

    try {
      const code = this._generateInviteCode();
      await this._db.collection("groups").doc(group.id).update({ inviteCode: code });
      group.inviteCode = code;
      this._renderInviteLinkModal(group);
    } catch (err) {
      console.error("Reset invite link error:", err);
      crolixAlert("Failed to reset the invite link. Please try again.", { title: "Error", icon: "error" });
    }
  }

  // ── Public: resolve/join a group invite (used by ProfileController after login) ──

  async resolveGroupInvite(code) {
    try {
      const snap = await this._db.collection("groups").where("inviteCode", "==", code).limit(1).get();
      if (snap.empty) return { status: "invalid" };

      const doc = snap.docs[0];
      const group = { id: doc.id, ...doc.data() };
      if ((group.members || []).includes(this._user.userId)) return { status: "already-member", groupId: group.id };
      return { status: "can-join", group };
    } catch (err) {
      console.error("Resolve group invite error:", err);
      return { status: "invalid" };
    }
  }

  async joinGroup(groupId) {
    await this._db.collection("groups").doc(groupId).update({
      members: firebase.firestore.FieldValue.arrayUnion(this._user.userId),
    });
  }

  _bindMessageActions(el) {
    // Profile share history "View" buttons
    el.querySelectorAll(".ps-history-view-btn").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        this._profileShare?.showHistoryCard(btn.dataset.profileid);
      };
    });

    el.querySelectorAll(".chat-msg-row").forEach(msgEl => {
      // Long press on mobile or right-click on desktop
      let holdTimer = null;
      const showMenu = (e) => {
        e.preventDefault();
        const msgId = msgEl.dataset.msgid;
        if (!msgId) return;
        this._contextMsgId = msgId;

        const ctx = this.container.querySelector("#chatContextMenu");
        if (!ctx) return;

        const isOwn = msgEl.classList.contains("chat-row-own");
        const deleteAllBtn = ctx.querySelector("#ctxDeleteAll");
        if (deleteAllBtn) deleteAllBtn.style.display = isOwn ? "" : "none";

        ctx.style.display = "flex";
        const rect = msgEl.getBoundingClientRect();
        const chatRect = this.container.querySelector("#chatActive").getBoundingClientRect();
        ctx.style.top = Math.min(rect.top - chatRect.top + rect.height / 2, chatRect.height - 80) + "px";
        ctx.style.left = (isOwn ? Math.max(rect.left - chatRect.left - 160, 8) : Math.min(rect.right - chatRect.left + 8, chatRect.width - 170)) + "px";

        ctx.querySelectorAll(".chat-ctx-btn").forEach(btn => {
          btn.onclick = async (ev) => {
            ev.stopPropagation();
            ctx.style.display = "none";
            if (btn.dataset.action === "deleteMe") await this._deleteForMe(this._contextMsgId);
            if (btn.dataset.action === "deleteAll") await this._deleteForEveryone(this._contextMsgId);
          };
        });
      };

      msgEl.oncontextmenu = showMenu;
      msgEl.ontouchstart = () => { holdTimer = setTimeout(() => showMenu(new Event("contextmenu")), 600); };
      msgEl.ontouchend = () => { clearTimeout(holdTimer); };
      msgEl.ontouchmove = () => { clearTimeout(holdTimer); };
    });
  }

  _bindImageLightbox(el) {
    el.querySelectorAll(".chat-bubble-image img").forEach(img => {
      img.style.cursor = "pointer";
      img.onclick = () => {
        const lb = document.createElement("div");
        lb.className = "room-lightbox";
        lb.innerHTML = `<img src="${img.src}" alt="" /><button class="room-lightbox-close">✕</button>`;
        lb.onclick = (e) => { if (e.target === lb || e.target.classList.contains("room-lightbox-close")) lb.remove(); };
        document.body.appendChild(lb);
        requestAnimationFrame(() => lb.classList.add("room-lightbox-show"));
      };
    });
  }

  _bindVoicePlayback(el) {
    el.querySelectorAll(".chat-voice-play-btn").forEach(btn => {
      btn.onclick = () => {
        const audio = new Audio(btn.dataset.audio);
        if (btn.textContent === "⏸") { btn._audio?.pause(); btn.textContent = "▶"; return; }
        btn.textContent = "⏸";
        btn._audio = audio;
        audio.play().catch(() => {});
        audio.onended = () => { btn.textContent = "▶"; };
      };
    });
  }

  // ── Helpers ────────────────────────────────────────────────

  _compressImage(file, maxDim, quality) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  _readFileAsDataURL(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  async _fetchUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) return [];
    const results = [];
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 10) chunks.push(userIds.slice(i, i + 10));
    for (const chunk of chunks) {
      const snapshot = await this._db.collection("users")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk).get();
      snapshot.forEach(doc => results.push({ ...doc.data(), userId: doc.id }));
    }
    return results;
  }
}
