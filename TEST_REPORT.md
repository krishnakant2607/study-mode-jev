# Verification report

Build checked on 10 October 2026. TypeScript type checking passed.

## Automated logic and worker tests: 17 passed

Semantic Python intent, general learning, off-topic education, uncertain evidence, clickbait and Shorts policy; malformed answers; metadata bounds; cache invalidation; duplicate counters; trusted senders and private credentials; concurrent request deduplication; stale keyword/session responses; rehearsal isolation; missing/rejected keys; transient rate-limit retry; failed repeat connection tests; key removal during an in-flight request.

## Packaged browser tests: 9 passed

An isolated Chromium profile loaded the actual Manifest V3 build. Its API transport was explicitly mocked and YouTube navigation served authored HTML fixtures. No real key was used.

1. Popup key controls, connection feedback and Python session setup.
2. Home/search/related/lockup detection; covered titles invisible and underlying controls inert.
3. Reused cards re-covered after their content changes.
4. Duplicate cards use cached judgments without another inference call.
5. Enter adds independent Python/DSA keywords; either lesson is allowed, matching memes covered, duplicate chips rejected.
6. Keyword changes reclassify cards and reveal the relevant lesson.
7. Missing titles stay covered until details arrive and permit classification.
8. Disabling restores original content and keyboard interaction.
9. Separate offline rehearsal and a 320px sidebar without horizontal overflow.

No page errors were recorded. Generated captures: `artifacts/panel.png`, `artifacts/sidebar-320.png`, `artifacts/rehearsal.png`. The final captures show settled switches, authored-decision status and the complete embedded panel. A separate finish review identified the status and credential-race issues; both were fixed and regression tested.

## Still required before the live demo

User-supplied API access and account quota; actual YouTube layout detection in the presentation profile; real Jev decision-quality calibration; venue connectivity; manual native sidebar opening. Automated mock tests cannot establish these. Follow `DEMO.md`.
