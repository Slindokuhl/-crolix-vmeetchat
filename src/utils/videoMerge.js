/**
 * src/utils/videoMerge.js
 * Client-side merge of several recorded clips into one grid-composited
 * video. No server, no ffmpeg — plays the clips back together onto a
 * canvas + mixed audio graph and re-records the composite in real time.
 *
 * Known limitation: clips are played back together from a shared start
 * rather than timestamp-aligned, so this isn't frame-accurate sync —
 * good enough for "everyone talking together," not a broadcast edit.
 */
import { startRecording } from "./recorder.js";

function loadVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true; // avoid autoplay-with-sound restrictions; audio is still tapped via Web Audio below
    v.playsInline = true;
    v.src = url;
    v.onloadedmetadata = () => resolve(v);
    v.onerror = () => reject(new Error(`Failed to load clip: ${url}`));
  });
}

async function playAll(videos) {
  for (const v of videos) {
    try {
      await v.play();
    } catch (err) {
      console.warn("Clip failed to autoplay for merge:", err);
    }
  }
}

/**
 * clips: [{ url, name }]
 * onProgress(elapsedSeconds, totalSeconds)
 * Returns a Promise<Blob> (video/webm).
 */
export async function mergeClips(clips, { onProgress } = {}) {
  if (!clips.length) throw new Error("No clips to merge");

  const videos = await Promise.all(clips.map((c) => loadVideo(c.url)));

  const cols = videos.length <= 1 ? 1 : 2;
  const rows = Math.ceil(videos.length / cols);
  const cellW = 640, cellH = 360;

  const canvas = document.createElement("canvas");
  canvas.width = cellW * cols;
  canvas.height = cellH * rows;
  const ctx = canvas.getContext("2d");

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  const dest = audioCtx.createMediaStreamDestination();
  videos.forEach((v) => {
    try {
      audioCtx.createMediaElementSource(v).connect(dest);
    } catch (err) {
      console.warn("Could not tap audio for a clip:", err);
    }
  });

  const canvasStream = canvas.captureStream(30);
  const combined = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const rec = startRecording(combined);
  await playAll(videos);

  const maxDuration = Math.max(0, ...videos.map((v) => (isFinite(v.duration) ? v.duration : 0)));
  const startedAt = performance.now();

  await new Promise((resolve) => {
    function draw() {
      let stillGoing = false;
      videos.forEach((v, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        ctx.drawImage(v, col * cellW, row * cellH, cellW, cellH);
        if (!v.ended) stillGoing = true;
      });
      const elapsed = (performance.now() - startedAt) / 1000;
      if (onProgress) onProgress(elapsed, maxDuration);

      const timedOut = maxDuration > 0 && elapsed > maxDuration + 1;
      if (stillGoing && !timedOut) requestAnimationFrame(draw);
      else resolve();
    }
    draw();
  });

  videos.forEach((v) => { try { v.pause(); } catch (_) {} });
  const blob = await rec.stop();
  try { await audioCtx.close(); } catch (_) {}
  return blob;
}
