---
title: Brand and UI rules
summary: The rules every screen follows, so the app looks and sounds like one product.
audience: internal
order: 2
---

The living style guide is at `/brand`. These are the rules in short.

## Look

- Use design tokens and shared components only. No hand-picked colours, no one-off buttons.
- The whole look changes from one brand colour ramp. Change it once, never per screen.
- Icons come from the shared icon list. Light weight by default, filled for the selected state.
- Every screen works at 320 px wide and in dark mode.

## Layout

- A page starts with a title, a short description and its main action.
- Lists are tables inside a card; the whole row is the link. An empty list says what to do next.
- Notices use the **Callout** component, never a hand-built coloured box.
- A record's fields are read-only until you press Edit.

## Voice

- Sentence case. Plain, short words.
- Buttons say what happens: **Save changes**, not Submit.
- Say what happened and what to do next. Skip "successfully" and "please note".
- Never show a raw error. Show the message and the error reference.

## Dates and money

- Dates are stored in UTC and shown in the app's time zone.
- Money is whole cents everywhere in code.
