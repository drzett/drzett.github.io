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
| Local import and virtual paths | HTML, folder and ZIP imports; local files are served through virtual `__site/` paths with relative assets. | **Present**, but needs a real browser/Safari regression pass. | `core/projects.js`, service worker |
| Website shortcuts | URL validation, separate website type, edit and delete behavior. | **Partial**: creation and type preservation are active; editing and all historical viewer behavior are not yet equivalent. | `core/projects.js`, `main.js` |
| Website icon discovery | Candidate website/PWA icons were detected, retained as the default, cached where possible, and fell back safely. | **Partial**: candidate discovery exists, but caching, loading reliability and fallback parity are incomplete. | website icon service |
| Website viewer | Embedded website launch, reload, navigation controls and an external-browser fallback where embedding is blocked. | **Partial**: the viewer exists, but the black-screen/blocked-frame path is unresolved. | website viewer module |
| Home layout | iPhone-style grid, widgets, dock geometry, labels and persisted placement. | **Partial**: state persistence and four explicit dock slots are active; clipping/edge hit-testing and full geometry parity remain open. | `ui/home.js`, Home CSS |
| SpringBoard editing | Long press with movement tolerance, click suppression, wiggle, visible full-size drag item, target indication and cleanup. | **Partial**: long press, drag and target handling exist; motion values, full-size drag fidelity and iOS pointer/scroll validation remain open. | `ui/home.js` |
| Dock | Four visually even slots, intentional placement into each slot, deterministic ordering and moves in both directions. | **Partial**: canonical four-slot state and bidirectional moves exist; visual slot alignment and Safari interaction need correction. | `core/home-state.js`, `ui/home.js` |
| Pro Runner Home icon | A persistent return-to-workspace icon, configurable image/designer/default icon and optional dock placement. | **Present**: the canonical Home edit dialog supports image, designer, default icon and dock placement. | Home settings module |
| Icon Designer | Sixteen backgrounds, two independent text/emoji layers, position, scale and rotation controls, image replacement and stored design configuration. | **Present**: the canonical designer stores the two-layer configuration in the shared asset repository and migrates prior one-layer designs. | `ui/icon-designer.js` |
| Calendar widget | Styled month view, localized day labels, highlighted current day and stable widget geometry. | **Partial**: a styled month view is active; final typography, weekday treatment and geometry must be compared visually. | Home widget module/CSS |
| Clock and widgets | Configurable clock/calendar widgets and Home edit behavior. | **Partial**: widgets render, but full edit/configuration parity is not yet verified. | Home widget module |
| Workspace settings | Wallpaper presets and custom image, start view, labels, feature defaults, storage summary and clear-data workflow. | **Partial**: controls are wired; diagnostics, storage details and persistence require complete verification. | settings module |
| Diagnostics | Runtime capabilities plus useful console, network and performance reporting. | **Partial**: capability rendering and a dialog exist; runtime event capture is not implemented yet. | diagnostics module |
| Update UI | Version/update status and reload flow independent of user-data storage. | **Partial**: shell update UI remains active; service-worker/update regression coverage is incomplete. | updater module |
| Keep awake | Wake Lock acquisition, release and UI state. | **Missing**. | runtime capability module |
| iOS touch behavior | Scoped touch/pointer handling for SpringBoard without blocking normal page or embedded-viewer scrolling. | **Partial**: the controller avoids global prevention, but Safari/Home-Screen PWA behavior is unverified and historical edge cases are not yet migrated. | `ui/home.js`, viewer module |
| Service worker | Versioned shell cache, virtual local-file routing and no user-data reset during updates. | **Partial**: core routing is active; manifest/upgrade behavior needs dedicated integration checks. | `sw.js`, service-worker core |

## Migration order

1. Restore the complete Icon Designer data model and the Pro Runner icon
   configuration flow using the canonical repositories.
2. Restore website icon discovery/cache and the blocked-embed browser fallback.
3. Reconcile Home geometry, target hit testing, drag rendering and Wiggle
   values against the historical CSS and behavior.
4. Restore diagnostics, Wake Lock and remaining settings/update behavior.
5. Add regression coverage for each completed row, then perform the manual
   iPhone Home-Screen PWA checklist before any production proposal.

Historical modules remain source material only. They must not be re-added to
the runtime import chain.
