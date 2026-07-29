/**
 * src/ui/authTemplates.js
 * HTML templates for auth screens — sign up, login, OTP verification.
 */

import { ICONS } from "./icons.js";

const LOGO_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="aRG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4fa3f7"/><stop offset="100%" stop-color="#6c5ce7"/></linearGradient><linearGradient id="aCG" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#74b9ff"/><stop offset="100%" stop-color="#a29bfe"/></linearGradient></defs><path d="M 50 8 A 42 42 0 1 1 19.5 73 L 26 68 A 34 34 0 1 0 50 16 Z" fill="url(#aRG)"/><rect x="26" y="36" width="30" height="22" rx="4" fill="url(#aCG)"/><circle cx="41" cy="47" r="7" fill="#0d1b2a"/><circle cx="41" cy="47" r="4.5" fill="url(#aRG)"/><rect x="53" y="40" width="2" height="14" rx="1" fill="url(#aCG)"/><polygon points="56,44 63,47 56,50" fill="url(#aCG)"/><path d="M 22 58 L 18 68 L 30 62" fill="url(#aRG)" opacity="0.85"/></svg>`;

export function buildAuthChoiceScreen() {
  return `
<div id="auth-screen" class="auth-screen">
  <div class="auth-choice" id="auth-choice">
    <div class="auth-choice-logo">
      ${LOGO_SVG}
      <div class="auth-choice-brand"><span class="crolix">Crolix</span><span class="meet">VmeetChat</span></div>
    </div>
    <p class="auth-choice-sub">Create your account to get a unique Meeting ID, add friends, and start video calls instantly.</p>
    <div class="auth-choice-btns">
      <button class="auth-choice-btn primary" id="authGoSignup">Create Account</button>
      <div class="auth-choice-divider">OR</div>
      <button class="auth-choice-btn secondary" id="authGoLogin">I already have an account</button>
    </div>
  </div>
</div>`;
}

export function buildSignupScreen() {
  return `
<div class="auth-card" id="auth-signup-card">
  <button class="auth-back-btn" id="signupBack">← Back</button>
  <div class="auth-card-header">
    <h2>Create Your Account</h2>
    <p>Set up your profile and get your unique Meeting ID</p>
  </div>
  <div class="auth-error" id="signup-error"></div>

  <div class="auth-avatar-upload">
    <div class="auth-avatar-preview" id="avatarPreview">
      <div class="avatar-placeholder">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Photo</span>
      </div>
    </div>
    <input type="file" accept="image/*" class="auth-avatar-input" id="avatarInput" />
    <label class="auth-avatar-label" for="avatarInput">Upload Profile Picture</label>
  </div>

  <div class="auth-field" id="field-fullname">
    <label>Full Name</label>
    <input type="text" id="signupName" placeholder="e.g. John Doe" autocomplete="name" />
    <span class="field-error" id="err-fullname">Name is required</span>
  </div>

  <div class="auth-field" id="field-email">
    <label>Email Address</label>
    <input type="email" id="signupEmail" placeholder="your@email.com" autocomplete="email" />
    <span class="field-error" id="err-email">Enter a valid email address</span>
  </div>

  <div class="auth-field" id="field-meetid">
    <label>Unique Meeting ID</label>
    <div class="auth-meetid-wrap">
      <input type="text" id="signupMeetId" placeholder="e.g. john-doe-42" autocomplete="off" />
      <span class="auth-meetid-status" id="meetidStatus"></span>
    </div>
    <span class="field-hint">3-30 characters. Lowercase letters, numbers and hyphens only.</span>
    <span class="field-error" id="err-meetid">Invalid Meeting ID</span>
  </div>

  <button class="auth-submit" id="signupSubmit">Create Account</button>

  <div class="auth-switch">
    Already have an account? <button id="signupToLogin">Log in</button>
  </div>
</div>`;
}

export function buildLoginScreen() {
  return `
<div class="auth-card" id="auth-login-card">
  <button class="auth-back-btn" id="loginBack">← Back</button>
  <div class="auth-card-header">
    <h2>Welcome Back</h2>
    <p>Enter your email to receive a login code</p>
  </div>
  <div class="auth-error" id="login-error"></div>

  <div class="auth-field" id="field-login-email">
    <label>Email Address</label>
    <input type="email" id="loginEmail" placeholder="your@email.com" autocomplete="email" />
    <span class="field-error" id="err-login-email">Enter a valid email address</span>
  </div>

  <button class="auth-submit" id="loginSubmit">Send Login Code</button>

  <div class="auth-switch">
    Don't have an account? <button id="loginToSignup">Create one</button>
  </div>
</div>`;
}

export function buildOTPScreen(email) {
  return `
<div class="auth-card" id="auth-otp-card">
  <button class="auth-back-btn" id="otpBack">← Back</button>
  <div class="auth-card-header">
    <h2>Enter Verification Code</h2>
    <p>We sent a 6-digit code to <strong>${email}</strong></p>
  </div>
  <div class="auth-error" id="otp-error"></div>

  <div class="otp-inputs" id="otpInputs">
    <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
    <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
    <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
    <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
    <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
    <input type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" />
  </div>

  <button class="auth-submit" id="otpSubmit">Verify & Login</button>

  <div class="otp-resend">
    Didn't receive it? <button id="otpResend">Resend Code</button>
  </div>
</div>`;
}
