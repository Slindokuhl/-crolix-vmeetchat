/**
 * src/utils/avatar.js
 * Deterministic gradient colours for participant avatars.
 */

export const AVATAR_GRADIENTS = [
  ["#6366f1","#818cf8"],["#0ea5e9","#38bdf8"],["#10b981","#34d399"],
  ["#f59e0b","#fbbf24"],["#ef4444","#f87171"],["#8b5cf6","#a78bfa"],
  ["#ec4899","#f472b6"],["#14b8a6","#2dd4bf"],
];

export function gradientForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const [a, b] = AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
