/**
 * src/ui/roomTemplates.js
 * HTML templates for Public Room and Private Room feeds.
 */

import { ICONS } from "./icons.js";

function _escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _renderText(text) {
  const escaped = _escapeHtml(text);
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a class="room-post-link" href="$1" target="_blank" rel="noopener">$1</a>'
  ).replace(/\n/g, "<br>");
}

function _timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
}

export function buildPostCard(post, isOwner) {
  let contentHtml = "";

  if (post.type === "image") {
    contentHtml = `<div class="room-post-image"><img src="${post.content}" alt="${_escapeHtml(post.caption || "")}" loading="lazy" /></div>`;
  } else if (post.type === "video") {
    const ytMatch = post.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      contentHtml = `<div class="room-post-video"><iframe src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>`;
    } else {
      contentHtml = `<div class="room-post-video-link"><a href="${_escapeHtml(post.content)}" target="_blank" rel="noopener" class="room-video-ext-link">▶ Watch Video</a></div>`;
    }
  } else if (post.type === "file") {
    const sizeKb = post.fileSize ? (post.fileSize / 1024).toFixed(1) : "?";
    contentHtml = `
      <div class="room-post-file">
        <div class="room-file-icon">📎</div>
        <div class="room-file-info">
          <div class="room-file-name">${_escapeHtml(post.fileName || "File")}</div>
          <div class="room-file-size">${sizeKb} KB</div>
        </div>
        <a class="room-file-download" href="${post.content}" download="${_escapeHtml(post.fileName || "file")}">⬇</a>
      </div>`;
  } else {
    contentHtml = `<div class="room-post-text">${_renderText(post.content || "")}</div>`;
  }

  const captionHtml = post.caption && post.type !== "text"
    ? `<div class="room-post-caption">${_renderText(post.caption)}</div>` : "";

  const deleteBtn = isOwner
    ? `<button class="room-post-delete" data-postid="${post.id}" title="Delete">✕</button>` : "";

  // Rating
  const ratings = post.ratings || {};
  const ratingValues = Object.values(ratings);
  const avgRating = ratingValues.length > 0 ? (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length) : 0;
  const ratingCount = ratingValues.length;
  const isTrending = avgRating >= 4 && ratingCount >= 2;

  const stars = [1,2,3,4,5].map(s =>
    `<button class="rp-star" data-postid="${post.id}" data-star="${s}" title="${s} star${s>1?'s':''}">${s <= Math.round(avgRating) ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent-light)" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'}</button>`
  ).join("");

  const trendBadge = isTrending ? `<span class="rp-trend-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>Trending</span>` : "";

  // Comments
  const comments = post.comments || [];
  const commentCount = comments.length;

  return `
<div class="room-post-card ${isTrending ? "rp-trending" : ""}" data-postid="${post.id}">
  ${trendBadge}
  ${deleteBtn}
  ${contentHtml}
  ${captionHtml}
  <div class="rp-social">
    <div class="rp-rating">
      <div class="rp-stars">${stars}</div>
      <span class="rp-rating-info">${avgRating > 0 ? avgRating.toFixed(1) : "—"} <span class="rp-rating-count">(${ratingCount})</span></span>
    </div>
    <button class="rp-comment-toggle" data-postid="${post.id}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      ${commentCount > 0 ? commentCount : ""}
    </button>
  </div>
  <div class="rp-comments-section" data-postid="${post.id}" style="display:none;">
    <div class="rp-comments-list" id="rp-comments-${post.id}">${comments.length > 0 ? comments.slice(-5).map(c => _buildComment(c)).join("") : '<div class="rp-no-comments">No comments yet</div>'}</div>
    <div class="rp-comment-input-wrap">
      <input type="text" class="rp-comment-input" data-postid="${post.id}" placeholder="Write a comment…" maxlength="300" />
      <button class="rp-comment-send" data-postid="${post.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </div>
  <div class="room-post-meta">
    <span class="room-post-time">${_timeAgo(post.createdAt)}</span>
    <span class="room-post-type-badge room-type-${post.type}">${post.type.toUpperCase()}</span>
  </div>
</div>`;
}

function _buildComment(c) {
  const pic = c.profilePic
    ? `<img src="${c.profilePic}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;" />`
    : `<div style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">${(c.name||"?").charAt(0).toUpperCase()}</div>`;
  const likes = c.likes || [];
  const likeCount = likes.length;
  return `<div class="rp-comment" data-commentid="${c.id || ""}">
    <div class="rp-comment-avatar">${pic}</div>
    <div class="rp-comment-body">
      <span class="rp-comment-name">${_escapeHtml(c.name || "User")}</span>
      <span class="rp-comment-text">${_escapeHtml(c.text || "")}</span>
    </div>
    <button class="rp-comment-like ${likes.length > 0 ? "rp-liked" : ""}" data-postid="${c.postId}" data-commentidx="${c.idx}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="${likeCount > 0 ? 'var(--accent-light)' : 'none'}" stroke="${likeCount > 0 ? 'var(--accent-light)' : 'var(--text-dim)'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      ${likeCount > 0 ? `<span>${likeCount}</span>` : ""}
    </button>
  </div>`;
}

export function buildUploadModal(roomType) {
  const title = roomType === "public" ? "Post to Public Room" : "Post to Private Room";
  return `
<div class="edit-profile-overlay" id="uploadOverlay">
  <div class="room-upload-modal">
    <h3>${title}</h3>
    <p class="edit-bio-subtitle">Share something — photos, thoughts, videos, or files</p>
    <div class="auth-error" id="upload-error"></div>

    <div class="room-type-selector">
      <button class="room-type-btn active" data-type="image">🖼 Image</button>
      <button class="room-type-btn" data-type="text">✍ Text</button>
      <button class="room-type-btn" data-type="video">🎬 Video</button>
      <button class="room-type-btn" data-type="file">📎 File</button>
    </div>

    <div class="room-upload-area" id="uploadArea">
      <div class="room-upload-type" id="upload-image">
        <div class="room-dropzone" id="imageDropzone">
          <input type="file" accept="image/*" id="imageFileInput" style="display:none;" />
          <div class="room-dropzone-content" id="dropzoneContent">
            <div class="room-dropzone-icon">🖼</div>
            <div>Click or drag an image here</div>
            <div class="room-dropzone-hint">JPG, PNG, GIF — max 800px, auto-compressed</div>
          </div>
        </div>
      </div>

      <div class="room-upload-type" id="upload-text" style="display:none;">
        <textarea id="textPostInput" class="bio-textarea" placeholder="What's on your mind? 💭&#10;&#10;Use emojis, share thoughts, drop links..." maxlength="2000" style="min-height:140px;"></textarea>
      </div>

      <div class="room-upload-type" id="upload-video" style="display:none;">
        <div class="auth-field" style="margin:0;">
          <label>Video URL</label>
          <input type="url" id="videoUrlInput" placeholder="Paste a YouTube or video link…" />
          <div class="room-dropzone-hint" style="margin-top:6px;">YouTube links will auto-embed as a player</div>
        </div>
      </div>

      <div class="room-upload-type" id="upload-file" style="display:none;">
        <div class="room-dropzone" id="fileDropzone">
          <input type="file" id="fileFileInput" style="display:none;" />
          <div class="room-dropzone-content" id="fileDropzoneContent">
            <div class="room-dropzone-icon">📎</div>
            <div>Click to select a file</div>
            <div class="room-dropzone-hint">Max 700KB — PDFs, docs, zips, etc.</div>
          </div>
        </div>
      </div>
    </div>

    <div class="auth-field" id="captionField">
      <label>Caption <span class="bio-char-hint">(optional)</span></label>
      <input type="text" id="captionInput" placeholder="Add a caption…" maxlength="200" />
    </div>

    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="auth-submit" id="uploadSubmitBtn" style="flex:1;">Post</button>
      <button class="auth-submit" id="uploadCancelBtn" style="flex:1;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Cancel</button>
    </div>
  </div>
</div>`;
}

export function buildAccessModal(accessUsers) {
  const listHtml = accessUsers.length
    ? accessUsers.map(u => `
      <div class="room-access-item" data-userid="${u.userId}">
        <div class="profile-user-pic">${u.profilePicBase64
          ? `<img src="${u.profilePicBase64}" alt="${_escapeHtml(u.name)}" />`
          : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);font-size:16px;">${(u.name||"?").charAt(0).toUpperCase()}</div>`
        }</div>
        <div class="profile-user-info">
          <div class="profile-user-name">${_escapeHtml(u.name)}</div>
          <div class="profile-user-meetid">${_escapeHtml(u.meetingId || "")}</div>
        </div>
        <button class="profile-user-btn remove room-revoke-btn" data-userid="${u.userId}">Revoke</button>
      </div>`).join("")
    : '<div class="profile-empty"><div class="profile-empty-icon">🔒</div>No one else has access</div>';

  return `
<div class="edit-profile-overlay" id="accessOverlay">
  <div class="room-access-modal">
    <h3>Private Room Access</h3>
    <p class="edit-bio-subtitle">Control who can see your private uploads</p>

    <div class="room-access-search">
      <input type="text" id="accessSearchInput" placeholder="Enter a Meeting ID to grant access…" autocomplete="off" />
      <button class="profile-search-btn" id="accessSearchBtn">Add</button>
    </div>
    <div class="auth-error" id="access-error"></div>

    <div class="room-access-list" id="accessList">${listHtml}</div>

    <button class="auth-submit" id="accessCloseBtn" style="margin-top:12px;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Close</button>
  </div>
</div>`;
}
