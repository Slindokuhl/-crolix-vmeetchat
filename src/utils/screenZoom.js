/**
 * src/utils/screenZoom.js
 * Lightbox for remote screen-share zoom/pan/fullscreen.
 */

import { ICONS } from "../ui/icons.js";

export class ScreenZoomController {
  constructor(container) {
    this.container    = container;
    this._scale       = 1;
    this._minScale    = 0.5;
    this._maxScale    = 4;
    this._scaleStep   = 0.25;
    this._originX     = 0;
    this._originY     = 0;
    this._dragging    = false;
    this._dragStartX  = 0;
    this._dragStartY  = 0;
    this._dragOriginX = 0;
    this._dragOriginY = 0;
    this._activeTrack = null;
    this._open        = false;
    this._isNativeFS  = false;

    this._overlay  = container.querySelector("#screen-zoom-overlay");
    this._viewport = container.querySelector("#screen-zoom-viewport");
    this._canvas   = container.querySelector("#screen-zoom-canvas");
    this._label    = container.querySelector("#screen-zoom-label");
    this._levelEl  = container.querySelector("#szoom-level");
    this._fsBtn    = container.querySelector("#szoomFullscreen");

    this._bindOverlayEvents();
    this._bindFullscreenChange();
  }

  open(track, sharerName) {
    if (!track || this._open) return;
    this._activeTrack = track;
    this._open = true;
    this._scale = 1;
    this._originX = 0;
    this._originY = 0;
    if (this._label) this._label.textContent = `${sharerName || "Screen"} — Screen Share`;
    this._canvas.innerHTML = "";
    track.play(this._canvas);
    this._applyTransform();
    this._updateLevelDisplay();
    this._overlay.style.display = "flex";
    requestAnimationFrame(() => this._overlay.classList.add("open"));
  }

  close() {
    if (!this._open) return;
    if (this._isNativeFS) this._exitNativeFullscreen();
    this._open = false;
    this._overlay.classList.remove("open");
    setTimeout(() => { this._overlay.style.display = "none"; this._canvas.innerHTML = ""; this._activeTrack = null; }, 280);
  }

  zoomIn()    { this._setScale(this._scale + this._scaleStep); }
  zoomOut()   { this._setScale(this._scale - this._scaleStep); }
  zoomReset() { this._scale = 1; this._originX = 0; this._originY = 0; this._applyTransform(); this._updateLevelDisplay(); }

  toggleNativeFullscreen() { this._isNativeFS ? this._exitNativeFullscreen() : this._requestNativeFullscreen(); }

  _setScale(v) { this._scale = Math.min(this._maxScale, Math.max(this._minScale, v)); this._applyTransform(); this._updateLevelDisplay(); }
  _applyTransform() { this._canvas.style.transform = `translate(${this._originX}px,${this._originY}px) scale(${this._scale})`; }
  _updateLevelDisplay() { if (this._levelEl) this._levelEl.textContent = `${Math.round(this._scale * 100)}%`; }

  _requestNativeFullscreen() {
    const el = this._overlay;
    const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
    if (rfs) rfs.call(el).catch(() => {});
  }

  _exitNativeFullscreen() {
    const efs = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
    if (efs) efs.call(document).catch(() => {});
  }

  _bindFullscreenChange() {
    const handler = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
      this._isNativeFS = !!(fsEl && fsEl === this._overlay);
      if (this._fsBtn) {
        this._fsBtn.innerHTML = this._isNativeFS ? ICONS.exitFullscreen : ICONS.fullscreen;
        this._fsBtn.title = this._isNativeFS ? "Exit Fullscreen" : "Toggle Fullscreen";
      }
    };
    ["fullscreenchange","webkitfullscreenchange","mozfullscreenchange","MSFullscreenChange"].forEach(ev => document.addEventListener(ev, handler));
  }

  _bindOverlayEvents() {
    const { _overlay: overlay, _viewport: viewport, _canvas: canvas } = this;

    this.container.querySelector("#szoomIn")?.addEventListener("click", () => this.zoomIn());
    this.container.querySelector("#szoomOut")?.addEventListener("click", () => this.zoomOut());
    this.container.querySelector("#szoomReset")?.addEventListener("click", () => this.zoomReset());
    this.container.querySelector("#szoomClose")?.addEventListener("click", () => this.close());
    this.container.querySelector("#szoomFullscreen")?.addEventListener("click", () => this.toggleNativeFullscreen());
    overlay.querySelector(".screen-zoom-backdrop")?.addEventListener("click", () => this.close());
    canvas.addEventListener("dblclick", () => this.close());

    document.addEventListener("keydown", (e) => {
      if (!this._open) return;
      if (e.key === "Escape") this.close();
      if (e.key === "=" || e.key === "+") { e.preventDefault(); this.zoomIn(); }
      if (e.key === "-") { e.preventDefault(); this.zoomOut(); }
      if (e.key === "0") { e.preventDefault(); this.zoomReset(); }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); this.toggleNativeFullscreen(); }
    });

    viewport.addEventListener("wheel", (e) => { e.preventDefault(); this._setScale(this._scale + (e.deltaY > 0 ? -this._scaleStep : this._scaleStep)); }, { passive: false });

    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      this._dragging = true; this._dragStartX = e.clientX; this._dragStartY = e.clientY;
      this._dragOriginX = this._originX; this._dragOriginY = this._originY;
      canvas.style.cursor = "grabbing"; e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!this._dragging) return;
      this._originX = this._dragOriginX + (e.clientX - this._dragStartX);
      this._originY = this._dragOriginY + (e.clientY - this._dragStartY);
      this._applyTransform();
    });
    document.addEventListener("mouseup", () => { if (!this._dragging) return; this._dragging = false; canvas.style.cursor = "grab"; });

    let lastTouchDist = null, lastTouchX = null, lastTouchY = null;
    viewport.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      else if (e.touches.length === 1) { lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY; }
    }, { passive: true });
    viewport.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        if (lastTouchDist) this._setScale(this._scale * (dist / lastTouchDist));
        lastTouchDist = dist; e.preventDefault();
      } else if (e.touches.length === 1 && lastTouchX !== null) {
        this._originX += e.touches[0].clientX - lastTouchX; this._originY += e.touches[0].clientY - lastTouchY;
        lastTouchX = e.touches[0].clientX; lastTouchY = e.touches[0].clientY;
        this._applyTransform(); e.preventDefault();
      }
    }, { passive: false });
    viewport.addEventListener("touchend", () => { lastTouchDist = lastTouchX = lastTouchY = null; }, { passive: true });
  }
}
