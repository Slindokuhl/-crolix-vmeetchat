/**
 * src/utils/recorder.js
 * Thin MediaRecorder wrapper for locally recording a MediaStream.
 */

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const type of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(type)) return type;
  }
  return "";
}

/**
 * Starts recording a MediaStream. Returns a controller with stop(),
 * which resolves to the finished Blob once recording has fully flushed.
 */
export function startRecording(stream) {
  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

  const stopped = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
  });

  recorder.start(1000); // 1s timeslice so we always have data if something goes wrong

  return {
    get state() { return recorder.state; },
    stop() {
      if (recorder.state === "inactive") return stopped;
      recorder.stop();
      return stopped;
    },
  };
}
