# Local development security boundary

This branch supports **one user, localhost only, development/testing**.
It is not production authentication and is not approved for Internet-facing, LAN,
multi-user, reverse-proxy, tunnel, port-forwarding, container or public deployment.

## First milestone: no API keys

- Use Node.js 22.13+ LTS and a pnpm version compatible with lockfile v9.
- Use a fresh checkout and a fresh database. Old browser user IDs are not migrated.
  Existing projects owned by old IDs will not appear; do not migrate data yet.
- Use the pinned lockfile and initially disable all dependency build hooks:
  `pnpm install --frozen-lockfile --ignore-scripts`.
  This is a recommended later command, not authorization to execute it now.
- Native `better-sqlite3` may require an independently reviewed build/prebuilt
  binary. Review that package and its native build dependencies before approving
  a targeted rebuild. Do not bulk-approve build scripts.
- Only after that review, start with
  `pnpm exec next dev --hostname 127.0.0.1`, with no API credentials in the shell
  or .env files. Open http://127.0.0.1:3000.
- Do not run generation, Python scripts, FFmpeg or Docker in this milestone.
- Startup creates/migrates SQLite and starts the task worker. Use fresh data so
  there are no historical jobs; migrations include destructive column removal.
- Set `NEXT_TELEMETRY_DISABLED=1` locally if desired before starting Next.js.
  No runtime or dependency checks were performed during this static hardening.

## Identity and local access

The server assigns the fixed identity `local-user`. Headers, cookies and browser
storage do not choose an identity. This deliberately provides no isolation
between local processes/users. The listener binds to 127.0.0.1, and the request
proxy rejects non-loopback hosts and cross-site browser requests. This is defense
in depth, not permission to publish the service.

## Media storage

Only `UPLOAD_DIR` (default ./uploads) is approved for application media access.
Keep it dedicated to media; never set it to the repository, home directory, root
filesystem or database/config directory. Do not put secrets in uploads.
The shared validator rejects traversal/encoded paths and checks canonical paths
using path.relative, including symlink escapes and output ancestors.
The local filesystem must remain under the single user's control; this does not
sandbox a hostile local process racing filesystem changes.
Windows-style backslash media paths are currently rejected; the first smoke test
should use a Unix-like environment and the default uploads directory.

## Credentials and providers (later milestone only)

Credentials belong only in gitignored server configuration such as .env.local.
.env.example lists empty names. Never use NEXT_PUBLIC_ for a secret.
Browser settings retain provider/model metadata only. Legacy model-store data is
rewritten through an allowlist when loaded; clear site data before the first run
if this app was used previously. Agent database credential columns are no longer
used; new/edited records store an empty compatibility value. Legacy databases or
backups may still contain old secrets, so use a fresh database.

Built-in providers use server environment credentials and trusted HTTPS hosts.
Browser metadata cannot change the server destination. Custom remote hosts are
disabled. Loopback HTTP/HTTPS is opt-in via the matching server BASE_URL; private
LAN addresses are not loopback. Direct provider requests and supported SDK custom
transports reject redirects. Google GenAI image/video SDK construction fails closed in this milestone because
its redirect transport could not be verified without dependency inspection.
Gemini text through the AI SDK retains its restricted custom transport; image/video
SDK functionality needs a separately approved transport review before enabling. Dify is limited to api.dify.ai or an explicitly
server-configured loopback instance. Provider-generated media downloads carry no
application credentials and reject redirects. The standalone Python utilities also
restrict credential destinations and reject redirects; they remain outside this milestone.

API agent/task responses use explicit field allowlists. Task payloads are not
returned, and credential-named fields are removed before new jobs are persisted.
Do not submit credentials in descriptions, prompts or other free-text fields.

## Deferred work

Dependency upgrades/advisory remediation, binary/ZIP audits, real authentication,
production deployment, encryption/cleanup of existing databases and backups,
provider privacy/cost review and credentialed integration tests are outside this
milestone. Deprecated dependencies and native builds still need separate review.
The documentation previously contained a credential-looking example; it is
redacted in this branch, not removed from Git history. Its owner must determine
whether it was real; no credential was tested or rotated.
