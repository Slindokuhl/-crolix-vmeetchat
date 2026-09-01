/**
 * src/ui/profileTemplates.js
 * HTML templates for profile dashboard, public profile, edit modal.
 */

import { ICONS } from "./icons.js";

function _renderBioText(text) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a class="bio-inline-link" href="$1" target="_blank" rel="noopener">$1</a>'
  ).replace(/\n/g, "<br>");
}

export function buildProfileDashboard(user) {
  const picHtml = user.profilePicBase64
    ? `<img src="${user.profilePicBase64}" alt="${user.name}" />`
    : `<div class="pic-fallback">${(user.name || "?").charAt(0).toUpperCase()}</div>`;

  return `
<div id="profile-screen" class="profile-screen">

  <!-- ══ PREMIUM SIDEBAR ══ -->
  <nav class="pnav">
    <div class="pnav-logo">
      <div class="pnav-logo-mark">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2.2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
      </div>
      <span class="pnav-logo-text">CrolixMeet</span>
    </div>

    <div class="pnav-user" id="sidebarAvatar" title="View profile">
      <div class="pnav-user-pic" id="sidebarCardPic">${picHtml}</div>
      <div class="pnav-user-info">
        <div class="pnav-user-name">${user.name}</div>
        <div class="pnav-user-status"><span class="pnav-online-dot"></span>Online</div>
      </div>
    </div>

    <!-- Profile popover (hidden by default) -->
    <div class="pnav-profile-card" id="sidebarProfileCard" style="display:none;">
      <div class="pnav-card-pic">${picHtml}</div>
      <div class="pnav-card-name">${user.name}</div>
      <div class="pnav-card-email">${user.email}</div>
      <div class="pnav-card-meetid"><span class="pnav-card-label">Meeting ID</span>${user.meetingId}</div>
      <div class="pnav-card-actions">
        <button class="pnav-card-btn" id="sidebarViewPic">View Photo</button>
        <button class="pnav-card-btn" id="sidebarGoHome" data-page="home">Go to Profile</button>
      </div>
    </div>

    <div class="pnav-links">
      <button class="pnav-btn active" data-page="home" title="Home">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        <span>Home</span>
      </button>
      <button class="pnav-btn" data-page="profile" title="My Profile">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Profile</span>
      </button>
      <button class="pnav-btn" data-page="chat" title="Chat">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>Chat</span>
      </button>
      <button class="pnav-btn" data-page="publicRoom" title="Public Room">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>Public</span>
      </button>
      <button class="pnav-btn" data-page="privateRoom" title="Private Room">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <span>Private</span>
      </button>
      <button class="pnav-btn" data-page="friends" title="Friends">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        <span>Friends</span>
        <span class="pnav-badge" id="pendingBadge" style="display:none;">0</span>
      </button>
      <button class="pnav-btn" data-page="categories" title="Categories">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span>Categories</span>
      </button>
      <button class="pnav-btn" data-page="find" title="Find Someone">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Find</span>
      </button>
    </div>

    <div class="pnav-bottom">
      <div class="pnav-meetid-chip">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        <span>${user.meetingId}</span>
      </div>
      <button class="pnav-btn" id="profileEditBtn" title="Edit Profile">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <span>Edit</span>
      </button>
      <button class="pnav-btn pnav-logout" id="profileLogoutBtn" title="Logout">
        ${ICONS.leave}
        <span>Logout</span>
      </button>
    </div>
  </nav>

  <!-- ── Mobile Bottom Bar ── -->
  <nav class="pmobile-bar">
    <button class="pmobile-btn active" data-page="home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    </button>
    <button class="pmobile-btn" data-page="profile">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </button>
    <button class="pmobile-btn" data-page="chat">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
    <button class="pmobile-btn" data-page="publicRoom">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
    </button>
    <button class="pmobile-btn" data-page="privateRoom">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
    </button>
    <button class="pmobile-btn" data-page="friends">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span class="pnav-badge pmobile-badge" id="pendingBadgeMobile" style="display:none;">0</span>
    </button>
    <button class="pmobile-btn" data-page="categories">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    </button>
    <button class="pmobile-btn" data-page="find">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </button>
  </nav>

  <!-- ── Main Content Area ── -->
  <main class="pmain">

    <!-- HOME PAGE -->
    <div class="ppage active" id="page-home">
      <div class="phome-scroll">

        <!-- ── HERO ── -->
        <div class="phome-hero">
          <div class="phome-hero-mesh"></div>
          <div class="phome-hero-inner">
            <div class="phome-avatar-wrap" id="heroProfilePic">
              <div class="phome-avatar-outer-ring"></div>
              <div class="phome-avatar-inner-ring">
                <div class="phome-avatar-img">${picHtml}</div>
              </div>
            </div>
            <div class="phome-hero-text">
              <h1 class="phome-hero-name" id="heroName">${user.name}</h1>
              <div class="phome-hero-email-row">
                <span class="phome-hero-email" id="heroEmail" data-email="${user.email}">••••••••••••••••••</span>
                <button class="phome-eye-btn" id="heroEmailToggle" title="Show/hide email">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button id="tourHelpBtn" title="Take the tour">?</button>
              </div>
              <div class="phome-meetid-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                <span id="heroMeetId">${user.meetingId}</span>
                <button class="phome-copy-btn" id="copyMeetIdBtn" title="Copy Meeting ID">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
              </div>
            </div>
          </div>
          <button class="phome-start-btn" id="profileStartMeeting">
            <span class="phome-start-shine"></span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            Start Meeting Now
          </button>
        </div>

        <!-- ── STATS ROW ── -->
        <div class="phome-stats">
          <div class="phome-stat-pill">
            <span class="phome-stat-num" id="statFriendsCount">0</span>
            <span class="phome-stat-label">Friends</span>
          </div>
          <div class="phome-stat-pill">
            <span class="phome-stat-num" id="statUnreadCount">—</span>
            <span class="phome-stat-label">Messages</span>
          </div>
          <div class="phome-stat-pill">
            <span class="phome-stat-num" id="statPostsCount">—</span>
            <span class="phome-stat-label">Posts</span>
          </div>
        </div>

        <!-- ── BENTO GRID ── -->
        <div class="phome-bento">

          <div class="phbc phome-feat-card" data-feat="chat" style="--delay:0ms">
            <div class="phbc-icon" style="--c1:#6366f1;--c2:#818cf8;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="phbc-body">
              <div class="phbc-title">Messages</div>
              <div class="phbc-desc">Chat one-on-one or in groups</div>
            </div>
            <svg class="phbc-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

          <div class="phbc phome-feat-card" data-feat="publicRoom" style="--delay:80ms">
            <div class="phbc-icon" style="--c1:#10b981;--c2:#34d399;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <div class="phbc-body">
              <div class="phbc-title">Share Moments</div>
              <div class="phbc-desc">Post publicly</div>
            </div>
          </div>

          <div class="phbc phome-feat-card" data-feat="friends" style="--delay:160ms">
            <div class="phbc-icon" style="--c1:#3b82f6;--c2:#60a5fa;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div class="phbc-body">
              <div class="phbc-title">Friends</div>
              <div class="phbc-desc">Connect &amp; manage your network</div>
            </div>
          </div>

          <div class="phbc phome-feat-card" data-feat="privateRoom" style="--delay:240ms">
            <div class="phbc-icon" style="--c1:#f97316;--c2:#fb923c;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div class="phbc-body">
              <div class="phbc-title">Private Vault</div>
              <div class="phbc-desc">Your secret space</div>
            </div>
          </div>

          <div class="phbc phome-feat-card" data-feat="find" style="--delay:320ms">
            <div class="phbc-icon" style="--c1:#ec4899;--c2:#f472b6;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <div class="phbc-body">
              <div class="phbc-title">Find People</div>
              <div class="phbc-desc">Discover by Meeting ID</div>
            </div>
          </div>

          <div class="phbc phome-feat-card" data-feat="schedule" style="--delay:400ms">
            <div class="phbc-icon" style="--c1:#8b5cf6;--c2:#a78bfa;">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div class="phbc-body">
              <div class="phbc-title">Schedule</div>
              <div class="phbc-desc">Plan &amp; invite for future meetings</div>
            </div>
            <svg class="phbc-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>

        </div>

      </div>
    </div>

    <!-- PROFILE PAGE -->
    <div class="ppage" id="page-profile">
      <div class="ppage-inner">

        <!-- Profile card -->
        <div class="pprofile-hero">
          <div class="pprofile-avatar">${picHtml}</div>
          <div class="pprofile-info">
            <div class="pprofile-name">${user.name}</div>
            <div class="pprofile-email">${user.email}</div>
            <div class="pprofile-meetid-row">
              <span class="pprofile-meetid-chip">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                ${user.meetingId}
              </span>
            </div>
          </div>
          <button class="pprofile-edit-btn" id="profilePageEditBtn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Profile
          </button>
        </div>

        <!-- About Me -->
        <div class="phome-about" id="profileBioCard" style="margin:0 0 16px;">
          <div class="phome-about-header">
            <span class="phome-about-title">About Me</span>
            <button class="phome-about-edit" id="editBioBtn">✎ Edit</button>
          </div>
          <div class="phome-about-bio" id="bioText">
            <span class="bio-placeholder">Tell the world about yourself — add a bio, your interests, and links!</span>
          </div>
          <div class="phome-about-interests" id="bioInterests"></div>
          <div class="phome-about-links" id="bioLinks"></div>
        </div>

      </div>
    </div>

    <!-- CHAT PAGE -->
    <div class="ppage ppage-chat" id="page-chat">
      <div class="ppage-inner ppage-chat-inner"></div>
    </div>

    <!-- PUBLIC ROOM PAGE -->
    <div class="ppage" id="page-publicRoom">
      <div class="ppage-inner">
        <div class="ppage-header">
          <div>
            <h2 class="ppage-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px;opacity:0.7;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Public Room</h2>
            <p class="ppage-subtitle">Your public uploads — visible to everyone who visits your profile</p>
          </div>
          <button class="room-upload-btn" id="publicUploadBtn">+ New Post</button>
        </div>
        <div class="room-post-grid" id="publicRoomGrid"></div>
        <div class="profile-empty" id="publicRoomEmpty"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></div>Your public room is empty.<br>Upload photos, videos, or thoughts for everyone to see!</div>
      </div>
    </div>

    <!-- PRIVATE ROOM PAGE -->
    <div class="ppage" id="page-privateRoom">
      <div class="ppage-inner">
        <div class="ppage-header">
          <div>
            <h2 class="ppage-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px;opacity:0.7;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Private Room</h2>
            <p class="ppage-subtitle">Your private vault — only you and people you grant access can see</p>
          </div>
          <div class="ppage-header-actions">
            <button class="room-upload-btn" id="privateUploadBtn">+ New Post</button>
            <button class="room-access-btn" id="manageAccessBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>Manage Access</button>
          </div>
        </div>
        <div class="room-post-grid" id="privateRoomGrid"></div>
        <div class="profile-empty" id="privateRoomEmpty"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>Your private vault is empty.<br>Upload anything here — it stays between you and those you allow.</div>
      </div>
    </div>

    <!-- FRIENDS PAGE -->
    <div class="ppage" id="page-friends">
      <div class="ppage-inner">
        <div class="ppage-header">
          <h2 class="ppage-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px;opacity:0.7;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Friends</h2>
        </div>
        <div class="pfriends-tabs">
          <button class="pfriends-tab active" data-ftab="friendsList">All Friends</button>
          <button class="pfriends-tab" data-ftab="pendingList">Requests <span class="pnav-badge pfriends-badge" id="pendingBadgeInline" style="display:none;">0</span></button>
          <button class="pfriends-tab" data-ftab="sentList">Sent <span class="pnav-badge pfriends-badge" id="sentBadge" style="display:none;">0</span></button>
          <button class="pfriends-tab" data-ftab="blockedList">Blocked</button>
        </div>
        <div class="pfriends-panel active" id="ftab-friendsList">
          <div class="profile-user-list" id="friendsList"></div>
          <div class="profile-empty" id="friendsEmpty"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>No friends yet.<br>Use the Find page to search for people!</div>
        </div>
        <div class="pfriends-panel" id="ftab-pendingList">
          <div class="profile-user-list" id="pendingList"></div>
          <div class="profile-empty" id="pendingEmpty"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg></div>No pending friend requests.</div>
        </div>
        <div class="pfriends-panel" id="ftab-sentList">
          <div class="profile-user-list" id="sentList"></div>
          <div class="profile-empty" id="sentEmpty"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></div>No pending sent requests.</div>
        </div>
        <div class="pfriends-panel" id="ftab-blockedList">
          <div class="profile-user-list" id="blockedList"></div>
          <div class="profile-empty" id="blockedEmpty"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg></div>No blocked users.</div>
        </div>
      </div>
    </div>

    <!-- FRIEND PROFILE PAGE (dynamic) -->
    <div class="ppage" id="page-friendProfile">
      <div class="ppage-inner">
        <button class="pfp-back-btn" id="friendProfileBack">← Back to Friends</button>
        <div id="friendProfileContent"></div>
      </div>
    </div>

    <!-- CATEGORIES PAGE -->
    <div class="ppage" id="page-categories">
      <div class="ppage-inner"></div>
    </div>

    <!-- FIND PAGE -->
    <div class="ppage" id="page-find">
      <div class="ppage-inner ppage-center">
        <div class="pfind-card">
          <h2 class="ppage-title" style="margin-bottom:4px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px;opacity:0.7;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Find Someone</h2>
          <p class="ppage-subtitle">Search by Meeting ID to find and connect with people</p>
          <div class="pfind-search">
            <input type="text" id="findMeetIdInput" placeholder="Enter a Meeting ID…" autocomplete="off" />
            <button class="pfind-search-btn" id="findSearchBtn">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
          </div>
          <div id="findResults"></div>
        </div>
      </div>
    </div>

  </main>

  <!-- Incoming call overlay -->
  <div class="call-overlay" id="incomingCallOverlay" style="display:none;">
    <div class="call-card call-incoming">
      <div class="call-pulse-ring"></div>
      <div class="call-avatar" id="inCallAvatar"></div>
      <div class="call-name" id="inCallName">Someone</div>
      <div class="call-label">is calling you…</div>
      <div class="call-actions">
        <button class="call-btn call-answer" id="inCallAnswer">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          Answer
        </button>
        <button class="call-btn call-decline" id="inCallDecline">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M15 10l4.553-2.276A1 1 0 0 1 21 8.723v6.554a1 1 0 0 1-1.447.894L15 14"/><rect x="1" y="6" width="14" height="12" rx="2" ry="2"/></svg>
          Decline
        </button>
      </div>
    </div>
  </div>

  <!-- Outgoing call overlay -->
  <div class="call-overlay" id="outgoingCallOverlay" style="display:none;">
    <div class="call-card call-outgoing">
      <div class="call-pulse-ring"></div>
      <div class="call-avatar" id="outCallAvatar"></div>
      <div class="call-name" id="outCallName">Someone</div>
      <div class="call-label" id="outCallStatus">Calling…</div>
      <button class="call-btn call-decline call-cancel-btn" id="outCallCancel">Cancel</button>
    </div>
  </div>
</div>`;
}

export function buildEditProfileModal(user) {
  const picHtml = user.profilePicBase64
    ? `<img src="${user.profilePicBase64}" alt="${user.name}" />`
    : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);">${(user.name || "?").charAt(0).toUpperCase()}</div>`;

  return `
<div class="edit-profile-overlay" id="editProfileOverlay">
  <div class="edit-profile-modal">
    <h3>Edit Profile</h3>
    <div class="auth-error" id="edit-error"></div>

    <div class="auth-avatar-upload">
      <div class="auth-avatar-preview has-image" id="editAvatarPreview">${picHtml}</div>
      <input type="file" accept="image/*" class="auth-avatar-input" id="editAvatarInput" />
      <label class="auth-avatar-label" for="editAvatarInput">Change Photo</label>
    </div>

    <div class="auth-field">
      <div class="bio-label-row">
        <label>Full Name</label>
        <button class="ep-trigger-btn" id="nameEmojiBtn" title="Insert emoji" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
      </div>
      <input type="text" id="editNameInput" value="${user.name}" />
    </div>

    <div class="auth-field">
      <label>Email (cannot be changed)</label>
      <input type="email" value="${user.email}" disabled style="opacity:0.5;cursor:not-allowed;" />
    </div>

    <div class="auth-field">
      <label>Meeting ID (cannot be changed)</label>
      <input type="text" value="${user.meetingId}" disabled style="opacity:0.5;cursor:not-allowed;" />
    </div>

    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="auth-submit" id="editSaveBtn" style="flex:1;">Save Changes</button>
      <button class="auth-submit" id="editCancelBtn" style="flex:1;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Cancel</button>
    </div>
    ${user.isPremium
      ? `<button class="auth-submit" id="upgradePremiumBtn" type="button" disabled style="margin-top:12px;width:100%;background:rgba(251,191,36,0.12);color:#fbbf24;border:1px solid rgba(251,191,36,0.35);cursor:default;">✓ Premium Account — Unlimited Meetings</button>`
      : `<button class="auth-submit" id="upgradePremiumBtn" type="button" style="margin-top:12px;width:100%;background:linear-gradient(135deg,#f59e0b,#fbbf24);color:#1a1200;">Upgrade to Premium — $9.99/mo</button>`}
    <button class="bio-edit-btn" id="resetVaultAccessBtn" type="button" style="margin-top:12px;width:100%;">Reset Hidden Vault Access</button>
  </div>
</div>`;
}

export function buildUserItem(user, actions) {
  const picHtml = user.profilePicBase64
    ? `<img src="${user.profilePicBase64}" alt="${user.name}" />`
    : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);font-size:16px;">${(user.name || "?").charAt(0).toUpperCase()}</div>`;

  const btnsHtml = actions.map(a =>
    `<button class="profile-user-btn ${a.cls}" data-action="${a.action}" data-uid="${user.odoo || user.meetingId}">${a.label}</button>`
  ).join("");

  return `
<div class="profile-user-item" data-meetid="${user.meetingId}">
  <div class="profile-user-pic">${picHtml}</div>
  <div class="profile-user-info">
    <div class="profile-user-name">${user.name}</div>
    <div class="profile-user-meetid">${user.meetingId}</div>
  </div>
  <div class="profile-user-actions">${btnsHtml}</div>
</div>`;
}

export function buildEditBioModal(userData) {
  const bio = userData?.bio || "";
  const interests = (userData?.interests || []).join(", ");
  const links = userData?.links || [];
  const linksHtml = links.map((l, i) => `
    <div class="bio-link-row" data-idx="${i}">
      <input type="text" class="bio-link-label-input" value="${l.label || ""}" placeholder="Label (e.g. Portfolio)" />
      <input type="url" class="bio-link-url-input" value="${l.url || ""}" placeholder="https://..." />
      <button class="bio-link-remove" data-idx="${i}">✕</button>
    </div>`).join("");

  return `
<div class="edit-profile-overlay" id="editBioOverlay">
  <div class="edit-bio-modal">
    <h3>Customize Your Profile</h3>
    <p class="edit-bio-subtitle">Express yourself — this is what people see when they visit you</p>
    <div class="auth-error" id="bio-error"></div>

    <div class="auth-field">
      <div class="bio-label-row">
        <label>Bio <span class="bio-char-hint" id="bioCharCount">${bio.length}/300</span></label>
        <button class="ep-trigger-btn" id="bioEmojiBtn" title="Insert emoji" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
      </div>
      <textarea id="bioTextInput" class="bio-textarea" maxlength="300" placeholder="Hey there! 👋 I'm a creative soul who loves tech, music, and good vibes...">${bio}</textarea>
    </div>

    <div class="auth-field">
      <div class="bio-label-row">
        <label>Interests <span class="bio-char-hint">Comma separated</span></label>
        <button class="ep-trigger-btn" id="interestsEmojiBtn" title="Insert emoji" type="button">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
      </div>
      <input type="text" id="bioInterestsInput" value="${interests}" placeholder="🎮 Gaming, 🎵 Music, 💻 Coding, 📸 Photography..." />
    </div>

    <div class="auth-field">
      <label>Links</label>
      <div class="bio-links-editor" id="bioLinksEditor">${linksHtml}</div>
      <button class="bio-add-link-btn" id="bioAddLinkBtn">+ Add Link</button>
    </div>

    <div style="display:flex;gap:10px;margin-top:12px;">
      <button class="auth-submit" id="bioSaveBtn" style="flex:1;">Save</button>
      <button class="auth-submit" id="bioCancelBtn" style="flex:1;background:var(--bg-card);color:var(--text-soft);border:1px solid var(--border-soft);">Cancel</button>
    </div>
  </div>
</div>`;
}

export function buildPublicProfile(user, relationship) {
  const picHtml = user.profilePicBase64
    ? `<img src="${user.profilePicBase64}" alt="${user.name}" />`
    : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);">${(user.name || "?").charAt(0).toUpperCase()}</div>`;

  let actionsHtml = "";
  if (relationship === "friend") {
    actionsHtml = `
      <button class="profile-action-btn start-meeting" id="publicCallBtn">▶ Call</button>
      <button class="profile-action-btn edit-profile" id="publicRemoveFriend" style="color:#f87171;border-color:rgba(239,68,68,0.3);">Remove Friend</button>`;
  } else if (relationship === "pending-sent") {
    actionsHtml = `
      <button class="profile-action-btn start-meeting" id="publicCallBtn">▶ Call</button>
      <button class="profile-action-btn edit-profile profile-user-btn pending-sent" style="cursor:default;opacity:0.6;">Request Sent</button>`;
  } else if (relationship === "pending-received") {
    actionsHtml = `
      <button class="profile-action-btn start-meeting" id="publicCallBtn">▶ Call</button>
      <button class="profile-action-btn edit-profile" id="publicAcceptFriend" style="background:rgba(34,197,94,0.15);color:#4ade80;border-color:rgba(34,197,94,0.35);">Accept Request</button>`;
  } else {
    actionsHtml = `
      <button class="profile-action-btn start-meeting" id="publicCallBtn">▶ Call</button>
      <button class="profile-action-btn edit-profile" id="publicAddFriend">+ Add Friend</button>`;
  }

  const bio = user.bio || "";
  const interests = user.interests || [];
  const links = user.links || [];

  const bioHtml = bio ? `<div class="public-bio-text">${_renderBioText(bio)}</div>` : "";
  const interestsHtml = interests.length
    ? `<div class="bio-interests">${interests.map(t => `<span class="bio-tag">${t}</span>`).join("")}</div>` : "";
  const linksHtml = links.length
    ? `<div class="bio-links">${links.map(l => `<a class="bio-link-pill" href="${l.url}" target="_blank" rel="noopener">${l.label || l.url}</a>`).join("")}</div>` : "";

  return `
<div class="public-profile-card">
  <div class="profile-hero-pic">${picHtml}</div>
  <div class="profile-hero-name">${user.name}</div>
  <div class="profile-hero-email" style="color:var(--accent-light);font-weight:600;">${user.meetingId}</div>
  ${bioHtml}${interestsHtml}${linksHtml}
  <div class="public-profile-actions">${actionsHtml}</div>
  <button class="room-view-room-btn" id="publicViewRoomBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>View Public Room</button>
  <div class="room-post-grid" id="publicProfileRoomGrid" style="width:100%;margin-top:4px;"></div>
</div>`;
}

export function buildFriendProfilePage(user, relationship, hasPrivateAccess) {
  const picHtml = user.profilePicBase64
    ? `<img src="${user.profilePicBase64}" alt="${user.name}" />`
    : `<div class="pic-fallback" style="background:linear-gradient(135deg,#6366f1,#818cf8);">${(user.name || "?").charAt(0).toUpperCase()}</div>`;

  const bio = user.bio || "";
  const interests = user.interests || [];
  const links = user.links || [];

  const bioHtml = bio ? `<div class="pfp-bio">${_renderBioText(bio)}</div>` : "";
  const interestsHtml = interests.length
    ? `<div class="bio-interests" style="justify-content:center;">${interests.map(t => `<span class="bio-tag">${t}</span>`).join("")}</div>` : "";
  const linksHtml = links.length
    ? `<div class="bio-links" style="justify-content:center;">${links.map(l => `<a class="bio-link-pill" href="${l.url}" target="_blank" rel="noopener">${l.label || l.url}</a>`).join("")}</div>` : "";

  let friendActions = "";
  if (relationship === "friend") {
    friendActions = `
      <button class="profile-action-btn start-meeting" id="fpCallBtn" data-meetid="${user.meetingId}">▶ Call</button>
      <button class="profile-action-btn edit-profile" id="fpRemoveBtn" data-userid="${user.userId}" style="color:#f87171;border-color:rgba(239,68,68,0.3);">Remove Friend</button>`;
  } else if (relationship === "pending-sent") {
    friendActions = `
      <button class="profile-action-btn start-meeting" id="fpCallBtn" data-meetid="${user.meetingId}">▶ Call</button>
      <button class="profile-action-btn edit-profile" style="cursor:default;opacity:0.6;">Request Sent</button>`;
  } else {
    friendActions = `
      <button class="profile-action-btn start-meeting" id="fpCallBtn" data-meetid="${user.meetingId}">▶ Call</button>
      <button class="profile-action-btn edit-profile" id="fpAddBtn" data-userid="${user.userId}">+ Add Friend</button>`;
  }

  const privateTab = hasPrivateAccess
    ? `<button class="pfp-room-tab" data-room="private"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px;opacity:0.7;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Private Room</button>` : "";

  return `
<div class="pfp-hero">
  <div class="pfp-hero-pic">${picHtml}</div>
  <div class="pfp-hero-name">${user.name}</div>
  <div class="pfp-hero-meetid">${user.meetingId}</div>
  ${bioHtml}${interestsHtml}${linksHtml}
  <div class="pfp-actions">${friendActions}</div>
</div>

<div class="pfp-rooms">
  <div class="pfp-room-tabs">
    <button class="pfp-room-tab active" data-room="public"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px;opacity:0.7;"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>Public Room</button>
    ${privateTab}
  </div>
  <div class="pfp-room-panel active" id="fpRoom-public">
    <div class="room-post-grid" id="fpPublicGrid"></div>
    <div class="profile-empty" id="fpPublicEmpty" style="display:none;"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>No public posts yet</div>
  </div>
  ${hasPrivateAccess ? `
  <div class="pfp-room-panel" id="fpRoom-private">
    <div class="room-post-grid" id="fpPrivateGrid"></div>
    <div class="profile-empty" id="fpPrivateEmpty" style="display:none;"><div class="profile-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent-light)" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>No private posts shared with you</div>
  </div>` : ""}
</div>`;
}
