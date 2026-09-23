# Publishing to the Chrome Web Store

Every push to `main` builds, lints, packages and uploads the extension to the
Chrome Web Store and submits it for review (`.github/workflows/publish.yml`).
Pull requests only build and package. This file is the one-time setup and the
things worth knowing afterwards.

## How it fits together

- **Extension id.** `manifest.json` carries a `key` (public key) so every
  unpacked build has the id `mhdibbpkbdoofdbjkaplfdjmdfcacemp`. The matching
  private key `extension-key.pem` is gitignored. The store must end up with the
  **same** id, otherwise store installs and dev installs would have separate
  `chrome.storage.sync` data — that is what the first-upload step below is for.
- **The store rejects a manifest with a `key` field**, so
  `scripts/package-extension.mjs` strips it from the zip. On the very first
  upload the private key is shipped as `key.pem` inside the zip instead; the
  store derives its id from it and keeps it forever. Never include `key.pem`
  again after that.
- **Version.** CI sets `<major>.<minor>.<run number>` from the `major.minor` in
  `manifest.json`. Bump `major.minor` in the repo when you want a meaningful
  version; the run number keeps every upload strictly greater than the last,
  which the store requires. Do not rename the workflow file — the run number
  is per workflow, a rename restarts it at 1 and uploads would be rejected
  until you bump `major.minor`.
- **Review.** `--auto-publish` submits each upload for review. Google still
  reviews every version before users receive it (minutes to days). Remove the
  flag in the workflow if you prefer to press «Publish» yourself.

## One-time setup

### A. Store item (about 15 minutes, needs a Google account)

1. Register as a Chrome Web Store developer at
   <https://chrome.google.com/webstore/devconsole> (one-time USD 5 fee) using
   the Google account that should own the extension.
2. Build the first-upload package locally (requires Node 24, see `.nvmrc`):

   ```bash
   npm ci
   npm run build
   npm run package -- --include-pem extension-key.pem
   ```

   This writes `release/todo-extension-1.0.0.zip` with `key.pem` inside. The
   key must be PKCS#8 (`-----BEGIN PRIVATE KEY-----`); the script refuses
   anything else, because the store answers a PKCS#1 key with «key.pem cannot
   be processed». Convert with
   `openssl pkcs8 -topk8 -nocrypt -in extension-key.pem -out out.pem`.
3. In the developer console click **New item**, upload that zip. Fill in the
   store listing (description, at least one 1280×800 screenshot, a 128×128
   icon — `public/icons/icon128.png` works), the privacy tab (single purpose:
   «todo list on the new tab page»; permission justification for `storage`:
   «stores the user's todos locally and in Chrome sync»; data usage: no user
   data is transmitted to the developer), and set **Visibility** to
   *Unlisted* unless you want it publicly searchable.
4. Check the **Item ID** shown in the console. It must be
   `mhdibbpkbdoofdbjkaplfdjmdfcacemp`. If it is not, the zip was built without
   `key.pem` — delete the item and repeat step 2 and 3.
5. Save the draft. You can submit this first version for review now or let the
   first CI run do it.

### B. API credentials (about 10 minutes)

The pipeline talks to the Chrome Web Store API with an OAuth client that
belongs to the same Google account.

1. Open <https://console.cloud.google.com/>, create a project (any name, e.g.
   «chrome-todo-publishing»).
2. **APIs & Services → Library**, search «Chrome Web Store API», **Enable**.
3. **APIs & Services → OAuth consent screen**: user type *External*, fill in
   app name and your e-mail, save. Under **Test users** add the Google account
   from part A. (Leave the app in *Testing* — that is enough for your own
   account; the refresh token then does not expire unless unused for 6 months.)
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   application type **Desktop app**. Note the **Client ID** and **Client
   secret**.
5. Generate a refresh token:

   ```bash
   npx chrome-webstore-upload-keys
   ```

   It asks for the client id and secret, opens a browser, you sign in with the
   account from part A and grant access, and it prints a **refresh token**.
   (Reference: <https://github.com/fregante/chrome-webstore-upload-keys>.)

### C. GitHub configuration (about 5 minutes)

1. In the GitHub repo: **Settings → Secrets and variables → Actions → New
   repository secret**, create four secrets:

   | Name                | Value                                   |
   |---------------------|-----------------------------------------|
   | `CWS_EXTENSION_ID`  | `mhdibbpkbdoofdbjkaplfdjmdfcacemp`      |
   | `CWS_CLIENT_ID`     | OAuth client id from B.4                |
   | `CWS_CLIENT_SECRET` | OAuth client secret from B.4            |
   | `CWS_REFRESH_TOKEN` | refresh token from B.5                  |

2. Optional but recommended: **Settings → Environments → New environment**
   named `chrome-web-store`, add yourself as a *required reviewer*. Every
   publish then waits for one click of approval in the Actions run. Without
   the environment GitHub creates it automatically on first run, without
   protection.
3. Store `extension-key.pem` somewhere safe outside the repo (password
   manager). It is only needed again if the store item is ever recreated.

### D. First run

Merge to `main` (or **Actions → Build and publish → Run workflow**). The
`build` job produces the zip as an artifact, the `publish` job uploads it. In
the developer console the new version shows up as *Pending review*.

## Day-to-day

- Push to `main` → new version submitted. Nothing else to do.
- Real version bump: change `major.minor` in `manifest.json` (e.g. `1.1.0`).
- A rejected upload with «version must be greater» means the run number went
  backwards (workflow renamed) — bump `major.minor`.
- Rotating credentials: repeat B.5 for a new refresh token; if the OAuth client
  is recreated, update all three `CWS_CLIENT_*`/`CWS_REFRESH_TOKEN` secrets.
- Local package without upload: `npm run build && npm run package`.
