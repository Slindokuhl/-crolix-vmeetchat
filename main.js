/**
 * main.js — App bootstrap entry point.
 * Routes: Auth → Profile Dashboard → Video Call
 */
import { VideoCall } from "./src/controllers/VideoCall.js";
import { AuthController } from "./src/controllers/AuthController.js";
import { ProfileController } from "./src/controllers/ProfileController.js";

window.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");
  let videoCall = null;
  let profileCtrl = null;

  function showAuth() {
    const auth = new AuthController(app, (session) => {
      showProfile(session);
    });
    auth.show();
  }

  async function showProfile(session) {
    profileCtrl = new ProfileController(
      app,
      (meetingId, userName) => startMeeting(meetingId, userName),
      () => showAuth()
    );
    await profileCtrl.show(session);

    const params = new URLSearchParams(window.location.search);
    const joinGroupCode = params.get("joinGroup");
    if (joinGroupCode) {
      window.history.replaceState({}, "", window.location.pathname);
      profileCtrl.handleGroupInviteFromUrl(joinGroupCode);
    }
  }

  function startMeeting(meetingId, userName) {
    app.innerHTML = "";
    videoCall = new VideoCall("app");

    const session = AuthController.getSession();
    if (session) {
      videoCall._userSession = session;
    }

    // Pre-fill and auto-join
    const nameInput = app.querySelector("#username");
    const channelInput = app.querySelector("#channelName");
    if (nameInput) nameInput.value = userName;
    if (channelInput) channelInput.value = meetingId;

    // Override leave to go back to profile
    const origLeave = videoCall.leaveChannel.bind(videoCall);
    videoCall.leaveChannel = function () {
      origLeave();
      setTimeout(() => {
        const session = AuthController.getSession();
        if (session) showProfile(session);
      }, 500);
    };

    // Back button on join screen — only when logged in
    if (localStorage.getItem("crolixUser")) {
      const backBtn = app.querySelector("#joinBackBtn");
      if (backBtn) {
        backBtn.style.display = "flex";
        backBtn.addEventListener("click", () => {
          const s = AuthController.getSession();
          if (s) showProfile(s);
        });
        backBtn.addEventListener("mouseover", () => { backBtn.style.background = "rgba(255,255,255,0.14)"; });
        backBtn.addEventListener("mouseout", () => { backBtn.style.background = "rgba(255,255,255,0.07)"; });
      }
    }
  }

  // Check for existing session
  const session = AuthController.getSession();
  if (session) {
    showProfile(session);
  } else {
    showAuth();
  }
});
