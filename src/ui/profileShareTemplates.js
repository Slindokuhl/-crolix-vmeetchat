/**
 * src/ui/profileShareTemplates.js
 * HTML templates for the live profile-sharing / tagging feature.
 */

function _esc(t) { return (t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function _avatarCircle(pic, name, size = 36) {
  const initial = (name || "?").charAt(0).toUpperCase();
  const fs = Math.round(size * 0.42);
  if (pic) {
    return `<img src="${pic}" alt="${_esc(name)}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;" />`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-size:${fs}px;font-weight:700;color:#fff;flex-shrink:0;">${initial}</div>`;
}

function _bannerLabel(taggerName, view) {
  const n = taggerName || "Someone";
  if (view === "room")  return `${n} is browsing their room`;
  if (view === "about") return `${n} is viewing their about`;
  return `${n} is sharing a profile`;
}

function _buildPostThumb(post) {
  if (post.type === "image" && post.content) {
    return `<div class="ps-post-thumb ps-post-image" title="${_esc(post.caption || "")}">
      <img src="${_esc(post.content)}" alt="post" loading="lazy" />
      ${post.caption ? `<div class="ps-post-caption">${_esc(post.caption.slice(0, 40))}</div>` : ""}
    </div>`;
  }
  if (post.type === "video") {
    const ytMatch = (post.content || "").match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    const thumb = ytMatch ? `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg` : "";
    return thumb
      ? `<div class="ps-post-thumb ps-post-image" title="${_esc(post.caption || "Video")}">
           <img src="${thumb}" alt="video" loading="lazy" />
           <div class="ps-post-caption">▶ Video</div>
         </div>`
      : `<div class="ps-post-thumb ps-post-text"><p>▶ Video</p></div>`;
  }
  if (post.type === "file") {
    return `<div class="ps-post-thumb ps-post-text"><p>📎 ${_esc(post.fileName || "File")}</p></div>`;
  }
  const text = post.content || "";
  return `<div class="ps-post-thumb ps-post-text">
    <p>${_esc(text.slice(0, 80))}${text.length > 80 ? "…" : ""}</p>
  </div>`;
}

const _sendInviteBtn = `
  <button class="ps-send-invite-btn" id="psSendInviteBtn">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    Send Invite ↗
  </button>`;

const _backBtn = `
  <button class="ps-back-btn" id="psBackBtn">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
    Back
  </button>`;

/** Returns the view-specific HTML that replaces everything after the banner. */
export function buildViewBody(view, profile, posts, isTagger) {
  const lockClass = isTagger ? "" : " ps-partner-lock";
  const stickyInvite = isTagger ? "" : `<div class="ps-sticky-invite">${_sendInviteBtn}</div>`;

  /* ── Room view ── */
  if (view === "room") {
    const postsHtml = posts && posts.length > 0
      ? `<div class="ps-posts-grid">${posts.map(_buildPostThumb).join("")}</div>`
      : `<div class="ps-posts-empty">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
           <span>No posts yet</span>
         </div>`;
    return `
      <div class="ps-view-header">
        ${_backBtn}
        <span class="ps-view-title">${_esc(profile.name || "")}'s Room</span>
      </div>
      <div class="ps-expanded-body${lockClass}" id="psExpandedBody">${postsHtml}</div>
      ${stickyInvite}`;
  }

  /* ── About view ── */
  if (view === "about") {
    const bio       = profile.bio || "";
    const interests = Array.isArray(profile.interests) ? profile.interests : [];
    const links     = Array.isArray(profile.links)     ? profile.links     : [];
    const hasContent = bio || interests.length || links.length;
    const contentHtml = hasContent
      ? `${bio ? `<p class="ps-about-bio">${_esc(bio)}</p>` : ""}
         ${interests.length ? `<div class="ps-about-interests">${interests.map(t => `<span class="ps-about-tag">${_esc(t)}</span>`).join("")}</div>` : ""}
         ${links.length ? `<div class="ps-about-links">${links.map(l => `<a class="ps-about-link" href="${_esc(l.url)}" target="_blank" rel="noopener">${_esc(l.label || l.url)}</a>`).join("")}</div>` : ""}`
      : `<div class="ps-posts-empty"><span>No about info added yet</span></div>`;
    return `
      <div class="ps-view-header">
        ${_backBtn}
        <span class="ps-view-title">About ${_esc(profile.name || "")}</span>
      </div>
      <div class="ps-expanded-body${lockClass}" id="psExpandedBody">${contentHtml}</div>
      ${stickyInvite}`;
  }

  /* ── Profile view (default) ── */
  const pic64 = profile.profilePicBase64 || null;
  const disabledBtns = `
    <button class="ps-action-btn ps-action-disabled" disabled>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>Call
    </button>
    <button class="ps-action-btn ps-action-disabled" disabled>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Room
    </button>
    <button class="ps-action-btn ps-action-disabled" disabled>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h.01M7 20v-4"/><path d="M12 20V10"/><path d="M17 20V4"/><path d="M22 20v-2"/></svg>About
    </button>
    <button class="ps-action-btn ps-action-disabled" disabled>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Add Friend
    </button>
    ${_sendInviteBtn}`;

  const taggerBtns = `
    <button class="ps-action-btn" data-action="call">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>Call
    </button>
    <button class="ps-action-btn" data-action="room">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Room
    </button>
    <button class="ps-action-btn" data-action="about">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h.01M7 20v-4"/><path d="M12 20V10"/><path d="M17 20V4"/><path d="M22 20v-2"/></svg>About
    </button>
    <button class="ps-action-btn" data-action="addFriend">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>Add Friend
    </button>`;

  return `
    <div class="ps-card-body" data-view="profile">
      <div class="ps-card-profile-row">
        <div class="ps-card-pic">${_avatarCircle(pic64, profile.name, 60)}</div>
        <div class="ps-card-info">
          <div class="ps-card-name">${_esc(profile.name)}</div>
          <div class="ps-card-meetid-row">
            <span class="ps-meetid-chip">${_esc(profile.meetingId || "")}</span>
            <button class="ps-copy-id-btn" data-meetid="${_esc(profile.meetingId || "")}" title="Copy ID">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
          </div>
          ${profile.bio ? `<div class="ps-card-bio">${_esc(profile.bio)}</div>` : ""}
        </div>
      </div>
      <div class="ps-card-actions">${isTagger ? taggerBtns : disabledBtns}</div>
    </div>`;
}

export function buildTagResultsHtml(friends) {
  if (!friends || friends.length === 0) {
    return `<div class="ps-tag-empty">No friends match your search</div>`;
  }
  return friends.slice(0, 5).map(f => `
    <div class="ps-tag-result" data-userid="${_esc(f.userId)}">
      <div class="ps-tag-result-pic">${_avatarCircle(f.profilePicBase64, f.name, 36)}</div>
      <div class="ps-tag-result-info">
        <div class="ps-tag-result-name">${_esc(f.name)}</div>
        <div class="ps-tag-result-id">${_esc(f.meetingId || "")}</div>
      </div>
      <button class="ps-tag-btn" data-userid="${_esc(f.userId)}">Tag</button>
    </div>
  `).join("");
}

export function buildTagSearchPanel(friends) {
  return `
<div class="ps-tag-panel" id="chatTagPanel">
  <div class="ps-tag-header">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    <input type="text" class="ps-tag-search" id="chatTagSearch" placeholder="Search friends by name or Meeting ID…" autocomplete="off" />
    <button class="ps-tag-close" id="chatTagPanelClose">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="ps-tag-results" id="chatTagResults">
    ${buildTagResultsHtml(friends)}
  </div>
</div>`;
}

export function buildSharedProfileCard(profile, isTagger, taggerName, view = "profile", posts = []) {
  const label   = _bannerLabel(isTagger ? "You" : (taggerName || "Someone"), view);
  const expanded = view !== "profile" ? " ps-card-expanded" : "";
  const closeBtn = isTagger
    ? `<button class="ps-close-btn" id="psCloseShareBtn" title="End share">
         <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
       </button>` : "";
  return `
<div class="ps-share-card${expanded}" id="psShareCard">
  <div class="ps-live-banner">
    <span class="ps-live-dot"></span>
    <span class="ps-live-badge">LIVE</span>
    <span class="ps-live-label" id="psLiveLabel">${_esc(label)}</span>
    ${closeBtn}
  </div>
  ${buildViewBody(view, profile, posts, isTagger)}
</div>`;
}

export function buildSendInviteDropdown(taggedName) {
  return `
<div class="ps-invite-drop" id="psInviteDropdown">
  <div class="ps-invite-drop-title">Invite <strong>${_esc(taggedName)}</strong> to:</div>
  <button class="ps-invite-opt" data-type="joinChat">
    <span class="ps-invite-opt-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </span>
    <span class="ps-invite-opt-text">
      <span class="ps-invite-opt-name">Join This Chat</span>
      <span class="ps-invite-opt-desc">Add them as a participant here</span>
    </span>
  </button>
  <button class="ps-invite-opt" data-type="meeting">
    <span class="ps-invite-opt-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
    </span>
    <span class="ps-invite-opt-text">
      <span class="ps-invite-opt-name">Start a Meeting</span>
      <span class="ps-invite-opt-desc">Open a video meeting with them</span>
    </span>
  </button>
  <button class="ps-invite-opt" data-type="addFriend">
    <span class="ps-invite-opt-icon">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
    </span>
    <span class="ps-invite-opt-text">
      <span class="ps-invite-opt-name">Add as Friend</span>
      <span class="ps-invite-opt-desc">Send them a friend request from you</span>
    </span>
  </button>
</div>`;
}

export function buildProfileShareHistoryMsg(msg) {
  const pic = msg.profilePic
    ? `<img src="${msg.profilePic}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
    : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#fff;">${(msg.profileName || "?").charAt(0).toUpperCase()}</div>`;

  return `
<div class="ps-history-pill" data-msgid="${_esc(msg.id || "")}" data-profileid="${_esc(msg.profileId || "")}">
  <div class="ps-history-avatar">${pic}</div>
  <div class="ps-history-text">
    <span class="ps-history-label">Profile shared</span>
    <span class="ps-history-name">${_esc(msg.profileName || "Unknown")}</span>
  </div>
  <button class="ps-history-view-btn" data-profileid="${_esc(msg.profileId || "")}">View</button>
</div>`;
}
