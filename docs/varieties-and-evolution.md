# Creature varieties + evolution trees — design (opened 2026-07-08, Jeton)

Context: the size-variation switcher landed in the editor (a "Size variations"
section on each creature — switch the viewed form; per-size discover/own with
nicknamed owned instances). Jeton: *"this makes me think about possibly creating
other varieties for creatures as well as representing evolution trees."* This doc
scopes those two follow-ups. Nothing here is locked.

## Where we are now (the foundation this builds on)

- **Sizes** are a real per-instance axis: `data/forms.js` (Baby…Boss), each form
  re-derives HP/Might; a creature can be owned at any discovered size; per-size art
  (`sizeArt.js`, `creatureArtSizes.json`).
- **Owned instances**: `app/collection.js` — the collection is a list of
  `{iid, species, form, nickname}`; you can own several of the same species/size,
  each nicknamed. Team refers to instance ids.
- **Evolution (first cut)**: `engine/content/evolve.js` + `forms.js nextForm` —
  advances a creature one step UP the size ladder (Baby→…→Boss, terminal at
  Elite/Boss). Single linear target; used by the run campfire.

## 1. Varieties (a general "variant" axis)

A **variety** is an alternate rendering/tuning of the same species that isn't a
size. Candidates, in rough priority:

1. **Attunement / palette variants** — e.g. a Fire Emberwisp vs a Frost one; same
   species+kit, different element (already legal via multi-attunement) + a recoloured
   portrait. This is the most natural "shiny/variant" and reuses the reskin system
   (`cards/reskin.js`) + per-variant art.
2. **Subtype variants** — the same body wearing a different descriptive subtype
   (Mechanical vs Undead Beast). Mechanically real today (subtype card packages);
   would need a variant selector + naming.
3. **Cosmetic shiny** — pure recolour, no mechanical change (a rarity flourish).

**Proposed model.** Generalise the per-size switcher into a per-VARIANT switcher.
An owned instance grows optional fields: `{iid, species, form, variant?, nickname}`
where `variant` names the non-size variety (e.g. `att:Frost`, `subtype:Undead`,
`shiny`). The editor's "Size variations" section becomes "Variations" with two rows
(Size · Variety). `sizeArt`/portrait resolution extends to a `variantArt(id, form,
variant)` lookup. Keep sizes and variants ORTHOGONAL (a Boss Frost Emberwisp).

**Open questions:** which variety types ship first (attunement is the pick);
whether variants are earned (drop/breed) or just authorable; art cost (a variant ×
size matrix is a lot of images — resolve lazily, fall back to base like sizes do).

## 2. Evolution trees (branching)

Today evolution is linear along the size ladder. The ask is BRANCHING trees — a
species evolves into one of several targets under conditions (à la Pokémon).

**Proposed data.** A per-species `evolutions` list in the roster/def:
```
evolutions: [
  { to: 'voltfang',      when: { form: 'large' } },          // size-gated
  { to: 'stormfang',     when: { form: 'elite', item: 'thunderstone' } },
  { to: 'voidfang',      when: { form: 'elite', attunement: 'Void' } },
]
```
- `to` = a species id (evolution can CHANGE species/typings, not just size).
- `when` = a condition object (form reached, item held, attunement, HP threshold,
  battles won…). Multiple entries = a branch; the player/engine picks the met one.
- Terminal when no entry's `when` can still be reached.

**Editor.** A new "Evolution" section in the creature modal: a small node graph
(this species → its `to` targets, each with its condition), authorable inline;
read-only preview of incoming edges ("evolves from …"). Reuse the size-switcher UI
patterns. The Codex creature page shows the tree for discovered species.

**Engine.** Generalise `content/evolve.js` from `nextForm` to `evolutionsFor(species,
state)` → the list of currently-eligible `to` targets; the campfire/run offers the
choice. An owned instance's evolution SWAPS its `species` (and resets/re-derives its
deck from the new typings) while keeping its `iid` + `nickname`.

**Open questions:** does evolving consume the instance or add a new one; do we
author brand-new evolved species (content cost) or reuse existing roster ids as
targets; how size and evolution interact (is "grow to Large" an evolution or just a
size change?). Recommendation: keep SIZE (Baby→Boss, same species) and EVOLUTION
(species→species) as distinct axes; size is growth, evolution is transformation.

## Suggested sequencing

1. Branching-evolution DATA + engine (`evolutions` list, `evolutionsFor`), reuse in
   the campfire — mechanics first, on the existing roster ids.
2. Editor "Evolution" section (author + visualise the tree).
3. Attunement variety (the first non-size variant) end-to-end (data + art hook + UI).
4. Codex evolution-tree view.
