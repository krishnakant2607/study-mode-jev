# YouTube Study Mode
<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
TypeScript, plain HTML/CSS, Chrome Manifest V3. The accepted implementation plan uses TypeScript. Vanilla UI and esbuild packaging keep the unpacked build small and reproducible.

## Users
People using YouTube to learn or study. Parental supervision is not included in this first build.

## Product Purpose
Cover distracting recommendations, including thumbnail and text, and preserve useful learning content. Optional keyword lists distinguish semantic meanings such as Python programming versus snakes.

## Capabilities and Constraints
Home, search, related-video cards; optional Shorts blocking; uncertainty and API failures stay covered. Live judgments use Jev. A clearly labelled rehearsal is separate, deterministic, and never a fallback on real YouTube. Credentials are entered in extension settings. Counters report unique videos and actual display decisions; no invented time saved.

## Brand Commitments
User supplied three charcoal/orange dashboard references and requested a classy, premium panel. Working product name is YouTube Study Mode. Focus controls take precedence over analytics.

## Evidence on Hand
Research notes in the separate Codex artifact directory. Three user-supplied visual references. No measured classification accuracy or live API key yet.

## Product Principles
Keep the user in control. Hide uncertain recommendations. Separate model judgments from display policy. Label rehearsal and live inference. Report useful activity without exposing hidden titles in the dashboard.
