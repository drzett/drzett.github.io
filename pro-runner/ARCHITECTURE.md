# Pro Runner Architecture

## Ownership

`projects` in IndexedDB owns local and website project records. Local projects retain imported files in `files`; custom icons and wallpaper remain in `assets`. `meta/home-state-v3` owns grid positions and ordered Dock membership. `meta/app-settings-v2` owns UI settings.

The first architecture-refactor launch migrates legacy project records and legacy localStorage settings/layout in place. It records completion in `meta/architecture-migration-v2`; legacy localStorage is not deleted. Updates and service-worker cache changes never clear user storage.

## Runtime

`main.js` is the only application boot entry. It composes storage, project operations, icon rendering, and the Home controller. The update UI is independent. Each subsystem owns its own listeners; no versioned patch module, observer-installed behavior, or import-order dependency is part of the active runtime.

The service worker serves local files from `__site/<project-id>/` and caches the current static shell. Website projects remain explicit website records and use the external viewer wrapper.

## Validation and rollback

Run `npm test` before review. The suite covers data migration, boot, Home edit mode, and reload persistence in Chromium and WebKit. Manual iOS Home-Screen PWA checks remain required for installed fullscreen behavior, local-file imports, scrolling, long press, drag/Dock geometry, updates, and offline use.

This work must remain on a non-production branch until approved. A rollback restores the previous `gh-pages` commit; user IndexedDB data is not part of the deployment and remains intact.
