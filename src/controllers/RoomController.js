/**
 * src/controllers/RoomController.js
 * Public Room and Private Room — uploads, feed, access management.
 */

import { FIREBASE_CONFIG } from "../config/config.js";
import { buildPostCard, buildUploadModal, buildAccessModal } from "../ui/roomTemplates.js";

export class RoomController {
  constructor(container) {
    this.container = container;
    this._db = null;
    this._user = null;
    this._fullUserData = null;
    this._publicPosts = [];
    this._privatePosts = [];
    this._init();
  }

  _init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._db = firebase.firestore();
  }

  setUser(session, fullUserData) {
    this._user = session;
    this._fullUserData = fullUserData;
  }

  // ── Load & Render Posts ────────────────────────────────────

  async loadPublicRoom() {
    const grid = this.container.querySelector("#publicRoomGrid");
    const empty = this.container.querySelector("#publicRoomEmpty");
    if (!grid) return;

    grid.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading posts…</div>';
    empty.style.display = "none";

    try {
      const snap = await this._db.collection("users").doc(this._user.userId)
        .collection("publicRoom").orderBy("createdAt", "desc").limit(50).get();
      this._publicPosts = [];
      snap.forEach(doc => this._publicPosts.push({ id: doc.id, ...doc.data() }));

      if (this._publicPosts.length === 0) {
        grid.innerHTML = "";
        empty.style.display = "";
        return;
      }

      empty.style.display = "none";
      // Sort: trending (high rating + enough votes) first, then by date
      this._publicPosts.sort((a, b) => {
        const aR = a.ratings ? Object.values(a.ratings) : [];
        const bR = b.ratings ? Object.values(b.ratings) : [];
        const aAvg = aR.length >= 2 ? aR.reduce((s, v) => s + v, 0) / aR.length : 0;
        const bAvg = bR.length >= 2 ? bR.reduce((s, v) => s + v, 0) / bR.length : 0;
        const aScore = aAvg >= 4 ? aAvg * 10 + aR.length : 0;
        const bScore = bAvg >= 4 ? bAvg * 10 + bR.length : 0;
        if (bScore !== aScore) return bScore - aScore;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      grid.innerHTML = this._publicPosts.map(p => buildPostCard(p, true)).join("");
      this._bindPostActions(grid, "public");
    } catch (err) {
      console.error("Load public room error:", err);
      grid.innerHTML = '<div class="profile-empty">Failed to load posts</div>';
    }
  }

  async loadPrivateRoom() {
    const grid = this.container.querySelector("#privateRoomGrid");
    const empty = this.container.querySelector("#privateRoomEmpty");
    if (!grid) return;

    grid.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading posts…</div>';
    empty.style.display = "none";

    try {
      const snap = await this._db.collection("users").doc(this._user.userId)
        .collection("privateRoom").orderBy("createdAt", "desc").limit(50).get();
      this._privatePosts = [];
      snap.forEach(doc => this._privatePosts.push({ id: doc.id, ...doc.data() }));

      if (this._privatePosts.length === 0) {
        grid.innerHTML = "";
        empty.style.display = "";
        return;
      }

      empty.style.display = "none";
      grid.innerHTML = this._privatePosts.map(p => buildPostCard(p, true)).join("");
      this._bindPostActions(grid, "private");
    } catch (err) {
      console.error("Load private room error:", err);
      grid.innerHTML = '<div class="profile-empty">Failed to load posts</div>';
    }
  }

  async loadUserPublicRoom(targetUserId, containerEl) {
    containerEl.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading posts…</div>';

    try {
      const snap = await this._db.collection("users").doc(targetUserId)
        .collection("publicRoom").orderBy("createdAt", "desc").limit(50).get();
      const posts = [];
      snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));

      if (posts.length === 0) {
        containerEl.innerHTML = '<div class="profile-empty"><div class="profile-empty-icon">📭</div>No public posts yet</div>';
        return;
      }

      // Sort trending first
      posts.sort((a, b) => {
        const aR = a.ratings ? Object.values(a.ratings) : [];
        const bR = b.ratings ? Object.values(b.ratings) : [];
        const aAvg = aR.length >= 2 ? aR.reduce((s, v) => s + v, 0) / aR.length : 0;
        const bAvg = bR.length >= 2 ? bR.reduce((s, v) => s + v, 0) / bR.length : 0;
        const aScore = aAvg >= 4 ? aAvg * 10 + aR.length : 0;
        const bScore = bAvg >= 4 ? bAvg * 10 + bR.length : 0;
        if (bScore !== aScore) return bScore - aScore;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      containerEl.innerHTML = posts.map(p => buildPostCard(p, false)).join("");
      this._bindLightbox(containerEl);
      this._bindSocialActions(containerEl, "public", targetUserId);
    } catch (err) {
      console.error("Load user public room error:", err);
      containerEl.innerHTML = '<div class="profile-empty">Could not load posts</div>';
    }
  }

  // ── Upload Flow ────────────────────────────────────────────

  showUploadModal(roomType) {
    const existing = this.container.querySelector("#uploadOverlay");
    if (existing) existing.remove();

    this.container.insertAdjacentHTML("beforeend", buildUploadModal(roomType));
    const overlay = this.container.querySelector("#uploadOverlay");

    let selectedType = "image";
    let preparedContent = null;
    let preparedFileName = null;
    let preparedFileSize = 0;

    // Type selector
    overlay.querySelectorAll(".room-type-btn").forEach(btn => {
      btn.onclick = () => {
        overlay.querySelectorAll(".room-type-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        selectedType = btn.dataset.type;
        overlay.querySelectorAll(".room-upload-type").forEach(el => el.style.display = "none");
        overlay.querySelector(`#upload-${selectedType}`).style.display = "";
        preparedContent = null;
        preparedFileName = null;
        preparedFileSize = 0;

        const captionField = overlay.querySelector("#captionField");
        captionField.style.display = selectedType === "text" ? "none" : "";
      };
    });

    // Image upload
    const imageDropzone = overlay.querySelector("#imageDropzone");
    const imageInput = overlay.querySelector("#imageFileInput");
    const dropzoneContent = overlay.querySelector("#dropzoneContent");

    imageDropzone.onclick = () => imageInput.click();
    imageDropzone.ondragover = (e) => { e.preventDefault(); imageDropzone.classList.add("dragover"); };
    imageDropzone.ondragleave = () => imageDropzone.classList.remove("dragover");
    imageDropzone.ondrop = (e) => {
      e.preventDefault(); imageDropzone.classList.remove("dragover");
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) this._processImage(file, dropzoneContent, (b64) => { preparedContent = b64; });
    };
    imageInput.onchange = () => {
      const file = imageInput.files[0];
      if (file) this._processImage(file, dropzoneContent, (b64) => { preparedContent = b64; });
    };

    // File upload
    const fileDropzone = overlay.querySelector("#fileDropzone");
    const fileInput = overlay.querySelector("#fileFileInput");
    const fileDropContent = overlay.querySelector("#fileDropzoneContent");

    fileDropzone.onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 716800) {
        this._showUploadError(overlay, "File too large — max 700KB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        preparedContent = e.target.result;
        preparedFileName = file.name;
        preparedFileSize = file.size;
        fileDropContent.innerHTML = `<div class="room-dropzone-icon">✅</div><div>${file.name}</div><div class="room-dropzone-hint">${(file.size / 1024).toFixed(1)} KB</div>`;
      };
      reader.readAsDataURL(file);
    };

    // Cancel
    overlay.querySelector("#uploadCancelBtn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // Submit
    overlay.querySelector("#uploadSubmitBtn").onclick = async () => {
      const btn = overlay.querySelector("#uploadSubmitBtn");
      const caption = overlay.querySelector("#captionInput").value.trim();

      let content = preparedContent;

      if (selectedType === "text") {
        content = overlay.querySelector("#textPostInput").value.trim();
        if (!content) { this._showUploadError(overlay, "Write something first!"); return; }
      } else if (selectedType === "video") {
        content = overlay.querySelector("#videoUrlInput").value.trim();
        if (!content) { this._showUploadError(overlay, "Paste a video URL"); return; }
        if (!/^https?:\/\/.+/.test(content)) { this._showUploadError(overlay, "Enter a valid URL starting with http"); return; }
      } else if (selectedType === "image") {
        if (!content) { this._showUploadError(overlay, "Select an image first"); return; }
      } else if (selectedType === "file") {
        if (!content) { this._showUploadError(overlay, "Select a file first"); return; }
      }

      btn.disabled = true; btn.textContent = "Posting…";

      try {
        const post = {
          type: selectedType,
          content,
          caption: selectedType === "text" ? "" : caption,
          createdAt: Date.now(),
        };
        if (selectedType === "file") {
          post.fileName = preparedFileName;
          post.fileSize = preparedFileSize;
        }

        const collectionName = roomType === "public" ? "publicRoom" : "privateRoom";
        await this._db.collection("users").doc(this._user.userId)
          .collection(collectionName).add(post);

        overlay.remove();
        if (roomType === "public") this.loadPublicRoom();
        else this.loadPrivateRoom();
      } catch (err) {
        console.error("Upload error:", err);
        this._showUploadError(overlay, "Upload failed — " + (err.message || "try again"));
        btn.disabled = false; btn.textContent = "Post";
      }
    };
  }

  _processImage(file, previewEl, callback) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else { w = Math.round(w * MAX / h); h = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.65);
        callback(compressed);
        previewEl.innerHTML = `<img src="${compressed}" alt="Preview" style="max-height:200px;border-radius:10px;" />`;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  _showUploadError(overlay, msg) {
    const errEl = overlay.querySelector("#upload-error");
    errEl.textContent = msg;
    errEl.classList.add("visible");
    setTimeout(() => errEl.classList.remove("visible"), 4000);
  }

  // ── Delete Posts ───────────────────────────────────────────

  _bindPostActions(grid, roomType) {
    grid.querySelectorAll(".room-post-delete").forEach(btn => {
      btn.onclick = async () => {
        const postId = btn.dataset.postid;
        const card = btn.closest(".room-post-card");
        if (!postId) return;

        card.style.opacity = "0.4";
        card.style.pointerEvents = "none";

        try {
          const collectionName = roomType === "public" ? "publicRoom" : "privateRoom";
          await this._db.collection("users").doc(this._user.userId)
            .collection(collectionName).doc(postId).delete();
          card.style.transform = "scale(0.9)";
          setTimeout(() => {
            card.remove();
            const grid2 = roomType === "public"
              ? this.container.querySelector("#publicRoomGrid")
              : this.container.querySelector("#privateRoomGrid");
            const empty = roomType === "public"
              ? this.container.querySelector("#publicRoomEmpty")
              : this.container.querySelector("#privateRoomEmpty");
            if (grid2 && grid2.children.length === 0 && empty) empty.style.display = "";
          }, 300);
        } catch (err) {
          console.error("Delete post error:", err);
          card.style.opacity = "1";
          card.style.pointerEvents = "";
        }
      };
    });

    this._bindLightbox(grid);
    this._bindSocialActions(grid, roomType);
  }

  _bindSocialActions(grid, roomType, ownerUserId) {
    const userId = ownerUserId || this._user.userId;

    // Star ratings
    grid.querySelectorAll(".rp-star").forEach(btn => {
      btn.onclick = async () => {
        const postId = btn.dataset.postid;
        const star = parseInt(btn.dataset.star);
        const collName = roomType === "public" ? "publicRoom" : "privateRoom";
        await this._db.collection("users").doc(userId).collection(collName).doc(postId)
          .update({ [`ratings.${this._user.userId}`]: star }).catch(() => {});
        if (roomType === "public") this.loadPublicRoom();
      };
    });

    // Comment toggle
    grid.querySelectorAll(".rp-comment-toggle").forEach(btn => {
      btn.onclick = () => {
        const postId = btn.dataset.postid;
        const section = grid.querySelector(`.rp-comments-section[data-postid="${postId}"]`);
        if (section) section.style.display = section.style.display === "none" ? "" : "none";
      };
    });

    // Send comment
    grid.querySelectorAll(".rp-comment-send").forEach(btn => {
      btn.onclick = async () => {
        const postId = btn.dataset.postid;
        const input = grid.querySelector(`.rp-comment-input[data-postid="${postId}"]`);
        const text = input?.value.trim();
        if (!text) return;
        input.value = "";

        const comment = {
          userId: this._user.userId,
          name: this._user.name,
          profilePic: this._user.profilePicBase64 || "",
          text,
          likes: [],
          createdAt: Date.now(),
        };

        const collName = roomType === "public" ? "publicRoom" : "privateRoom";
        await this._db.collection("users").doc(userId).collection(collName).doc(postId)
          .update({ comments: firebase.firestore.FieldValue.arrayUnion(comment) }).catch(() => {});
        if (roomType === "public") this.loadPublicRoom();
      };
    });

    // Enter to send comment
    grid.querySelectorAll(".rp-comment-input").forEach(input => {
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          const btn = grid.querySelector(`.rp-comment-send[data-postid="${input.dataset.postid}"]`);
          if (btn) btn.click();
        }
      };
    });

    // Like comment (heart toggle)
    grid.querySelectorAll(".rp-comment-like").forEach(btn => {
      btn.onclick = async () => {
        const postId = btn.dataset.postid;
        const commentIdx = parseInt(btn.dataset.commentidx);
        if (isNaN(commentIdx)) return;

        const collName = roomType === "public" ? "publicRoom" : "privateRoom";
        const docRef = this._db.collection("users").doc(userId).collection(collName).doc(postId);
        const doc = await docRef.get();
        if (!doc.exists) return;
        const comments = doc.data().comments || [];
        if (!comments[commentIdx]) return;

        const likes = comments[commentIdx].likes || [];
        if (likes.includes(this._user.userId)) {
          comments[commentIdx].likes = likes.filter(id => id !== this._user.userId);
        } else {
          comments[commentIdx].likes.push(this._user.userId);
        }
        await docRef.update({ comments });
        if (roomType === "public") this.loadPublicRoom();
      };
    });
  }

  _bindLightbox(container) {
    container.querySelectorAll(".room-post-image img").forEach(img => {
      if (img._lightboxBound) return;
      img._lightboxBound = true;
      img.onclick = () => {
        const lb = document.createElement("div");
        lb.className = "room-lightbox";
        lb.innerHTML = `<img src="${img.src}" alt="" /><button class="room-lightbox-close">✕</button>`;
        lb.onclick = (e) => { if (e.target === lb || e.target.classList.contains("room-lightbox-close")) lb.remove(); };
        document.body.appendChild(lb);
        requestAnimationFrame(() => lb.classList.add("room-lightbox-show"));
      };
    });
  }

  // ── Private Room Access Management ─────────────────────────

  async showAccessModal() {
    const accessIds = this._fullUserData?.privateRoomAccess || [];
    let accessUsers = [];

    if (accessIds.length > 0) {
      accessUsers = await this._fetchUsersByIds(accessIds);
    }

    const existing = this.container.querySelector("#accessOverlay");
    if (existing) existing.remove();

    this.container.insertAdjacentHTML("beforeend", buildAccessModal(accessUsers));
    const overlay = this.container.querySelector("#accessOverlay");

    // Close
    overlay.querySelector("#accessCloseBtn").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    // Revoke buttons
    this._bindRevokeButtons(overlay);

    // Search & Add
    overlay.querySelector("#accessSearchBtn").onclick = () => this._handleGrantAccess(overlay);
    overlay.querySelector("#accessSearchInput").onkeydown = (e) => {
      if (e.key === "Enter") this._handleGrantAccess(overlay);
    };
  }

  async _handleGrantAccess(overlay) {
    const input = overlay.querySelector("#accessSearchInput");
    const errEl = overlay.querySelector("#access-error");
    const meetId = input.value.trim().toLowerCase();

    if (!meetId) return;
    if (meetId === this._user.meetingId) {
      errEl.textContent = "That's your own Meeting ID!";
      errEl.classList.add("visible");
      setTimeout(() => errEl.classList.remove("visible"), 3000);
      return;
    }

    const btn = overlay.querySelector("#accessSearchBtn");
    btn.disabled = true; btn.textContent = "Adding…";

    try {
      const idDoc = await this._db.collection("meetingIds").doc(meetId).get();
      if (!idDoc.exists) {
        errEl.textContent = "No user found with this Meeting ID";
        errEl.classList.add("visible");
        setTimeout(() => errEl.classList.remove("visible"), 3000);
        btn.disabled = false; btn.textContent = "Add";
        return;
      }

      const targetUserId = idDoc.data().userId;
      const current = this._fullUserData?.privateRoomAccess || [];
      if (current.includes(targetUserId)) {
        errEl.textContent = "This person already has access";
        errEl.classList.add("visible");
        setTimeout(() => errEl.classList.remove("visible"), 3000);
        btn.disabled = false; btn.textContent = "Add";
        return;
      }

      await this._db.collection("users").doc(this._user.userId).update({
        privateRoomAccess: firebase.firestore.FieldValue.arrayUnion(targetUserId)
      });

      if (this._fullUserData) {
        if (!this._fullUserData.privateRoomAccess) this._fullUserData.privateRoomAccess = [];
        this._fullUserData.privateRoomAccess.push(targetUserId);
      }

      input.value = "";
      overlay.remove();
      this.showAccessModal();
    } catch (err) {
      console.error("Grant access error:", err);
      errEl.textContent = "Failed to add — try again";
      errEl.classList.add("visible");
      btn.disabled = false; btn.textContent = "Add";
    }
  }

  _bindRevokeButtons(overlay) {
    overlay.querySelectorAll(".room-revoke-btn").forEach(btn => {
      btn.onclick = async () => {
        const userId = btn.dataset.userid;
        btn.disabled = true; btn.textContent = "Revoking…";

        try {
          await this._db.collection("users").doc(this._user.userId).update({
            privateRoomAccess: firebase.firestore.FieldValue.arrayRemove(userId)
          });

          if (this._fullUserData?.privateRoomAccess) {
            this._fullUserData.privateRoomAccess = this._fullUserData.privateRoomAccess.filter(id => id !== userId);
          }

          btn.closest(".room-access-item").remove();
          const list = overlay.querySelector("#accessList");
          if (list && list.children.length === 0) {
            list.innerHTML = '<div class="profile-empty"><div class="profile-empty-icon">🔒</div>No one else has access</div>';
          }
        } catch (err) {
          console.error("Revoke error:", err);
          btn.disabled = false; btn.textContent = "Revoke";
        }
      };
    });
  }

  // ── View someone else's private room (if you have access) ──

  async loadUserPrivateRoom(targetUserId, targetUserData, containerEl) {
    const accessList = targetUserData?.privateRoomAccess || [];
    if (!accessList.includes(this._user.userId)) {
      containerEl.innerHTML = '<div class="profile-empty"><div class="profile-empty-icon">🔒</div>This room is private</div>';
      return;
    }

    containerEl.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';
    try {
      const snap = await this._db.collection("users").doc(targetUserId)
        .collection("privateRoom").orderBy("createdAt", "desc").limit(50).get();
      const posts = [];
      snap.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));

      if (posts.length === 0) {
        containerEl.innerHTML = '<div class="profile-empty"><div class="profile-empty-icon">📭</div>No private posts yet</div>';
        return;
      }

      containerEl.innerHTML = posts.map(p => buildPostCard(p, false)).join("");
      this._bindLightbox(containerEl);
    } catch (err) {
      containerEl.innerHTML = '<div class="profile-empty">Could not load posts</div>';
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
