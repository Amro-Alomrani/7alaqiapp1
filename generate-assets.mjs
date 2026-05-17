import sharp from 'sharp';
import path from 'path';

const LOGO = './public/halaqi-logo.jpg';
const ANDROID_RES = './android/app/src/main/res';
const BG = { r: 30, g: 27, b: 38, alpha: 1 }; // dark background matching logo

// ── Splash screens ──────────────────────────────────────────────────────────
const SPLASHES = [
  { dir: 'drawable',              w: 480,  h: 800  },
  { dir: 'drawable-port-mdpi',   w: 320,  h: 480  },
  { dir: 'drawable-port-hdpi',   w: 480,  h: 854  },
  { dir: 'drawable-port-xhdpi',  w: 720,  h: 1280 },
  { dir: 'drawable-port-xxhdpi', w: 960,  h: 1600 },
  { dir: 'drawable-port-xxxhdpi',w: 1280, h: 1920 },
  { dir: 'drawable-land-mdpi',   w: 480,  h: 320  },
  { dir: 'drawable-land-hdpi',   w: 854,  h: 480  },
  { dir: 'drawable-land-xhdpi',  w: 1280, h: 720  },
  { dir: 'drawable-land-xxhdpi', w: 1600, h: 960  },
  { dir: 'drawable-land-xxxhdpi',w: 1920, h: 1280 },
];

// ── Launcher icons ───────────────────────────────────────────────────────────
const ICONS = [
  { dir: 'mipmap-mdpi',    size: 48  },
  { dir: 'mipmap-hdpi',    size: 72  },
  { dir: 'mipmap-xhdpi',   size: 96  },
  { dir: 'mipmap-xxhdpi',  size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

// Adaptive icon foreground (108dp canvas per density)
const FG_ICONS = [
  { dir: 'mipmap-mdpi',    size: 108 },
  { dir: 'mipmap-hdpi',    size: 162 },
  { dir: 'mipmap-xhdpi',   size: 216 },
  { dir: 'mipmap-xxhdpi',  size: 324 },
  { dir: 'mipmap-xxxhdpi', size: 432 },
];

async function makeSplash({ dir, w, h }) {
  const logoFit = Math.floor(Math.min(w, h) * 0.65);
  const logo = await sharp(LOGO)
    .resize(logoFit, logoFit, { fit: 'contain', background: { ...BG, alpha: 0 } })
    .png().toBuffer();
  const left = Math.floor((w - logoFit) / 2);
  const top  = Math.floor((h - logoFit) / 2);
  await sharp({ create: { width: w, height: h, channels: 4, background: BG } })
    .composite([{ input: logo, left, top }])
    .png()
    .toFile(path.join(ANDROID_RES, dir, 'splash.png'));
  console.log(`  splash ✓ ${dir} (${w}×${h})`);
}

async function makeIcon({ dir, size }) {
  const out = path.join(ANDROID_RES, dir);
  await sharp(LOGO)
    .resize(size, size, { fit: 'cover' })
    .png().toFile(path.join(out, 'ic_launcher.png'));
  await sharp(LOGO)
    .resize(size, size, { fit: 'cover' })
    .png().toFile(path.join(out, 'ic_launcher_round.png'));
  console.log(`  icon  ✓ ${dir} ${size}px`);
}

async function makeFgIcon({ dir, size }) {
  const logoSize = Math.floor(size * 0.72);
  const offset   = Math.floor((size - logoSize) / 2);
  const logo = await sharp(LOGO)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: logo, left: offset, top: offset }])
    .png()
    .toFile(path.join(ANDROID_RES, dir, 'ic_launcher_foreground.png'));
  console.log(`  fg    ✓ ${dir} ${size}px`);
}

// PWA / public icons
async function makePwa() {
  await sharp(LOGO).resize(192, 192, { fit: 'cover' }).png().toFile('./public/icons/icon-192.png');
  await sharp(LOGO).resize(512, 512, { fit: 'cover' }).png().toFile('./public/icons/icon-512.png');
  await sharp(LOGO).resize(512, 512, { fit: 'cover' }).png().toFile('./public/icons/icon-512-maskable.png');
  await sharp(LOGO).resize(180, 180, { fit: 'cover' }).png().toFile('./public/icons/apple-touch-icon.png');
  await sharp(LOGO).resize(512, 512, { fit: 'cover' }).png().toFile('./public/logo.png');
  console.log('  pwa   ✓ public/icons/*');
}

async function main() {
  console.log('\n=== Splash Screens ===');
  for (const s of SPLASHES) await makeSplash(s);

  console.log('\n=== Launcher Icons ===');
  for (const i of ICONS) await makeIcon(i);

  console.log('\n=== Adaptive Icon Foreground ===');
  for (const i of FG_ICONS) await makeFgIcon(i);

  console.log('\n=== PWA Icons ===');
  await makePwa();

  console.log('\nDone! All assets generated with HALAQI logo.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
