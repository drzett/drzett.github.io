# Feature Parity Inventory

This inventory compares the active architecture-refactor runtime with the
last feature-rich 1.6.0 implementation (`ad378d9`). It is a migration guide,
not a claim that the historical patch cascade should be restored.

Status meanings:

- **Present**: implemented by an active canonical module and covered by a
  relevant automated check where practical.
- **Partial**: some user-visible behavior exists, but it does not yet match
  the historical feature or has an unverified interaction/data path.
- **Missing**: no active canonical implementation exists.

| Area | Historical behavior | Active refactor status | Canonical destination |
| --- | --- | --- | --- |
| Project repository | IndexedDB projects, local files and assets survive upgrades. | **Present** for normalized local and website records; migration coverage exists. | `core/storage.js`, `core/projects.js` |
| Local import and virtual paths | HTML, folder and ZIP imports; local files are served through virtual `__site/` paths with relative assets. | **Present**: real Service Worker tests cover standalone HTML plus multi-file relative CSS, JS, fetched files and images through reload and offline startup. iPhone/Safari PWA validation remains manual. | `core/projects.js`, `sw-runtime.js` |
| Website shortcuts | URL validation, separate website type, edit and delete behavior. | **Partial**: creation and type preservation are active; editing and all historical viewer behavior are not yet equivalent. | `core/projects.js`, `main.js` |
| Website icon discovery | Candidate website/PWA icons were detected, retained as the default, cached where possible, and fell back safely. | **Partial**: common icon sizes and paths plus external favicon services are probed, with caching where CORS permits. Parsing arbitrary cross-origin page metadata remains browser-restricted. | `core/projects.js` |
| Website viewer | Embedded website launch, reload, navigation controls and an external-browser fallback where embedding is blocked. | **Partial**: the viewer cannot bypass third-party CSP/X-Frame-Options. “Open in browser” remains in the three-dot menu, and each website can be configured to launch directly in the browser instead of showing a blocked frame. | website viewer module |
| Home layout | iPhone-style grid, widgets, dock geometry, labels and persisted placement. | **Partial**: state persistence and four explicit dock slots are active; appearance changes no longer normalize hidden zero-size geometry or overwrite placement. Clipping/edge hit-testing and full geometry parity remain open. | `ui/home.js`, Home CSS |
| SpringBoard editing | Long press with movement tolerance, click suppression, wiggle, visible full-size drag item, target indication and cleanup. | **Partial**: long press, drag and target handling exist; the lifted icon remains transparent and animated while moving. Final iOS pointer/scroll validation remains open. | `ui/home.js` |
| Dock | Four visually even slots, intentional placement into each slot, deterministic ordering and moves in both directions. | **Partial**: canonical four-slot state, bidirectional moves, and non-layout-changing drag target markers exist; final Safari interaction needs device validation. | `core/home-state.js`, `ui/home.js` |
| Pro Runner Home icon | A persistent return-to-workspace icon, configurable image/designer/default icon and optional dock placement. | **Present**: the canonical Home edit dialog supports image, designer, default icon and dock placement. | Home settings module |
| Icon Designer | Sixteen backgrounds, two independent text/emoji layers, position, scale and rotation controls, image replacement and stored design configuration. | **Present**: the canonical designer stores the two-layer configuration in the shared asset repository and migrates prior one-layer designs. | `ui/icon-designer.js` |
| Calendar widget | Styled month view, localized day labels, highlighted current day and stable widget geometry. | **Partial**: a styled month view is active; final typography, weekday treatment and geometry must be compared visually. | Home widget module/CSS |
| Clock and widgets | Configurable clock/calendar widgets and Home edit behavior. | **Partial**: widgets render; the clock and Dock use a shared persisted glass material while the calendar intentionally remains opaque. Full widget editing parity is not yet verified. | `core/glass.js`, Home widget module |
| Workspace settings | Wallpaper presets and custom image, start view, labels, feature defaults, storage summary and clear-data workflow. | **Partial**: controls include persisted glass style/intensity and shared Home-surface frame treatments. Diagnostics and storage details still require complete verification. | `core/glass.js`, `core/frame.js`, settings module |
| Diagnostics | Runtime capabilities plus useful console, network and performance reporting. | **Partial**: capability rendering and a dialog exist; runtime event capture is not implemented yet. | diagnostics module |
| Update UI | Version/update status and reload flow independent of user-data storage. | **Present** for automatic/manual checks, notification, postponement, skipping, staged installation, takeover verification and visible failures. A deployed-version iPhone upgrade still requires manual validation. | `release.js`, `version.json`, `update-ui-core.js` |
| Keep awake | Wake Lock acquisition, release and UI state. | **Missing**. | runtime capability module |
| iOS touch behavior | Scoped touch/pointer handling for SpringBoard without blocking normal page or embedded-viewer scrolling. | **Partial**: the controller avoids global prevention, but Safari/Home-Screen PWA behavior is unverified and historical edge cases are not yet migrated. | `ui/home.js`, viewer module |
| Service worker | Versioned shell cache, virtual local-file routing and no user-data reset during updates. | **Present**: one active runtime owns lifecycle/routing, uses coherent release caches, cleans legacy app caches, preserves IndexedDB, handles missing virtual files explicitly, and has first-install/offline/transition coverage. | `sw.js`, `sw-runtime.js` |

## Migration order

1. Restore the complete Icon Designer data model and the Pro Runner icon
   configuration flow using the canonical repositories.
2. Restore website icon discovery/cache and the blocked-embed browser fallback.
3. Reconcile Home geometry, target hit testing, drag rendering and Wiggle
   values against the historical CSS and behavior.
4. Restore diagnostics, Wake Lock and remaining settings/update behavior.
5. Add regression coverage for each completed row, then perform the manual
   iPhone Home-Screen PWA checklist before any production proposal.

Historical modules, including `sw-core-v140.js`, remain source material only.
They must not be deleted or re-added to the runtime import chain while feature
parity work is still in progress.
