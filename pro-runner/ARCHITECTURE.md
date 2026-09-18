# Pro Runner Architecture

## Active application

`main.js` is the application boot entry. It composes the canonical storage,
project, Home, and icon modules. `update-ui.js` starts the independent update
controller in `update-ui-core.js`. Historical `v*`, patch, SpringBoard, and
`app.js` files are retained as reference material and are not loaded by
`index.html`.

`release.js` is the authoritative in-app release identity. It is consumed by
the page and the service worker. `version.json` is the network update manifest
required by static GitHub Pages hosting; `tests/release.test.js` prevents its
version, build, channel, or release date from drifting from `release.js`.

## Storage and virtual hosting

IndexedDB `pro-runner-v1` version 2 owns four stores:

- `projects`: local and website project records.
- `files`: imported local-project files keyed by project and relative path.
- `assets`: custom icons and wallpaper.
- `meta`: application settings, Home state, and migration markers.

The architecture-refactor migration normalizes legacy records in place and
does not delete legacy localStorage. Application updates and cache cleanup do
not clear IndexedDB, Cache Storage outside Pro Runner's own cache families, or
user settings.

The stable `sw.js` entry imports `release.js` and the non-versioned
`sw-runtime.js`. The runtime has sole ownership of installation, activation,
messages, and fetch routing:

- The application shell is pre-cached under one release-and-build-specific
  cache and served cache-first, preventing assets from different releases from
  being mixed. Root and `index.html` remain available offline.
- `__site/<project-id>/...` is resolved only from IndexedDB. Missing projects
  and files return explicit text `404` responses and never fall back to the
  Pro Runner shell.
- `version.json` is network-only and marked `no-store`; offline checks return a
  visible `503` instead of stale update information.
- Cross-origin and unrelated same-origin requests are left to the browser.

On activation, the worker deletes only current/legacy Pro Runner application
cache families (`pro-runner-app-shell-*`, `pro-runner-shell-*`, and
`pro-runner-patch-*`). This provides the transition from the currently
deployed patch/core worker without touching imported projects.

## Fresh installation and upgrades

On a fresh installation the shell is fully cached before the worker installs,
then the worker claims the page. Pro Runner enables imports only after the page
has an active controller.

On an upgrade, the new worker installs in the normal waiting state. Automatic
and manual checks may stage it, but do not interrupt an open imported
application. The user can install, postpone, or skip the offered version.
Installation uses `SKIP_WAITING`, verifies the resulting controller version,
and reloads only after successful takeover. Failures stay visible in update
settings. Existing IndexedDB version-1 installations are upgraded in place to
version 2; no clean installation is required for the current 2.x transition.

## Validation and rollback

`npm test` runs unit/consistency tests, isolated Chromium and WebKit UI tests,
and real Chromium Service Worker tests. Runtime coverage includes standalone
HTML execution, multi-file relative CSS/JS/assets, reload persistence, offline
startup, missing-file behavior, database-version consistency, legacy-cache
transition, and visible update failures.

Manual iPhone Home-Screen PWA checks remain required for installed fullscreen
behavior, file/folder import, scrolling, long press, drag/Dock geometry,
updates, and offline use. This work remains local on the refactor branch until
approved; no deployment step may clear browser data.
