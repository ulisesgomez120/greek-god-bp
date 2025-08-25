#!/usr/bin/env node

// Post-build helper for web export
// Copies selected assets and public files into the dist/ directory produced by `expo export --platform web`.
// Run as: node scripts/post-build-web.js

const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function copyFile(src, dest) {
  try {
    await ensureDir(path.dirname(dest));
    await fsp.copyFile(src, dest);
    console.log(`Copied: ${src} -> ${dest}`);
  } catch (err) {
    console.warn(`Skip copy (missing or failed): ${src} -> ${dest} (${err && err.message})`);
  }
}

async function copyDir(srcDir, destDir) {
  try {
    const entries = await fsp.readdir(srcDir, { withFileTypes: true });
    await ensureDir(destDir);
    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else {
        await copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    console.warn(`Skip directory copy (missing or failed): ${srcDir} (${err && err.message})`);
  }
}

async function main() {
  const root = process.cwd();
  const dist = path.join(root, "dist");

  // Ensure dist exists
  await ensureDir(dist);

  // Assets to copy into dist/icons/
  const iconsSrc = path.join(root, "assets");
  const iconsDest = path.join(dist, "icons");

  // If there's an assets icons directory, copy specific files; otherwise copy individually
  const iconFiles = ["icon.png", "icon.svg", "adaptive-icon.png", "favicon.png", "splash-icon.png"];

  for (const file of iconFiles) {
    const src = path.join(iconsSrc, file);
    const dest = path.join(iconsDest, file);
    await copyFile(src, dest);
  }

  // Copy selected public files into dist root
  const publicFiles = ["manifest.json", "service-worker.js", "_redirects"];
  for (const file of publicFiles) {
    const src = path.join(root, "public", file);
    const dest = path.join(dist, file);
    await copyFile(src, dest);
  }

  // Optionally copy entire public/icons if exists
  const publicIconsDir = path.join(root, "public", "icons");
  const distIconsDir = path.join(dist, "icons");
  await copyDir(publicIconsDir, distIconsDir);

  // Patch manifest icon paths to point at /icons/ (if the manifest references /assets/)
  try {
    const manifestPath = path.join(dist, "manifest.json");
    const manifestExists = await fsp
      .stat(manifestPath)
      .then(() => true)
      .catch(() => false);
    if (manifestExists) {
      const raw = await fsp.readFile(manifestPath, "utf8");
      const manifest = JSON.parse(raw);

      if (Array.isArray(manifest.icons)) {
        manifest.icons = manifest.icons.map((icon) => {
          if (typeof icon.src === "string") {
            icon.src = icon.src.replace(/^\/?assets\//, "/icons/");
          }
          return icon;
        });
      }

      await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
      console.log("post-build-web: updated manifest icon paths to /icons/");
    } else {
      console.warn("post-build-web: manifest.json not found in dist; skipping manifest patch");
    }
  } catch (err) {
    console.warn("post-build-web: manifest patch failed:", err && err.message);
  }

  console.log("post-build-web: finished");
}

main().catch((err) => {
  console.error("post-build-web: error", err);
  process.exit(1);
});
