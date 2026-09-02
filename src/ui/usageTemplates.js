/**
 * src/ui/usageTemplates.js
 * HTML templates for the owner-only Usage & Costs dashboard.
 */

function fmtUsd(n) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtMin(n) {
  return n.toLocaleString("en-ZA", { maximumFractionDigits: 0 });
}

export function buildUsagePage(data) {
  const {
    totalMinutes, totalGB, premiumCount,
    revenueEstimate, agoraCostEstimate, storageCostEstimate, marginEstimate,
    userRows,
  } = data;

  const marginClass = marginEstimate >= 0 ? "usage-margin-positive" : "usage-margin-negative";

  const rows = userRows.length
    ? userRows.map((u) => `
      <tr>
        <td>${u.name}${u.isPremium ? '<span class="usage-premium-badge">Premium</span>' : ""}</td>
        <td>${fmtMin(u.totalMinutes)}</td>
        <td>${fmtMin(u.hostMinutes)}</td>
        <td>${u.sessions}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" class="usage-empty-row">No usage logged yet this month.</td></tr>`;

  return `
    <div class="ppage-header">
      <div>
        <h2 class="ppage-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-3px;margin-right:6px;opacity:0.7;"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>Usage &amp; Costs</h2>
        <p class="ppage-subtitle">This month — estimated, not pulled from a real billing API. Adjust the rate constants in config.js to match your actual Agora/Firebase plan.</p>
      </div>
    </div>

    <div class="usage-stats">
      <div class="usage-stat-card">
        <div class="usage-stat-label">Premium subscribers</div>
        <div class="usage-stat-value">${premiumCount}</div>
        <div class="usage-stat-sub">${fmtUsd(revenueEstimate)} / mo revenue</div>
      </div>
      <div class="usage-stat-card">
        <div class="usage-stat-label">Meeting minutes</div>
        <div class="usage-stat-value">${fmtMin(totalMinutes)}</div>
        <div class="usage-stat-sub">~${fmtUsd(agoraCostEstimate)} est. Agora cost</div>
      </div>
      <div class="usage-stat-card">
        <div class="usage-stat-label">Recording storage</div>
        <div class="usage-stat-value">${totalGB.toFixed(2)} GB</div>
        <div class="usage-stat-sub">~${fmtUsd(storageCostEstimate)} est. storage cost</div>
      </div>
      <div class="usage-stat-card ${marginClass}">
        <div class="usage-stat-label">Estimated margin</div>
        <div class="usage-stat-value">${fmtUsd(marginEstimate)}</div>
        <div class="usage-stat-sub">revenue − Agora − storage</div>
      </div>
    </div>

    <h3 class="usage-table-title">Top users by minutes this month</h3>
    <div class="usage-table-wrap">
      <table class="usage-table">
        <thead>
          <tr><th>User</th><th>Total min</th><th>As host</th><th>Sessions</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}
