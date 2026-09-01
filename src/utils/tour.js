/**
 * src/utils/tour.js
 * First-run spotlight tour — dims the screen and highlights one real
 * UI element at a time with an animated callout.
 */

let _activeTour = null;

function _rectOf(el) {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function startSpotlightTour(steps, onDone) {
  if (_activeTour) _activeTour._cleanup();

  const resolved = steps.filter((s) => document.querySelector(s.selector));
  if (!resolved.length) return;

  let index = 0;
  let scrollTimeout = null;

  const overlay = document.createElement("div");
  overlay.className = "tour-overlay";
  overlay.innerHTML = `
    <div class="tour-highlight"></div>
    <div class="tour-callout">
      <div class="tour-callout-step"></div>
      <div class="tour-callout-title"></div>
      <div class="tour-callout-desc"></div>
      <div class="tour-callout-actions">
        <button class="tour-skip-btn">Skip</button>
        <button class="tour-next-btn">Next</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const highlight = overlay.querySelector(".tour-highlight");
  const callout   = overlay.querySelector(".tour-callout");
  const stepEl    = overlay.querySelector(".tour-callout-step");
  const titleEl   = overlay.querySelector(".tour-callout-title");
  const descEl    = overlay.querySelector(".tour-callout-desc");
  const skipBtn   = overlay.querySelector(".tour-skip-btn");
  const nextBtn   = overlay.querySelector(".tour-next-btn");

  function positionFor(target) {
    const pad = 8;
    const r = _rectOf(target);
    highlight.style.top    = `${r.top - pad}px`;
    highlight.style.left   = `${r.left - pad}px`;
    highlight.style.width  = `${r.width + pad * 2}px`;
    highlight.style.height = `${r.height + pad * 2}px`;

    // Decide callout placement: below, above, or beside the target,
    // clamped so it never runs off the viewport.
    const vw = window.innerWidth, vh = window.innerHeight;
    const calloutRect = callout.getBoundingClientRect();
    const cw = calloutRect.width || 300, ch = calloutRect.height || 160;
    const gap = 14;

    let top;
    const spaceBelow = vh - (r.top + r.height);
    const spaceAbove = r.top;
    if (spaceBelow >= ch + gap) top = r.top + r.height + gap;
    else if (spaceAbove >= ch + gap) top = r.top - ch - gap;
    else top = Math.max(gap, Math.min(vh - ch - gap, r.top));

    let left = r.left + r.width / 2 - cw / 2;
    left = Math.max(gap, Math.min(vw - cw - gap, left));

    callout.style.top = `${top}px`;
    callout.style.left = `${left}px`;
  }

  function renderStep() {
    const step = resolved[index];
    const target = document.querySelector(step.selector);
    if (!target) { advance(); return; }

    stepEl.textContent = `${index + 1} of ${resolved.length}`;
    titleEl.textContent = step.title;
    descEl.textContent = step.desc;
    nextBtn.textContent = index === resolved.length - 1 ? "Got it" : "Next";

    target.scrollIntoView({ behavior: "smooth", block: "center" });
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => positionFor(target), 320);
  }

  function advance() {
    index++;
    if (index >= resolved.length) { finish(); return; }
    renderStep();
  }

  function finish() {
    _cleanup();
    if (onDone) onDone();
  }

  function onResize() {
    const step = resolved[index];
    const target = step && document.querySelector(step.selector);
    if (target) positionFor(target);
  }

  function onKeydown(e) {
    if (e.key === "Escape") finish();
  }

  function _cleanup() {
    clearTimeout(scrollTimeout);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("keydown", onKeydown);
    overlay.remove();
    if (_activeTour === api) _activeTour = null;
  }

  nextBtn.onclick = advance;
  skipBtn.onclick = finish;
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) advance();
  });
  window.addEventListener("resize", onResize);
  document.addEventListener("keydown", onKeydown);

  const api = { _cleanup };
  _activeTour = api;

  renderStep();
  requestAnimationFrame(() => overlay.classList.add("tour-visible"));

  return api;
}
