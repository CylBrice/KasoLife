// Génère toutes les tailles d'icônes (favicon web + PWA + sources mobiles)
// à partir du SVG maître public/brand/icon-master.svg
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const SRC = path.join(__dirname, "..", "public", "brand", "icon-master.svg");
const PUBLIC = path.join(__dirname, "..", "public");
const BRAND = path.join(__dirname, "..", "public", "brand");

const ICONS_DIR = path.join(PUBLIC, "icons");

const targets = [
  // Favicon web
  { out: path.join(PUBLIC, "favicon-16x16.png"), size: 16 },
  { out: path.join(PUBLIC, "favicon-32x32.png"), size: 32 },
  { out: path.join(PUBLIC, "favicon-48x48.png"), size: 48 },
  // Next.js App Router icons (app/icon.png détecté automatiquement)
  { out: path.join(__dirname, "..", "src", "app", "icon.png"), size: 512 },
  { out: path.join(__dirname, "..", "src", "app", "apple-icon.png"), size: 180 },
  // PWA manifest
  { out: path.join(PUBLIC, "android-chrome-192x192.png"), size: 192 },
  { out: path.join(PUBLIC, "android-chrome-512x512.png"), size: 512 },
  { out: path.join(PUBLIC, "apple-touch-icon.png"), size: 180 },
  // Source haute résolution pour génération native (Capacitor Assets)
  { out: path.join(BRAND, "icon-1024.png"), size: 1024 },
  // Jeu complet PWA/manifest (mêmes tailles que public/icons sur KasoPlex)
  { out: path.join(ICONS_DIR, "icon-72.png"), size: 72 },
  { out: path.join(ICONS_DIR, "icon-96.png"), size: 96 },
  { out: path.join(ICONS_DIR, "icon-128.png"), size: 128 },
  { out: path.join(ICONS_DIR, "icon-144.png"), size: 144 },
  { out: path.join(ICONS_DIR, "icon-152.png"), size: 152 },
  { out: path.join(ICONS_DIR, "icon-192.png"), size: 192 },
  { out: path.join(ICONS_DIR, "icon-384.png"), size: 384 },
  { out: path.join(ICONS_DIR, "icon-512.png"), size: 512 },
  { out: path.join(ICONS_DIR, "icon-1024.png"), size: 1024 },
  { out: path.join(ICONS_DIR, "icon-apple-touch.png"), size: 180 },
];

fs.mkdirSync(ICONS_DIR, { recursive: true });

(async () => {
  for (const t of targets) {
    await sharp(SRC).resize(t.size, t.size).png().toFile(t.out);
    console.log(`✓ ${path.relative(process.cwd(), t.out)} (${t.size}x${t.size})`);
  }
  console.log("\nToutes les icônes ont été générées.");
})();
