/**
 * src/ui/categoryTemplates.js
 * HTML templates for Contact Categories — friend-grouping cards, create/rename/password modals, member panel.
 */

const CATEGORY_COLORS = [
  ["#6366f1", "#818cf8"],
  ["#ec4899", "#f472b6"],
  ["#10b981", "#34d399"],
  ["#f97316", "#fb923c"],
  ["#3b82f6", "#60a5fa"],
  ["#8b5cf6", "#a78bfa"],
];

function _escapeHtml(text) {
  return (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _folderIconSvg(size) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-${Math.round(size * 0.17)}px;margin-right:6px;opacity:0.7;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
}

export function buildCategoriesPage(categories) {
  const cardsHtml = categories.map((c, i) => buildCategoryCard(c, i)).join("");

  return `
<div class="ppage-header">
  <div>
    <h2 class="ppage-title">${_folderIconSvg(18)}Categories</h2>
    <p class="ppage-subtitle">Private folders for your friends — click one to see who's inside</p>
  </div>
  <button class="room-upload-btn" id="catNewBtn">+ New Category</button>
</div>
<div class="cat-grid" id="catGrid">${cardsHtml}</div>
<div class="profile-empty" id="catEmpty" style="${categories.length ? "display:none;" : ""}">
  <div class="profile-empty-icon">${_folderIconSvg(36)}</div>
  No categories yet.<br>Create one to group your friends — Family, Work, Girls, anything you like.
</div>`;
}

export function buildCategoryCard(category, index = 0) {
  const [c1, c2] = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  const count = (category.memberIds || []).length;
  const lockBadge = category.passwordHash
    ? `<span class="cat-card-badge" title="Password protected"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>`
    : "";
  const groupBadge = category.linkedGroupId
    ? `<span class="cat-card-badge" title="Has a linked group chat"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></span>`
    : "";

  return `
<div class="cat-card" data-catid="${category.id}" style="--c1:${c1};--c2:${c2};">
  <div class="cat-card-icon">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
  </div>
  <div class="cat-card-body">
    <div class="cat-card-name">${_escapeHtml(category.name)}${lockBadge}${groupBadge}</div>
    <div class="cat-card-count">${count} member${count === 1 ? "" : "s"}</div>
  </div>
</div>`;
}

export function buildCreateCategoryModal(friends) {
  const friendItems = friends.map(f => {
    const pic = f.profilePicBase64
      ? `<img src="${f.profilePicBase64}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" />`
      : `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:13px;">${(f.name || "?").charAt(0).toUpperCase()}</div>`;
    return `<label class="group-member-item"><input type="checkbox" value="${f.userId}" data-name="${_escapeHtml(f.name)}" />${pic}<span>${_escapeHtml(f.name)}</span></label>`;
  }).join("");

  return `
<div class="edit-profile-overlay" id="createCatOverlay">
  <div class="create-group-modal">
    <h3>New Category</h3>
    <div class="auth-field">
      <label>CATEGORY NAME *</label>
      <input type="text" id="catNameInput" placeholder="e.g. Family, Work, Girls" maxlength="40" />
    </div>
    <div class="auth-field">
      <label>PASSWORD <span class="bio-char-hint">(optional — locks this category)</span></label>
      <input type="password" id="catPasswordInput" placeholder="Leave blank for no password" maxlength="60" autocomplete="new-password" />
    </div>
    <div class="auth-field">
      <label>ADD MEMBERS</label>
      <div class="group-member-list" id="catMemberList">${friendItems || '<div style="padding:8px;color:var(--text-dim);font-size:12px;">Add friends first to create a category</div>'}</div>
    </div>
    <label class="cat-checkbox-row">
      <input type="checkbox" id="catAlsoGroupCheckbox" />
      <span>Also create a group chat for these members</span>
    </label>
    <div class="auth-error" id="cat-error"></div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="auth-submit" id="catCreateBtn" style="flex:1;">Create Category</button>
      <button class="auth-submit" id="catCancelBtn" style="flex:1;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Cancel</button>
    </div>
  </div>
</div>`;
}

/**
 * Generic single-input prompt modal, reused for password entry, rename, and set/change password.
 * `overlayId` must be unique per invocation — submit/cancel/error element ids are derived from it.
 */
export function buildTextPromptModal({ overlayId, title, subtitle = "", inputId, inputType = "text", placeholder = "", submitLabel = "Save", danger = false }) {
  return `
<div class="edit-profile-overlay" id="${overlayId}">
  <div class="cat-password-modal">
    <h3>${_escapeHtml(title)}</h3>
    ${subtitle ? `<p class="edit-bio-subtitle">${_escapeHtml(subtitle)}</p>` : ""}
    <div class="auth-field">
      <input type="${inputType}" id="${inputId}" placeholder="${_escapeHtml(placeholder)}" autocomplete="off" />
    </div>
    <div class="auth-error" id="${overlayId}-error"></div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="auth-submit" id="${overlayId}-submit" style="flex:1;${danger ? "background:linear-gradient(135deg,#dc2626,#b91c1c);" : ""}">${submitLabel}</button>
      <button class="auth-submit" id="${overlayId}-cancel" style="flex:1;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Cancel</button>
    </div>
  </div>
</div>`;
}

/**
 * Combined unlock-phrase + vault-password setup modal, used both when hiding
 * a category for the first time and when resetting forgotten vault access.
 */
export function buildVaultSetupModal({ title, subtitle = "", submitLabel = "Save" }) {
  return `
<div class="edit-profile-overlay" id="catVaultSetupOverlay">
  <div class="cat-password-modal">
    <h3>${_escapeHtml(title)}</h3>
    ${subtitle ? `<p class="edit-bio-subtitle">${_escapeHtml(subtitle)}</p>` : ""}

    <div class="auth-field" id="catVaultPhraseField">
      <label>UNLOCK PHRASE <span class="bio-char-hint">a word or phrase only you'd know</span></label>
      <div class="auth-meetid-wrap">
        <input type="text" id="catVaultPhraseInput" placeholder="e.g. a nickname, a private joke…" maxlength="60" autocomplete="off" />
        <span class="auth-meetid-status" id="catVaultPhraseStatus"></span>
      </div>
      <div class="room-dropzone-hint" style="margin-top:6px;">Tip: including a space or symbol makes it impossible for this to ever collide with a real Meeting ID.</div>
    </div>

    <div class="auth-field">
      <label>VAULT PASSWORD</label>
      <input type="password" id="catVaultSetupPasswordInput" placeholder="New password" autocomplete="new-password" />
    </div>

    <div class="auth-error" id="catVaultSetup-error"></div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="auth-submit" id="catVaultSetupSubmitBtn" style="flex:1;">${submitLabel}</button>
      <button class="auth-submit" id="catVaultSetupCancelBtn" style="flex:1;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Cancel</button>
    </div>
  </div>
</div>`;
}

export function buildCategoryMembersPanel(category, members, linkedGroup) {
  const memberRows = members.length
    ? members.map(m => {
        const pic = m.profilePicBase64
          ? `<img src="${m.profilePicBase64}" alt="${_escapeHtml(m.name)}" />`
          : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);font-size:16px;">${(m.name || "?").charAt(0).toUpperCase()}</div>`;
        return `
        <div class="profile-user-item" data-userid="${m.userId}" data-meetid="${m.meetingId || ""}">
          <div class="profile-user-pic">${pic}</div>
          <div class="profile-user-info">
            <div class="profile-user-name">${_escapeHtml(m.name)}</div>
            <div class="profile-user-meetid">${_escapeHtml(m.meetingId || "")}</div>
          </div>
          <div class="profile-user-actions">
            <button class="profile-user-btn add" data-action="chat" data-uid="${m.userId}">Chat</button>
            <button class="profile-user-btn call" data-action="call" data-uid="${m.userId}">Call</button>
            <button class="profile-user-btn remove" data-action="removeMember" data-uid="${m.userId}">Remove</button>
          </div>
        </div>`;
      }).join("")
    : '<div class="profile-empty"><div class="profile-empty-icon">👤</div>No members yet — add some friends below.</div>';

  const groupBtn = linkedGroup
    ? `<button class="cat-group-open-btn" id="catOpenGroupBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Open Group Chat</button>`
    : "";

  return `
<div class="edit-profile-overlay" id="catDetailOverlay">
  <div class="cat-detail-modal">
    <div class="cat-detail-header">
      <h3 id="catDetailName">${_escapeHtml(category.name)}</h3>
      <button class="cat-detail-close" id="catDetailCloseBtn">✕</button>
    </div>
    ${groupBtn}
    <div class="profile-user-list cat-detail-list" id="catDetailList">${memberRows}</div>

    <div class="cat-detail-actions">
      <button class="pnav-card-btn" id="catAddMemberBtn">+ Add Member</button>
      <button class="pnav-card-btn" id="catRenameBtn">Rename</button>
      <button class="pnav-card-btn" id="catPasswordBtn">${category.passwordHash ? "Change" : "Set"} Password</button>
      ${category.passwordHash ? `<button class="pnav-card-btn" id="catRemovePasswordBtn">Remove Password</button>` : ""}
      ${category.hidden
        ? `<button class="pnav-card-btn" id="catUnhideBtn">Unhide Category</button>`
        : `<button class="pnav-card-btn" id="catHideBtn">Hide Category</button>`}
      <button class="pnav-card-btn" id="catDeleteBtn" style="color:#f87171;border-color:rgba(239,68,68,0.3);">Delete Category</button>
    </div>
  </div>
</div>`;
}

export function buildHiddenVaultOverlay(categories) {
  const cardsHtml = categories.length
    ? categories.map((c, i) => buildCategoryCard(c, i)).join("")
    : '<div class="profile-empty"><div class="profile-empty-icon">👤</div>No hidden categories right now.</div>';

  return `
<div class="edit-profile-overlay" id="catVaultOverlay">
  <div class="cat-detail-modal cat-vault-overlay-inner">
    <div class="cat-detail-header">
      <h3>Hidden Categories</h3>
      <button class="cat-detail-close" id="catVaultCloseBtn">✕</button>
    </div>
    <div class="cat-grid" id="catVaultGrid">${cardsHtml}</div>
  </div>
</div>`;
}

export function buildAddMemberPicker(candidates) {
  if (!candidates.length) {
    return `<div class="cat-add-picker"><p class="edit-bio-subtitle">All your friends are already in this category.</p></div>`;
  }
  const items = candidates.map(f => {
    const pic = f.profilePicBase64
      ? `<img src="${f.profilePicBase64}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;" />`
      : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#818cf8);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:11px;">${(f.name || "?").charAt(0).toUpperCase()}</div>`;
    return `<label class="group-member-item"><input type="checkbox" value="${f.userId}" />${pic}<span>${_escapeHtml(f.name)}</span></label>`;
  }).join("");
  return `
<div class="cat-add-picker">
  <div class="group-member-list">${items}</div>
  <button class="auth-submit" id="catAddSelectedBtn" style="margin-top:8px;width:100%;">Add Selected</button>
</div>`;
}
