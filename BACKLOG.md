# Backlog

## Deploy via GitHub Actions instead of building on the server

**Today:** `update.sh` on the production server (`/var/www/ava_map`) pulls, runs `npm ci` and `npm run build`
there, and restarts pm2. The server needs Node, npm, and a GitHub read token for the private
`@rocasspb/avaawa-shared` package.

**Goal:** a GitHub Actions workflow in this repo builds `dist/` and uploads it to the server; the server only
serves files.

- Workflow on push to `main` (or a tag): `npm ci` (token from `GITHUB_TOKEN`/PAT secret), `npm test`, `npm run build`.
- Upload `dist/` + `server/` over SSH/rsync to the server, then `pm2 restart avaawa`.
- Create a restricted deploy user (not root) and an SSH deploy key stored as an Actions secret.
- Remove the npm token from the server once deploys no longer install packages.
- Decide whether the Express server (`/api/*`) is built (`tsc`) or still run through `tsx`; the server needs
  runtime deps either way, so either ship `node_modules` or run `npm ci --omit=dev` on the server.
- Optional: healthcheck after restart, with automatic rollback to the previous `dist/`.

## Production cleanup (server)

- pm2 holds 54 `avaawa` entries (53 stopped duplicates) from the old `pm2 stop` + `pm2 start` flow.
  `pm2 delete` the stopped ones, then save with `pm2 save`. The new `update.sh` uses `pm2 restart`.
- `package-lock.json` on the server was modified in place; reset it (`git checkout package-lock.json`)
  before the first `git pull` of this branch.
- App runs as root under pm2; move to an unprivileged user.

## Shared library publishing

- Add a test step to the `publish-shared` workflow in `ava_android` (shared tests currently live in `commonTest`;
  verify the correct Gradle task for the wasmJs target first).
- Consider a CI check in `ava_gem` that opens a PR when a new `@rocasspb/avaawa-shared` version is published
  (e.g. Dependabot for npm with GitHub Packages registry).
- Production Wasm is ~245 KB; the previously committed `kmplib` was the ~2.2 MB development build.

## Other

- `incidents` branch uses an unofficial incidents API: do not deploy until permission is granted.
