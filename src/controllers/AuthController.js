/**
 * src/controllers/AuthController.js
 * Sign up, login, OTP verification, session management.
 */

import { FIREBASE_CONFIG, EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST } from "../config/config.js";
import { buildAuthChoiceScreen, buildSignupScreen, buildLoginScreen, buildOTPScreen } from "../ui/authTemplates.js";

const SESSION_KEY = "crolixUser";

export class AuthController {
  constructor(container, onAuthComplete) {
    this.container = container;
    this.onAuthComplete = onAuthComplete;
    this._db = null;
    this._emailjsReady = false;
    this._meetIdCheckTimer = null;
    this._meetIdAvailable = false;
    this._profilePicBase64 = null;
    this._pendingOtpEmail = null;
    this._init();
  }

  _init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._db = firebase.firestore();
    this._initEmailJS();
  }

  _initEmailJS() {
    if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); this._emailjsReady = true; return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload = () => { window.emailjs.init(EMAILJS_PUBLIC_KEY); this._emailjsReady = true; };
    document.head.appendChild(s);
  }

  static getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (_) { return null; }
  }

  static clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  _saveSession(user) {
    const session = {
      userId: user.userId,
      name: user.name,
      email: user.email,
      meetingId: user.meetingId,
      profilePicBase64: user.profilePicBase64 || null,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  show() {
    this._renderChoice();
  }

  // ── Choice screen ──────────────────────────────────────────
  _renderChoice() {
    this.container.innerHTML = buildAuthChoiceScreen();
    const screen = this.container.querySelector("#auth-screen");
    screen.querySelector("#authGoSignup").onclick = () => this._renderSignup(screen);
    screen.querySelector("#authGoLogin").onclick = () => this._renderLogin(screen);
  }

  // ── Sign Up ────────────────────────────────────────────────
  _renderSignup(screen) {
    const choice = screen.querySelector("#auth-choice");
    if (choice) choice.remove();
    screen.insertAdjacentHTML("beforeend", buildSignupScreen());
    this._profilePicBase64 = null;
    this._meetIdAvailable = false;

    const card = screen.querySelector("#auth-signup-card");
    card.querySelector("#signupBack").onclick = () => this._renderChoice();
    card.querySelector("#signupToLogin").onclick = () => { card.remove(); this._renderLogin(screen); };

    // Avatar upload
    const preview = card.querySelector("#avatarPreview");
    const fileInput = card.querySelector("#avatarInput");
    preview.onclick = () => fileInput.click();
    fileInput.onchange = () => this._handleAvatarSelect(fileInput, preview);

    // Meeting ID availability check
    const meetIdInput = card.querySelector("#signupMeetId");
    meetIdInput.addEventListener("input", () => {
      meetIdInput.value = meetIdInput.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
      this._debounceMeetIdCheck(meetIdInput.value.trim());
    });

    // Submit
    card.querySelector("#signupSubmit").onclick = () => this._handleSignup(card);
  }

  _handleAvatarSelect(fileInput, preview) {
    const file = fileInput.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 256;
        let w = img.width, h = img.height;
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.7);
        this._profilePicBase64 = compressed;
        preview.innerHTML = `<img src="${compressed}" alt="Profile" />`;
        preview.classList.add("has-image");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  _debounceMeetIdCheck(value) {
    clearTimeout(this._meetIdCheckTimer);
    const status = this.container.querySelector("#meetidStatus");
    const field = this.container.querySelector("#field-meetid");
    if (!status) return;

    if (!value || value.length < 3) {
      status.textContent = "";
      status.className = "auth-meetid-status";
      this._meetIdAvailable = false;
      return;
    }

    if (!/^[a-z0-9-]{3,30}$/.test(value)) {
      status.textContent = "✗";
      status.className = "auth-meetid-status taken";
      this._meetIdAvailable = false;
      field.classList.add("has-error");
      field.querySelector(".field-error").textContent = "Only lowercase letters, numbers and hyphens (3-30 chars)";
      return;
    }

    field.classList.remove("has-error");
    status.textContent = "⟳";
    status.className = "auth-meetid-status checking";

    this._meetIdCheckTimer = setTimeout(async () => {
      try {
        const doc = await this._db.collection("meetingIds").doc(value).get();
        if (doc.exists) {
          status.textContent = "✗";
          status.className = "auth-meetid-status taken";
          this._meetIdAvailable = false;
          field.classList.add("has-error");
          field.querySelector(".field-error").textContent = "This Meeting ID is already taken";
        } else {
          status.textContent = "✓";
          status.className = "auth-meetid-status available";
          this._meetIdAvailable = true;
          field.classList.remove("has-error");
        }
      } catch (_) {
        status.textContent = "";
        status.className = "auth-meetid-status";
      }
    }, 500);
  }

  async _handleSignup(card) {
    const name = card.querySelector("#signupName").value.trim();
    const email = card.querySelector("#signupEmail").value.trim();
    const meetId = card.querySelector("#signupMeetId").value.trim();
    const errBanner = card.querySelector("#signup-error");
    const btn = card.querySelector("#signupSubmit");

    // Clear errors
    card.querySelectorAll(".auth-field").forEach(f => f.classList.remove("has-error"));
    errBanner.classList.remove("visible");

    // Validate
    let hasError = false;
    if (!name) { this._fieldError(card, "field-fullname", "Name is required"); hasError = true; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this._fieldError(card, "field-email", "Enter a valid email address"); hasError = true; }
    if (!meetId || !/^[a-z0-9-]{3,30}$/.test(meetId)) { this._fieldError(card, "field-meetid", "3-30 characters, lowercase letters, numbers and hyphens only"); hasError = true; }
    if (!this._profilePicBase64) {
      errBanner.textContent = "Please upload a profile picture";
      errBanner.classList.add("visible");
      hasError = true;
    }
    if (!this._meetIdAvailable) { this._fieldError(card, "field-meetid", "This Meeting ID is not available"); hasError = true; }
    if (hasError) return;

    btn.disabled = true; btn.textContent = "Creating account…";

    try {
      // Check email uniqueness
      const emailCheck = await this._db.collection("users").where("email", "==", email).limit(1).get();
      if (!emailCheck.empty) {
        errBanner.textContent = "An account with this email already exists. Try logging in.";
        errBanner.classList.add("visible");
        btn.disabled = false; btn.textContent = "Create Account";
        return;
      }

      // Double-check meeting ID
      const meetIdDoc = await this._db.collection("meetingIds").doc(meetId).get();
      if (meetIdDoc.exists) {
        this._fieldError(card, "field-meetid", "This Meeting ID is already taken");
        btn.disabled = false; btn.textContent = "Create Account";
        return;
      }

      // Create user document
      const userRef = this._db.collection("users").doc();
      const userId = userRef.id;
      const userData = {
        name,
        email,
        meetingId: meetId,
        profilePicBase64: this._profilePicBase64,
        friends: [],
        blocked: [],
        pendingFriends: [],
        isPremium: false,
        createdAt: Date.now(),
      };
      await userRef.set(userData);

      // Reserve meeting ID
      await this._db.collection("meetingIds").doc(meetId).set({ userId, email });

      // Send welcome email
      this._sendWelcomeEmail(name, email, meetId);

      // Save session and redirect
      const session = this._saveSession({ userId, name, email, meetingId: meetId, profilePicBase64: this._profilePicBase64 });
      this.onAuthComplete(session);
    } catch (err) {
      console.error("Signup error:", err);
      errBanner.textContent = "Something went wrong. Please try again.";
      errBanner.classList.add("visible");
      btn.disabled = false; btn.textContent = "Create Account";
    }
  }

  _sendWelcomeEmail(name, email, meetId) {
    if (!this._emailjsReady || !window.emailjs) return;
    window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, {
      to_email: email,
      from_name: "CrolixMeet",
      subject: "Welcome to CrolixMeet",
      meeting_id: meetId,
      message: `Welcome to CrolixMeet, ${name}! Your unique Meeting ID is: ${meetId}. Share it with friends so they can find you and start video calls instantly.`,
      date_time: new Date().toLocaleString(),
      guest_email: email,
      initials: name.split(" ").map(w => w[0]).join("").toUpperCase(),
    }).catch(err => console.warn("Welcome email failed:", err));
  }

  // ── Login ──────────────────────────────────────────────────
  _renderLogin(screen) {
    const choice = screen.querySelector("#auth-choice");
    if (choice) choice.remove();
    const existingCard = screen.querySelector(".auth-card");
    if (existingCard) existingCard.remove();
    screen.insertAdjacentHTML("beforeend", buildLoginScreen());

    const card = screen.querySelector("#auth-login-card");
    card.querySelector("#loginBack").onclick = () => this._renderChoice();
    card.querySelector("#loginToSignup").onclick = () => { card.remove(); this._renderSignup(screen); };
    card.querySelector("#loginSubmit").onclick = () => this._handleLogin(card, screen);
    card.querySelector("#loginEmail").onkeydown = (e) => { if (e.key === "Enter") this._handleLogin(card, screen); };
  }

  async _handleLogin(card, screen) {
    const email = card.querySelector("#loginEmail").value.trim();
    const errBanner = card.querySelector("#login-error");
    const btn = card.querySelector("#loginSubmit");

    card.querySelectorAll(".auth-field").forEach(f => f.classList.remove("has-error"));
    errBanner.classList.remove("visible");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this._fieldError(card, "field-login-email", "Enter a valid email address");
      return;
    }

    btn.disabled = true; btn.textContent = "Checking…";

    try {
      // Check user exists
      const snapshot = await this._db.collection("users").where("email", "==", email).limit(1).get();
      if (snapshot.empty) {
        errBanner.textContent = "No account found with this email. Please sign up first.";
        errBanner.classList.add("visible");
        btn.disabled = false; btn.textContent = "Send Login Code";
        return;
      }

      // Generate OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000;

      // Store OTP in Firestore
      await this._db.collection("otpCodes").doc(email).set({ otp, expiresAt, email });

      // Send OTP email
      if (this._emailjsReady && window.emailjs) {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, {
          to_email: email,
          from_name: "CrolixMeet",
          subject: "Your CrolixMeet Login Code",
          meeting_id: otp,
          message: `Your CrolixMeet login code is: ${otp}. This code expires in 10 minutes. If you didn't request this, please ignore this email.`,
          date_time: new Date().toLocaleString(),
          guest_email: email,
          initials: "OTP",
        });
      }

      this._pendingOtpEmail = email;
      card.remove();
      this._renderOTP(screen, email);
    } catch (err) {
      console.error("Login error:", err);
      errBanner.textContent = "Something went wrong. Please try again.";
      errBanner.classList.add("visible");
      btn.disabled = false; btn.textContent = "Send Login Code";
    }
  }

  // ── OTP Verification ──────────────────────────────────────
  _renderOTP(screen, email) {
    screen.insertAdjacentHTML("beforeend", buildOTPScreen(email));
    const card = screen.querySelector("#auth-otp-card");

    card.querySelector("#otpBack").onclick = () => { card.remove(); this._renderLogin(screen); };

    // Auto-focus and auto-advance OTP inputs
    const inputs = card.querySelectorAll("#otpInputs input");
    inputs.forEach((inp, i) => {
      inp.addEventListener("input", () => {
        inp.value = inp.value.replace(/[^0-9]/g, "");
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
      });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus();
      });
      inp.addEventListener("paste", (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "").slice(0, 6);
        pasted.split("").forEach((ch, j) => { if (inputs[j]) inputs[j].value = ch; });
        if (pasted.length > 0) inputs[Math.min(pasted.length, inputs.length) - 1].focus();
      });
    });
    inputs[0].focus();

    card.querySelector("#otpSubmit").onclick = () => this._handleOTPVerify(card, screen, email);
    card.querySelector("#otpResend").onclick = () => this._handleOTPResend(email, card);
  }

  async _handleOTPVerify(card, screen, email) {
    const inputs = card.querySelectorAll("#otpInputs input");
    const code = Array.from(inputs).map(i => i.value).join("");
    const errBanner = card.querySelector("#otp-error");
    const btn = card.querySelector("#otpSubmit");

    errBanner.classList.remove("visible");

    if (code.length !== 6) {
      errBanner.textContent = "Please enter all 6 digits";
      errBanner.classList.add("visible");
      return;
    }

    btn.disabled = true; btn.textContent = "Verifying…";

    try {
      const otpDoc = await this._db.collection("otpCodes").doc(email).get();
      if (!otpDoc.exists) {
        errBanner.textContent = "No verification code found. Please request a new one.";
        errBanner.classList.add("visible");
        btn.disabled = false; btn.textContent = "Verify & Login";
        return;
      }

      const otpData = otpDoc.data();
      if (Date.now() > otpData.expiresAt) {
        errBanner.textContent = "Code expired. Please request a new one.";
        errBanner.classList.add("visible");
        btn.disabled = false; btn.textContent = "Verify & Login";
        return;
      }

      if (otpData.otp !== code) {
        errBanner.textContent = "Incorrect code. Please try again.";
        errBanner.classList.add("visible");
        btn.disabled = false; btn.textContent = "Verify & Login";
        return;
      }

      // OTP valid — delete it and log in
      await this._db.collection("otpCodes").doc(email).delete();

      // Fetch user data
      const snapshot = await this._db.collection("users").where("email", "==", email).limit(1).get();
      if (snapshot.empty) {
        errBanner.textContent = "Account not found.";
        errBanner.classList.add("visible");
        btn.disabled = false; btn.textContent = "Verify & Login";
        return;
      }

      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      const session = this._saveSession({
        userId: userDoc.id,
        name: userData.name,
        email: userData.email,
        meetingId: userData.meetingId,
        profilePicBase64: userData.profilePicBase64 || null,
      });
      this.onAuthComplete(session);
    } catch (err) {
      console.error("OTP verify error:", err);
      errBanner.textContent = "Verification failed. Please try again.";
      errBanner.classList.add("visible");
      btn.disabled = false; btn.textContent = "Verify & Login";
    }
  }

  async _handleOTPResend(email, card) {
    const resendBtn = card.querySelector("#otpResend");
    resendBtn.disabled = true; resendBtn.textContent = "Sending…";

    try {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000;
      await this._db.collection("otpCodes").doc(email).set({ otp, expiresAt, email });

      if (this._emailjsReady && window.emailjs) {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, {
          to_email: email,
          from_name: "CrolixMeet",
          subject: "Your CrolixMeet Login Code",
          meeting_id: otp,
          message: `Your new CrolixMeet login code is: ${otp}. This code expires in 10 minutes.`,
          date_time: new Date().toLocaleString(),
          guest_email: email,
          initials: "OTP",
        });
      }

      resendBtn.textContent = "Code sent!";
      setTimeout(() => { resendBtn.disabled = false; resendBtn.textContent = "Resend Code"; }, 30000);
    } catch (err) {
      console.warn("Resend OTP failed:", err);
      resendBtn.disabled = false; resendBtn.textContent = "Resend Code";
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  _fieldError(card, fieldId, message) {
    const field = card.querySelector(`#${fieldId}`);
    if (!field) return;
    field.classList.add("has-error");
    const errEl = field.querySelector(".field-error");
    if (errEl) errEl.textContent = message;
  }
}
