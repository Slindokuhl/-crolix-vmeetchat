/**
 * src/controllers/RecordingsController.js
 * Recordings dashboard page — lists meetings the user has recorded
 * clips in, and merges a meeting's clips into one video client-side.
 */

import { FIREBASE_CONFIG } from "../config/config.js";
import { buildRecordingsPage, buildMeetingClipsView } from "../ui/recordingsTemplates.js";
import { mergeClips } from "../utils/videoMerge.js";
import { crolixAlert } from "../utils/confirmModal.js";

export class RecordingsController {
  constructor(container) {
    this.container = container;
    this._db = null;
    this._storage = null;
    this._user = null;
    this._init();
  }

  _init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._db = firebase.firestore();
    this._storage = firebase.storage();
  }

  setUser(session) {
    this._user = session;
  }

  async render() {
    const page = this.container.querySelector("#page-recordings");
    if (!page) return;
    const inner = page.querySelector(".ppage-inner");
    if (!inner) return;

    inner.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';
    const meetings = await this._loadMyMeetings();
    inner.innerHTML = buildRecordingsPage(meetings);

    inner.querySelectorAll(".rec-meeting-card").forEach((card) => {
      card.onclick = () => this._openMeeting(inner, card.dataset.channel);
    });
  }

  async _loadMyMeetings() {
    if (!this._user?.userId) return [];
    try {
      const snap = await this._db.collectionGroup("recordings")
        .where("recordedByUserId", "==", this._user.userId).get();
      const byChannel = new Map();
      snap.forEach((doc) => {
        const channelId = doc.ref.parent.parent.id;
        const data = doc.data();
        const entry = byChannel.get(channelId) || { channelId, count: 0, latestAt: 0 };
        entry.count++;
        entry.latestAt = Math.max(entry.latestAt, data.createdAt || 0);
        byChannel.set(channelId, entry);
      });
      return [...byChannel.values()].sort((a, b) => b.latestAt - a.latestAt);
    } catch (err) {
      console.error("Load recordings error:", err);
      return [];
    }
  }

  async _openMeeting(inner, channelId) {
    inner.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';
    const clips = await this._loadClips(channelId);
    inner.innerHTML = buildMeetingClipsView(channelId, clips);

    inner.querySelector("#recBackBtn").onclick = () => this.render();

    const mergeBtn = inner.querySelector("#recMergeBtn");
    const checkboxes = () => Array.from(inner.querySelectorAll(".rec-clip-check"));
    checkboxes().forEach((cb) => {
      cb.onchange = () => { mergeBtn.disabled = checkboxes().filter((c) => c.checked).length === 0; };
    });

    mergeBtn.onclick = () => {
      const selected = checkboxes().filter((c) => c.checked).map((c) => ({ url: c.dataset.url, name: c.dataset.name }));
      this._merge(inner, channelId, selected);
    };
  }

  async _loadClips(channelId) {
    try {
      const snap = await this._db.collection("meetings").doc(channelId)
        .collection("recordings").orderBy("createdAt", "asc").get();
      const clips = [];
      snap.forEach((doc) => clips.push({ id: doc.id, ...doc.data() }));
      return clips;
    } catch (err) {
      console.error("Load clips error:", err);
      return [];
    }
  }

  async _merge(inner, channelId, clips) {
    if (!clips.length) return;
    const progress = inner.querySelector("#recMergeProgress");
    const progressLabel = inner.querySelector("#recMergeProgressLabel");
    const progressFill = inner.querySelector("#recMergeProgressFill");
    const resultBox = inner.querySelector("#recMergeResult");
    const mergeBtn = inner.querySelector("#recMergeBtn");

    mergeBtn.disabled = true;
    progress.style.display = "block";
    resultBox.style.display = "none";

    try {
      const blob = await mergeClips(clips, {
        onProgress: (elapsed, total) => {
          const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0;
          progressFill.style.width = `${pct}%`;
          progressLabel.textContent = `Merging… ${elapsed.toFixed(0)}s${total ? ` / ${total.toFixed(0)}s` : ""}`;
        },
      });

      progress.style.display = "none";
      const objectUrl = URL.createObjectURL(blob);
      resultBox.style.display = "block";
      resultBox.innerHTML = `
        <div class="rec-merge-done">Merged! <a href="${objectUrl}" download="${channelId}-merged.webm" class="rec-merge-download-link">Download merged video</a></div>
      `;

      this._uploadMerged(channelId, blob).catch((err) => console.error("Upload merged clip failed:", err));
    } catch (err) {
      console.error("Merge failed:", err);
      progress.style.display = "none";
      crolixAlert("Couldn't merge those clips. Try again.", { title: "Merge failed", icon: "error" });
    } finally {
      mergeBtn.disabled = false;
    }
  }

  async _uploadMerged(channelId, blob) {
    const path = `recordings/${channelId}/merged_${Date.now()}.webm`;
    const ref = this._storage.ref(path);
    await ref.put(blob, { contentType: "video/webm" });
    const downloadURL = await ref.getDownloadURL();
    await this._db.collection("meetings").doc(channelId).collection("recordings").add({
      recordedByUserId: this._user?.userId || null,
      name: "Merged recording",
      storagePath: path,
      downloadURL,
      merged: true,
      createdAt: Date.now(),
    });
  }
}
