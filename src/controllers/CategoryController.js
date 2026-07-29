/**
 * src/controllers/CategoryController.js
 * Contact Categories — grouping friends into named, optionally
 * password-protected folders, with a hidden vault for extra-private ones.
 * Chat/Call actions delegate back to ChatController/ProfileController via
 * constructor callbacks.
 */

import { FIREBASE_CONFIG, EMAILJS_PUBLIC_KEY, EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST } from "../config/config.js";
import { crolixConfirm, crolixAlert } from "../utils/confirmModal.js";
import {
  buildCategoriesPage,
  buildCreateCategoryModal,
  buildTextPromptModal,
  buildVaultSetupModal,
  buildCategoryMembersPanel,
  buildAddMemberPicker,
  buildHiddenVaultOverlay,
} from "../ui/categoryTemplates.js";

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export class CategoryController {
  constructor(container, onChatWithUser, onCallUser, onOpenGroupChat) {
    this.container = container;
    this.onChatWithUser = onChatWithUser;
    this.onCallUser = onCallUser;
    this.onOpenGroupChat = onOpenGroupChat;
    this._db = null;
    this._user = null;
    this._fullUserData = null;
    this._allCategories = [];
    this._categories = [];
    this._unlockedIds = new Set();
    this._emailjsReady = false;
    this._init();
  }

  _init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._db = firebase.firestore();
    if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); this._emailjsReady = true; }
    else {
      const check = setInterval(() => {
        if (window.emailjs) { window.emailjs.init(EMAILJS_PUBLIC_KEY); this._emailjsReady = true; clearInterval(check); }
      }, 500);
    }
  }

  setUser(session, fullUserData) {
    this._user = session;
    this._fullUserData = fullUserData;
  }

  // ── Render ───────────────────────────────────────────────

  async render() {
    const page = this.container.querySelector("#page-categories");
    if (!page) return;
    const inner = page.querySelector(".ppage-inner");
    if (!inner) return;

    inner.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';
    await this._loadCategories();
    inner.innerHTML = buildCategoriesPage(this._categories);
    this._bindPageEvents(inner);
  }

  async _loadCategories() {
    try {
      const snap = await this._db.collection("users").doc(this._user.userId)
        .collection("categories").orderBy("createdAt", "desc").get();
      this._allCategories = [];
      snap.forEach(doc => this._allCategories.push({ id: doc.id, ...doc.data() }));
    } catch (err) {
      console.error("Load categories error:", err);
      this._allCategories = [];
    }
    this._categories = this._allCategories.filter(c => !c.hidden);
  }

  _bindPageEvents(inner) {
    const newBtn = inner.querySelector("#catNewBtn");
    if (newBtn) newBtn.onclick = () => this._showCreateModal();

    inner.querySelectorAll(".cat-card").forEach(card => {
      card.onclick = () => this._openCategory(card.dataset.catid);
    });
  }

  // ── Create ───────────────────────────────────────────────

  async _showCreateModal() {
    const friendIds = this._fullUserData?.friends || [];
    if (friendIds.length === 0) {
      crolixAlert("Add friends first before creating a category.", { title: "No friends yet", icon: "info" });
      return;
    }
    const friends = await this._fetchUsersByIds(friendIds);
    this.container.querySelector("#createCatOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildCreateCategoryModal(friends));
    const overlay = this.container.querySelector("#createCatOverlay");

    overlay.querySelector("#catCancelBtn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.querySelector("#catCreateBtn").onclick = () => this._createCategory(overlay);
  }

  async _createCategory(overlay) {
    const name = overlay.querySelector("#catNameInput").value.trim();
    const password = overlay.querySelector("#catPasswordInput").value;
    const errEl = overlay.querySelector("#cat-error");
    const alsoGroup = overlay.querySelector("#catAlsoGroupCheckbox").checked;

    if (!name) { errEl.textContent = "Category name is required"; errEl.classList.add("visible"); return; }

    const checked = overlay.querySelectorAll("#catMemberList input:checked");
    const memberIds = Array.from(checked).map(cb => cb.value);

    const btn = overlay.querySelector("#catCreateBtn");
    btn.disabled = true; btn.textContent = "Creating…";

    try {
      let linkedGroupId = null;
      if (alsoGroup && memberIds.length > 0) {
        const groupRef = await this._db.collection("groups").add({
          name,
          description: "",
          avatar: "",
          members: [this._user.userId, ...memberIds],
          createdBy: this._user.userId,
          createdAt: Date.now(),
        });
        linkedGroupId = groupRef.id;
      }

      const passwordHash = password ? await sha256Hex(password) : null;

      await this._db.collection("users").doc(this._user.userId)
        .collection("categories").add({ name, memberIds, passwordHash, linkedGroupId, createdAt: Date.now() });

      overlay.remove();
      this.render();
    } catch (err) {
      console.error("Create category error:", err);
      errEl.textContent = "Failed to create category. Please try again.";
      errEl.classList.add("visible");
      btn.disabled = false; btn.textContent = "Create Category";
    }
  }

  // ── Open / unlock ────────────────────────────────────────

  _openCategory(categoryId) {
    const category = this._allCategories.find(c => c.id === categoryId);
    if (!category) return;

    if (category.passwordHash && !this._unlockedIds.has(categoryId)) {
      this._showPasswordPrompt(category);
      return;
    }
    this._showMembersPanel(category);
  }

  _showPasswordPrompt(category) {
    this.container.querySelector("#catPromptOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildTextPromptModal({
      overlayId: "catPromptOverlay",
      title: `${category.name} is locked`,
      subtitle: "Enter the password to view its members",
      inputId: "catPromptInput",
      inputType: "password",
      placeholder: "Password",
      submitLabel: "Unlock",
    }));
    const overlay = this.container.querySelector("#catPromptOverlay");
    const input = overlay.querySelector("#catPromptInput");
    const errEl = overlay.querySelector("#catPromptOverlay-error");
    input.focus();

    const submit = async () => {
      const value = input.value;
      if (!value) return;
      const hash = await sha256Hex(value);
      if (hash === category.passwordHash) {
        this._unlockedIds.add(category.id);
        overlay.remove();
        this._showMembersPanel(category);
      } else {
        errEl.textContent = "Incorrect password";
        errEl.classList.add("visible");
        input.value = "";
        input.focus();
      }
    };

    overlay.querySelector("#catPromptOverlay-submit").onclick = submit;
    input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    overlay.querySelector("#catPromptOverlay-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  async _showMembersPanel(category) {
    this.container.querySelector("#catDetailOverlay")?.remove();
    const members = await this._fetchUsersByIds(category.memberIds || []);
    const linkedGroup = category.linkedGroupId ? { id: category.linkedGroupId } : null;

    this.container.insertAdjacentHTML("beforeend", buildCategoryMembersPanel(category, members, linkedGroup));
    const overlay = this.container.querySelector("#catDetailOverlay");

    overlay.querySelector("#catDetailCloseBtn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelectorAll(".profile-user-btn").forEach(actionBtn => {
      actionBtn.onclick = () => {
        const userId = actionBtn.dataset.uid;
        const action = actionBtn.dataset.action;
        const row = actionBtn.closest(".profile-user-item");
        const meetId = row?.dataset.meetid;
        if (action === "chat") { overlay.remove(); this.container.querySelector("#catVaultOverlay")?.remove(); this.onChatWithUser(userId); }
        else if (action === "call") { overlay.remove(); this.container.querySelector("#catVaultOverlay")?.remove(); this.onCallUser(meetId, this._user.name); }
        else if (action === "removeMember") this._removeMember(category, userId, overlay);
      };
    });

    if (linkedGroup) {
      const groupBtn = overlay.querySelector("#catOpenGroupBtn");
      if (groupBtn) groupBtn.onclick = () => { overlay.remove(); this.container.querySelector("#catVaultOverlay")?.remove(); this.onOpenGroupChat(linkedGroup.id); };
    }

    overlay.querySelector("#catAddMemberBtn").onclick = () => this._showAddMemberPicker(category, overlay);
    overlay.querySelector("#catRenameBtn").onclick = () => this._showRenamePrompt(category, overlay);
    overlay.querySelector("#catPasswordBtn").onclick = () => this._showSetPasswordPrompt(category, overlay);
    const removePwBtn = overlay.querySelector("#catRemovePasswordBtn");
    if (removePwBtn) removePwBtn.onclick = () => this._removePassword(category, overlay);
    const hideBtn = overlay.querySelector("#catHideBtn");
    if (hideBtn) hideBtn.onclick = () => this._hideCategory(category, overlay);
    const unhideBtn = overlay.querySelector("#catUnhideBtn");
    if (unhideBtn) unhideBtn.onclick = () => this._unhideCategory(category, overlay);
    overlay.querySelector("#catDeleteBtn").onclick = () => this._deleteCategory(category, overlay);
  }

  async _removeMember(category, userId, overlay) {
    const newMemberIds = (category.memberIds || []).filter(id => id !== userId);
    try {
      await this._db.collection("users").doc(this._user.userId)
        .collection("categories").doc(category.id).update({ memberIds: newMemberIds });
      category.memberIds = newMemberIds;
      overlay.remove();
      this._showMembersPanel(category);
    } catch (err) {
      console.error("Remove member error:", err);
    }
  }

  async _showAddMemberPicker(category, overlay) {
    const existing = overlay.querySelector("#catAddPickerSlot");
    if (existing) { existing.remove(); return; }

    const friendIds = this._fullUserData?.friends || [];
    const candidateIds = friendIds.filter(id => !(category.memberIds || []).includes(id));
    const candidates = await this._fetchUsersByIds(candidateIds);

    const slot = document.createElement("div");
    slot.id = "catAddPickerSlot";
    slot.innerHTML = buildAddMemberPicker(candidates);
    overlay.querySelector(".cat-detail-actions").insertAdjacentElement("afterend", slot);

    const addBtn = slot.querySelector("#catAddSelectedBtn");
    if (addBtn) {
      addBtn.onclick = async () => {
        const checked = slot.querySelectorAll("input:checked");
        const toAdd = Array.from(checked).map(cb => cb.value);
        if (toAdd.length === 0) return;
        const newMemberIds = [...(category.memberIds || []), ...toAdd];
        await this._db.collection("users").doc(this._user.userId)
          .collection("categories").doc(category.id).update({ memberIds: newMemberIds });
        category.memberIds = newMemberIds;
        overlay.remove();
        this._showMembersPanel(category);
      };
    }
  }

  _showRenamePrompt(category, parentOverlay) {
    this.container.querySelector("#catRenameOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildTextPromptModal({
      overlayId: "catRenameOverlay",
      title: "Rename Category",
      inputId: "catRenameInput",
      inputType: "text",
      placeholder: category.name,
      submitLabel: "Save",
    }));
    const overlay = this.container.querySelector("#catRenameOverlay");
    const input = overlay.querySelector("#catRenameInput");
    input.value = category.name;
    input.focus();

    const submit = async () => {
      const name = input.value.trim();
      if (!name) return;
      await this._db.collection("users").doc(this._user.userId)
        .collection("categories").doc(category.id).update({ name });
      category.name = name;
      overlay.remove();
      parentOverlay.remove();
      this._showMembersPanel(category);
    };
    overlay.querySelector("#catRenameOverlay-submit").onclick = submit;
    input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    overlay.querySelector("#catRenameOverlay-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  _showSetPasswordPrompt(category, parentOverlay) {
    this.container.querySelector("#catSetPwOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildTextPromptModal({
      overlayId: "catSetPwOverlay",
      title: category.passwordHash ? "Change Password" : "Set Password",
      subtitle: "This password will be required each time this category is opened.",
      inputId: "catSetPwInput",
      inputType: "password",
      placeholder: "New password",
      submitLabel: "Save",
    }));
    const overlay = this.container.querySelector("#catSetPwOverlay");
    const input = overlay.querySelector("#catSetPwInput");
    input.focus();

    const submit = async () => {
      const value = input.value;
      if (!value) return;
      const passwordHash = await sha256Hex(value);
      await this._db.collection("users").doc(this._user.userId)
        .collection("categories").doc(category.id).update({ passwordHash });
      category.passwordHash = passwordHash;
      this._unlockedIds.add(category.id);
      overlay.remove();
      parentOverlay.remove();
      this._showMembersPanel(category);
    };
    overlay.querySelector("#catSetPwOverlay-submit").onclick = submit;
    input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    overlay.querySelector("#catSetPwOverlay-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  async _removePassword(category, overlay) {
    const ok = await crolixConfirm("Remove password protection from this category?", { title: "Remove password?", confirmText: "Remove" });
    if (!ok) return;
    await this._db.collection("users").doc(this._user.userId)
      .collection("categories").doc(category.id).update({ passwordHash: null });
    category.passwordHash = null;
    overlay.remove();
    this._showMembersPanel(category);
  }

  // ── Hide / Unhide ────────────────────────────────────────

  async _hideCategory(category, overlay) {
    if (!this._fullUserData?.hiddenVaultPasswordHash) {
      this._showVaultSetupModal({ category, parentOverlay: overlay });
      return;
    }
    await this._setHidden(category, true, overlay);
  }

  async _unhideCategory(category, overlay) {
    await this._setHidden(category, false, overlay);
  }

  async _setHidden(category, hidden, overlay) {
    try {
      await this._db.collection("users").doc(this._user.userId)
        .collection("categories").doc(category.id).update({ hidden });
      category.hidden = hidden;
      overlay.remove();
      this.container.querySelector("#catVaultOverlay")?.remove();
      this.render();
    } catch (err) {
      console.error("Set hidden error:", err);
    }
  }

  /**
   * Combined unlock-phrase + vault-password setup, used both for the first-hide
   * flow (category + parentOverlay provided) and the forgot-access reset flow
   * (isReset: true, no category).
   */
  _showVaultSetupModal({ category = null, parentOverlay = null, isReset = false } = {}) {
    this.container.querySelector("#catVaultSetupOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildVaultSetupModal({
      title: isReset ? "Set New Hidden Vault Access" : "Set Up Hidden Vault Access",
      subtitle: isReset
        ? "Choose a brand-new unlock phrase and password — your old ones will stop working."
        : "Choose a phrase you'll type into Find Someone to reveal hidden categories, plus a password to actually unlock them.",
      submitLabel: isReset ? "Save" : "Set & Hide",
    }));

    const overlay = this.container.querySelector("#catVaultSetupOverlay");
    const phraseInput = overlay.querySelector("#catVaultPhraseInput");
    const phraseStatus = overlay.querySelector("#catVaultPhraseStatus");
    const passwordInput = overlay.querySelector("#catVaultSetupPasswordInput");
    const errEl = overlay.querySelector("#catVaultSetup-error");
    phraseInput.focus();

    let phraseTaken = false;
    let checkTimer = null;

    phraseInput.addEventListener("input", () => {
      const value = phraseInput.value.trim().toLowerCase();
      clearTimeout(checkTimer);
      if (!value) { phraseStatus.textContent = ""; phraseStatus.className = "auth-meetid-status"; phraseTaken = false; return; }

      if (value === this._user.meetingId) {
        phraseStatus.textContent = "✗"; phraseStatus.className = "auth-meetid-status taken"; phraseTaken = true;
        return;
      }

      phraseStatus.textContent = "⟳"; phraseStatus.className = "auth-meetid-status checking";
      checkTimer = setTimeout(async () => {
        try {
          const doc = await this._db.collection("meetingIds").doc(value).get();
          if (doc.exists) {
            phraseStatus.textContent = "✗"; phraseStatus.className = "auth-meetid-status taken"; phraseTaken = true;
          } else {
            phraseStatus.textContent = "✓"; phraseStatus.className = "auth-meetid-status available"; phraseTaken = false;
          }
        } catch (_) {
          phraseStatus.textContent = ""; phraseStatus.className = "auth-meetid-status";
        }
      }, 500);
    });

    const submit = async () => {
      const phrase = phraseInput.value.trim().toLowerCase();
      const password = passwordInput.value;
      errEl.classList.remove("visible");

      if (phrase.length < 3) { errEl.textContent = "Unlock phrase must be at least 3 characters"; errEl.classList.add("visible"); return; }
      if (phraseTaken || phrase === this._user.meetingId) { errEl.textContent = "That phrase is already taken as a Meeting ID — pick another"; errEl.classList.add("visible"); return; }
      if (!password) { errEl.textContent = "A vault password is required"; errEl.classList.add("visible"); return; }

      const btn = overlay.querySelector("#catVaultSetupSubmitBtn");
      btn.disabled = true; btn.textContent = "Saving…";

      try {
        const [hiddenUnlockPhraseHash, hiddenVaultPasswordHash] = await Promise.all([sha256Hex(phrase), sha256Hex(password)]);
        await this._db.collection("users").doc(this._user.userId)
          .update({ hiddenUnlockPhraseHash, hiddenVaultPasswordHash });
        this._fullUserData.hiddenUnlockPhraseHash = hiddenUnlockPhraseHash;
        this._fullUserData.hiddenVaultPasswordHash = hiddenVaultPasswordHash;

        overlay.remove();
        if (category && parentOverlay) {
          await this._setHidden(category, true, parentOverlay);
        } else {
          crolixAlert("Your hidden vault access has been reset.", { title: "Done", icon: "success" });
        }
      } catch (err) {
        console.error("Save vault setup error:", err);
        errEl.textContent = "Failed to save. Please try again.";
        errEl.classList.add("visible");
        btn.disabled = false; btn.textContent = isReset ? "Save" : "Set & Hide";
      }
    };

    overlay.querySelector("#catVaultSetupSubmitBtn").onclick = submit;
    overlay.querySelector("#catVaultSetupCancelBtn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  // ── Hidden vault (secret trigger entry point) ───────────────

  async isHiddenTrigger(text) {
    if (!text || !this._fullUserData?.hiddenUnlockPhraseHash) return false;
    const hash = await sha256Hex(text);
    return hash === this._fullUserData.hiddenUnlockPhraseHash;
  }

  async triggerHiddenUnlock() {
    if (!this._fullUserData?.hiddenVaultPasswordHash) {
      crolixAlert("No hidden categories yet — hide one from its category menu first.", { title: "Nothing hidden", icon: "info" });
      return;
    }
    this._showVaultUnlockPrompt();
  }

  _showVaultUnlockPrompt() {
    this.container.querySelector("#catVaultUnlockOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildTextPromptModal({
      overlayId: "catVaultUnlockOverlay",
      title: "Enter Password",
      inputId: "catVaultUnlockInput",
      inputType: "password",
      placeholder: "Password",
      submitLabel: "Unlock",
    }));
    const overlay = this.container.querySelector("#catVaultUnlockOverlay");
    const input = overlay.querySelector("#catVaultUnlockInput");
    const errEl = overlay.querySelector("#catVaultUnlockOverlay-error");
    input.focus();

    const submit = async () => {
      const value = input.value;
      if (!value) return;
      const hash = await sha256Hex(value);
      if (hash === this._fullUserData.hiddenVaultPasswordHash) {
        overlay.remove();
        await this._openVault();
      } else {
        errEl.textContent = "Incorrect password";
        errEl.classList.add("visible");
        input.value = "";
        input.focus();
      }
    };
    overlay.querySelector("#catVaultUnlockOverlay-submit").onclick = submit;
    input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    overlay.querySelector("#catVaultUnlockOverlay-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  async _openVault() {
    // Refresh so the vault reflects the latest hide/unhide state even if categories haven't been loaded yet.
    if (this._allCategories.length === 0) await this._loadCategories();
    const hiddenCategories = this._allCategories.filter(c => c.hidden);

    this.container.querySelector("#catVaultOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildHiddenVaultOverlay(hiddenCategories));
    const overlay = this.container.querySelector("#catVaultOverlay");

    overlay.querySelector("#catVaultCloseBtn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    overlay.querySelectorAll(".cat-card").forEach(card => {
      card.onclick = () => this._openCategory(card.dataset.catid);
    });
  }

  // ── Forgot access — email code recovery ─────────────────────

  async showResetVaultAccessFlow() {
    const email = this._user?.email;
    if (!email) return;

    const ok = await crolixConfirm(
      `We'll email a verification code to ${email} to reset your hidden vault unlock phrase and password. Continue?`,
      { title: "Reset Hidden Vault Access?", confirmText: "Send Code", icon: "info" }
    );
    if (!ok) return;

    try {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000;
      await this._db.collection("otpCodes").doc(email).set({ otp, expiresAt, email });

      if (this._emailjsReady && window.emailjs) {
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_HOST, {
          to_email: email,
          from_name: "CrolixMeet",
          subject: "Reset Your Hidden Vault Access",
          meeting_id: otp,
          message: `Your CrolixMeet verification code is: ${otp}. Use it to reset your hidden vault unlock phrase and password. This code expires in 10 minutes. If you didn't request this, you can ignore this email.`,
          date_time: new Date().toLocaleString(),
          guest_email: email,
          initials: "OTP",
        });
      }

      this._showResetCodePrompt(email);
    } catch (err) {
      console.error("Send reset code error:", err);
      crolixAlert("Failed to send the verification code. Please try again.", { title: "Error", icon: "error" });
    }
  }

  _showResetCodePrompt(email) {
    this.container.querySelector("#catResetCodeOverlay")?.remove();
    this.container.insertAdjacentHTML("beforeend", buildTextPromptModal({
      overlayId: "catResetCodeOverlay",
      title: "Enter Verification Code",
      subtitle: "Check your email for the 6-digit code we just sent.",
      inputId: "catResetCodeInput",
      inputType: "text",
      placeholder: "6-digit code",
      submitLabel: "Verify",
    }));
    const overlay = this.container.querySelector("#catResetCodeOverlay");
    const input = overlay.querySelector("#catResetCodeInput");
    const errEl = overlay.querySelector("#catResetCodeOverlay-error");
    input.focus();

    const submit = async () => {
      const code = input.value.trim();
      if (!code) return;

      try {
        const otpDoc = await this._db.collection("otpCodes").doc(email).get();
        if (!otpDoc.exists) {
          errEl.textContent = "No verification code found. Please request a new one.";
          errEl.classList.add("visible");
          return;
        }
        const otpData = otpDoc.data();
        if (Date.now() > otpData.expiresAt) {
          errEl.textContent = "Code expired. Please request a new one.";
          errEl.classList.add("visible");
          return;
        }
        if (otpData.otp !== code) {
          errEl.textContent = "Incorrect code. Please try again.";
          errEl.classList.add("visible");
          input.value = "";
          return;
        }

        await this._db.collection("otpCodes").doc(email).delete();
        overlay.remove();
        this._showVaultSetupModal({ isReset: true });
      } catch (err) {
        console.error("Verify reset code error:", err);
        errEl.textContent = "Verification failed. Please try again.";
        errEl.classList.add("visible");
      }
    };

    overlay.querySelector("#catResetCodeOverlay-submit").onclick = submit;
    input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    overlay.querySelector("#catResetCodeOverlay-cancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  }

  async _deleteCategory(category, overlay) {
    const ok = await crolixConfirm(
      "This will remove the category folder. Your friends and any linked group chat are not affected.",
      { title: "Delete category?", confirmText: "Delete", danger: true, icon: "delete" }
    );
    if (!ok) return;
    try {
      await this._db.collection("users").doc(this._user.userId)
        .collection("categories").doc(category.id).delete();
      overlay.remove();
      this.container.querySelector("#catVaultOverlay")?.remove();
      this.render();
    } catch (err) {
      console.error("Delete category error:", err);
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  async _fetchUsersByIds(userIds) {
    if (!userIds || userIds.length === 0) return [];
    const results = [];
    const chunks = [];
    for (let i = 0; i < userIds.length; i += 10) chunks.push(userIds.slice(i, i + 10));
    for (const chunk of chunks) {
      const snapshot = await this._db.collection("users")
        .where(firebase.firestore.FieldPath.documentId(), "in", chunk).get();
      snapshot.forEach(doc => results.push({ ...doc.data(), userId: doc.id }));
    }
    return results;
  }
}
