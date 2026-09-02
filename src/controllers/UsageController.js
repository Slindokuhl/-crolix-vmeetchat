/**
 * src/controllers/UsageController.js
 * Usage & Costs dashboard — owner-only (HOST_EMAIL). Estimates Agora and
 * Firebase Storage cost against Premium revenue using this app's own
 * usage logs (usageLog collection, written by VideoCall.leaveChannel)
 * and recording sizes — not a real billing API integration.
 */

import {
  FIREBASE_CONFIG,
  HOST_EMAIL,
  PREMIUM_PRICE_USD,
  AGORA_RATE_PER_1000_MIN_USD,
  FIREBASE_STORAGE_RATE_PER_GB_MONTH_USD,
} from "../config/config.js";
import { buildUsagePage } from "../ui/usageTemplates.js";

export class UsageController {
  constructor(container) {
    this.container = container;
    this._db = null;
    this._user = null;
    this._init();
  }

  _init() {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    this._db = firebase.firestore();
  }

  setUser(session) {
    this._user = session;
  }

  isOwner() {
    return !!this._user?.email && this._user.email === HOST_EMAIL;
  }

  async render() {
    const page = this.container.querySelector("#page-usage");
    if (!page) return;
    const inner = page.querySelector(".ppage-inner");
    if (!inner) return;

    if (!this.isOwner()) {
      inner.innerHTML = '<div class="profile-empty">This page isn\'t available.</div>';
      return;
    }

    inner.innerHTML = '<div class="profile-loading"><div class="profile-spinner"></div>Loading…</div>';

    try {
      const data = await this._loadData();
      inner.innerHTML = buildUsagePage(data);
    } catch (err) {
      console.error("Usage dashboard error:", err);
      inner.innerHTML = '<div class="profile-empty">Couldn\'t load usage data.</div>';
    }
  }

  async _loadData() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const [usageSnap, recordingsSnap, usersSnap] = await Promise.all([
      this._db.collection("usageLog").where("endedAt", ">=", startOfMonth).get(),
      this._db.collectionGroup("recordings").get(),
      this._db.collection("users").get(),
    ]);

    const usersById = {};
    let premiumCount = 0;
    usersSnap.forEach((doc) => {
      const d = doc.data();
      usersById[doc.id] = { name: d.name || "Unknown", email: d.email || "", isPremium: !!d.isPremium };
      if (d.isPremium) premiumCount++;
    });

    let totalSeconds = 0;
    const perUser = {};
    usageSnap.forEach((doc) => {
      const d = doc.data();
      totalSeconds += d.durationSeconds || 0;
      const entry = perUser[d.userId] || { totalSeconds: 0, hostSeconds: 0, sessions: 0 };
      entry.totalSeconds += d.durationSeconds || 0;
      if (d.isHost) entry.hostSeconds += d.durationSeconds || 0;
      entry.sessions += 1;
      perUser[d.userId] = entry;
    });

    let totalBytes = 0;
    recordingsSnap.forEach((doc) => { totalBytes += doc.data().sizeBytes || 0; });

    const totalMinutes = totalSeconds / 60;
    const totalGB = totalBytes / 1e9;
    const agoraCostEstimate = (totalMinutes / 1000) * AGORA_RATE_PER_1000_MIN_USD;
    const storageCostEstimate = totalGB * FIREBASE_STORAGE_RATE_PER_GB_MONTH_USD;
    const revenueEstimate = premiumCount * PREMIUM_PRICE_USD;
    const marginEstimate = revenueEstimate - agoraCostEstimate - storageCostEstimate;

    const userRows = Object.entries(perUser)
      .map(([userId, entry]) => ({
        userId,
        name: usersById[userId]?.name || "Unknown",
        isPremium: usersById[userId]?.isPremium || false,
        totalMinutes: entry.totalSeconds / 60,
        hostMinutes: entry.hostSeconds / 60,
        sessions: entry.sessions,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 25);

    return {
      totalMinutes,
      totalGB,
      premiumCount,
      revenueEstimate,
      agoraCostEstimate,
      storageCostEstimate,
      marginEstimate,
      userRows,
    };
  }
}
