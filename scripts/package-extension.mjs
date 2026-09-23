// Builds the Chrome Web Store zip from dist/.
//
//   node scripts/package-extension.mjs [--build-number N] [--include-pem path]
//
// - Strips the `key` field from manifest.json: the Web Store rejects uploads
//   that contain it. The store keeps the extension id stable itself, provided
//   the very first upload carried the matching private key as `key.pem` in
//   the zip root (--include-pem). Later uploads must NOT include it.
// - With --build-number, the version becomes <major>.<minor>.<N> where
//   major/minor come from manifest.json, so bumping them in the repo is the
//   only manual versioning step and every CI run is monotonic.
// - Output: release/todo-extension-<version>.zip, manifest at the zip root.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const staging = resolve(root, "release", "staging");
const releaseDir = resolve(root, "release");

if (!existsSync(resolve(dist, "manifest.json"))) {
  console.error("dist/manifest.json not found — run `npm run build` first.");
  process.exit(1);
}

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
cpSync(dist, staging, { recursive: true });

const manifestPath = resolve(staging, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
delete manifest.key;

const buildNumber = option("--build-number");
if (buildNumber !== undefined) {
  if (!/^\d+$/.test(buildNumber)) {
    console.error(`--build-number must be an integer, got "${buildNumber}"`);
    process.exit(1);
  }
  const [major, minor] = manifest.version.split(".");
  manifest.version = `${major}.${minor}.${buildNumber}`;
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const pem = option("--include-pem");
if (pem !== undefined) {
  const pemText = readFileSync(resolve(root, pem), "utf8");
  // The store only reads PKCS#8 ("BEGIN PRIVATE KEY"), which is what Chrome's
  // own "Pack extension" writes. LibreSSL/OpenSSL 1.x `genrsa` writes PKCS#1.
  if (!pemText.startsWith("-----BEGIN PRIVATE KEY-----")) {
    console.error(
      `${pem} is not PKCS#8. Convert it first:\n  openssl pkcs8 -topk8 -nocrypt -in ${pem} -out ${pem}.pkcs8 && mv ${pem}.pkcs8 ${pem}`,
    );
    process.exit(1);
  }
  cpSync(resolve(root, pem), resolve(staging, "key.pem"));
  console.warn(
    "Including key.pem — only correct for the very first upload of a new store item.",
  );
}

const zipPath = resolve(releaseDir, `todo-extension-${manifest.version}.zip`);
rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", "-X", zipPath, ".", "-x", "*.DS_Store"], {
  cwd: staging,
  stdio: "inherit",
});
rmSync(staging, { recursive: true, force: true });

console.log(`version => ${manifest.version}`);
console.log(`zip     => ${zipPath}`);
