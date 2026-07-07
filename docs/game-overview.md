# Chimera Cards — Game Overview (conceptual reference)

> The canonical **conceptual** portrait of the game: the vision, the fantasy, and how
> the systems fit together — design-first (the *why* and the *shape*), not code-first.
> For implementation detail, follow the cross-references to the deep-dive docs and to
> `CLAUDE.md` (the living project-state log). Keep this doc updated when a *pillar-level*
> design decision changes; keep `CLAUDE.md` updated for per-milestone build state.

**Deep-dive docs this overview sits on top of:**
`docs/combat-engine-spec.md` (the locked Vanguard/Peek combat model) ·
`docs/synthesis-matrix-spec.md` (the 3-axis creature taxonomy) ·
`docs/biology-kits.md` (body types + kits) · `docs/archetype-design.md` (the 36 archetypes) ·
`docs/mechanics.md` (statuses + the reaction matrix) · `docs/hybrid-design.md` ·
`docs/varieties-and-evolution.md`.

---

## 1. The core fantasy

**Pokémon × Slay the Spire.** You are a tamer who captures, breeds/forges, and fields
**monsters** — but combat is a **card-driven deckbuilder**, not a stat-trade. Every
creature *is* a deck; a team is a portfolio of decks; a run is a descent where those decks
grow. The long-term north star is a **dynamic, multiplayer creature deckbuilder**: a living
world of generated creatures, shared DNA, and asynchronous rivalry, grounded in
StS2-caliber combat depth.

Three verbs define the player:

- **Collect** — capture creatures, own individual instances, nickname them.
- **Build** — assemble teams and decks from each creature's generated *potential* card pool.
- **Descend** — roguelike runs that test and evolve those decks.

---

## 2. The creature model — a 3-axis synthesis taxonomy

A creature is defined by a **triple of axes**, each holding **1–2 bases** (so hybrids are
first-class on every axis). See `docs/synthesis-matrix-spec.md` and `docs/biology-kits.md`.

- **Form / Body Type** — *what it fundamentally is.* **Humanoid · Beast · Aberration.**
  This is the **primary card-pool selector**: it answers "where do this creature's cards
  come from?"
- **Descriptive Subtypes** — *composition/affliction overlays, stackable in any
  combination.* **Mechanical · Elemental · Giant · Demonic** (backlog:
  Undead/Hallowed/Feral/Ancient/Swarm/Cursed/Spectral). A creature can be a *Giant
  Mechanical Beast*.
- **Attunement** — *elemental identity (replaces the old 16 "elements").* 13 bases
  (Physical, Fire, Frost, Water, Air, Nature, Stone, Energy, Void, Mind, Arcane, Holy,
  Shadow…) combining into ~91 named pairs.

### The kit system hangs off body type

Each body type has a **second, body-conditional axis** that supplies most of its cards:

| Body Type | Axis-2 kit (the "class" question) | Special factors (deck bulk) |
|---|---|---|
| **Humanoid** | **Archetype** (Warrior/Rogue/Mage/Warlock/Priest/Shaman/Ranger/Engineer) | **Weapons** (gated by archetype) |
| **Beast** | **Family** (Mammalian/Reptilian/Avian/Piscine/Insectoid/Amphibian/**Draconic**) | **Anatomy** noun-tags (Claws/Teeth/Beak/Horns/Tail/Wings/Venom/Hide/Shell/Breath…) |
| **Aberration** | **Manifestation** (Eldritch/Construct/Ooze/Flora/Crystalline/Formless) | **Aberrant-feature** tags |

**Archetype is Humanoid-only** — every other body is instinct-driven and carries no class
(its attunements aren't class-gated). Hybrids are the **elegant union** of both bodies' kits
(a Beast|Humanoid carries a Family *and* an Archetype), with a **synthesized name**
(Chimera/Anomalous/Warped; Cybeast = Mechanical Beast; Leviathan = Giant Draconic…). Naming
is data-driven from body × subtype × family.

### Stats — five stats, no levels

Derived from `Body × Subtype × Family` profiles: **Might** (damage) · **Guard** (block) ·
**Focus** (effects on others) · **Resolve** (buffs gained + debuff resist) · **Speed**
(tempo), plus HP. There are **no XP levels** — progression is **size/form** (see §3).

---

## 3. Size as identity

Six forms — **Baby · Small · Regular · Large · Elite · Boss** — each with HP/Might scaling
and *its own generated art*. Size is **part of a creature's identity**, not a cosmetic
slider: it shows in the name ("Large Ironhide"), and you can **own several of the same
species at different sizes**. Elite/Boss are terminal forms. The **Giant** subtype grants
bulk but no longer forces a large size (a Baby Giant is legal).

---

## 4. Cards & decks — deriving a deck from a triple

Creatures don't ship hand-authored decks (except custom/admin cases). A creature's
**potential card pool** is *generated* from its typings, across three planes of interaction
(`docs/synthesis-matrix-spec.md` §14):

- **Stat affinity** (Body × Subtype) — shapes the numbers.
- **Card content** (kit pools) — the Archetype/Family/Anatomy/Manifestation/Weapon/Feature
  pools, **element-reskinned** to the creature's attunement, **plus** the attunement's own
  **signature sub-pool** (~4–6 cards/element), **plus** subtype card packages, **plus**
  **hybrid signature cards** — cards that exist only at a genuine two-value axis (Fire+Frost
  "Thermal Shock", Giant+Mechanical "Siege Bulwark").
- **Emergent combos** (all three together).

**Factors are mechanically real:** a Venom beast literally *starts* with a venom move. The
**starter deck** guarantees a Strike + Defend base, then fills signature slots so each factor
is represented.

**Rarity is one unified 7-tier ladder** shared by cards *and* creatures:
`basic · common · uncommon · rare · epic · mythic · legendary · godly`.
Open-world deckbuilding is **free choice against a rarity-weighted budget** (Σ rarity points
≤ cap); dungeon decks instead **grow through rewards**.

---

## 5. Combat — the Vanguard/Bench engine

The heart of the game, and a deliberate rebuild from 1-v-1 into a **symmetrical
action-economy duel of teams**. Authoritative spec: `docs/combat-engine-spec.md` (LOCKED).

- **Active Vanguard + Bench.** Each side fields one active creature (its own deck/hand); the
  rest wait on the bench. Both sides share a symmetrical **energy economy** =
  `max(3, benched)`.
- **Swaps** cost escalating energy, ride mid-turn, and grant entry boons; a downed vanguard
  triggers a **free death-swap**.
- **Peek** — a limited-charge scouting system that reveals the enemy's forecasted
  multi-action turn; reveals are turn-wide and survive re-plans (no refund; charges reset per
  encounter).
- **Targeting** uses a locked **18-token scope vocabulary** (vanguard / bench / whole-side /
  self / spatial `fortifySlot` auras…).
- **Block** is creature-bound, rides swaps, and decays at the **start of its own side's
  turn** (StS-style). **DoTs** tick at the **opponent's** turn-end; **Regen** at the
  **carrier's own** turn-end.
- **Enemy AI** is a priority + lookahead planner with difficulty tiers (basic→expert): it
  seeks reactions, sets up its own primers, plays around matchups, and **re-plans after every
  player action**.

### Statuses & the reaction matrix (`docs/mechanics.md`)

Each attunement has a **signature status** and a **reaction verb**:

- Fire *detonates* (Burn) · Frost *freezes/locks* · Water (**Soak**) *primes/conducts* ·
  Void (**Decay**) *devours* buffs/powers + strips Block · Energy (**Shock**) taxes energy ·
  Mind (**Confuse**) fizzles/retargets · Physical (**Bleed**) ramps with hits · Air
  (**Expose**) bypasses Block + can lock a creature out · Arcane (**Amplify**) crits the next
  hit · Stone (**Fortify**) is a slot-bound Block aura.
- Plus the vanilla StS-ish set: Poison/Burn/Weak/Vulnerable/Frail/Strength/Dexterity/Regen…

**Reactions** are a data-driven `status × attunement` matrix: attacking into a primed status
fires an *interesting* effect (not just bonus damage). Detonating cells consume the primer,
amplifying cells grow it, and magnitude scales with primer stacks. Players get a drag-time
forecast; the AI actively sets up its own primers. **Pure upside** — statuses still stand
alone.

### Matchups

Two layered magnitudes, both keyed on **attunement**:

1. **attunement → attunement** (×1.5 / ×0.66).
2. **biology → attunement constitution** (a body/subtype is innately weak/resistant to
   certain elements, ×1.25 / ×0.8) — with an **override**: a creature attuned to the incoming
   element cancels its constitutional weakness.

**Archetype has no matchup effect.**

---

## 6. The run / meta layer

A Slay-the-Web-style **action-queue + undo** roguelike:

- A seeded, typed **map** — combat / elite / boss / rest / treasure / shop / event — picked
  from curated **encounter bands** by depth so difficulty and theme stay coherent.
- A **party** of creatures, each carrying their own HP + growing deck; **gold**, **relics**,
  **potions**.
- **Rewards** draft from each surviving member's own potential pool; the **shop** sells
  cards/relics/potions; **campfires** upgrade *any* card (auto-derived "+" versions).
- Enemies are real generated roster creatures fighting with their **kit decks**. HP scales
  with depth; elites/bosses field beefier pairs.
- Save/resume; death → new run.

---

## 7. Collection & the tamer layer

- Fresh players **pick a starter**.
- The collection tracks **owned instances** — `{species, size, nickname}` — so duplicates
  coexist, each nicknameable. Renaming hides the size word (a nickname replaces the auto
  "Small Emberwisp" name).
- **Discovery vs capture** are separate states (Codex-visible vs team-pickable), per
  species-and-size.
- The **Collection page** is the home base: a hideable team sidebar, drag-to-team +
  drag-to-reorder, always-on search + Filters + Sort, auto-save.
- The **Codex ("Creatures")** shows discovered creatures as their actual cards with per-size
  pages.

---

## 8. Creation & the generative spine

- **The Creature Forge** (vision centerpiece): one prompted call turns a *concept* into a
  full creature — name / lore / typings / 2–3 bespoke signature cards / art prompt — all
  validated and budget-clamped, with an offline heuristic fallback.
- **The Editor**: authors cards (data-driven op-list schema) and creatures (typings, size
  variants, optional hand-built decks), with dual persistence (local + GitHub API).
- **Art**: a locked flat-2D "Variant-B" style, generated per creature and per size through an
  AI image pipeline (`docs/art-pipeline.md`).

---

## 9. The north star (beyond the prototype)

Multiplayer + a shared, living world:

- Cloud sync; asynchronous world-map **ghosts**; **hologram-clone** challenges.
- A **community DNA registry** where forged/fused creatures propagate between players.
- **Fusion / breeding** (designed, currently paused) is the generative loop where "dynamic"
  actually lives.
- A **Phaser** view layer is deferred; combat UI is React today in an ornate gilded-TCG skin.

---

## 10. Live design tensions (where conceptual work matters most)

These are the open seams — the decisions still worth making:

- **Breadth vs. budget on hybrids.** A hybrid unions two full kits → a large pool. Lean into
  breadth (current), or trim to N-from-each?
- **Subtype combos as content, not just aura math.** Mechanical+Elemental ("living reactor"),
  Giant+Demonic ("titan fiend") want bespoke cards/traits, not just two stacked auras.
- **How far does size-as-identity go?** Size-specific moves? Branching evolution trees?
  (`docs/varieties-and-evolution.md`.)
- **Reaction-matrix legibility.** Powerful and build-defining, but a `13 × ~15` matrix is a
  lot to teach — how much must the player *know* vs. *discover*?
- **Fusion/breeding + the DNA registry** — the most ambitious, least-built pillar; the actual
  home of "dynamic multiplayer."
- **Two codebases.** The playable React prototype (`index.html`) and the framework-agnostic
  engine rebuild (`src/engine/`) coexist; **the engine is the active direction** — target
  conceptual decisions there.

---

## 11. Current state vs. aspiration (one-glance)

| Pillar | State |
|---|---|
| 3-axis taxonomy (bodies/subtypes/attunement) | **Built** (data + generator) |
| Kits (Humanoid/Beast/Aberration + subtypes + hybrids) | **Built** |
| Vanguard/Bench combat + statuses + reactions | **Built + tested** (numbers tunable) |
| Matchups (attunement + constitution) | **Built + tested** |
| Roguelike run layer (map/rewards/shop/campfire) | **Built** |
| Collection / instances / sizes / Codex | **Built** |
| Creature Forge (AI authoring) | **Built** |
| Editor (cards + creatures) | **Built** |
| Per-size art pipeline | **Framework built**, art baking ongoing |
| Multiplayer / world / DNA registry | **Vision only** |
| Fusion / breeding | **Designed, paused** |
| Phaser renderer / TS migration | **Deferred** |

> Playable today: the roguelike run + practice combat via `app.html`
> (`/chimera_cards/app.html` on GH Pages). The root `index.html` is the older prototype.
