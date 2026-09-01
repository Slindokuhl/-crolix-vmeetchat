/**
 * src/config/config.js
 * All app configuration — Agora, Firebase, EmailJS.
 */

export const AGORA_APP_ID = "48e1240440fa48e29297863ed05ac95f";

// Real hosted URL of the deployed web app (e.g. Firebase Hosting), used to build
// shareable meeting/group invite links from the mobile app, where window.location
// points at the internal Capacitor WebView origin instead of a public URL.
// Leave blank until the web app is deployed — link-building falls back to
// window.location on web in that case.
export const PUBLIC_WEB_URL = "https://crolix-5a614.web.app";

export const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBYXtYwGH5U5ZNvEPZUcRenQ9bJheXmqAs",
  authDomain:        "crolix-5a614.firebaseapp.com",
  projectId:         "crolix-5a614",
  storageBucket:     "crolix-5a614.firebasestorage.app",
  messagingSenderId: "983243030432",
  appId:             "1:983243030432:web:e5cea6cb44269f8c62aec5",
};

export const EMAILJS_PUBLIC_KEY     = "qO4DMhZWfigqmMZpb";
export const EMAILJS_SERVICE_ID     = "service_lonwsfc";
export const EMAILJS_TEMPLATE_HOST  = "template_myxj97v";
export const EMAILJS_TEMPLATE_GUEST = "template_8056d44";
export const HOST_EMAIL             = "slindokuhleatlehang22009757@gmail.com";

// Giphy — GIF reactions
export const GIPHY_API_KEY = "dc6zaTOxFJmzC";

// Local GIFs — drop files into assets/gifs/ and add entries here
export const LOCAL_GIFS = [
  { name: "Look",      file: "./assets/gifs/look.gif" },
  { name: "Shocked",   file: "./assets/gifs/shocked.gif" },
  { name: "Telling",   file: "./assets/gifs/telling.gif" },
];
