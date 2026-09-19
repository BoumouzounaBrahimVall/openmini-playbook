# technews — OpenMini mini-app

Instructions for AI coding agents (and humans) working in this project.

## What this is

An OpenMini mini-app: a plain React web app that talks to its host app
through the typed `mini.*` bridge from `@openmini/runtime`. It builds to
static files, is packaged as a `.mpkg`, and is distributed via a
static-file registry. There is no server code here, and no host-framework
code (React Native, Flutter, …) — the host is opaque behind `mini.*`.

## Check up-to-date docs before trusting memory

OpenMini is young and moves fast. Do NOT rely on trained-in knowledge of
its APIs — fetch the specs pinned to the SDK version this app was
scaffolded with before adding or changing any `mini.*` call, manifest
field, or packaging step:

- Bridge protocol (API surface, errors, events):
  https://github.com/BoumouzounaBrahimVall/openmini/blob/v0.1.3/specs/bridge-protocol.md
- Manifest:
  https://github.com/BoumouzounaBrahimVall/openmini/blob/v0.1.3/specs/manifest.md
- Package format (`.mpkg`):
  https://github.com/BoumouzounaBrahimVall/openmini/blob/v0.1.3/specs/package-format.md
- Registry protocol (publishing):
  https://github.com/BoumouzounaBrahimVall/openmini/blob/v0.1.3/specs/registry-protocol.md
- Latest docs (may be newer than this app's SDK):
  https://github.com/BoumouzounaBrahimVall/openmini#readme

## Commands

- `npx mini dev` (or `npm run dev`) — dev server with a browser mock host
- `npx mini build` — production-build to `dist/web`
- `npx mini pack` — build and package into `dist/<id>-<version>.mpkg`
- `npx mini inspect <file.mpkg>` — validate a package and print its summary
- `npx mini publish [package] --registry <dir | s3://bucket[/prefix]>` —
  publish to a registry
- `npm test` / `npm run typecheck` — the pure core (`src/feed/feed.ts`,
  `src/feed/preview.ts`, `src/prefs/`) is covered by the single
  `src/feed/feed.test.ts`; components have no tests, matching the sibling apps.
- `node scripts/generate-icon.mjs` — regenerate `icon.png` from scratch. Run
  from this directory. Zero npm dependencies and byte-for-byte deterministic,
  so re-running it on an unchanged script produces no diff; the design lives in
  the script's header comment. Never hand-edit `icon.png`.

## Bridge surface (v1 — FROZEN)

The built-in surface is frozen: do NOT invent `mini.*` APIs. Anything not
listed here must go through host-defined APIs (`mini.host.*`) or an
upstream spec change.

| API                                                   | Manifest permission |
| ----------------------------------------------------- | ------------------- |
| `mini.storage.get/set/remove` — string KV, per-app    | `storage`           |
| `mini.ui.showToast({ message, durationMs? })`         | `toast`             |
| `mini.system.getInfo()` — platform, locale, theme, …  | —                   |
| `mini.navigation.close()` — ask host to dismiss app   | —                   |
| `mini.request({ url, method?, headers?, body?, … })`  | `network`           |
| `mini.host.invoke(name, payload?)` / `.on(name, cb)`  | `host:<name>`       |
| `mini.lifecycle.onLaunch/onShow/onHide/onDestroy(cb)` | —                   |

Failures reject with a `BridgeError` whose `code` is one of
`PERMISSION_DENIED`, `API_NOT_FOUND`, `INVALID_PAYLOAD`,
`NETWORK_DOMAIN_BLOCKED`, `HOST_ERROR`, `TIMEOUT`.

## Manifest (`manifest.json`)

The manifest gates the bridge: a permissioned API only works if listed in
`permissions`, and `mini.request` origins must be in `allowedDomains`
(checked before any I/O). This app's id is `com.example.technews`. It asks for `storage` (keywords and
the last-opened stamp), `network` with two allowed origins, and the
host-defined `host:openUrl`. Full field rules are in the manifest spec above.

| Origin                   | Used for                                              |
| ------------------------ | ----------------------------------------------------- |
| `https://hn.algolia.com` | one `search_by_date` request per day window           |
| `https://r.jina.ai`      | one metadata request per opened story (description, page text for the excerpt, social image); keyless, 20 requests a minute per address, so never for a whole window |
| `https://wsrv.nl`        | image proxy: every preview image is resized through it, so this is the only image origin the package's CSP has to allow |

Remote images need `@openmini/cli` 0.1.4 or later at pack time: earlier CLIs
inject `img-src 'self' data:` and every `<img>` is blocked on device, whatever
the manifest says. Pack with the CLI from the openmini repo until it ships.

`host:openUrl` is registered by the playbook super-app
(`super-app/openmini-playbook/src/api/host-apis.ts`) and hands an http(s) link
to the system browser. In `npm run dev` the same name comes from
`openmini.dev.ts` in this directory, which `@openmini/cli` reads from 0.1.4 on;
older CLIs answer `API_NOT_FOUND` and the row shows "This host can't open
links".

## What this app is

A personal Hacker News digest. One Algolia request per rolling 24h window,
seven windows anchored at launch, ranked by
`log10(points + 2*comments + 1) * (1 + 1.5*keywordMatches) * recencyDecay`.
A tap unfolds a story in place: the post body for a text post, otherwise the
article's description (or the first few hundred characters of its text when
it has none) and social image fetched on demand, then "Open" and "N comments"
buttons. Pull down at the top to fetch the day again; editing the keywords
drops the whole cache and fetches the selected day. The focus chips under the
day chips are a session-only, client-side filter (`filterByFocus`): they never
trigger a request. Both go through `mini.host.invoke("openUrl")`. Never use
an `<a href>` for them: the host draws no chrome, so a top-level navigation
would replace the app together with its close button.

## Rules of thumb

- Storage keys and values are strings — JSON-encode structured data.
- Non-2xx HTTP responses resolve normally; check `response.status`
  (HTTP errors are data, not bridge errors).
- `mini.lifecycle.onDestroy` is the last message the app receives — flush
  state there.
- Any React UI library is fine; the bridge doesn't care about rendering.
