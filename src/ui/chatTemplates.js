/**
 * src/ui/chatTemplates.js
 * HTML templates for the chat system — conversation list, chat window, messages.
 */

function _escapeHtml(t) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _renderLinks(text) {
  return _escapeHtml(text).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a class="chat-msg-link" href="$1" target="_blank" rel="noopener">$1</a>'
  ).replace(/\n/g, "<br>");
}

function _timeShort(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
  if (diff < 172800000) return "Yesterday";
  return d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

function _timeFull(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function _avatarHtml(pic, name, size = 32) {
  if (pic) return `<img src="${pic}" alt="${_escapeHtml(name || "")}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;" />`;
  const initial = (name || "?").charAt(0).toUpperCase();
  return `<div class="chat-avatar-fallback" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.42)}px;">${initial}</div>`;
}

const STICKERS = [
  "😂","🥰","😎","🔥","💀","👀","❤️","👍","👎","🎉",
  "😢","😤","🤔","💪","🙏","✨","😍","🤣","😱","🥺",
  "💯","🫡","🤝","😈","👻","🎶","☕","🍕","⚽","🏆",
  "💔","😴","🤯","🙄","😏","🥳","💐","🌟","🦁","🐐",
];

export { STICKERS };

export function buildChatPage(user) {
  return `
<div class="chat-layout">
  <div class="chat-sidebar" id="chatSidebar">
    <div class="chat-sidebar-header">
      <h3>Chats</h3>
      <button class="chat-new-group-btn" id="chatNewGroupBtn" title="New Group">+</button>
    </div>
    <div class="chat-conv-list" id="chatConvList">
      <div class="profile-loading"><div class="profile-spinner"></div>Loading chats…</div>
    </div>
  </div>

  <div class="chat-window" id="chatWindow">
    <div class="chat-empty-state" id="chatEmptyState">
      <div class="chat-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
      <div class="chat-empty-title">Your Messages</div>
      <div class="chat-empty-text">Select a friend to start chatting</div>
    </div>

    <div class="chat-active" id="chatActive" style="display:none;">
      <div class="chat-header" id="chatHeader"></div>
      <div class="chat-messages" id="chatMessages"></div>
      <div class="chat-typing" id="chatTyping" style="display:none;">
        <div class="chat-typing-dots"><span></span><span></span><span></span></div>
        <span class="chat-typing-text" id="chatTypingText">typing…</span>
      </div>
      <div class="chat-input-bar" id="chatInputBar">
        <button class="chat-input-btn chat-attach-btn" id="chatAttachBtn" title="Attach">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input type="file" id="chatFileInput" style="display:none;" />
        <button class="chat-input-btn chat-sticker-btn" id="chatStickerBtn" title="Stickers">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
        <button class="chat-input-btn chat-gif-btn" id="chatGifBtn" title="Send GIF">GIF</button>
        <button class="chat-input-btn chat-tag-btn" id="chatTagBtn" title="Tag a friend">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        </button>
        <div class="chat-text-wrap">
          <textarea id="chatTextInput" placeholder="Type a message…" rows="1"></textarea>
        </div>
        <button class="chat-input-btn chat-voice-btn" id="chatVoiceBtn" title="Voice note">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
        </button>
        <button class="chat-input-btn chat-send-btn" id="chatSendBtn" title="Send">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>

      <div class="chat-sticker-panel" id="chatStickerPanel" style="display:none;">
        <div class="chat-sticker-grid">
          ${STICKERS.map(s => `<button class="chat-sticker-item" data-sticker="${s}">${s}</button>`).join("")}
        </div>
      </div>

      <div class="chat-gif-panel" id="chatGifPanel" style="display:none;">
        <div class="chat-gif-search">
          <input type="text" id="chatGifSearch" placeholder="Search GIFs…" autocomplete="off" />
        </div>
        <div class="chat-gif-grid" id="chatGifGrid">
          <div class="chat-gif-hint">Search for a GIF above</div>
        </div>
      </div>

      <div class="chat-voice-overlay" id="chatVoiceOverlay" style="display:none;">
        <div class="chat-voice-recording">
          <div class="chat-voice-pulse"></div>
          <span class="chat-voice-timer" id="chatVoiceTimer">0:00</span>
          <span class="chat-voice-label">Recording…</span>
        </div>
        <div class="chat-voice-actions">
          <button class="chat-voice-cancel" id="chatVoiceCancelBtn">✕ Cancel</button>
          <button class="chat-voice-send" id="chatVoiceSendBtn">Send ▶</button>
        </div>
      </div>

      <div class="chat-context-menu" id="chatContextMenu" style="display:none;">
        <button class="chat-ctx-btn" data-action="deleteMe">Delete for me</button>
        <button class="chat-ctx-btn chat-ctx-danger" data-action="deleteAll" id="ctxDeleteAll">Delete for everyone</button>
      </div>
    </div>
  </div>
</div>`;
}

export function buildConvItem(conv) {
  const picHtml = conv.profilePicBase64
    ? `<img src="${conv.profilePicBase64}" alt="${conv.name}" />`
    : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);font-size:14px;">${(conv.name || "?").charAt(0).toUpperCase()}</div>`;

  const lastMsg = conv.lastMessage || "";
  const preview = lastMsg.length > 35 ? lastMsg.slice(0, 35) + "…" : lastMsg;
  const unreadClass = conv.unread ? " chat-conv-unread" : "";

  return `
<div class="chat-conv-item${unreadClass}" data-userid="${conv.userId}" data-meetid="${conv.meetingId}">
  <div class="chat-conv-pic-wrap">
    <div class="chat-conv-pic">${picHtml}</div>
    ${conv.online ? '<span class="chat-conv-online"></span>' : ""}
  </div>
  <div class="chat-conv-info">
    <div class="chat-conv-name">${_escapeHtml(conv.name)}</div>
    <div class="chat-conv-preview">${_escapeHtml(preview)}</div>
  </div>
  <div class="chat-conv-meta">
    <span class="chat-conv-time">${_timeShort(conv.lastMessageAt)}</span>
    ${conv.unread ? '<span class="chat-conv-dot"></span>' : ""}
  </div>
</div>`;
}

export function buildChatHeader(user) {
  const picHtml = user.profilePicBase64
    ? `<img src="${user.profilePicBase64}" alt="${user.name}" />`
    : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);font-size:14px;">${(user.name || "?").charAt(0).toUpperCase()}</div>`;

  return `
<button class="chat-back-btn" id="chatBackBtn">←</button>
<div class="chat-header-pic-wrap">
  <div class="chat-header-pic">${picHtml}</div>
  <span class="chat-online-dot" id="chatOnlineDot" style="display:none;"></span>
</div>
<div class="chat-header-info">
  <div class="chat-header-name">${_escapeHtml(user.name)}</div>
  <div class="chat-header-status" id="chatHeaderStatus">loading…</div>
</div>
<div class="chat-header-actions">
  <button class="chat-header-btn" id="chatCallBtn" title="Call">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
  </button>
  <button class="chat-header-btn" id="chatDisappearBtn" title="Disappearing messages">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  </button>
  <button class="chat-header-btn chat-header-block" id="chatBlockBtn" title="Block">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
  </button>
  <button class="chat-header-btn" id="chatMenuBtn" title="More">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
  </button>
</div>`;
}

export function buildChatMenu(isGroup) {
  return `
<div class="chat-dropdown-menu" id="chatDropdownMenu">
  <button class="chat-dropdown-item" data-action="clearChat">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    Clear chat
  </button>
  <button class="chat-dropdown-item" data-action="deleteChat">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
    <span style="color:#f87171;">Delete chat</span>
  </button>
  ${!isGroup ? `<button class="chat-dropdown-item" data-action="archiveChat">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
    Archive chat
  </button>` : ""}
</div>`;
}

export function buildDisappearMenu(current) {
  const opts = [
    { val: "0", label: "Off", desc: "Messages stay forever" },
    { val: "86400000", label: "24 hours", desc: "Messages disappear after 1 day" },
    { val: "604800000", label: "7 days", desc: "Messages disappear after 1 week" },
    { val: "7776000000", label: "90 days", desc: "Messages disappear after 3 months" },
  ];
  return `
<div class="chat-disappear-panel" id="chatDisappearPanel">
  <div class="chat-disappear-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Disappearing Messages</div>
  <div class="chat-disappear-opts">
    ${opts.map(o => `<button class="chat-disappear-opt ${String(current) === o.val ? "active" : ""}" data-val="${o.val}"><strong>${o.label}</strong><span>${o.desc}</span></button>`).join("")}
  </div>
</div>`;
}

export function buildMessageBubble(msg, isOwn, senderPic, senderName) {
  const avatar = _avatarHtml(senderPic, senderName, 30);
  const time = _timeFull(msg.createdAt);

  if (msg.deletedForEveryone) {
    return `<div class="chat-msg-row ${isOwn ? "chat-row-own" : ""}" data-msgid="${msg.id}">
      ${isOwn ? "" : `<div class="chat-msg-avatar">${avatar}</div>`}
      <div class="chat-msg-body">
        <div class="chat-bubble chat-bubble-deleted">🚫 This message was deleted</div>
        <div class="chat-msg-meta"><span class="chat-msg-time">${time}</span></div>
      </div>
      ${isOwn ? `<div class="chat-msg-avatar">${avatar}</div>` : ""}
    </div>`;
  }

  let contentHtml = "";
  let bubbleClass = "chat-bubble";
  let noBubble = false;

  if (msg.type === "text") {
    contentHtml = `<div class="chat-bubble-text">${_renderLinks(msg.content)}</div>`;
  } else if (msg.type === "sticker") {
    noBubble = true;
    contentHtml = `<div class="chat-sticker-msg">${msg.content}</div>`;
  } else if (msg.type === "gif") {
    bubbleClass += " chat-bubble-media";
    contentHtml = `<div class="chat-bubble-gif"><img src="${msg.content}" alt="GIF" loading="lazy" /></div>`;
  } else if (msg.type === "image") {
    bubbleClass += " chat-bubble-media";
    contentHtml = `<div class="chat-bubble-image"><img src="${msg.content}" alt="Image" loading="lazy" /></div>`;
  } else if (msg.type === "voice") {
    const dur = msg.duration ? `${Math.floor(msg.duration / 60)}:${String(Math.floor(msg.duration % 60)).padStart(2, "0")}` : "0:00";
    contentHtml = `<div class="chat-bubble-voice">
      <button class="chat-voice-play-btn" data-audio="${msg.content}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <div class="chat-voice-bars">${Array.from({length:20}, () => `<div class="chat-vbar" style="height:${8+Math.random()*18}px;"></div>`).join("")}</div>
      <span class="chat-voice-dur">${dur}</span>
    </div>`;
  } else if (msg.type === "file") {
    const sizeKb = msg.fileSize ? (msg.fileSize / 1024).toFixed(1) : "?";
    contentHtml = `<div class="chat-bubble-file">
      <span class="chat-file-icon">📎</span>
      <div class="chat-file-info"><span class="chat-file-name">${_escapeHtml(msg.fileName || "File")}</span><span class="chat-file-size">${sizeKb} KB</span></div>
      <a class="chat-file-dl" href="${msg.content}" download="${_escapeHtml(msg.fileName || "file")}">⬇</a>
    </div>`;
  } else if (msg.type === "profile_share") {
    // Collapsed profile share history pill
    noBubble = true;
    const picHtml = msg.profilePic
      ? `<img src="${msg.profilePic}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;" />`
      : `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;">${(msg.profileName||"?").charAt(0).toUpperCase()}</div>`;
    contentHtml = `<div class="ps-history-pill" data-profileid="${_escapeHtml(msg.profileId||"")}">
      <div class="ps-history-avatar">${picHtml}</div>
      <div class="ps-history-text">
        <span class="ps-history-label">Profile shared</span>
        <span class="ps-history-name">${_escapeHtml(msg.profileName||"Unknown")}</span>
      </div>
      <button class="ps-history-view-btn" data-profileid="${_escapeHtml(msg.profileId||"")}">View</button>
    </div>`;
  }

  if (msg.caption && msg.type !== "text") {
    contentHtml += `<div class="chat-bubble-caption">${_renderLinks(msg.caption)}</div>`;
  }

  const nameLabel = !isOwn ? `<span class="chat-msg-sender">${_escapeHtml(senderName)}</span>` : "";
  const inner = noBubble ? contentHtml : `<div class="${bubbleClass}">${contentHtml}</div>`;

  const readClass = msg.readBy && msg.readBy.length > 0 ? "read-seen" : "read-sent";
  const readIndicator = isOwn ? `<span class="chat-read-dot ${readClass}" title="${readClass === "read-seen" ? "Seen" : "Sent"}"></span>` : "";

  return `<div class="chat-msg-row ${isOwn ? "chat-row-own" : ""}" data-msgid="${msg.id}">
    ${isOwn ? "" : `<div class="chat-msg-avatar">${avatar}</div>`}
    <div class="chat-msg-body">
      ${nameLabel}
      ${inner}
      <div class="chat-msg-meta"><span class="chat-msg-time">${time}</span>${readIndicator}</div>
    </div>
    ${isOwn ? `<div class="chat-msg-avatar">${avatar}</div>` : ""}
  </div>`;
}

export function buildConvContextMenu() {
  return `
<div class="conv-context-menu" id="convContextMenu" style="display:none;">
  <button class="conv-ctx-item" data-action="archive">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
    Archive
  </button>
  <button class="conv-ctx-item" data-action="clearAll">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
    Clear chat
  </button>
  <button class="conv-ctx-item conv-ctx-danger" data-action="deleteAll">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
    Delete chat
  </button>
</div>`;
}

export function buildDateSeparator(dateStr) {
  return `<div class="chat-date-sep"><span>${dateStr}</span></div>`;
}

export function buildGroupConvItem(group) {
  const initial = (group.name || "G").charAt(0).toUpperCase();
  const picHtml = group.avatar
    ? `<img src="${group.avatar}" alt="${group.name}" />`
    : `<div class="pic-fallback" style="background:linear-gradient(135deg,#8b5cf6,#a78bfa);font-size:14px;">${initial}</div>`;
  const lastMsg = group.lastMessage || "";
  const preview = lastMsg.length > 30 ? lastMsg.slice(0, 30) + "…" : lastMsg;

  return `
<div class="chat-conv-item chat-conv-group" data-groupid="${group.id}">
  <div class="chat-conv-pic-wrap"><div class="chat-conv-pic">${picHtml}</div><span class="chat-conv-group-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span></div>
  <div class="chat-conv-info">
    <div class="chat-conv-name">${_escapeHtml(group.name)}</div>
    <div class="chat-conv-preview">${_escapeHtml(preview)}</div>
  </div>
  <div class="chat-conv-meta"><span class="chat-conv-time">${_timeShort(group.lastMessageAt)}</span></div>
</div>`;
}

export function buildCreateGroupModal(friends) {
  const friendItems = friends.map(f => {
    const pic = f.profilePicBase64
      ? `<img src="${f.profilePicBase64}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
      : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;">${(f.name||"?").charAt(0).toUpperCase()}</div>`;
    return `<label class="group-member-item"><input type="checkbox" value="${f.userId}" data-name="${_escapeHtml(f.name)}" />${pic}<span>${_escapeHtml(f.name)}</span></label>`;
  }).join("");

  return `
<div class="edit-profile-overlay" id="createGroupOverlay">
  <div class="create-group-modal">
    <h3>Create Group</h3>
    <div class="auth-field">
      <label>GROUP NAME *</label>
      <input type="text" id="groupNameInput" placeholder="e.g. The Squad 🔥" maxlength="50" />
    </div>
    <div class="auth-field">
      <label>DESCRIPTION</label>
      <textarea id="groupDescInput" placeholder="What's this group about?" rows="2" maxlength="200"></textarea>
    </div>
    <div class="auth-field">
      <label>ADD MEMBERS</label>
      <div class="group-member-list" id="groupMemberList">${friendItems || '<div style="padding:8px;color:var(--text-dim);font-size:12px;">Add friends first to create a group</div>'}</div>
    </div>
    <div class="auth-error" id="group-error"></div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="auth-submit" id="groupCreateBtn" style="flex:1;">Create Group</button>
      <button class="auth-submit" id="groupCancelBtn" style="flex:1;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Cancel</button>
    </div>
  </div>
</div>`;
}

export function buildGroupHeader(group) {
  const initial = (group.name || "G").charAt(0).toUpperCase();
  const picHtml = group.avatar
    ? `<img src="${group.avatar}" alt="${group.name}" />`
    : `<div class="pic-fallback" style="background:linear-gradient(135deg,#8b5cf6,#a78bfa);font-size:14px;">${initial}</div>`;
  const memberCount = group.members?.length || 0;

  return `
<button class="chat-back-btn" id="chatBackBtn">←</button>
<div class="chat-header-pic">${picHtml}</div>
<div class="chat-header-info">
  <div class="chat-header-name">${_escapeHtml(group.name)}</div>
  <div class="chat-header-status" id="chatHeaderStatus">${memberCount} members</div>
</div>
<div class="chat-header-actions">
  <button class="chat-header-btn" id="chatGroupInfoBtn" title="Group info">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  </button>
</div>`;
}

export function buildGroupInfoPanel(group, members, isAdmin) {
  const memberHtml = members.map(m => {
    const pic = m.profilePicBase64
      ? `<img src="${m.profilePicBase64}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
      : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;">${(m.name||"?").charAt(0).toUpperCase()}</div>`;
    const adminBadge = m.userId === group.createdBy ? '<span class="group-admin-badge">Admin</span>' : "";
    const removeBtn = isAdmin && m.userId !== group.createdBy ? `<button class="group-remove-member" data-uid="${m.userId}">✕</button>` : "";
    return `<div class="group-info-member">${pic}<span>${_escapeHtml(m.name)}${adminBadge}</span>${removeBtn}</div>`;
  }).join("");

  return `
<div class="group-info-panel" id="groupInfoPanel">
  <div class="group-info-header">${_escapeHtml(group.name)}</div>
  ${group.description ? `<div class="group-info-desc">${_escapeHtml(group.description)}</div>` : ""}
  <div class="group-info-section">Members (${members.length})</div>
  <div class="group-info-members">${memberHtml}</div>
  ${isAdmin ? '<button class="group-info-add" id="groupInfoAddBtn">+ Add Member</button>' : ""}
  ${isAdmin ? '<button class="group-info-add" id="groupInfoInviteBtn">🔗 Share Invite Link</button>' : ""}
  <button class="group-info-leave" id="groupInfoLeaveBtn">Leave Group</button>
  <button class="group-info-close" id="groupInfoCloseBtn">Close</button>
</div>`;
}

export function buildInviteLinkModal(link, canReset) {
  return `
<div class="edit-profile-overlay" id="inviteLinkOverlay">
  <div class="cat-password-modal">
    <h3>Share Invite Link</h3>
    <p class="edit-bio-subtitle">Anyone with this link can join the group — no need to add them as a friend first.</p>
    <div class="auth-field">
      <input type="text" id="inviteLinkInput" value="${_escapeHtml(link)}" readonly />
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="auth-submit" id="inviteLinkCopyBtn" style="flex:1;">Copy Link</button>
      ${canReset ? `<button class="auth-submit" id="inviteLinkResetBtn" style="flex:1;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Reset Link</button>` : ""}
    </div>
    <button class="auth-submit" id="inviteLinkCloseBtn" style="margin-top:10px;width:100%;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Close</button>
  </div>
</div>`;
}

export function buildGroupInvitePreviewHtml(group) {
  const memberCount = group.members?.length || 0;
  const desc = group.description ? `<br>${_escapeHtml(group.description)}` : "";
  return `<strong>${_escapeHtml(group.name)}</strong>${desc}<br>${memberCount} member${memberCount === 1 ? "" : "s"}`;
}
