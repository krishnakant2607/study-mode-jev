# Architecture

## Deterministic perception and execution

`src/detector.ts` discovers known desktop YouTube card renderers and extracts bounded titles, channels, descriptions, durations and video IDs. `src/content.ts` covers new and reused candidates, prioritizes visible/nearby cards, observes navigation and mutations, and restores original content and keyboard interaction when disabled. Opaque covers hide the entire card and make original controls inert.

Keyword matching is case-insensitive and uses whole keywords or phrases across each card's title, channel and description. It accepts any of up to twenty keywords. Nonmatching cards are covered locally. Empty lists allow general learning evaluation. Existing single-topic settings migrate to a keyword list.

## Jev decision layer

`src/background.ts` owns credentials and communicates with `https://api.typesafe.ai/v1/systemone`. `src/core.ts` supplies five named Noul questions: education, entertainment, relevance to any keyword, clickbait and evidence sufficiency. Every answer must have the expected type and a finite value in [0,1]. Display thresholds are conservative initial policy, not measured accuracy guarantees.

Transport concurrency is bounded to three. Failures and transient rate limits get one bounded retry. Duplicate in-flight evaluations share a request. Identical metadata/keyword/model evaluations reuse a local 24-hour cache, capped at 1,000 entries. A changed key clears the cache and invalidates pending replies. Changed keywords/sessions reject stale display replies.

## State and activity

Settings, keys, counters and cache live in trusted extension storage. Public snapshots omit the key. Only extension pages can change settings or credentials; only the expected YouTube origin or extension-owned demo can request classification. The rehearsal cannot be requested by YouTube clients.

Counters retain the most recent 1,500 unique video IDs in a session. Repeated IDs replace their prior decision. Entire Shorts shelves may be covered without being counted as individually evaluated videos. Activity never repeats hidden titles or estimates time saved from video duration.

## Privacy and permissions

The key stays in `chrome.storage.local`, with access restricted to trusted extension contexts. This is local storage, not an encrypted secret vault. Remove the key before sharing the browser profile. The key is never bundled and is never sent to a site other than TypeSafe for inference.

Eligible titles, channel names, available descriptions, durations and keywords are sent directly to TypeSafe. Cache keys retain this metadata locally. Counters retain IDs and decisions. No video frames, transcript, audio, thumbnail image or full page HTML is sent. Host access is limited to YouTube and TypeSafe; `storage` and `sidePanel` support persistence and the sidebar.

## Rehearsal boundaries

`src/fixtures.ts` and `src/demo.ts` provide fictional cards and explicitly authored judgments. Rehearsal settings/counters are separate from live settings/counters. The localhost preview uses the same UI and detector but cannot save keys or infer live judgments. It never supplies authored decisions on real YouTube.

## Compatibility boundaries

Known home/search/related renderers are supported. YouTube experiments or renderer changes can evade detection. New pages can render before settings arrive. Metadata can be misleading; the extension does not inspect the video itself or enforce child safety. Live account access, presentation-profile layout compatibility and threshold calibration require the manual checks in `DEMO.md`.
