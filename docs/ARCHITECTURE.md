# FocusMaxx architecture

## Perception

`detector.ts` extracts bounded titles, channels, displayed snippets, duration, Shorts status and available channel-page context from recognized desktop YouTube renderers. It includes modern/legacy Shorts cards, standalone image-bearing Shorts links and an active `ytd-reel-video-renderer`. It never watches videos or sends thumbnail images, audio or transcripts.

## Judgment and policy

`core.ts` supplies one entertainment question plus optional nonblank preference questions: primarily entertainment, explicit positive preference match, explicit negative preference match. Keywords are optional semantic hints; missing keywords never reject a video. There is no clickbait question or requirement for lecture-style teaching. Channel context supports a decision without granting a blanket exemption.

The deterministic policy is: explicit hide match ≥0.90 covers; explicit allow match ≥0.90 keeps; otherwise an explicit entertainment title covers; otherwise entertainment ≥0.90 covers; all other judgments keep. Empty preference fields are omitted from the request and cannot match. Classification describes primary purpose independently of code-level display thresholds. Informative title markers bypass the category rule. Blank preferences allow local category decisions without a network request. Invalid replies, missing credentials and transport failures keep other content visible. Thresholds are initial policy and need live calibration.

## Execution

`content.ts` observes card insertion, navigation and metadata changes. Unknown and pending cards remain visible. Final cover decisions hide the original card and mark its children inert. Disabling restores content and keyboard interaction. Reused cards lose stale covers before re-evaluation. Blocked Shorts-player media is paused; a play event on a covered player is also stopped. The implementation does not auto-resume media after revealing it.

Three requests may run concurrently. Duplicate in-flight requests share a result. A 24-hour cache is keyed by rubric version, metadata, hints, preferences and model. Key changes clear the cache and invalidate pending replies. Preference/session changes reject stale display results. The new rubric discards prior strict-policy caches and resets their counters on upgrade.

## State and activity

`background.ts` owns credentials and trusted-message boundaries. Public snapshots never contain the key. Only extension pages can modify preferences or credentials. Real YouTube cannot request the authored rehearsal mode. Session outcomes retain the most recent 1,500 unique video IDs; repeated IDs replace earlier outcomes. Counters distinguish visible uncertainty from actual covered content.

## Privacy and permissions

The key stays in trusted extension `chrome.storage.local`, which is local storage rather than an encrypted vault. Content scripts cannot read it. Video text, limited page context, hints and preference text go directly to TypeSafe. Cache keys retain that text locally; Activity retains IDs and decisions. No entire page, image, transcript or audio is sent. Remove credentials before sharing a browser profile.

Host permissions cover YouTube and TypeSafe only. The sidebar and storage permissions support UI and persistence. Native `video.pause()` stops blocked player media locally, without reading or transmitting audio/video.

## Rehearsal and limitations

The extension-owned demo uses fictional metadata and explicitly authored judgments. Its settings/counters are separate from live use. Authored wildlife rules demonstrate the override mechanics; they are not an AI evaluation. Browser tests use routed DOM fixtures and mocked transport.

Live Jev decision quality, venue connectivity and actual YouTube renderer experiments need manual validation. Text metadata can misrepresent the video. Missing information deliberately stays visible. Comments, subtitles, playing-video frames and parental enforcement are outside scope.
