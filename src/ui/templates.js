/**
 * src/ui/templates.js
 * Pure functions returning HTML strings. No logic — markup only.
 */

import { ICONS } from "./icons.js";

export function buildJoinScreen() {
  return `
<div id="join-screen">
  <button id="joinBackBtn" style="position:fixed;top:20px;left:20px;z-index:1000;display:none;align-items:center;gap:8px;padding:10px 18px;border-radius:24px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.07);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fff;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:background 0.2s ease;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
    Back to Dashboard
  </button>
  <div class="join-wrapper">
    <div class="join-left">
      <div class="splash">
        <svg class="logo-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4fa3f7"/><stop offset="100%" stop-color="#6c5ce7"/></linearGradient>
            <linearGradient id="camGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#74b9ff"/><stop offset="100%" stop-color="#a29bfe"/></linearGradient>
          </defs>
          <path d="M 50 8 A 42 42 0 1 1 19.5 73 L 26 68 A 34 34 0 1 0 50 16 Z" fill="url(#ringGrad)"/>
          <rect x="26" y="36" width="30" height="22" rx="4" fill="url(#camGrad)"/>
          <circle cx="41" cy="47" r="7" fill="#0d1b2a"/>
          <circle cx="41" cy="47" r="4.5" fill="url(#ringGrad)"/>
          <rect x="53" y="40" width="2" height="14" rx="1" fill="url(#camGrad)"/>
          <polygon points="56,44 63,47 56,50" fill="url(#camGrad)"/>
          <path d="M 22 58 L 18 68 L 30 62" fill="url(#ringGrad)" opacity="0.85"/>
        </svg>
        <div class="logo-text"><span class="crolix">Crolix</span><span class="meet">VmeetChat</span></div>
      </div>
      <h1>Start or Join a Meeting</h1>
      <p class="subtitle">Connect instantly with your team. Create a meeting, share your ID, and collaborate in real-time.</p>
      <ul class="features">
        <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>Create your own meeting instantly</li>
        <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>Share a unique meeting ID</li>
        <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Join from anywhere</li>
        <li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="2" style="vertical-align:-2px;margin-right:6px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Schedule and manage sessions easily</li>
      </ul>
    </div>
    <div class="join-card">
      <h2>Join Meeting</h2>
      <p class="small-text">Enter your name and a meeting ID</p>
      <label>YOUR NAME</label>
      <input id="username" placeholder="Enter your name" autocomplete="name" />
      <label>MEETING ID</label>
      <input id="channelName" placeholder="e.g. team-standup-42" autocomplete="off" />
      <button id="joinBtn">Join Now</button>
      <div class="hint-box"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Tip: Create a meeting by entering a new ID and sharing it with others.</div>
    </div>
  </div>
</div>`;
}

export function buildMeetingScreen() {
  return `
<div id="meeting-screen" style="display:none;">
  <div class="top-bar">
    <div class="meeting-info">
      <span class="meeting-dot"></span>
      <span id="meeting-name">Chat</span>
      <span class="live-badge">● LIVE</span>
      <button id="premiumBtn" class="premium-pill" title="Schedule a Meeting">${ICONS.calendar} Schedule</button>
    </div>
    <div class="timer" id="meeting-timer">00:00</div>
    <div class="top-right">
      <button class="music-mute-btn" id="musicMuteBtn" title="Mute/unmute music" style="display:none;">${ICONS.musicOn}</button>
      <div class="participants-count" id="count" title="View participants">${ICONS.users}<span id="count-num">1</span></div>
    </div>
  </div>
  <div id="video-streams" class="video-grid"></div>
  <div id="participants-panel" class="participants-panel" style="display:none;">
    <div class="panel-header">
      <span>${ICONS.users} Participants (<span id="panel-count">0</span>)</span>
      <button id="closePanelBtn" class="panel-close-btn">✕</button>
    </div>
    <ul id="participants-list" class="participants-list"></ul>
  </div>
  <div class="mood-drawer" id="moodDrawer">
    <div class="mood-drawer-tab" id="moodDrawerTab">
      ${ICONS.palette}
    </div>
    <div class="mood-drawer-panel" id="moodDrawerPanel">
      <div class="mood-drawer-header">
        <span class="mood-drawer-title">Session Mood</span>
        <span class="mood-drawer-active" id="moodDrawerActive"></span>
      </div>
      <div class="mood-drawer-list" id="moodDrawerList"></div>
    </div>
  </div>
  <div id="meet-chat-panel" class="meet-chat-panel" style="display:none;">
    <div class="panel-header">
      <span>${ICONS.chat} Chat</span>
      <button id="closeMeetChatBtn" class="panel-close-btn">✕</button>
    </div>
    <div id="meet-chat-select" class="meet-chat-select">
      <div class="meet-chat-hint">Select someone to chat with</div>
      <div id="meet-chat-user-list" class="meet-chat-user-list"></div>
    </div>
    <div id="meet-chat-active" class="meet-chat-active" style="display:none;">
      <div class="meet-chat-active-header" id="meetChatHeader">
        <button id="meetChatBackBtn" class="meet-chat-back">←</button>
        <div class="meet-chat-active-pic" id="meetChatPic"></div>
        <span class="meet-chat-active-name" id="meetChatName"></span>
        <div class="meet-chat-active-lock" id="meetChatLock" title="Private chat">🔒</div>
      </div>
      <div id="meet-chat-typing" class="chat-typing" style="display:none;">
        <div class="chat-typing-dots"><span></span><span></span><span></span></div>
        <span class="chat-typing-text" id="meetChatTypingText">typing…</span>
      </div>
      <div id="meet-chat-messages" class="meet-chat-messages"></div>
      <div class="meet-chat-input">
        <button class="meet-chat-attach-btn" id="meetChatAttachBtn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        </button>
        <input type="file" id="meetChatFileInput" style="display:none;" />
        <input type="text" id="meet-chat-input" placeholder="Type a message…" autocomplete="off" />
        <button class="meet-chat-send-btn" id="meetChatSendBtn">${ICONS.send}</button>
      </div>
    </div>
    <div id="meet-chat-guest-block" class="meet-chat-guest-block" style="display:none;">
      <div class="meet-chat-guest-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
      <div class="meet-chat-guest-text">This is a private chat</div>
      <button id="meetChatRequestBtn" class="meet-chat-request-btn">Request to Join</button>
      <div id="meetChatGuestStatus" class="meet-chat-guest-status"></div>
    </div>
    <div id="meet-chat-approve" class="meet-chat-approve" style="display:none;"></div>
  </div>
  <div class="controls">
    <button id="muteAudio" class="control-btn muted" title="Unmute"><span class="btn-icon">${ICONS.micOff}</span><span class="btn-label">Mute</span></button>
    <button id="muteVideo" class="control-btn video-off" title="Start Video"><span class="btn-icon">${ICONS.camOff}</span><span class="btn-label">Start Video</span></button>
    <button id="shareScreenBtn" class="control-btn share-btn" title="Share Screen"><span class="btn-icon">${ICONS.screen}</span><span class="btn-label" id="share-label">Share</span></button>
    <button id="meetChatBtn" class="control-btn share-btn" title="Chat"><span class="btn-icon">${ICONS.chat}</span><span class="btn-label">Chat</span></button>
    <button id="leaveBtn" class="control-btn leave" title="Leave"><span class="btn-icon">${ICONS.leave}</span><span class="btn-label">Leave</span></button>
  </div>

  <!-- Host Leave Modal -->
  <div id="hostLeaveOverlay" class="host-leave-overlay" style="display:none;">
    <div class="host-leave-modal">
      <h3>You are the host</h3>
      <p class="host-leave-desc">What should happen when you leave?</p>
      <div class="host-leave-options">
        <button class="host-leave-btn host-leave-end" id="hostEndNow">
          <span class="host-leave-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg></span>
          <span class="host-leave-text"><strong>End meeting now</strong><br><small>Everyone will be kicked out immediately</small></span>
        </button>
        <button class="host-leave-btn host-leave-timer" id="hostEndTimer">
          <span class="host-leave-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
          <span class="host-leave-text"><strong>Leave with timer</strong><br><small>Meeting ends after a set time</small></span>
        </button>
        <button class="host-leave-btn host-leave-keep" id="hostKeepAlive">
          <span class="host-leave-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>
          <span class="host-leave-text"><strong>Keep meeting alive</strong><br><small>Others can stay — meeting continues</small></span>
        </button>
      </div>
      <div class="host-timer-picker" id="hostTimerPicker" style="display:none;">
        <label>End meeting after:</label>
        <div class="host-timer-btns">
          <button class="host-timer-opt" data-mins="1">1 min</button>
          <button class="host-timer-opt" data-mins="3">3 min</button>
          <button class="host-timer-opt active" data-mins="5">5 min</button>
          <button class="host-timer-opt" data-mins="10">10 min</button>
          <button class="host-timer-opt" data-mins="15">15 min</button>
          <button class="host-timer-opt" data-mins="30">30 min</button>
        </div>
        <button class="host-timer-confirm" id="hostTimerConfirm">Leave & Start Timer</button>
      </div>
      <button class="host-leave-cancel" id="hostLeaveCancel">Cancel</button>
    </div>
  </div>

  <!-- Meeting Ended Overlay (for non-host participants) -->
  <div id="meetingEndedOverlay" class="meeting-ended-overlay" style="display:none;">
    <div class="meeting-ended-card">
      <div class="meeting-ended-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></div>
      <h3 id="meetingEndedTitle">Meeting has ended</h3>
      <p id="meetingEndedMsg">The host ended this meeting.</p>
      <div class="meeting-ended-countdown" id="meetingEndedCountdown" style="display:none;">
        <span>Leaving in </span><strong id="meetingEndedTimer">5</strong><span>s</span>
      </div>
      <button class="meeting-ended-btn" id="meetingEndedLeave">Leave Now</button>
    </div>
  </div>
</div>`;
}

export function buildScheduleModal() {
  return `
<div id="schedule-overlay" class="sched-overlay" style="display:none;">
  <div class="sched-modal">
    <div class="sched-header">
      <div class="sched-header-left">${ICONS.calendar}<span>Invite to Meeting</span></div>
      <button class="sched-close" id="schedClose">✕</button>
    </div>
    <div class="sched-body">
      <div class="sched-field">
        <label>INVITE BY MEETING ID <span class="req">*</span></label>
        <div class="sched-copy-wrap">
          <input id="sched-invite-id" placeholder="Enter their Meeting ID…" autocomplete="off" />
          <button class="sched-lookup-btn" id="schedLookupBtn">Look up</button>
        </div>
        <div class="sched-lookup-result" id="schedLookupResult" style="display:none;"></div>
      </div>
      <div class="sched-row">
        <div class="sched-field"><label>DATE <span class="req">*</span></label><input id="sched-date" type="date" /></div>
        <div class="sched-field"><label>TIME <span class="req">*</span></label><input id="sched-time" type="time" /></div>
      </div>
      <div class="sched-field"><label>MESSAGE <span class="optional">(optional)</span></label><textarea id="sched-message" placeholder="Hey, let's catch up! Join my meeting at…" rows="3"></textarea></div>
      <div class="sched-field">
        <label>YOUR MEETING ID</label>
        <div class="sched-copy-wrap"><input id="sched-meetid" readonly /><button class="sched-copy-btn" id="schedCopyId" title="Copy your Meeting ID">${ICONS.copy}</button></div>
      </div>
      <button class="sched-submit" id="schedSubmit">${ICONS.send} Send Invite</button>
    </div>
  </div>
</div>`;
}

export function buildSuccessToast() {
  return `
<div id="sched-success-toast" class="sched-toast" style="display:none;">
  <div class="sched-toast-inner">
    <div class="sched-toast-icon">${ICONS.check}</div>
    <div><div class="sched-toast-title">Request Sent!</div><div class="sched-toast-sub">Thank you — we'll get back to you soon.</div></div>
  </div>
</div>`;
}

export function buildScreenZoomOverlay() {
  return `
<div id="screen-zoom-overlay" class="screen-zoom-overlay" style="display:none;">
  <div class="screen-zoom-backdrop"></div>
  <div class="screen-zoom-modal">
    <div class="screen-zoom-header">
      <span class="screen-zoom-title">${ICONS.screen}<span id="screen-zoom-label">Screen Share</span></span>
      <div class="screen-zoom-controls">
        <button class="screen-zoom-btn" id="szoomOut" title="Zoom Out">${ICONS.zoomOut}</button>
        <span class="screen-zoom-level" id="szoom-level">100%</span>
        <button class="screen-zoom-btn" id="szoomIn" title="Zoom In">${ICONS.zoomIn}</button>
        <button class="screen-zoom-btn" id="szoomReset" title="Reset Zoom">${ICONS.zoomReset}</button>
        <button class="screen-zoom-btn" id="szoomFullscreen" title="Toggle Fullscreen">${ICONS.fullscreen}</button>
        <div class="screen-zoom-divider"></div>
        <button class="screen-zoom-btn screen-zoom-close-btn" id="szoomClose" title="Close">${ICONS.closeX}</button>
      </div>
    </div>
    <div class="screen-zoom-viewport" id="screen-zoom-viewport"><div class="screen-zoom-canvas" id="screen-zoom-canvas"></div></div>
    <div class="screen-zoom-hint">Double-click tile to open · Scroll to zoom · Drag to pan · F for fullscreen</div>
  </div>
</div>`;
}

export function buildNotifContainer() {
  return `<div id="notif-container" class="notif-container"></div>`;
}
