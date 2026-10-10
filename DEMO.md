# Hackathon demo runbook

## Prepare before presenting

1. Install `dist` in the exact Chrome profile you will present. Pin the extension and keep the project/ZIP locally.
2. Enter your own TypeSafe key in Settings. Test the connection on the venue network. If your account supports a versioned Jev model, pin it and repeat the test.
3. Add `python` with Enter, then turn Study Mode on. Reload YouTube. Confirm a genuine Python lesson remains visible and distracting/off-topic results are covered. Check home, search, scrolling and the sidebar on this actual layout.
4. Add `dsa` as a second keyword, then turn the switch off and back on. Confirm the original cards restore and no console errors appear. Confirm the header shortcut opens the sidebar in your installed Chrome.
5. Open **Rehearse demo** once. Confirm the page is labelled, controls work and Python/JavaScript changes preserve the right authored lesson. Keep this tab ready.
6. Do not update the model, dependencies, extension build or browser immediately before the talk. Keep a short screen recording of the validated live flow, labelled with when it was recorded.

## A two-minute presentation

- **Problem:** “I open YouTube to learn, but the recommendations pull me elsewhere.”
- **Start:** Show the Focus switch, enter Python programming, then show the live YouTube search. Call out a retained lesson and an opaque cover hiding the entire distracting card.
- **Explain Jev:** “We supply bounded text metadata. Jev answers five typed questions. Our code decides whether to show the card; uncertainty stays covered.”
- **Demonstrate control:** Add or remove keywords, show recommendations re-evaluated, then switch off to restore the original page.
- **Show Activity:** Explain unique videos, cover reasons and uncertainty. No fabricated time-saved number.
- **Finish:** Show the clearly labelled offline rehearsal as engineering preparation, with settings and counters separate from live use.

## If a dependency fails

- **Network/API outage:** Covers remain in place. Show the recovery message and use the labelled rehearsal tab. Say explicitly that these are authored sample decisions, not live inference.
- **401/403:** Update the private key and test again. Never expose the key during the presentation.
- **Rate limiting:** Pause briefly; use Retry after recovery. Do not repeatedly refresh or press buttons.
- **YouTube layout mismatch:** Use the recording of the validated live flow, then the rehearsal. Do not claim the rehearsal proves compatibility with the changed layout.
- **Extension updated mid-session:** Reload the extension and existing YouTube tabs. Old content scripts cannot reconnect reliably after an extension reload.

## What you can truthfully claim

The build integrates Jev, covers recognized recommendation cards, preserves controls and tracks real display decisions. The automated tests validate behavior with mocks. Claim live compatibility or decision quality only after you have completed the live checks above; do not describe the extension as a child-safety product.
