---
name: FocusMaxx
description: A quieter place to learn.
colors:
  charcoal: '#111112'
  surface: '#1b1b1d'
  raised: '#252527'
  line: '#343436'
  foreground: '#f3f0ec'
  secondary: '#b8b5b0'
  orange: '#ff944d'
  connected: '#a6cdb8'
typography:
  title:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: 20px
    fontWeight: 600
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'
    fontSize: 13px
  label:
    fontSize: 11px
  metric:
    fontSize: 25px
    fontWeight: 450
    letterSpacing: '-0.025em'
rounded:
  button: 8px
  input-group: 9px
  summary: 14px
spacing:
  panel: 24px
  compact-panel: 18px
  summary: 16px
components:
  button-primary:
    bg: '{colors.orange}'
    text: '#26190f'
    rounded: '{rounded.button}'
    padding: 10px 13px
  summary:
    bg: '{colors.surface}'
    rounded: '{rounded.summary}'
    padding: '{spacing.summary}'
---
# Design System: FocusMaxx

## Overview

The user's three charcoal/orange dashboard references anchor the visual direction: classy, premium, compact and legible. Focus controls lead; analytics support them. Tonal surfaces, restrained icons and tabular figures make a small utility feel carefully finished.

This document describes the implemented panel, not a new brand direction. Rehearsal has an explicit warm badge and authored-decision status. Empty sessions retain zero counts. Failures keep videos visible and show a recovery message.

## Colors

Charcoal is the canvas; surface and raised tones separate summary, fields and states. Warm foreground and secondary text provide hierarchy. Orange marks primary actions, enabled switches and covered-video segments. Muted green is reserved for a verified live connection. Neutral segments represent visible videos; orange represents covered decisions. Uncertainty stays visible and has an explicit text count.

## Typography

One system sans stack; Inter is used only when already available. No font download is required. The brand title is 20px/600, section titles 14px/550, controls 11–13px and help text 10px. Metric figures use tabular numerals, 28px/450 in Focus and 43px/450 in Activity. Long explanatory text has a 1.6–1.65 line height.

## Layout

The popup is 420px wide and scrolls above 600px tall. Sidebar content fills available width with a 280px minimum and a 500px panel maximum. Panel padding is 24px, reduced to 18px below 350px. Focus uses a three-column statistic row and forty evenly spaced meter segments. At compact widths, action buttons wrap. The rehearsal uses a separate two-column page and a fully visible embedded panel.

## Elevation & Depth

Depth uses tonal layering and fine borders. There are no ornamental shadows. The summary is a slightly lighter surface against the canvas, with a 14px corner radius. Fields and secondary buttons use a single fine outline.

## Shapes

8px buttons, 9px grouped fields, 14px summary corners and pill switches. Icons are compact SVG paths with 1.6px strokes; the pause mark is filled. Borders are subtle charcoal dividers. Focus outlines are 2px orange with a 3px offset.

## Components

Buttons use an orange/dark primary treatment and outlined charcoal secondary treatment. Disabled buttons dim and display a wait cursor while their action is pending. Tabs are a tonal segmented control with explicit current-page state. The keyword editor contains removable warm chips and an Enter-to-add field. Chips wrap at narrow widths, preserve phrases and expose labelled remove buttons. Inputs remain dark, have readable placeholders and a shared group focus outline. Switches transition over 180ms; reduced-motion preference removes transitions.

The summary has real checked/learning/covered counts and a segmented outcome meter. Activity exposes reasons without repeating filtered titles. Settings has a password field, explicit save/test actions, a model field and a remove-key action. An opaque cover hides all card children and makes them inert, while showing a neutral reason.

## Do's and Don'ts

- Do keep learning controls before session analytics.
- Do use the actual CSS values above when extending the panel.
- Do keep rehearsal and live states visibly distinguishable.
- Do preserve keyboard focus, compact sidebar behavior and reduced motion.
- Don't display synthetic statistics as live activity or infer time saved from video duration.
- Don't expose covered titles in the dashboard.
- Don't add decorative glow or gradients to this reference-driven panel.

Preferences use two labelled 98px text areas, readable placeholders and 9px corners. The optional keyword editor is progressively disclosed. The default tab has a concise Balanced policy note, personalization shortcut and an individual-Shorts toggle. There is no clickbait control.
