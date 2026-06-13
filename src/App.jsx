import React, { useState, useEffect, useRef } from "react";

// ============================================================
// CHIMERA CARDS — a Pokémon x Slay the Spire prototype
// Capture monsters, build card-driven teams, descend dungeons,
// generate new monsters with AI, and fuse two into one.
// ============================================================

// BUMP THIS ON EVERY EDIT so the player can verify they have the
// BUMP THIS ON EVERY EDIT so the player can verify they have the
// latest artifact. Shown in the header and the debug menu.

/* ════════════════ TABLE OF CONTENTS (virtual modules) ════════════════
   Search for "MODULE:" to jump. Each banner lists its UPDATE WHEN
   obligations — the cross-codebase changes that must touch that module.
   1. ai/claude            7. data/artifacts+passives
   2. data/moves           8. systems/elements+forms+lines
   3. data/monsters        9. systems/forge
   4. data/dex            10. data/evolution-reqs
   5. data/items          11. app/main (state + logic)
   6. data/materials      12. ui/chrome   13. ui/admin (+ other ui/*)
   GOLDEN RULES: bump APP_VERSION every edit · regen dex on roster change
   · new content -> admin console · components only read props.
   ═══════════════════════════════════════════════════════════════════ */

// ---------- AI helper (Claude in the artifact) ----------
// Inside the Claude app this endpoint needs no key. When running OUTSIDE
// Claude (local Vite dev, etc.), set window.ANTHROPIC_API_KEY in index.html
// to enable the AI features (forge/fusion/art). LOCAL TESTING ONLY — never
// ship a page with your key in it. Without a key, AI features fail
// gracefully (emoji art, error messages) and the rest of the game works.


import { storeSet, storeGet, storeClear } from "./systems/save.js";
import { SFX } from "./systems/sfx.js";
import { askClaudeJson, generateArt } from "./ai/claude.js";
import { ELEMENTS, defenseMultiplier, FORMS, formAllowed, rollEnemyForm, lineOf, ELEMENT_AFFINITY, findReaction } from "./systems/elements.jsx";
import { generateIconArt } from "./ui/icons.jsx";
import { MOVE_CAP } from "./data/moves.js";
import { DEFAULT_MONSTERS } from "./data/monsters.js";
import { ITEMS } from "./data/items.js";
import { MATERIALS, materialById, rollDrops, transmuteTable, rollTransmute, ACHIEVEMENTS, RECIPES, canCraft, consumeRecipe } from "./data/materials.js";
import { RARITY_LADDER, RARITY_BUDGET, rarityIndex } from "./systems/forge.js";
import { ARTIFACTS, artifactById, combinedBonuses } from "./data/artifacts.js";
import { shuffle, clamp } from "./utils.js";
import { makeMonster, evolutionTarget, evolutionInfo } from "./game/monster.js";
import { checkEvolution } from "./game/evolution.js";
import { makeFighter } from "./game/fighter.js";
import { generateMap, generateOverworld, featureAt, isWalkable } from "./systems/map.js";
import { NPCS, questProgress } from "./data/quests.js";
import { S, CSS } from "./ui/styles.js";
import { useViewport, Header, Title, NPCTalk, MonstersGallery, MoveTutor, Collection, Compendium, ItemsScreen, CraftScreen, CheatPanel, StarterScreen, Generate, Fuse, Battle, Reward, DungeonMap, RestSite, Overworld, Shop, Mystery } from "./ui/components.jsx";

// ║ MODULE: app/main — ALL state + game logic handlers
// ║ UPDATE WHEN: every new system: state here, handlers here; check scope-leak (components only see PROPS); reward/afterWin hooks; egg ticking; stats/achievements
// ╚══════════════════════════════════════════════════════════════════╝
export default function ChimeraCards() {
  const [screen, setScreen] = useState("title"); // title | collection | compendium | generate | fuse | items | battle | reward
  // Start with the six tier-1 commons; the rest are discovered through play.
  // The journey begins with the starter choice: the collection starts empty.
  const [collection, setCollection] = useState([]);
  // Compendium: every species name the player has ever owned or defeated.
  const [seen, setSeen] = useState(() => new Set());
  const [items, setItems] = useState(["beastball", "beastball", "beastball"]); // owned item ids
  const [materials, setMaterials] = useState({}); // crafting materials {id: count}
  const [runArtifacts, setRunArtifacts] = useState([]); // dungeon-run artifacts (lost when the run ends)
  const [seenMaterials, setSeenMaterials] = useState(() => new Set()); // discovered materials
  const [knownRecipes, setKnownRecipes] = useState(() => new Set(["beastball"])); // learned recipes
  const [stats, setStats] = useState({ battlesWon: 0, bossesSlain: 0, monstersCaptured: 0, monstersTransmuted: 0, itemsCrafted: 0 });
  const [achDone, setAchDone] = useState(() => new Set()); // completed achievements
  const [eggs, setEggs] = useState([]); // breeding eggs: {id, template, eggCard, hatchIn}
  const [activeQuests, setActiveQuests] = useState([]); // accepted quest ids
  const [doneQuests, setDoneQuests] = useState(() => new Set()); // turned in
  const [npcCtx, setNpcCtx] = useState(null); // npc id being talked to
  const [baseScreen, setBaseScreen] = useState("den"); // where ↩ Return leads (den/overworld/map)
  const [iconArt, setIconArt] = useState({}); // generated art: {"item:<id>"|"move:<id>": svg | "…"}
  const saveReady = useRef(false); // becomes true after load attempt completes
  function paintIcon(kind, id, name, desc) {
    const key = `${kind}:${id}`;
    if (iconArt[key] === "…") return;
    setIconArt((a) => ({ ...a, [key]: "…" }));
    (async () => {
      const svg = await generateIconArt({ name, kind, desc });
      setIconArt((a) => { const n = { ...a }; if (svg) n[key] = svg; else delete n[key]; return n; });
      if (!svg) flash("Icon art failed (need an API key outside Claude).");
    })();
  }
  useEffect(() => { if (["den", "overworld", "map"].includes(screen)) setBaseScreen(screen); }, [screen]);
  const [seenItems, setSeenItems] = useState(() => new Set(["beastball"])); // every item ever obtained
  const [team, setTeam] = useState([]); // up to 3 uids
  const [battle, setBattle] = useState(null);
  const [toast, setToast] = useState(null);
  const [pendingReward, setPendingReward] = useState(null);
  // ----- run state (one dungeon run) -----
  const [runMap, setRunMap] = useState(null); // 2D array of nodes
  const [runRow, setRunRow] = useState(-1); // current row reached (-1 = not started)
  const [runCol, setRunCol] = useState(null); // current node col
  const [runHp, setRunHp] = useState({}); // uid -> current hp, persists across fights
  const [activeNode, setActiveNode] = useState(null); // node being resolved
  const [gold, setGold] = useState(0);
  // ----- overworld state -----
  const [overworld] = useState(() => generateOverworld());
  const [playerPos, setPlayerPos] = useState(() => overworld.start);
  const [shopCtx, setShopCtx] = useState({ deep: false }); // where a shop was opened from
  const [wildBattle, setWildBattle] = useState(false); // is current battle a wild encounter?
  const [returnScreen, setReturnScreen] = useState("overworld"); // where to go after rest/shop/wild

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  // Add an item to the bag and mark it discovered for the Codex.
  function grantItem(id) {
    setItems((arr) => [...arr, id]);
    setSeenItems((s) => (s.has(id) ? s : new Set(s).add(id)));
  }

  // Add a {materialId: qty} map into the player's stash, marking discovery.
  function grantMaterials(drops) {
    const ids = Object.keys(drops || {});
    if (ids.length === 0) return;
    setMaterials((m) => {
      const next = { ...m };
      ids.forEach((id) => (next[id] = (next[id] || 0) + drops[id]));
      return next;
    });
    setSeenMaterials((s) => {
      const next = new Set(s);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }

  // Teach the player a crafting recipe (by crafted item id).
  function learnRecipe(itemId) {
    setKnownRecipes((s) => {
      if (s.has(itemId)) return s;
      const it = ITEMS.find((x) => x.id === itemId);
      flash(`📜 Recipe learned: ${it ? it.name : itemId}!`);
      return new Set(s).add(itemId);
    });
  }

  // Increment a stat counter; completed achievements teach their recipe.
  function bumpStat(key, n = 1) {
    setStats((prev) => {
      const next = { ...prev, [key]: (prev[key] || 0) + n };
      // check achievements against the NEW totals
      setAchDone((doneSet) => {
        let done = doneSet;
        ACHIEVEMENTS.forEach((a) => {
          if (!done.has(a.id) && a.check(next)) {
            if (done === doneSet) done = new Set(doneSet);
            done.add(a.id);
            setTimeout(() => {
              flash(`🏆 Feat: ${a.label}!`);
              learnRecipe(a.recipe);
            }, 50);
          }
        });
        return done;
      });
      return next;
    });
  }

  // Destroy a captured monster for materials, rolled from its chance table
  // with exploding repeats. Guards: never the last monster; removed from team.
  function transmuteMonster(m) {
    if (collection.length <= 1) {
      flash("You can't transmute your last monster.");
      return;
    }
    const yieldMap = rollTransmute(transmuteTable(m));
    setTeam((t) => t.filter((uid) => uid !== m.uid));
    setCollection((c) => c.filter((x) => x.uid !== m.uid));
    grantMaterials(yieldMap);
    bumpStat("monstersTransmuted");
    const got = Object.keys(yieldMap);
    if (got.length === 0) {
      flash(`${m.name} transmuted... into nothing. The rolls were cruel.`);
    } else {
      const summary = got.map((id) => `${yieldMap[id]}× ${materialById(id).name}`).join(", ");
      flash(`${m.name} transmuted into: ${summary}`);
    }
  }

  // Craft a recipe into a real item. Requires knowing the recipe.
  function craftItem(recipe) {
    if (!knownRecipes.has(recipe.item)) {
      flash("You haven't learned this recipe yet.");
      return;
    }
    const check = canCraft(recipe, materials);
    if (!check.ok) {
      flash("Missing materials.");
      return;
    }
    setMaterials((m) => consumeRecipe(recipe, m));
    grantItem(recipe.item);
    bumpStat("itemsCrafted");
    const it = ITEMS.find((x) => x.id === recipe.item);
    flash(`Crafted ${it ? it.name : recipe.item}!`);
  }

  // ---------- Move Tutor ----------
  const TYPE_MOVE_COST = 80; // gold
  const SPECIAL_MOVE_COST = 120; // gold + an Ancient Tome
  const TRANSFER_GOLD = 400; // deliberately prohibitive
  function addMoveTo(uid2, move, tag) {
    setCollection((c) => c.map((m) => (m.uid === uid2 ? { ...m, cards: [...m.cards, { ...move, [tag]: true }] } : m)));
  }
  function learnTypeMove(mon, move) {
    if (mon.cards.length >= MOVE_CAP) { flash(`Moveset full (${MOVE_CAP} max). Forget or transfer a move first.`); return; }
    if (mon.cards.some((c) => c.id === move.id)) { flash("Already known."); return; }
    if (gold < TYPE_MOVE_COST) { flash(`Costs ${TYPE_MOVE_COST} gold.`); return; }
    setGold((g) => g - TYPE_MOVE_COST);
    addMoveTo(mon.uid, move, "learned");
    flash(`${mon.name} learned ${move.name}!`);
  }
  function learnSpecialMove(mon, move) {
    if (mon.cards.length >= MOVE_CAP) { flash(`Moveset full (${MOVE_CAP} max). Forget or transfer a move first.`); return; }
    if (mon.cards.some((c) => c.id === move.id)) { flash("Already known."); return; }
    if (!items.includes("ancienttome")) { flash("Requires an Ancient Tome."); return; }
    if (gold < SPECIAL_MOVE_COST) { flash(`Costs ${SPECIAL_MOVE_COST} gold + an Ancient Tome.`); return; }
    setGold((g) => g - SPECIAL_MOVE_COST);
    setItems((arr) => { const i = arr.indexOf("ancienttome"); return [...arr.slice(0, i), ...arr.slice(i + 1)]; });
    addMoveTo(mon.uid, move, "learned");
    flash(`📕 The tome crumbles. ${mon.name} learned ${move.name}!`);
  }
  function forgetMove(mon, idx) {
    const card = mon.cards[idx];
    if (!card || (!card.learned && !card.transferred)) { flash("Signature and egg moves can't be forgotten."); return; }
    setCollection((c) => c.map((m) => (m.uid === mon.uid ? { ...m, cards: m.cards.filter((_, i) => i !== idx) } : m)));
    flash(`${mon.name} forgot ${card.name}.`);
  }
  // Move TRANSFER: rip any non-generic move (even a signature) out of one
  // monster and graft it onto another. Costly by design.
  function transferMove(donor, idx, recipient) {
    const card = donor.cards[idx];
    if (!card) return;
    if (donor.uid === recipient.uid) { flash("Pick two different monsters."); return; }
    if (donor.cards.length <= 1) { flash("A monster must keep at least one move."); return; }
    if (recipient.cards.length >= MOVE_CAP) { flash(`${recipient.name}'s moveset is full.`); return; }
    if (recipient.cards.some((c) => c.id === card.id)) { flash(`${recipient.name} already knows ${card.name}.`); return; }
    if (gold < TRANSFER_GOLD || (materials.primalcore || 0) < 1) {
      flash(`Transfer costs ${TRANSFER_GOLD} gold + 1 🔮 Primal Core.`); return;
    }
    setGold((g) => g - TRANSFER_GOLD);
    setMaterials((mm) => { const n = { ...mm, primalcore: mm.primalcore - 1 }; if (n.primalcore <= 0) delete n.primalcore; return n; });
    setCollection((c) => c.map((m) => {
      if (m.uid === donor.uid) return { ...m, cards: m.cards.filter((_, i) => i !== idx) };
      if (m.uid === recipient.uid) return { ...m, cards: [...m.cards, { ...card, transferred: true }] };
      return m;
    }));
    flash(`💸 ${card.name} transferred: ${donor.name} → ${recipient.name}.`);
  }
  // ---------- quests & NPCs ----------
  function acceptQuest(q) {
    setActiveQuests((a) => (a.includes(q.id) ? a : [...a, q.id]));
    flash(`📜 Quest accepted: ${q.title}`);
  }
  function turnInQuest(q) {
    if (!questProgress(q, stats, seen).done) return;
    setActiveQuests((a) => a.filter((id) => id !== q.id));
    setDoneQuests((d) => new Set(d).add(q.id));
    const r = q.reward || {};
    if (r.gold) setGold((g) => g + r.gold);
    if (r.item) grantItem(r.item);
    if (r.materials) grantMaterials(r.materials);
    SFX.victory();
    flash(`✅ ${q.title} complete!${r.gold ? ` +${r.gold}g` : ""}${r.item ? ` +${ITEMS.find((i) => i.id === r.item).name}` : ""}`);
  }
  // Rival battles: an elite-form opponent that scales with your record.
  function startRivalBattle() {
    const wins = stats.rivalWins || 0;
    const pool = DEFAULT_MONSTERS.filter((t) => (t.tier || 1) >= 2 && ["rare", "epic"].includes(t.rarity));
    const base = pool[Math.floor(Math.random() * pool.length)];
    const info = evolutionInfo(base);
    const form = formAllowed("elite", info) ? "elite" : "large";
    const hpScale = 1 + wins * 0.25;
    const enemy = makeMonster({ ...base, form, baseHp: base.hp, hp: Math.round(base.hp * FORMS[form].hpMult * hpScale) });
    enemy.intent = null;
    setSeen((sn) => new Set(sn).add(base.name));
    const bonus = combinedBonuses(runArtifacts, items);
    const fighters = teamMonsters.map((m) => makeFighter(m, bonus, runHp[m.uid], teamMonsters));
    setWildBattle(true);
    setBattle({
      floor: 1, isBoss: false, wild: true, rival: true, enemy,
      enemyHp: enemy.maxHp, enemyMaxHp: enemy.maxHp, enemyBlock: 0,
      enemyStatus: { burn: 0, weak: 0, vulnerable: 0, chill: 0, soak: 0, shock: 0, poison: 0, decay: 0 },
      teamShield: 0, fighters, activeIdx: Math.max(0, fighters.findIndex((f) => f.hp > 0)),
      hand: [], discard: [], energy: 3, turn: "player", over: null,
      log: [`${NPCS.rival.name} sends out ${enemy.name}!`], bonus,
    });
    setScreen("battle");
  }

  // Leaving the den requires a full squad of 3 (or everyone, if fewer).
  function leaveDen() {
    if (team.length < 1) { flash("Take at least one monster with you."); return; }
    enterOverworld(); // team max of 3 is enforced by the picker itself
  }

  // ---------- breeding ----------
  // Parents are KEPT (unlike fusion). The egg hatches into a BABY-form
  // stage-1 of parent A's line, inheriting one "egg move" from parent B.
  const BREED_COST = { vitalessence: 1, chimdust: 2 };
  function canBreed(mA, mB) {
    if (!mA || !mB || mA.uid === mB.uid) return { ok: false, why: "Pick two different monsters." };
    if (eggs.length >= 3) return { ok: false, why: "The nursery is full (3 eggs max). Win battles to hatch them." };
    const aEls = mA.elements && mA.elements.length ? mA.elements : [mA.element];
    const bEls = mB.elements && mB.elements.length ? mB.elements : [mB.element];
    const sharedEl = aEls.some((e) => bEls.includes(e));
    const lA = lineOf(mA.name);
    const sameLine = lA && lA.members.includes(mB.name);
    if (!sharedEl && !sameLine) return { ok: false, why: "Parents must share an element or an evolution line." };
    for (const id in BREED_COST) {
      if ((materials[id] || 0) < BREED_COST[id]) {
        return { ok: false, why: `Costs ${BREED_COST.vitalessence}× Vital Essence + ${BREED_COST.chimdust}× Chimera Dust.` };
      }
    }
    return { ok: true, why: null };
  }
  function breedPair(mA, mB) {
    const chk = canBreed(mA, mB);
    if (!chk.ok) { flash(chk.why); return; }
    // offspring species: stage-1 root of parent A's line (A is the "dam")
    const line = lineOf(mA.name);
    const rootName = line ? line.members[0] : mA.name;
    const tmpl = DEFAULT_MONSTERS.find((t) => t.name === rootName) ||
      { name: mA.name, element: mA.element, elements: mA.elements, hp: mA.baseHp || mA.maxHp, sprite: mA.sprite, rarity: mA.rarity, desc: mA.desc, lore: mA.lore, cards: mA.cards.map(({ cid, ...c }) => c) };
    // egg move: one random card inherited from parent B
    const pool = mB.cards || [];
    const inherited = pool[Math.floor(Math.random() * pool.length)];
    const eggCard = inherited ? { ...inherited, cid: undefined, id: `egg_${inherited.id}`, eggMove: true, element: mB.element } : null;
    setMaterials((m) => {
      const next = { ...m };
      for (const id in BREED_COST) { next[id] -= BREED_COST[id]; if (next[id] <= 0) delete next[id]; }
      return next;
    });
    const hatchIn = 2 + Math.max(0, rarityIndex(tmpl.rarity || "common"));
    setEggs((e) => [...e, { id: `egg${Date.now()}_${Math.floor(Math.random() * 999)}`, template: tmpl, eggCard, hatchIn, parents: `${mA.name} + ${mB.name}` }]);
    flash(`🥚 An egg! ${mA.name} and ${mB.name} produced a ${rootName} egg (hatches after ${hatchIn} wins).`);
  }
  // Hatch countdown: called on every battle win.
  function tickEggs() {
    const current = eggs;
    if (current.length === 0) return;
    const remaining = [];
    const hatched = [];
    current.forEach((egg) => {
      if (egg.hatchIn <= 1) hatched.push(egg);
      else remaining.push({ ...egg, hatchIn: egg.hatchIn - 1 });
    });
    setEggs(remaining);
    hatched.forEach((egg) => {
      const baby = makeMonster({ ...egg.template, svg: null, imageUrl: null, form: "baby" });
      if (egg.eggCard) baby.cards = [...baby.cards.slice(0, baby.cards.length - 1), { ...egg.eggCard, cid: `c${Date.now()}_${Math.floor(Math.random() * 9999)}` }];
      setCollection((c) => [...c, baby]);
      setSeen((sn) => new Set(sn).add(baby.name));
      flash(`🐣 Hatched: Baby ${baby.name}${egg.eggCard ? ` knowing ${egg.eggCard.name} 🥚` : ""}!`);
    });
  }

  const teamMonsters = team.map((id) => collection.find((m) => m.uid === id)).filter(Boolean);

  // ---------- persistence ----------
  function serializeSave() {
    return {
      v: 1, gold, collection, team, items, materials, eggs, stats,
      seen: [...seen], seenItems: [...seenItems], seenMaterials: [...seenMaterials],
      knownRecipes: [...knownRecipes], achDone: [...achDone],
      activeQuests, doneQuests: [...doneQuests],
    };
  }
  function hydrateSave(d) {
    if (!d || d.v !== 1) return false;
    setGold(d.gold || 0);
    setCollection(d.collection || []);
    setTeam(d.team || []);
    setItems(d.items || []);
    setMaterials(d.materials || {});
    setEggs(d.eggs || []);
    setStats(d.stats || { battlesWon: 0, bossesSlain: 0, monstersCaptured: 0, monstersTransmuted: 0, itemsCrafted: 0 });
    setSeen(new Set(d.seen || []));
    setSeenItems(new Set(d.seenItems || []));
    setSeenMaterials(new Set(d.seenMaterials || []));
    setKnownRecipes(new Set(d.knownRecipes && d.knownRecipes.length ? d.knownRecipes : ["beastball"]));
    setAchDone(new Set(d.achDone || []));
    setActiveQuests(d.activeQuests || []);
    setDoneQuests(new Set(d.doneQuests || []));
    return true;
  }
  // load once on boot
  useEffect(() => {
    (async () => {
      const d = await storeGet();
      if (d) {
        const ok = hydrateSave(d);
        if (ok) flash("💾 Save loaded. Welcome back!");
      }
      saveReady.current = true;
    })();
    // eslint-disable-next-line
  }, []);
  // debounced auto-save on meaningful state changes
  useEffect(() => {
    if (!saveReady.current || collection.length === 0) return;
    const t = setTimeout(() => {
      const d = serializeSave();
      let json = JSON.stringify(d);
      if (json.length > 4500000) {
        // size guard: drop generated art before dropping the save entirely
        d.collection = d.collection.map((m) => ({ ...m, svg: null }));
      }
      storeSet(d);
    }, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [gold, collection, team, items, materials, eggs, stats, seen, seenItems, seenMaterials, knownRecipes, achDone]);
  function resetGame() {
    storeClear();
    setGold(0); setCollection([]); setTeam([]); setItems(["beastball", "beastball", "beastball"]);
    setMaterials({}); setEggs([]); setRunArtifacts([]); setBattle(null);
    setStats({ battlesWon: 0, bossesSlain: 0, monstersCaptured: 0, monstersTransmuted: 0, itemsCrafted: 0 });
    setSeen(new Set()); setSeenItems(new Set()); setSeenMaterials(new Set());
    setKnownRecipes(new Set(["beastball"])); setAchDone(new Set());
    setActiveQuests([]); setDoneQuests(new Set());
    setScreen("title");
    flash("New game. The world resets.");
  }

  // Paint the starter roster in the gallery style once, on first load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targets = collection.filter((m) => !m.svg);
      for (const m of targets) {
        const svg = await generateArt({ name: m.name, element: m.element, desc: m.desc, lore: m.lore });
        if (cancelled || !svg) continue;
        setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line
  }, []);
  // ---------- Overworld ----------
  function enterOverworld() {
    if (teamMonsters.length === 0) {
      flash("Pick at least one monster for your team first.");
      setScreen("collection");
      return;
    }
    // refill HP when (re)entering the overworld from base
    const hp = {};
    teamMonsters.forEach((m) => (hp[m.uid] = m.maxHp));
    setRunHp(hp);
    setScreen("overworld");
  }

  // Attempt to move the player by (dx,dy). Handles walls, features, and
  // wild encounters in tall grass.
  function movePlayer(dx, dy) {
    setPlayerPos((pos) => {
      const nx = pos.x + dx;
      const ny = pos.y + dy;
      if (!isWalkable(overworld, nx, ny)) return pos;
      const newPos = { x: nx, y: ny };
      const feat = featureAt(overworld, nx, ny);
      if (feat) {
        setTimeout(() => interactFeature(feat), 0);
      } else if (overworld.tiles[ny][nx] === 1) {
        if (Math.random() < 0.22) setTimeout(() => startWildEncounter(), 0);
      }
      return newPos;
    });
  }

  function interactFeature(feat) {
    SFX.step();
    if (feat.type === "den") {
      setScreen("den");
      return;
    }
    if (feat.type === "npc") {
      setNpcCtx(feat.npc);
      setScreen("talk");
      return;
    }
    if (feat.type === "shop") {
      setShopCtx({ deep: false });
      setReturnScreen("overworld");
      setScreen("shop");
    } else if (feat.type === "inn") {
      setReturnScreen("overworld");
      setScreen("rest");
    } else if (feat.type === "dungeon") {
      startDungeon(feat.depth || 1);
    }
  }

  // A single wild battle (not a full dungeon run). HP carries from overworld.
  function startWildEncounter() {
    const maxTier = 2;
    const pool = DEFAULT_MONSTERS.filter((t) => (t.tier || 1) <= maxTier);
    const base = pool[Math.floor(Math.random() * pool.length)];
    const painted = collection.find((m) => m.name === base.name && m.svg);
    const wform = rollEnemyForm(evolutionInfo(base), {});
    const enemy = makeMonster({ ...base, svg: painted ? painted.svg : null, form: wform, baseHp: base.hp, hp: Math.round(base.hp * FORMS[wform].hpMult) });
    enemy.intent = null;
    setSeen((s) => new Set(s).add(base.name));

    const bonus = combinedBonuses(runArtifacts, items);
    const fighters = teamMonsters.map((m) => makeFighter(m, bonus, runHp[m.uid], teamMonsters));
    setWildBattle(true);
    setBattle({
      floor: 1,
      isBoss: false,
      wild: true,
      enemy,
      enemyHp: enemy.maxHp,
      enemyMaxHp: enemy.maxHp,
      enemyBlock: 0,
      enemyStatus: { burn: 0, weak: 0, vulnerable: 0, chill: 0, soak: 0, shock: 0, poison: 0, decay: 0 },
      teamShield: 0,
      fighters,
      activeIdx: Math.max(0, fighters.findIndex((f) => f.hp > 0)),
      swappedThisTurn: false,
      energy: 3 + bonus.energyBonus,
      maxEnergy: 3 + bonus.energyBonus,
      bonus,
      potions: items.filter((id) => (ITEMS.find((it) => it.id === id) || {}).kind === "potion"),
      log: [`A wild ${enemy.name} appeared!`],
      turn: "player",
      over: null,
    });
    setScreen("battle");
    setTimeout(() => drawHand(5 + bonus.drawBonus), 50);
  }

  function startDungeon(depth = 1) {
    if (teamMonsters.length === 0) {
      flash("Pick at least one monster for your team first.");
      setScreen("collection");
      return;
    }
    // deeper dungeons have more floors
    const rows = depth === 3 ? 11 : depth === 2 ? 10 : 8;
    setRunArtifacts([]); // a fresh run starts with no artifacts
    const map = generateMap(rows);
    map._depth = depth;
    setRunMap(map);
    setRunRow(-1);
    setRunCol(null);
    // HP carries over from the overworld; do NOT refill here
    setScreen("map");
  }

  // Player taps a node on the map. Resolve it by type.
  function chooseNode(node) {
    setActiveNode(node);
    setRunRow(node.row);
    setRunCol(node.col);
    if (node.type === "fight" || node.type === "elite" || node.type === "boss") {
      beginBattle(node);
    } else if (node.type === "rest") {
      setReturnScreen("map");
      setScreen("rest");
    } else if (node.type === "shop") {
      awardProgress({ shops: 1 });
      setShopCtx({ deep: true, depth: (runMap && runMap._depth) || 1 });
      setReturnScreen("map");
      setScreen("shop");
    } else if (node.type === "treasure") {
      resolveTreasure();
    } else if (node.type === "mystery") {
      setScreen("mystery");
    }
  }

  // Mark the current node visited and return to the map for the next pick.
  function returnToMap() {
    if (runMap && activeNode) {
      setRunMap((m) =>
        m.map((row) => row.map((n) => (n.id === activeNode.id ? { ...n, visited: true } : n)))
      );
    }
    setActiveNode(null);
    setPendingReward(null);
    // boss cleared = run complete
    if (activeNode && activeNode.type === "boss") {
      flash("You cleared the dungeon! Your artifacts crumble as you leave.");
      setRunArtifacts([]);
      setBattle(null);
      // save HP back so it carries to the overworld
      setScreen("overworld");
      return;
    }
    setScreen("map");
  }

  function beginBattle(node) {
    const floor = node.row + 1;
    const isElite = node.type === "elite";
    const isBoss = node.type === "boss";
    const maxTier = isBoss ? 3 : floor < 3 ? 1 : floor < 6 ? 2 : 3;
    const pool = DEFAULT_MONSTERS.filter((t) => (t.tier || 1) <= maxTier);
    let base;
    if (isBoss) {
      // boss is a random legendary/rare if available
      const bossPool = DEFAULT_MONSTERS.filter((t) => t.rarity === "legendary" || t.tier === 3);
      base = bossPool[Math.floor(Math.random() * bossPool.length)] || pool[0];
    } else {
      base = pool[Math.floor(Math.random() * pool.length)];
    }
    const painted = collection.find((m) => m.name === base.name && m.svg);
    const scale = 1 + (floor - 1) * 0.28;
    // form replaces the old elite/boss multiplier AND the name prefix
    const form = rollEnemyForm(evolutionInfo(base), { elite: isElite, boss: isBoss });
    const mult = FORMS[form].hpMult;
    const enemy = makeMonster({
      ...base,
      svg: painted ? painted.svg : null,
      form,
      baseHp: base.hp,
      hp: Math.round(base.hp * scale * mult),
    });
    enemy.intent = null;
    setSeen((s) => new Set(s).add(base.name));

    const bonus = combinedBonuses(runArtifacts, items);
    // build fighters using carried-over HP from the run
    const fighters = teamMonsters.map((m) => makeFighter(m, bonus, runHp[m.uid], teamMonsters));

    setBattle({
      floor,
      isBoss,
      enemy,
      enemyHp: enemy.maxHp,
      enemyMaxHp: enemy.maxHp,
      enemyBlock: 0,
      enemyStatus: { burn: 0, weak: 0, vulnerable: 0, chill: 0, soak: 0, shock: 0, poison: 0, decay: 0 },
      teamShield: 0,
      fighters,
      activeIdx: Math.max(0, fighters.findIndex((f) => f.hp > 0)),
      swappedThisTurn: false,
      energy: 3 + bonus.energyBonus,
      maxEnergy: 3 + bonus.energyBonus,
      bonus,
      potions: items.filter((id) => (ITEMS.find((it) => it.id === id) || {}).kind === "potion"),
      log: [`A ${enemy.name} appears!`],
      turn: "player",
      over: null,
    });
    setScreen("battle");
    setTimeout(() => drawHand(5 + bonus.drawBonus), 50);
  }

  // ---------- battle mechanics ----------
  function setEnemyIntent(b) {
    const roll = Math.random();
    if (roll < 0.6) {
      const dmg = Math.round(4 + b.floor * 1.6 + Math.random() * 4);
      return { kind: "attack", value: dmg };
    } else if (roll < 0.85) {
      return { kind: "block", value: Math.round(5 + b.floor) };
    }
    return { kind: "buff", value: 2 };
  }

  // Helper: immutably update the active fighter inside a battle object.
  function updateActive(nb, fn) {
    const fighters = nb.fighters.map((f, i) => (i === nb.activeIdx ? fn({ ...f }) : f));
    return { ...nb, fighters };
  }

  function drawHand(n) {
    setBattle((b) => {
      if (!b) return b;
      const f = b.fighters[b.activeIdx];
      let draw = [...f.drawPile];
      let discard = [...f.discard];
      let hand = [...f.hand];
      for (let i = 0; i < n; i++) {
        if (draw.length === 0) {
          draw = shuffle(discard);
          discard = [];
        }
        if (draw.length === 0) break;
        hand.push(draw.shift());
      }
      const intent = b.enemy.intent || setEnemyIntent(b);
      const nb = updateActive(b, (af) => ({ ...af, drawPile: draw, discard, hand }));
      return { ...nb, enemy: { ...b.enemy, intent } };
    });
  }

  // Swap the active monster. Free action, once per turn. The outgoing
  // monster keeps its HP and block; the incoming one draws a fresh hand.
  function swapTo(idx) {
    setBattle((b) => {
      if (!b || b.over || b.turn !== "player") return b;
      if (idx === b.activeIdx) return b;
      if (b.swappedThisTurn) return b;
      const target = b.fighters[idx];
      if (!target || target.hp <= 0) return b;
      // stash current hand into its own discard
      let nb = updateActive(b, (af) => ({ ...af, discard: [...af.discard, ...af.hand], hand: [] }));
      nb = { ...nb, activeIdx: idx, swappedThisTurn: true };
      nb.log = [...nb.log, `${target.name} swaps in!`].slice(-6);
      // swap-in boons
      const tboon = target.boon && target.boon.effect ? target.boon.effect : {};
      if (tboon.swapEnergy) nb.energy += tboon.swapEnergy;
      const extraDraw = tboon.swapDraw || 0;
      const drawN = 5 + ((nb.bonus && nb.bonus.drawBonus) || 0) + extraDraw;
      setTimeout(() => drawHand(drawN), 40);
      return nb;
    });
  }

  function playCard(card) {
    setBattle((b) => {
      if (!b || b.turn !== "player" || b.over) return b;
      const active0 = b.fighters[b.activeIdx];
      const boon = active0.boon && active0.boon.effect ? active0.boon.effect : {};
      const bonus = b.bonus || {};
      // firstFree (boon or Solar Disk sigil): first card each turn costs 0
      const effectiveCost = (boon.firstFree || bonus.firstFree) && active0.firstCardThisTurn ? 0 : card.cost;
      if (effectiveCost > b.energy) return b;
      let nb = { ...b, energy: b.energy - effectiveCost };
      let log = [...nb.log];
      const active = nb.fighters[nb.activeIdx];

      // mark first card used this turn
      nb = updateActive(nb, (af) => ({ ...af, firstCardThisTurn: false }));

      // remove card from active hand. exhaust cards leave the deck entirely;
      // others go to the discard. (retain is handled at end of turn.)
      nb = updateActive(nb, (af) => ({
        ...af,
        hand: af.hand.filter((c) => c.cid !== card.cid),
        discard: card.exhaust ? af.discard : [...af.discard, card],
        exhausted: card.exhaust ? [...(af.exhausted || []), card] : af.exhausted || [],
      }));

      // damage (Strength, then enemy Vulnerable, then element effectiveness)
      const atkEl = card.element || active.element;
      const eff = defenseMultiplier(atkEl, nb.enemy);
      if (card.dmg) {
        const vuln = nb.enemyStatus.vulnerable > 0;
        const hits = card.hits || 1;
        let enemyHp = nb.enemyHp;
        let enemyBlock = nb.enemyBlock;
        let perHit = card.dmg + active.str + (bonus.dmgBonus || 0);
        if (vuln) perHit = Math.round(perHit * 1.5);
        if (eff !== 1) perHit = Math.round(perHit * eff);
        for (let h = 0; h < hits; h++) {
          let dmg = perHit;
          if (enemyBlock > 0) {
            const a = Math.min(enemyBlock, dmg);
            enemyBlock -= a;
            dmg -= a;
          }
          enemyHp = clamp(enemyHp - dmg, 0, nb.enemyMaxHp);
        }
        nb.enemyHp = enemyHp;
        nb.enemyBlock = enemyBlock;
        const effTxt = eff > 1 ? " super effective!" : eff < 1 ? " resisted" : "";
        nb.lastEff = eff; // for a UI flash
        log.push(`${active.name}'s ${card.name}: ${perHit}${hits > 1 ? ` x${hits}` : ""} dmg${vuln ? " (vuln)" : ""}${effTxt}.`);
      }
      if (card.block) {
        const blk = card.block + (bonus.blockBonus || 0);
        nb = updateActive(nb, (af) => ({ ...af, block: af.block + blk }));
        log.push(`${active.name} gains ${blk} block.`);
      }
      // team-wide Shield: persists across swaps, resets each of your turns
      if (card.shield) {
        nb.teamShield = (nb.teamShield || 0) + card.shield;
        log.push(`Team gains ${card.shield} Shield.`);
      }
      if (card.strength) {
        nb = updateActive(nb, (af) => ({ ...af, str: af.str + card.strength }));
        log.push(`${active.name} gains ${card.strength} Strength.`);
      }
      // immediate team heal
      if (card.teamheal) {
        nb = { ...nb, fighters: nb.fighters.map((f) => (f.hp > 0 ? { ...f, hp: clamp(f.hp + card.teamheal, 0, f.maxHp) } : f)) };
        log.push(`Whole team heals ${card.teamheal} HP.`);
      }
      // regen: active monster gains a heal-over-time stack
      if (card.regen) {
        nb = updateActive(nb, (af) => ({ ...af, regenStacks: (af.regenStacks || 0) + card.regen }));
        log.push(`${active.name} gains ${card.regen} Regen.`);
      }
      // gain energy this turn
      if (card.energy) {
        nb.energy += card.energy;
        log.push(`+${card.energy} energy.`);
      }
      // status application; the attacker's element affinity boosts its own
      // status by +1. New statuses: chill, soak, shock, poison, decay.
      const affinity = ELEMENT_AFFINITY[atkEl]; // e.g. "burn", "poison", ...
      const addStatus = (key, amt) => {
        if (!amt) return;
        const boost = affinity === key ? 1 : 0;
        nb.enemyStatus = { ...nb.enemyStatus, [key]: (nb.enemyStatus[key] || 0) + amt + boost };
      };
      addStatus("burn", card.burn);
      addStatus("weak", card.weak);
      addStatus("vulnerable", card.vulnerable);
      addStatus("chill", card.chill);
      addStatus("soak", card.soak);
      addStatus("shock", card.shock);
      addStatus("poison", card.poison);
      addStatus("decay", card.decay);
      // Blood: Leech heals the active monster for a share of damage dealt
      if (card.leech && card.dmg) {
        const heal = Math.max(1, Math.round((card.dmg + active.str) * 0.5));
        nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + heal, 0, af.maxHp) }));
        log.push(`${active.name} leeches ${heal} HP.`);
      }

      // ----- REACTIONS: attack element vs the enemy's existing statuses -----
      const reaction = findReaction(atkEl, nb.enemyStatus);
      if (reaction) {
        const es = { ...nb.enemyStatus };
        switch (reaction.id) {
          case "shatter": {
            const dmg = 8 + active.str;
            nb.enemyHp = clamp(nb.enemyHp - dmg, 0, nb.enemyMaxHp);
            es.chill = 0;
            log.push(`Shatter! +${dmg} burst, Chill consumed.`);
            break;
          }
          case "steam": {
            es.soak = 0;
            es.vulnerable = (es.vulnerable || 0) + 2;
            log.push(`Steam! Soak burns off, +2 Vulnerable.`);
            break;
          }
          case "conduct": {
            es.shock = (es.shock || 0) + 2; // electrified water amps shock
            log.push(`Conduct! Shock surges through the water.`);
            break;
          }
          case "combust": {
            const stacks = es.poison || 0;
            const dmg = stacks * 3;
            nb.enemyHp = clamp(nb.enemyHp - dmg, 0, nb.enemyMaxHp);
            es.poison = 0;
            log.push(`Combust! Poison detonates for ${dmg}.`);
            break;
          }
          case "spread": {
            es.poison = (es.poison || 0) + 2;
            log.push(`Spread! Poison washes wider (+2).`);
            break;
          }
          case "brittle": {
            es.burn = 0;
            es.chill = (es.chill || 0) + 3;
            log.push(`Brittle! Burn quenched, +3 Chill.`);
            break;
          }
          case "corrode": {
            nb.enemyBlock = 0;
            log.push(`Corrode! Enemy block stripped.`);
            break;
          }
          case "consume": {
            // eat one status, draw a card and heal a little
            const order = ["burn", "poison", "decay", "vulnerable", "shock", "soak", "chill"];
            const hit = order.find((s) => (es[s] || 0) > 0);
            if (hit) es[hit] = 0;
            nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + 4, 0, af.maxHp) }));
            log.push(`Consume! Devoured ${hit}, drew a card.`);
            setTimeout(() => drawHand(1), 30);
            break;
          }
          case "hemorrhage":
          case "hemorrhage2": {
            const heal = 6 + active.str;
            nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + heal, 0, af.maxHp) }));
            log.push(`Hemorrhage! Leeched ${heal} from the wound.`);
            break;
          }
          default:
            break;
        }
        nb.enemyStatus = es;
        nb.lastReaction = reaction.label;
      }
      nb.log = log.slice(-6);

      if (nb.enemyHp <= 0) {
        nb.over = "win";
        nb.log = [...nb.log, `${nb.enemy.name} is defeated!`].slice(-6);
      }
      if (card.draw) setTimeout(() => drawHand(card.draw), 30);
      return nb;
    });
  }

  function endTurn() {
    setBattle((b) => {
      if (!b || b.over) return b;
      let nb = { ...b, turn: "enemy" };
      let log = [...nb.log];

      // damage-over-time ticks on the enemy
      if (nb.enemyStatus.burn > 0) {
        nb.enemyHp = clamp(nb.enemyHp - nb.enemyStatus.burn, 0, nb.enemyMaxHp);
        log.push(`${nb.enemy.name} takes ${nb.enemyStatus.burn} burn.`);
        nb.enemyStatus = { ...nb.enemyStatus, burn: Math.max(0, nb.enemyStatus.burn - 1) };
      }
      if (nb.enemyStatus.poison > 0) {
        // Poison does NOT decay; it keeps ticking at full value (ramps).
        nb.enemyHp = clamp(nb.enemyHp - nb.enemyStatus.poison, 0, nb.enemyMaxHp);
        log.push(`${nb.enemy.name} suffers ${nb.enemyStatus.poison} poison.`);
      }
      if (nb.enemyStatus.decay > 0) {
        nb.enemyHp = clamp(nb.enemyHp - nb.enemyStatus.decay, 0, nb.enemyMaxHp);
        nb.enemyBlock = Math.max(0, nb.enemyBlock - nb.enemyStatus.decay);
        log.push(`${nb.enemy.name} decays (-${nb.enemyStatus.decay} HP & block).`);
        nb.enemyStatus = { ...nb.enemyStatus, decay: Math.max(0, nb.enemyStatus.decay - 1) };
      }
      if (nb.enemyHp <= 0) {
        nb.over = "win";
        nb.log = [...log, `${nb.enemy.name} succumbs!`].slice(-6);
        return nb;
      }

      // enemy attacks the ACTIVE fighter only
      const intent = nb.enemy.intent || setEnemyIntent(nb);
      let active = nb.fighters[nb.activeIdx];
      if (intent.kind === "attack") {
        let dmg = intent.value;
        if (nb.enemyStatus.weak > 0) dmg = Math.round(dmg * 0.75);
        // Chill: enemy hits softer while chilled (decays)
        if (nb.enemyStatus.chill > 0) dmg = Math.round(dmg * 0.7);
        // Shock: enemy fumbles, big one-turn damage cut, then consumed
        if (nb.enemyStatus.shock > 0) dmg = Math.round(dmg * 0.5);
        // element matchup vs ALL of the active monster's types (+self-resist)
        const eff = defenseMultiplier(nb.enemy.element, active);
        if (eff !== 1) dmg = Math.round(dmg * eff);
        // absorption order: team Shield -> active block -> HP
        if ((nb.teamShield || 0) > 0) {
          const a = Math.min(nb.teamShield, dmg);
          nb.teamShield -= a;
          dmg -= a;
        }
        let block = active.block;
        if (block > 0) {
          const a = Math.min(block, dmg);
          block -= a;
          dmg -= a;
        }
        const newHp = clamp(active.hp - dmg, 0, active.maxHp);
        nb = updateActive(nb, (af) => ({ ...af, hp: newHp, block }));
        active = nb.fighters[nb.activeIdx];
        log.push(`${nb.enemy.name} hits ${active.name} for ${dmg}.`);
        // thorns boon: reflect damage back when struck
        const boon = active.boon && active.boon.effect ? active.boon.effect : {};
        if (boon.thorns && dmg > 0) {
          let refl = boon.thorns;
          if (nb.enemyBlock > 0) {
            const a = Math.min(nb.enemyBlock, refl);
            nb.enemyBlock -= a;
            refl -= a;
          }
          nb.enemyHp = clamp(nb.enemyHp - refl, 0, nb.enemyMaxHp);
          log.push(`${active.name}'s thorns reflect ${boon.thorns}.`);
        }
      } else if (intent.kind === "block") {
        nb.enemyBlock += intent.value;
        log.push(`${nb.enemy.name} braces (+${intent.value} block).`);
      } else {
        log.push(`${nb.enemy.name} steels itself.`);
      }
      if (nb.enemyStatus.weak > 0) nb.enemyStatus = { ...nb.enemyStatus, weak: nb.enemyStatus.weak - 1 };
      if (nb.enemyStatus.vulnerable > 0) nb.enemyStatus = { ...nb.enemyStatus, vulnerable: nb.enemyStatus.vulnerable - 1 };
      if (nb.enemyStatus.chill > 0) nb.enemyStatus = { ...nb.enemyStatus, chill: nb.enemyStatus.chill - 1 };
      if (nb.enemyStatus.shock > 0) nb.enemyStatus = { ...nb.enemyStatus, shock: 0 }; // shock is one-shot
      if (nb.enemyStatus.soak > 0) nb.enemyStatus = { ...nb.enemyStatus, soak: nb.enemyStatus.soak - 1 };

      // did the active fighter faint?
      if (nb.fighters[nb.activeIdx].hp <= 0) {
        log.push(`${nb.fighters[nb.activeIdx].name} faints!`);
        const nextIdx = nb.fighters.findIndex((f, i) => i !== nb.activeIdx && f.hp > 0);
        if (nextIdx === -1 && nb.fighters[nb.activeIdx].hp <= 0) {
          nb.over = "lose";
          nb.log = [...log, "Your whole team has fallen..."].slice(-6);
          return nb;
        }
        if (nextIdx !== -1) {
          nb.activeIdx = nextIdx;
          log.push(`${nb.fighters[nextIdx].name} is forced into battle!`);
        }
      }

      // any fighters left alive?
      if (!nb.fighters.some((f) => f.hp > 0)) {
        nb.over = "lose";
        nb.log = [...log, "Your whole team has fallen..."].slice(-6);
        return nb;
      }

      nb.log = log.slice(-6);

      // start next player turn: refresh energy, clear active block & team
      // shield (Shield resets each of your turns), apply regen, draw
      nb.turn = "player";
      nb.energy = nb.maxEnergy;
      nb.swappedThisTurn = false;
      nb.teamShield = 0;
      const aboon = nb.fighters[nb.activeIdx].boon && nb.fighters[nb.activeIdx].boon.effect ? nb.fighters[nb.activeIdx].boon.effect : {};
      nb = updateActive(nb, (af) => {
        let hp = af.hp;
        const boonRegen = aboon.regen || 0;
        const cardRegen = af.regenStacks || 0;
        const totalRegen = boonRegen + cardRegen;
        if (totalRegen) hp = clamp(hp + totalRegen, 0, af.maxHp);
        // retain: keep cards flagged retain in hand; discard the rest
        const keep = af.hand.filter((c) => c.retain);
        const toDiscard = af.hand.filter((c) => !c.retain);
        return {
          ...af,
          hp,
          block: 0,
          firstCardThisTurn: true,
          discard: [...af.discard, ...toDiscard],
          hand: keep,
          _retainCount: keep.length,
        };
      });
      const af2 = nb.fighters[nb.activeIdx];
      const totalRegen = (aboon.regen || 0) + (af2.regenStacks || 0);
      if (totalRegen) log.push(`${af2.name} regenerates ${totalRegen} HP.`);
      nb.log = log.slice(-6);
      nb.enemy = { ...nb.enemy, intent: setEnemyIntent(nb) };
      // draw back up to hand size, accounting for retained cards
      const handSize = 5 + ((nb.bonus && nb.bonus.drawBonus) || 0);
      const drawN = Math.max(0, handSize - (af2._retainCount || 0));
      setTimeout(() => drawHand(drawN), 60);
      return nb;
    });
  }

  // Use a potion mid-battle; consumes it for the rest of the run.
  function usePotion(itemId) {
    const it = ITEMS.find((x) => x.id === itemId);
    if (!it) return;
    setBattle((b) => {
      if (!b || b.over) return b;
      let nb = { ...b };
      let log = [...nb.log];
      const e = it.effect;
      if (e.potionDmg) {
        let dmg = e.potionDmg;
        if (nb.enemyBlock > 0) {
          const a = Math.min(nb.enemyBlock, dmg);
          nb.enemyBlock -= a;
          dmg -= a;
        }
        nb.enemyHp = clamp(nb.enemyHp - dmg, 0, nb.enemyMaxHp);
        log.push(`${it.name}: ${e.potionDmg} damage.`);
      }
      if (e.potionBlock) { nb = updateActive(nb, (af) => ({ ...af, block: af.block + e.potionBlock })); log.push(`${it.name}: +${e.potionBlock} block.`); }
      if (e.potionStrength) { nb = updateActive(nb, (af) => ({ ...af, str: af.str + e.potionStrength })); log.push(`${it.name}: +${e.potionStrength} Strength.`); }
      if (e.potionHeal) { nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + e.potionHeal, 0, af.maxHp) })); log.push(`${it.name}: healed ${e.potionHeal}.`); }
      if (e.potionEnergy) { nb.energy += e.potionEnergy; log.push(`${it.name}: +${e.potionEnergy} energy.`); }
      nb.potions = nb.potions.filter((p, i) => i !== nb.potions.indexOf(itemId));
      nb.log = log.slice(-6);
      if (nb.enemyHp <= 0) {
        nb.over = "win";
        nb.log = [...nb.log, `${nb.enemy.name} is defeated!`].slice(-6);
      }
      return nb;
    });
    // remove one copy from owned items
    setItems((arr) => {
      const i = arr.indexOf(itemId);
      if (i === -1) return arr;
      return [...arr.slice(0, i), ...arr.slice(i + 1)];
    });
  }

  // Use a material as a weak battle consumable. Consumes one from the stash.
  function useMaterial(matId) {
    const mat = materialById(matId);
    if (!mat || !mat.effect || (materials[matId] || 0) <= 0) return;
    setBattle((b) => {
      if (!b || b.over || b.turn !== "player") return b;
      let nb = { ...b };
      let log = [...nb.log];
      const e = mat.effect;
      if (e.dmg) {
        let dmg = e.dmg;
        if (nb.enemyBlock > 0) {
          const a = Math.min(nb.enemyBlock, dmg);
          nb.enemyBlock -= a;
          dmg -= a;
        }
        nb.enemyHp = clamp(nb.enemyHp - dmg, 0, nb.enemyMaxHp);
        log.push(`${mat.name}: ${e.dmg} damage.`);
      }
      if (e.block) { nb = updateActive(nb, (af) => ({ ...af, block: af.block + e.block })); log.push(`${mat.name}: +${e.block} block.`); }
      if (e.shield) { nb.teamShield = (nb.teamShield || 0) + e.shield; log.push(`${mat.name}: +${e.shield} Shield.`); }
      if (e.strength) { nb = updateActive(nb, (af) => ({ ...af, str: af.str + e.strength })); log.push(`${mat.name}: +${e.strength} Strength.`); }
      if (e.heal) { nb = updateActive(nb, (af) => ({ ...af, hp: clamp(af.hp + e.heal, 0, af.maxHp) })); log.push(`${mat.name}: healed ${e.heal}.`); }
      if (e.regen) { nb = updateActive(nb, (af) => ({ ...af, regenStacks: (af.regenStacks || 0) + e.regen })); log.push(`${mat.name}: +${e.regen} Regen.`); }
      if (e.energy) { nb.energy += e.energy; log.push(`${mat.name}: +${e.energy} energy.`); }
      // enemy statuses
      const st = {};
      ["burn", "chill", "soak", "shock", "poison", "vulnerable", "decay"].forEach((k) => { if (e[k]) st[k] = e[k]; });
      if (Object.keys(st).length) {
        nb.enemyStatus = { ...nb.enemyStatus };
        for (const k in st) nb.enemyStatus[k] = (nb.enemyStatus[k] || 0) + st[k];
        log.push(`${mat.name}: applied ${Object.keys(st).map((k) => `${st[k]} ${k}`).join(", ")}.`);
      }
      if (e.draw) setTimeout(() => drawHand(e.draw), 30);
      nb.log = log.slice(-6);
      if (nb.enemyHp <= 0) {
        nb.over = "win";
        nb.log = [...nb.log, `${nb.enemy.name} is defeated!`].slice(-6);
      }
      return nb;
    });
    // consume one
    setMaterials((m) => {
      const next = { ...m, [matId]: (m[matId] || 0) - 1 };
      if (next[matId] <= 0) delete next[matId];
      return next;
    });
  }

  // ---------- post-battle ----------
  // Save surviving fighters' HP so it carries to the next encounter.
  function saveRunHp() {
    if (!battle) return;
    setRunHp((hp) => {
      const next = { ...hp };
      battle.fighters.forEach((f) => (next[f.uid] = f.hp));
      return next;
    });
  }

  // Add progress to every monster currently on the team. delta may carry
  // any numeric stat plus a kosByElement map. Persists on the collection.
  function awardProgress(delta) {
    const teamIds = new Set(team);
    setCollection((c) =>
      c.map((m) => {
        if (!teamIds.has(m.uid)) return m;
        const prog = { xp: 0, wins: 0, battles: 0, bossKills: 0, eliteKills: 0, treasures: 0, rests: 0, shops: 0, faints: 0, soloKills: 0, flawlessWins: 0, kosByElement: {}, ...(m.prog || {}) };
        const next = { ...prog, kosByElement: { ...(prog.kosByElement || {}) } };
        for (const k in delta) {
          if (k === "kosByElement") {
            for (const el in delta.kosByElement) {
              next.kosByElement[el] = (next.kosByElement[el] || 0) + delta.kosByElement[el];
            }
          } else {
            next[k] = (next[k] || 0) + delta[k];
          }
        }
        return { ...m, prog: next };
      })
    );
  }

  function afterWin() {
    saveRunHp();
    const isWild = battle.wild;
    const isBoss = battle.isBoss;
    const isElite = activeNode && activeNode.type === "elite";
    const enemyEl = battle.enemy.element;
    const aliveCount = battle.fighters.filter((f) => f.hp > 0).length;
    const anyFainted = battle.fighters.some((f) => f.hp <= 0);
    const delta = {
      xp: isBoss ? 80 : isElite ? 50 : isWild ? 20 : 30,
      wins: 1,
      battles: 1,
      bossKills: isBoss ? 1 : 0,
      eliteKills: isElite ? 1 : 0,
      kosByElement: { [enemyEl]: 1 },
      flawlessWins: anyFainted ? 0 : 1,
      soloKills: aliveCount === 1 ? 1 : 0,
    };
    awardProgress(delta);
    bumpStat("battlesWon");
    tickEggs();
    if (isBoss) bumpStat("bossesSlain");
    // ----- material drops: automatic, separate from the chosen reward -----
    const drops = rollDrops(battle.enemy, { boss: isBoss, elite: isElite, wild: isWild });
    grantMaterials(drops);
    const capturedTemplate = battle.enemy;
    const choices = [];
    choices.push({ kind: "capture", template: capturedTemplate });
    if (battle.rival) {
      bumpStat("rivalWins");
      choices.length = 0; // no capturing the rival's partner
      choices.push({ kind: "gold", amount: 120 });
    } else if (isWild) {
      // wild encounters: capture or a little gold, then back to overworld
      choices.push({ kind: "gold", amount: 15 });
    } else {
      const pool = isElite || isBoss ? ITEMS.filter((i) => i.rarity !== "common") : ITEMS;
      const drop = pool[Math.floor(Math.random() * pool.length)];
      choices.push({ kind: "item", item: drop });
      if (isElite || isBoss) {
        choices.push({ kind: "generate" });
        // StS-style: elites and bosses always offer a run artifact
        const unowned = ARTIFACTS.filter((a) => !runArtifacts.includes(a.id));
        if (unowned.length > 0) {
          const art = unowned[Math.floor(Math.random() * unowned.length)];
          choices.push({ kind: "artifact", artifact: art });
        }
      }
      // rare: elite/boss loot can include an undiscovered recipe scroll
      if (isElite || isBoss) {
        const unknown = RECIPES.filter((r) => !knownRecipes.has(r.item));
        if (unknown.length > 0 && Math.random() < 0.3) {
          const r = unknown[Math.floor(Math.random() * unknown.length)];
          choices.push({ kind: "recipe", item: r.item });
        }
      }
      choices.push({ kind: "gold", amount: isBoss ? 80 : isElite ? 50 : 25 });
    }
    setPendingReward({ choices, isBoss, wild: isWild, drops });
    setScreen("reward");
  }

  function takeReward(choice) {
    const wild = pendingReward && pendingReward.wild;
    const goBack = () => {
      if (wild) {
        setBattle(null);
        setWildBattle(false);
        setPendingReward(null);
        setScreen("overworld");
      } else {
        returnToMap();
      }
    };
    if (choice.kind === "capture") {
      const ballCount = items.filter((id) => id === "beastball").length;
      if (ballCount <= 0) {
        flash("You have no Beast Balls! Buy some at a shop.");
        return; // stay on the reward screen so they can pick something else
      }
      const cleanName = choice.template.name.replace(/^(BOSS |Elite )/, "");
      const fresh = makeMonster({
        name: cleanName,
        element: choice.template.element,
        elements: choice.template.elements,
        form: choice.template.form || "regular",
        hp: choice.template.baseHp || choice.template.maxHp,
        sprite: choice.template.sprite,
        desc: choice.template.desc,
        svg: choice.template.svg,
        imageUrl: choice.template.imageUrl,
        rarity: choice.template.rarity,
        tier: choice.template.tier,
        evolvesTo: choice.template.evolvesTo,
        cards: choice.template.cards.map(({ cid, ...c }) => c),
      });
      setCollection((c) => [...c, fresh]);
      setSeen((s) => new Set(s).add(cleanName));
      bumpStat("monstersCaptured");
      SFX.capture();
      // consume one Beast Ball
      setItems((arr) => {
        const i = arr.indexOf("beastball");
        if (i === -1) return arr;
        return [...arr.slice(0, i), ...arr.slice(i + 1)];
      });
      flash(`Caught ${cleanName}! (Beast Ball used)`);
      goBack();
    } else if (choice.kind === "item") {
      grantItem(choice.item.id);
      flash(`Found ${choice.item.name}!`);
      goBack();
    } else if (choice.kind === "gold") {
      setGold((g) => g + choice.amount);
      flash(`Picked up ${choice.amount} gold.`);
      goBack();
    } else if (choice.kind === "recipe") {
      learnRecipe(choice.item);
      goBack();
    } else if (choice.kind === "artifact") {
      setRunArtifacts((a) => [...a, choice.artifact.id]);
      flash(`Artifact claimed: ${choice.artifact.name} (this run only)`);
      goBack();
    } else if (choice.kind === "generate") {
      setScreen("generate");
    }
  }

  // ----- non-combat node resolvers -----
  function resolveTreasure() {
    awardProgress({ treasures: 1 });
    // half the time a chest holds a run artifact instead of an item
    const unowned = ARTIFACTS.filter((a) => !runArtifacts.includes(a.id));
    if (unowned.length > 0 && Math.random() < 0.5) {
      const art = unowned[Math.floor(Math.random() * unowned.length)];
      setRunArtifacts((a) => [...a, art.id]);
      setGold((g) => g + 20);
      flash(`Treasure: ${art.icon} ${art.name} (this run) + 20 gold!`);
    } else {
      const pool = ITEMS.filter((i) => i.rarity !== "common");
      const drop = pool[Math.floor(Math.random() * pool.length)];
      grantItem(drop.id);
      setGold((g) => g + 20);
      flash(`Treasure: ${drop.name} + 20 gold!`);
    }
    setTimeout(returnToMap, 200);
  }

  function restHeal(kind) {
    // heal 40% of max HP to all, or full-heal one
    setRunHp((hp) => {
      const next = { ...hp };
      teamMonsters.forEach((m) => {
        const cur = next[m.uid] == null ? m.maxHp : next[m.uid];
        next[m.uid] = clamp(Math.round(cur + m.maxHp * 0.4), 0, m.maxHp);
      });
      return next;
    });
    awardProgress({ rests: 1 });
    flash("Your team rests (+40% HP).");
    if (returnScreen === "overworld") setScreen("overworld");
    else returnToMap();
  }

  function leaveShop() {
    if (returnScreen === "overworld") setScreen("overworld");
    else returnToMap();
  }

  function buyItem(it, price) {
    const cost = price != null ? price : it.rarity === "rare" || it.rarity === "legendary" ? 60 : it.rarity === "uncommon" ? 40 : 25;
    if (gold < cost) {
      flash("Not enough gold.");
      return;
    }
    setGold((g) => g - cost);
    grantItem(it.id);
    flash(`Bought ${it.name}.`);
  }

  // Buy a recipe scroll from a deep shop.
  function buyRecipe(itemId, price) {
    if (gold < price) {
      flash("Not enough gold.");
      return;
    }
    setGold((g) => g - price);
    learnRecipe(itemId);
  }

  // mystery: random good or mild-bad outcome
  function resolveMystery(outcome) {
    if (outcome === "item") {
      const drop = ITEMS[Math.floor(Math.random() * ITEMS.length)];
      grantItem(drop.id);
      flash(`A traveler gives you ${drop.name}.`);
    } else if (outcome === "gold") {
      const g = 15 + Math.floor(Math.random() * 30);
      setGold((x) => x + g);
      flash(`You find ${g} gold.`);
    } else if (outcome === "heal") {
      setRunHp((hp) => {
        const next = { ...hp };
        teamMonsters.forEach((m) => {
          const cur = next[m.uid] == null ? m.maxHp : next[m.uid];
          next[m.uid] = clamp(cur + 15, 0, m.maxHp);
        });
        return next;
      });
      flash("A spring heals your team (+15 HP).");
    } else if (outcome === "hurt") {
      setRunHp((hp) => {
        const next = { ...hp };
        teamMonsters.forEach((m) => {
          const cur = next[m.uid] == null ? m.maxHp : next[m.uid];
          next[m.uid] = clamp(cur - 8, 1, m.maxHp);
        });
        return next;
      });
      flash("A trap! Your team takes 8 damage each.");
    }
    returnToMap();
  }

  // Evolve a monster into its next form, IF its requirements are met.
  // Consumes one Evolution Stone and carries leftover XP into the new form.
  async function evolveMonster(m) {
    const target = evolutionTarget(m);
    if (!target) return;
    const { met, req } = checkEvolution(m, items);
    if (!met) {
      flash("Requirements not met yet.");
      return;
    }
    if (req.item === "evostone") {
      setItems((arr) => {
        const i = arr.indexOf("evostone");
        if (i === -1) return arr;
        return [...arr.slice(0, i), ...arr.slice(i + 1)];
      });
    }
    const xpCond = (req.conds || []).find((c) => c.stat === "xp");
    const xpNeed = xpCond ? xpCond.need : 0;
    const leftoverXp = Math.max(0, (m.prog?.xp || 0) - xpNeed);

    // ----- forged monster: generate the next stage via AI -----
    if (m.forged) {
      flash(`${m.name} is evolving...`);
      const nextStage = (m.forgedStage || 1) + 1;
      const nextRarity = RARITY_LADDER[Math.min(RARITY_LADDER.length - 1, rarityIndex(m.rarity) + 1)];
      const budget = RARITY_BUDGET[nextRarity];
      try {
        const prompt = `Evolve a forged monster in a Pokémon x Slay the Spire card battler. Respond with ONLY a JSON object, no prose.

Current form: ${JSON.stringify({ name: m.name, element: m.element, hp: m.maxHp, desc: m.desc, cards: m.cards.map(({ cid, ...c }) => c) })}

Create its NEXT evolution: same element (${m.element}), clearly more powerful, an evolved name (related to the current one), HP in range ${budget.hp[0]}-${budget.hp[1]}, power level ${budget.power}. Keep the theme but make it look grander.
{
  "name":"evolved name",
  "hp": integer ${budget.hp[0]}-${budget.hp[1]},
  "sprite":"single emoji",
  "desc":"one vivid sentence",
  "cards":[ exactly 3 cards; fields id,name,type(attack|skill|power),cost(0-2),text, optional dmg/block/strength/burn/weak/draw/hits/shield/teamheal/regen/vulnerable/energy/chill/soak/shock/poison/decay/leech and booleans retain/exhaust. Match status to element: pyre=burn, frost=chill, hydro=soak, charge=shock, toxin=poison, umbra=vulnerable, void=decay, blood=leech. (shield=team block, teamheal=heal all, regen=heal-over-time, poison=non-decaying DoT, chill=enemy hits weaker, soak=sets up reactions, shock=enemy fumbles, decay=enemy loses HP+block, vulnerable=+50% dmg taken, leech=heal from damage) ]
}`;
        const data = await askClaudeJson(prompt);
        const evolved = makeMonster({
          name: data.name || `${m.name}+`,
          element: m.element,
          hp: clamp(Number(data.hp) || budget.hp[1], budget.hp[0], budget.hp[1]),
          sprite: data.sprite || m.sprite,
          desc: data.desc || m.desc,
          rarity: nextRarity,
          boon: m.boon,
          forged: true,
          forgedStage: nextStage,
          forgedStages: m.forgedStages,
          cards: (data.cards || m.cards.map(({ cid, ...c }) => c)).slice(0, 3),
        });
        evolved.prog = { ...evolved.prog, xp: leftoverXp };
        setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...evolved, uid: m.uid } : x)));
        flash(`${m.name} evolved into ${evolved.name}!`);
        const svg = await generateArt({ name: evolved.name, element: evolved.element, desc: evolved.desc });
        if (svg) setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
      } catch (e) {
        flash("Evolution failed, try again.");
      }
      return;
    }

    // ----- roster monster: swap to the known next form -----
    const evolved = makeMonster({ ...target, svg: null, imageUrl: null });
    // egg moves are family heirlooms: they survive evolution
    const heirloom = (m.cards || []).find((c) => c.eggMove);
    if (heirloom) evolved.cards = [...evolved.cards.slice(0, evolved.cards.length - 1), { ...heirloom, cid: `c${Date.now()}_${Math.floor(Math.random() * 9999)}` }];
    const keptForm = m.form && m.form !== "regular" && formAllowed(m.form, evolutionInfo(evolved)) ? m.form : "regular";
    evolved.form = keptForm;
    evolved.prog = { ...evolved.prog, xp: leftoverXp };
    setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...evolved, uid: m.uid } : x)));
    setSeen((s) => new Set(s).add(target.name));
    flash(`${m.name} evolved into ${target.name}!`);
    const svg = await generateArt({ name: target.name, element: target.element, desc: target.desc });
    if (svg) setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
  }

  // ---------- CHEAT / DEBUG helpers ----------
  function cheatGiveItem(id) {
    grantItem(id);
    const it = ITEMS.find((x) => x.id === id);
    flash(`Granted ${it ? it.name : id}.`);
  }
  function cheatGiveGold(n) {
    setGold((g) => g + n);
    flash(`+${n} gold.`);
  }
  async function cheatSpawnMonster(template) {
    const fresh = makeMonster({ ...template, svg: null });
    setCollection((c) => [...c, fresh]);
    setSeen((s) => new Set(s).add(template.name));
    flash(`Spawned ${template.name}.`);
    const svg = await generateArt({ name: template.name, element: template.element, desc: template.desc });
    if (svg) setCollection((c) => c.map((x) => (x.uid === fresh.uid ? { ...x, svg } : x)));
  }
  function cheatGiveXP(amount) {
    if (team.length === 0) {
      flash("Add monsters to your team first to grant XP.");
      return;
    }
    const allKos = {};
    ELEMENTS.forEach((e) => (allKos[e] = 5));
    awardProgress({ xp: amount, wins: 5, bossKills: 1, eliteKills: 1, treasures: 3, rests: 2, shops: 1, soloKills: 2, flawlessWins: 2, kosByElement: allKos });
    flash(`Granted ${amount} XP + deeds to your team.`);
  }
  function cheatRevealCodex() {
    setSeen(new Set(DEFAULT_MONSTERS.map((t) => t.name)));
    flash("Codex fully revealed.");
  }

  // ============================================================
  // RENDER
  // ============================================================
  const depthLabel = activeNode ? activeNode.row + 1 : runRow + 1;
  const vp = useViewport();
  const noScroll = screen === "battle" || screen === "overworld";
  return (
    <div style={noScroll ? { ...S.root, height: "100dvh", overflow: "hidden", display: "flex", flexDirection: "column" } : S.root}>
      <style>{CSS}</style>
      <Header screen={screen} setScreen={setScreen} floor={depthLabel} gold={gold} inBattle={!!battle && screen === "battle"} hasStarter={collection.length > 0} baseScreen={baseScreen} />

      {toast && <div style={S.toast}>{toast}</div>}

      <div style={noScroll
        ? { width: "100%", maxWidth: vp.landscape ? 1280 : 720, margin: "0 auto", padding: screen === "battle" ? "6px 10px 0" : "6px 10px 74px", flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
        : { ...S.main, maxWidth: vp.landscape ? 1280 : 720 }}>
        {screen === "title" && <Title onStart={() => setScreen(collection.length === 0 ? "starter" : "den")} />}

        {screen === "starter" && (
          <StarterScreen
            onPick={(tmpl) => {
              const m = makeMonster(tmpl);
              setCollection([m]);
              setTeam([m.uid]);
              setSeen(new Set([m.name]));
              flash(`${m.name} joins you. Your journey begins!`);
              setScreen("den");
              // paint the chosen starter in the background
              (async () => {
                const svg = await generateArt({ name: m.name, element: m.element, desc: m.desc, lore: m.lore });
                if (svg) setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
              })();
            }}
            onForged={(mon) => {
              const m = makeMonster(mon);
              setCollection([m]);
              setTeam([m.uid]);
              setSeen(new Set([m.name]));
              flash(`${m.name} is forged into being. Your journey begins!`);
              setScreen("den");
            }}
          />
        )}

        {screen === "collection" && (
          <MonstersGallery collection={collection} team={team} />
        )}

        {screen === "talk" && npcCtx && (
          <NPCTalk
            npc={NPCS[npcCtx]}
            stats={stats}
            seen={seen}
            activeQuests={activeQuests}
            doneQuests={doneQuests}
            onAccept={acceptQuest}
            onTurnIn={turnInQuest}
            onRivalBattle={npcCtx === "rival" ? startRivalBattle : null}
            onLeave={() => setScreen("overworld")}
          />
        )}

        {screen === "den" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
            <div style={{ flex: vp.landscape ? "1 1 420px" : "1 1 100%", minWidth: 0 }}>
            <Collection
              collection={collection}
              team={team}
              setTeam={setTeam}
              onDungeon={leaveDen}
              onEvolve={evolveMonster}
              items={items}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "14px 0" }}>
              <button style={S.cheatBtn} onClick={() => setScreen("generate")}>🔥 Forge</button>
              <button style={S.cheatBtn} onClick={() => setScreen("fuse")}>⚗️ Fusion & Nursery</button>
              <button style={S.cheatBtn} onClick={() => setScreen("craft")}>⚒️ Workshop</button>
            </div>
            </div>
            <div style={{ flex: vp.landscape ? "1 1 420px" : "1 1 100%", minWidth: 0 }}>
            <MoveTutor
              collection={collection}
              gold={gold}
              items={items}
              materials={materials}
              onLearnType={learnTypeMove}
              onLearnSpecial={learnSpecialMove}
              onForget={forgetMove}
              onTransfer={transferMove}
              iconArt={iconArt}
              onPaint={paintIcon}
            />
            </div>
          </div>
        )}

        {screen === "overworld" && (
          <Overworld
            vp={vp}
            ow={overworld}
            pos={playerPos}
            onMove={movePlayer}
            onLeave={() => setScreen("collection")}
          />
        )}

        {(screen === "map" || screen === "battle") && runArtifacts.length > 0 && (
          <div style={{ ...S.dropsBar, marginBottom: 8 }}>
            <span style={{ fontSize: 10, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>Artifacts</span>
            {runArtifacts.map((id) => {
              const a = artifactById(id);
              return a ? <span key={id} style={{ ...S.dropPill, borderColor: "#ffd34d66" }} title={a.text}>{a.icon} {a.name}</span> : null;
            })}
          </div>
        )}

        {screen === "map" && runMap && (
          <DungeonMap
            map={runMap}
            currentRow={runRow}
            currentCol={runCol}
            onPick={chooseNode}
            onLeave={() => {
              flash("You leave the dungeon. Your artifacts crumble to dust.");
              setRunArtifacts([]);
              setBattle(null);
              setScreen("overworld");
            }}
          />
        )}

        {screen === "rest" && (
          <RestSite team={teamMonsters} runHp={runHp} onRest={restHeal} />
        )}

        {screen === "shop" && (
          <Shop gold={gold} owned={items} onBuy={buyItem} onLeave={leaveShop} deep={shopCtx.deep} depth={shopCtx.depth} unknownRecipes={RECIPES.filter((r) => !knownRecipes.has(r.item)).map((r) => r.item)} onBuyRecipe={buyRecipe} />
        )}

        {screen === "mystery" && (
          <Mystery onResolve={resolveMystery} />
        )}

        {screen === "compendium" && (
          <Compendium seen={seen} collection={collection} seenItems={seenItems} />
        )}

        {screen === "items" && (
          <ItemsScreen items={items} materials={materials} iconArt={iconArt} onPaint={paintIcon} />
        )}

        {screen === "craft" && (
          <CraftScreen
            materials={materials}
            collection={collection}
            team={team}
            onCraft={craftItem}
            onTransmute={transmuteMonster}
            seenMaterials={seenMaterials}
            knownRecipes={knownRecipes}
            onBack={() => setScreen("den")}
          />
        )}

        {screen === "cheat" && (
          <CheatPanel
            onGiveItem={cheatGiveItem}
            onGiveGold={cheatGiveGold}
            onSpawn={cheatSpawnMonster}
            onGiveXP={cheatGiveXP}
            onRevealCodex={cheatRevealCodex}
            onLearnRecipes={() => { setKnownRecipes(new Set(RECIPES.map((r) => r.item))); flash("All recipes learned."); }}
            onMakeMonster={(tmpl, withArt) => {
              const m = makeMonster(tmpl);
              setCollection((c) => [...c, m]);
              setSeen((sn) => new Set(sn).add(m.name));
              flash(`🛠️ Created ${m.name}.`);
              if (withArt) {
                (async () => {
                  const svg = await generateArt({ name: m.name, element: m.element, desc: m.desc, lore: m.desc });
                  if (svg) setCollection((c) => c.map((x) => (x.uid === m.uid ? { ...x, svg } : x)));
                  else flash("Art generation failed (need an API key outside Claude).");
                })();
              }
            }}
            onAddMove={(uid2, card) => {
              setCollection((c) => c.map((m) => (m.uid === uid2 ? { ...m, cards: [...m.cards, { ...card, learned: true }] } : m)));
              flash(`🛠️ Move taught.`);
            }}
            onPaintIcon={paintIcon}
            onSaveNow={() => { storeSet(serializeSave()); flash("💾 Saved."); }}
            onExport={serializeSave}
            onImport={(d) => { const ok = hydrateSave(d); if (ok) { storeSet(d); flash("💾 Save imported."); } return ok; }}
            onReset={resetGame}
            onMakeItem={(item) => {
              ITEMS.push(item); // runtime registry: appears in bag/codex/shops
              grantItem(item.id);
              flash(`🛠️ Created ${item.name} (granted 1).`);
            }}
            onGiveMaterials={() => { const all = {}; MATERIALS.forEach((m) => (all[m.id] = 5)); grantMaterials(all); flash("+5 of every material."); }}
            onClose={() => setScreen("collection")}
            gold={gold}
            items={items}
            collection={collection}
            team={team}
            seen={seen}
            seenItems={seenItems}
            materials={materials}
          />
        )}

        {screen === "generate" && (
          <Generate
            items={items}
            free={!!activeNode}
            onCreated={(mon) => {
              setCollection((c) => [...c, makeMonster(mon)]);
              setSeen((s) => new Set(s).add(mon.name));
              // consume a Genesis Spark unless this was a free reward forge
              if (!activeNode) {
                setItems((arr) => {
                  const i = arr.indexOf("genesisspark");
                  if (i === -1) return arr;
                  return [...arr.slice(0, i), ...arr.slice(i + 1)];
                });
              }
              flash(`${mon.name} materializes into your collection!`);
              if (activeNode) {
                returnToMap();
              } else {
                setScreen("collection");
              }
            }}
            onCancel={() => (activeNode ? returnToMap() : setScreen("den"))}
          />
        )}

        {screen === "fuse" && (
          <Fuse
            collection={collection}
            items={items}
            eggs={eggs}
            materials={materials}
            onBreed={breedPair}
            canBreedCheck={canBreed}
            onFused={(mon) => {
              setCollection((c) => [...c, makeMonster(mon)]);
              setSeen((s) => new Set(s).add(mon.name));
              // consume one Fusion Catalyst
              setItems((arr) => {
                const i = arr.indexOf("fusioncatalyst");
                if (i === -1) return arr;
                return [...arr.slice(0, i), ...arr.slice(i + 1)];
              });
              flash(`Fusion complete: ${mon.name}!`);
              setScreen("den");
            }}
            onFormFused={(mA, mB, next) => {
              // deterministic same-species merge: both are consumed, one
              // emerges at the next form. XP is pooled; art/boons carry from A.
              const merged = {
                ...mA,
                uid: `m${Date.now()}_${Math.floor(Math.random() * 9999)}`,
                form: next,
                prog: { ...mA.prog, xp: ((mA.prog && mA.prog.xp) || 0) + ((mB.prog && mB.prog.xp) || 0) },
              };
              setTeam((t) => t.filter((uid) => uid !== mA.uid && uid !== mB.uid));
              setCollection((c) => [...c.filter((x) => x.uid !== mA.uid && x.uid !== mB.uid), merged]);
              flash(`${FORMS[next].badge} Form Fusion: ${merged.name} is now ${FORMS[next].label}!`);
              setScreen("den");
            }}
            onCancel={() => setScreen("den")}
          />
        )}

        {screen === "battle" && battle && (
          <Battle
            vp={vp}
            battle={battle}
            team={teamMonsters}
            onPlay={playCard}
            onEnd={endTurn}
            onPotion={usePotion}
            materials={materials}
            onMaterial={useMaterial}
            iconArt={iconArt}
            onSwap={swapTo}
            onWin={afterWin}
            onLose={() => {
              if (wildBattle) {
                flash("Your team fled back to safety.");
                setWildBattle(false);
                setBattle(null);
                // revive a little so the player isn't stuck at 0
                setRunHp((hp) => {
                  const next = { ...hp };
                  teamMonsters.forEach((m) => {
                    next[m.uid] = Math.max(next[m.uid] || 0, Math.round(m.maxHp * 0.3));
                  });
                  return next;
                });
                setScreen("overworld");
              } else {
                flash("Your team was defeated. Your artifacts are lost.");
                setRunArtifacts([]);
                setBattle(null);
                setScreen("overworld");
              }
            }}
          />
        )}

        {screen === "reward" && pendingReward && (
          <Reward reward={pendingReward} onTake={takeReward} floor={depthLabel} ballCount={items.filter((id) => id === "beastball").length} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/responsive — viewport + orientation hook. UPDATE WHEN:
// ║ a screen needs to reflow by shape — read useViewport() for {w,h,
// ║ landscape, compact}. landscape = wider than tall; compact = small.
// ╚══════════════════════════════════════════════════════════════════╝
