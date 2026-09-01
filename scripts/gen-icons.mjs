import sharp from "sharp";
import { mkdirSync } from "node:fs";

const BG = "#020617";
const RENDER_SIZE = 2048; // large working canvas so trim() has good precision

function rawLogoSvg(size) {
  const scale = size / 100;
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <g transform="scale(${scale})">
    <defs>
      <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#4fa3f7"/><stop offset="100%" stop-color="#6c5ce7"/></linearGradient>
      <linearGradient id="camGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#74b9ff"/><stop offset="100%" stop-color="#a29bfe"/></linearGradient>
    </defs>
    <path d="M 50 8 A 42 42 0 1 1 19.5 73 L 26 68 A 34 34 0 1 0 50 16 Z" fill="url(#ringGrad)"/>
    <rect x="26" y="36" width="30" height="22" rx="4" fill="url(#camGrad)"/>
    <circle cx="41" cy="47" r="7" fill="#0d1b2a"/>
    <circle cx="41" cy="47" r="4.5" fill="url(#ringGrad)"/>
    <rect x="53" y="40" width="2" height="14" rx="1" fill="url(#camGrad)"/>
    <polygon points="56,44 63,47 56,50" fill="url(#camGrad)"/>
    <path d="M 22 58 L 18 68 L 30 62" fill="url(#ringGrad)" opacity="0.85"/>
  </g>
</svg>`;
}

async function trimmedLogoBuffer() {
  const raw = await sharp(Buffer.from(rawLogoSvg(RENDER_SIZE))).png().toBuffer();
  return sharp(raw).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true });
}

async function centeredLogo({ canvas, logoFraction, background }) {
  const { data, info } = await trimmedLogoBuffer();
  const targetLogoSize = Math.round(canvas * logoFraction);
  const scaledDim =
    info.width >= info.height
      ? { width: targetLogoSize, height: Math.round((info.height / info.width) * targetLogoSize) }
      : { width: Math.round((info.width / info.height) * targetLogoSize), height: targetLogoSize };

  const resizedLogo = await sharp(data).resize(scaledDim.width, scaledDim.height).png().toBuffer();

  let img = sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: background || { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  return img
    .composite([
      {
        input: resizedLogo,
        left: Math.round((canvas - scaledDim.width) / 2),
        top: Math.round((canvas - scaledDim.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

const outDir = process.argv[2];
mkdirSync(outDir, { recursive: true });

const bgColor = { r: 0x02, g: 0x06, b: 0x17, alpha: 1 };

// Legacy/Play Store icon: flattened logo + navy background, fills most of the canvas.
const icon = await centeredLogo({ canvas: 1024, logoFraction: 0.78, background: bgColor });
await sharp(icon).png().toFile(`${outDir}/icon.png`);

// Adaptive icon layers: foreground logo kept within Android's ~66% safe zone, plain navy background.
const foreground = await centeredLogo({ canvas: 1024, logoFraction: 0.58, background: null });
await sharp(foreground).png().toFile(`${outDir}/icon-foreground.png`);

await sharp({ create: { width: 1024, height: 1024, channels: 4, background: bgColor } })
  .png()
  .toFile(`${outDir}/icon-background.png`);

console.log("wrote icon.png, icon-foreground.png, icon-background.png");
