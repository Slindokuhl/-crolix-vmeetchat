/**
 * src/ui/sessionTemplates.js
 * Session mood picker modal HTML.
 */

export const MOODS = [
  { id: "romance",  name: "Romance",       colors: ["#8b0000","#b76e79","#ffb6c1"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#ffb6c1" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>` },
  { id: "soccer",   name: "Soccer",        colors: ["#2d5a27","#ffffff","#ffd700"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>` },
  { id: "birthday", name: "Birthday",      colors: ["#ffd700","#9b59b6","#ff69b4"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd700" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><rect x="4" y="11" width="16" height="4" rx="2"/><path d="M12 7v4"/><circle cx="12" cy="5" r="2" fill="#ffd700"/></svg>` },
  { id: "gaming",   name: "Gaming",        colors: ["#00ff41","#0d0d0d","#7b2fff"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00ff41" stroke-width="2"><line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/></svg>` },
  { id: "party",    name: "Party",         colors: ["#ff1493","#00bfff","#ff6347"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff1493" stroke-width="2"><path d="M5.8 11.3L2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="M22 2l-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="M22 13l-1.34-.3a2.9 2.9 0 0 0-3.4 1.96v0a1.7 1.7 0 0 1-2.1 1.09l-.72-.2"/></svg>` },
  { id: "african",  name: "Amapiano",      colors: ["#e85d04","#f4a261","#6b3a1f"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f4a261" stroke-width="2"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M8 17V5l12-2v12"/></svg>` },
  { id: "church",   name: "Church",        colors: ["#c9b037","#f5f0e1","#4a3728"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9b037" stroke-width="2"><path d="M18 22H6a2 2 0 0 1-2-2V10l8-8 8 8v10a2 2 0 0 1-2 2z"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="10" y1="4" x2="14" y2="4"/><path d="M9 22v-4a3 3 0 0 1 6 0v4"/></svg>` },
  { id: "classroom",name: "Classroom",     colors: ["#1e88e5","#e3f2fd","#0d47a1"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#42a5f5" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>` },
  { id: "lofi",     name: "Chill Lofi",    colors: ["#6c5ce7","#a29bfe","#2d1b69"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a29bfe" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>` },
  { id: "horror",   name: "Horror",        colors: ["#1a1a2e","#e94560","#0f3460"], icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e94560" stroke-width="2"><path d="M12 2a7 7 0 0 0-7 7c0 3 2 5 3 7h8c1-2 3-4 3-7a7 7 0 0 0-7-7z"/><line x1="9" y1="22" x2="15" y2="22"/><line x1="12" y1="17" x2="12" y2="22"/></svg>` },
];

export function buildFabTray(currentMood, isHost) {
  const items = [
    { id: "", name: "Default", icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`, color: "var(--text-dim)" },
    ...MOODS.map(m => ({ id: m.id, name: m.name, icon: m.icon, color: m.colors[0] })),
  ];

  return items.map(m => {
    const isActive = (currentMood || "") === m.id;
    return `<button class="mood-tray-item ${isActive ? "mood-tray-active" : ""}" data-mood="${m.id}" title="${m.name}">
      <span class="mood-tray-icon">${m.icon}</span>
      <span class="mood-tray-name">${m.name}</span>
      ${isActive ? '<span class="mood-tray-dot"></span>' : ""}
    </button>`;
  }).join("") + (isHost ? `<button class="mood-tray-more" id="moodTrayMore" title="Customize"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg></button>` : "");
}

export function buildSessionPicker(currentMood, isHost) {
  const cards = MOODS.map(m => {
    const isActive = currentMood === m.id;
    const colorStrip = m.colors.map(c => `<span class="mood-color-dot" style="background:${c};"></span>`).join("");
    return `
<div class="mood-card ${isActive ? "mood-card-active" : ""}" data-mood="${m.id}">
  <div class="mood-card-icon">${m.icon}</div>
  <div class="mood-card-name">${m.name}</div>
  <div class="mood-card-colors">${colorStrip}</div>
  ${isActive ? '<div class="mood-card-live"><span class="mood-live-dot"></span>Active</div>' : ""}
</div>`;
  }).join("");

  const clearActive = !currentMood ? "mood-card-active" : "";

  return `
<div class="session-overlay" id="sessionOverlay">
  <div class="session-modal">
    <div class="session-header">
      <span class="session-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="2" style="vertical-align:-3px;margin-right:6px;"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="17" r="2"/><circle cx="6" cy="12" r="3"/></svg>Session Mood</span>
      <button class="session-close" id="sessionCloseBtn">&times;</button>
    </div>
    <div class="session-body">
      <div class="mood-grid">
        <div class="mood-card mood-card-default ${clearActive}" data-mood="">
          <div class="mood-card-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg></div>
          <div class="mood-card-name">Default</div>
          <div class="mood-card-colors"><span class="mood-color-dot" style="background:var(--bg-card);border:1px solid var(--border-soft);"></span></div>
          ${!currentMood ? '<div class="mood-card-live"><span class="mood-live-dot"></span>Active</div>' : ""}
        </div>
        ${cards}
      </div>
      ${isHost ? '<button class="session-apply-btn" id="sessionApplyBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" style="vertical-align:-2px;margin-right:6px;"><polyline points="20 6 9 17 4 12"/></svg>Apply to Meeting</button>' : '<div class="session-guest-note">Only the host can change the session mood</div>'}
    </div>
  </div>
</div>`;
}
