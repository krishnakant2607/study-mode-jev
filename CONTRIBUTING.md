# Development

Use Node.js 22 or later and npm. Install locked dependencies with `npm ci`.

```sh
npm run typecheck
npm test
npm run package
```

The build goes to `dist`; the packaged extension goes to `artifacts/study-mode-extension.zip`. Neither generated output nor `node_modules` belongs in Git. CI generates a downloadable package for each validated push.

For isolated browser tests:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

The test browser uses a temporary profile, authored YouTube DOM and an explicitly mocked transport. No real key is needed. Screenshots/results go to `artifacts`. If Playwright is already installed elsewhere, set `STUDY_PLAYWRIGHT_MODULE` to its module path.

For manual iteration, run `npm run build` and `npm run preview`. For installed-extension changes, reload the extension in `chrome://extensions` and reload the YouTube tab. Live credentials belong only in the extension's Settings field.

Keep policy in `core.ts`, credential/network boundaries in `background.ts`, discovery in `detector.ts` and covers in `content.ts`. Preserve reversible interaction, stale-response guards and separate rehearsal/live states. Add a meaningful regression check when changing these behaviors; document remaining live limitations honestly.

Before proposing a change, run the applicable checks and describe the observable result and any compatibility limits. Never commit API keys, GitHub tokens, browser profiles or private browsing data.
