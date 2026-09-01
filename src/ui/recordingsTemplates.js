/**
 * src/ui/recordingsTemplates.js
 * HTML templates for the Recordings dashboard page.
 */

function fmtDate(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("en-ZA", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function buildRecordingsPage(meetings) {
  const header = `
    <div class="ppage-header">
      <div>
        <h2 class="ppage-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px;opacity:0.7;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>Recordings</h2>
        <p class="ppage-subtitle">Meetings you've recorded — merge everyone's clips into one video</p>
      </div>
    </div>`;

  if (!meetings.length) {
    return `${header}<div class="profile-empty"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>No recordings yet.<br>Hit Record during a meeting to save one here.</div>`;
  }

  const cards = meetings.map((m) => `
    <div class="rec-meeting-card" data-channel="${m.channelId}">
      <div class="rec-meeting-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>
      <div class="rec-meeting-body">
        <div class="rec-meeting-name">${m.channelId}</div>
        <div class="rec-meeting-meta">${m.count} clip${m.count === 1 ? "" : "s"} · Last recorded ${fmtDate(m.latestAt)}</div>
      </div>
      <svg class="rec-meeting-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`).join("");

  return `${header}<div class="rec-meeting-list">${cards}</div>`;
}

export function buildMeetingClipsView(channelId, clips) {
  const clipItems = clips.map((c) => `
    <label class="rec-clip-item">
      <input type="checkbox" class="rec-clip-check" value="${c.id}" data-url="${c.downloadURL}" data-name="${c.name}" />
      <div class="rec-clip-info">
        <div class="rec-clip-name">${c.name}</div>
        <div class="rec-clip-meta">${fmtDate(c.createdAt)}</div>
      </div>
      <a class="rec-clip-download" href="${c.downloadURL}" target="_blank" rel="noopener" title="Open clip">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </label>`).join("");

  return `
    <button class="rec-back-btn" id="recBackBtn">&larr; Back to Recordings</button>
    <div class="ppage-header">
      <div>
        <h2 class="ppage-title">${channelId}</h2>
        <p class="ppage-subtitle">Select clips to merge into one video</p>
      </div>
      <button class="rec-merge-btn" id="recMergeBtn" disabled>Merge Selected</button>
    </div>
    <div class="rec-clip-list">${clipItems}</div>
    <div class="rec-merge-progress" id="recMergeProgress" style="display:none;">
      <div class="rec-merge-progress-label" id="recMergeProgressLabel">Merging…</div>
      <div class="rec-merge-progress-bar"><div class="rec-merge-progress-fill" id="recMergeProgressFill"></div></div>
    </div>
    <div class="rec-merge-result" id="recMergeResult" style="display:none;"></div>
  `;
}
