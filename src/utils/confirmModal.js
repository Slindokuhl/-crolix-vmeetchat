/**
 * src/utils/confirmModal.js
 * Premium custom confirmation/alert modal — replaces browser confirm() and alert().
 */

let _activeModal = null;

export function crolixConfirm(message, { title = "Are you sure?", confirmText = "Confirm", cancelText = "Cancel", danger = false, icon = "warning" } = {}) {
  return new Promise(resolve => {
    _removeExisting();

    const iconSvg = {
      warning: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${danger ? "#f87171" : "#fbbf24"}" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      delete: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
      block: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`,
      info: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      success: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    }[icon] || iconSvg.warning;

    const overlay = document.createElement("div");
    overlay.className = "crolix-modal-overlay";
    overlay.id = "crolixModalOverlay";
    overlay.innerHTML = `
      <div class="crolix-modal">
        <div class="crolix-modal-icon">${iconSvg}</div>
        <div class="crolix-modal-title">${title}</div>
        <div class="crolix-modal-msg">${message}</div>
        <div class="crolix-modal-actions">
          <button class="crolix-modal-btn crolix-modal-cancel" id="crolixModalCancel">${cancelText}</button>
          <button class="crolix-modal-btn ${danger ? "crolix-modal-danger" : "crolix-modal-confirm"}" id="crolixModalConfirm">${confirmText}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    _activeModal = overlay;

    overlay.querySelector("#crolixModalConfirm").onclick = () => { _removeExisting(); resolve(true); };
    overlay.querySelector("#crolixModalCancel").onclick = () => { _removeExisting(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { _removeExisting(); resolve(false); } };
  });
}

export function crolixAlert(message, { title = "Notice", btnText = "OK", icon = "info" } = {}) {
  return new Promise(resolve => {
    _removeExisting();

    const iconSvg = {
      warning: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
      success: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
      error: `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    }[icon] || iconSvg.info;

    const overlay = document.createElement("div");
    overlay.className = "crolix-modal-overlay";
    overlay.id = "crolixModalOverlay";
    overlay.innerHTML = `
      <div class="crolix-modal">
        <div class="crolix-modal-icon">${iconSvg}</div>
        <div class="crolix-modal-title">${title}</div>
        <div class="crolix-modal-msg">${message}</div>
        <div class="crolix-modal-actions">
          <button class="crolix-modal-btn crolix-modal-confirm" id="crolixModalOk">${btnText}</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    _activeModal = overlay;

    overlay.querySelector("#crolixModalOk").onclick = () => { _removeExisting(); resolve(); };
    overlay.onclick = (e) => { if (e.target === overlay) { _removeExisting(); resolve(); } };
  });
}

function _removeExisting() {
  if (_activeModal) { _activeModal.remove(); _activeModal = null; }
  document.getElementById("crolixModalOverlay")?.remove();
}
