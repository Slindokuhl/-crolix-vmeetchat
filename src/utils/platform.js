/**
 * src/utils/platform.js
 * True when running inside the Capacitor native app shell (not a browser tab).
 */
export function isNativeApp() {
  return !!window.Capacitor?.isNativePlatform?.();
}
