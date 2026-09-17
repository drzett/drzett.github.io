# Pro Runner

Pro Runner is a local-first PWA runtime for static web projects and website shortcuts.

## Development

Run `npm install`, then `npm test`. The test suite starts a local static server and runs Chromium and WebKit coverage. Test fixtures are synthetic and browser storage is isolated per test.

## Release safety

Development happens on a non-production branch. Do not publish to `gh-pages` before automated checks and manual iOS Home-Screen PWA validation are complete.
