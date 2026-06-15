import React, { useState, useEffect, useRef } from "react";
import { APP_VERSION } from "../version.js";
import { SFX } from "../systems/sfx.js";
import { askClaudeJson, generateArt } from "../ai/claude.js";
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_GLYPH, MATRIX, MULT_STRONG, MULT_WEAK, defenseMultiplier, FORMS, FORM_ORDER, monElements, monAccent, gradBorderStyle, ElementPills, formLabel, buildLines, lineOf, ELEMENT_STATUS, SELF_RESIST, REACTIONS } from "../systems/elements.jsx";
import { itemIcon, moveIcon, IconArt } from "./icons.jsx";
import { UNIVERSAL_CARDS, TYPE_MOVES, SPECIAL_MOVES, MOVE_CAP } from "../data/moves.js";
import { DEFAULT_MONSTERS } from "../data/monsters.js";
import { CODEX_ORDER, dexNumber } from "../data/dex.js";
import { ITEMS } from "../data/items.js";
import { MATERIALS, materialById, transmuteTable, RECIPES, canCraft } from "../data/materials.js";
import { RARITY_COLOR, RARITY_LADDER, RARITY_BUDGET, BOONS, STAT_EMPHASES, rollForge } from "../systems/forge.js";
import { shuffle, clamp } from "../utils.js";
import { evolutionTarget, isFormFusion, nextFormOf, canFuse, stageLabel } from "../game/monster.js";
import { checkEvolution } from "../game/evolution.js";
import { NODE_TYPES } from "../systems/map.js";
import { QUESTS, questProgress } from "../data/quests.js";
import { S, tcg } from "./styles.js";

function useViewport() {
  const get = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 400;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    return { w, h, landscape: w > h * 1.15, compact: Math.min(w, h) < 480 };
  };
  const [vp, setVp] = useState(get);
  useEffect(() => {
    const on = () => setVp(get());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
  }, []);
  return vp;
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/chrome — header, nav, version tag
// ║ UPDATE WHEN: new top-level screens (nav prune rule: deep actions = den only); APP_VERSION bump EVERY edit
// ╚══════════════════════════════════════════════════════════════════╝
function Header({ screen, setScreen, floor, gold, inBattle, hasStarter, baseScreen }) {
  const runScreens = ["battle", "rest", "shop", "mystery", "reward"]; // menus stay reachable on overworld + dungeon map
  const inRun = runScreens.includes(screen);
  const showTabs = !inRun && screen !== "title";
  const tapRef = useRef({ count: 0, last: 0 });

  function onLogoTap() {
    const now = Date.now();
    const t = tapRef.current;
    // reset the streak if taps are too far apart
    if (now - t.last > 600) t.count = 0;
    t.count += 1;
    t.last = now;
    if (t.count >= 5) {
      t.count = 0;
      setScreen("cheat");
      return;
    }
    // a normal single tap still navigates home (but not mid-run)
    if (!inRun) setScreen("title");
  }

  return (
    <>
      <div style={S.header}>
        {screen === "cheat" ? (
          // On the debug screen the logo is hidden (replaced by an inert
          // badge) so an extra tap can't accidentally navigate away.
          <div style={{ ...S.logo, cursor: "default", color: "#ffd34d" }}>
            🛠️ DEBUG <span style={S.versionTag}>{APP_VERSION}</span>
          </div>
        ) : (
          <div style={S.logo} onClick={onLogoTap}>
            CHIMERA<span style={{ color: "#ffd34d" }}>·</span>CARDS
            <span style={S.versionTag}>{APP_VERSION}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {gold > 0 && <div style={{ color: "#ffd34d", fontWeight: 700, fontSize: 14 }}>🪙 {gold}</div>}
          {inRun && floor > 0 && <div style={S.floorTag}>DEPTH {floor}</div>}
        </div>
      </div>

      {showTabs && hasStarter && screen !== "starter" && (
        <nav style={S.tabBar}>
          {[
            ...(["collection", "compendium", "items"].includes(screen) && baseScreen ? [["__back", "↩", "Return"]] : []),
            ["collection", "🐾", "Monsters"],
            ["compendium", "📖", "Codex"],
            ["items", "🎒", "Bag"],

          ].map(([key, icon, label]) => {
            const active = screen === key;
            return (
              <button
                key={key}
                style={{ ...S.tab, ...(active ? S.tabActive : null) }}
                onClick={() => setScreen(key === "__back" ? baseScreen : key)}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: 10, letterSpacing: 0.5 }}>{label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </>
  );
}

function Title({ onStart }) {
  return (
    <div style={S.title}>
      <div className="float" style={{ fontSize: 80 }}>🜂🜄🜁</div>
      <h1 style={S.h1}>CHIMERA CARDS</h1>
      <p style={S.tagline}>
        Capture beasts. Forge them from pure description. Fuse two into one.
        Descend a deck-driven dungeon that never plays the same way twice.
      </p>
      <button style={S.bigBtn} onClick={onStart}>Enter the Den →</button>
      <div style={S.featRow}>
        <Feat icon="🃏" t="Card combat" d="Every move is a card, Spire-style." />
        <Feat icon="🧬" t="AI forge" d="Describe a monster, get art + moves." />
        <Feat icon="⚗️" t="Fusion" d="Merge any two creatures." />
        <Feat icon="🗝️" t="Roguelike" d="Scaling floors, capture rewards." />
      </div>
    </div>
  );
}
function Feat({ icon, t, d }) {
  return (
    <div style={S.feat}>
      <div style={{ fontSize: 26 }}>{icon}</div>
      <strong style={{ color: "#ffd34d" }}>{t}</strong>
      <span style={{ opacity: 0.7, fontSize: 13 }}>{d}</span>
    </div>
  );
}

function MonsterSprite({ m, size = 64 }) {
  if (m.svg) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          overflow: "hidden",
          ...gradBorderStyle(m, "#0c0b16", 2),
        }}
        dangerouslySetInnerHTML={{
          __html: m.svg.replace(/<svg /, `<svg style="width:100%;height:100%;display:block" `),
        }}
      />
    );
  }
  if (m.imageUrl) {
    return (
      <img
        src={m.imageUrl}
        alt={m.name}
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 12, border: "2px solid #2a2a3a" }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.55,
        background: `radial-gradient(circle, ${ELEMENT_COLOR[m.element] || "#888"}33, transparent)`,
        borderRadius: 12,
      }}
    >
      {m.sprite}
    </div>
  );
}

// Fills whatever container it's in with the best art we have:
// a real rendered image (imageUrl) > AI SVG > emoji placeholder.
function MonsterArt({ m }) {
  if (m.imageUrl) {
    return (
      <img
        src={m.imageUrl}
        alt={m.name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    );
  }
  if (m.svg) {
    return (
      <div
        style={{ width: "100%", height: "100%" }}
        dangerouslySetInnerHTML={{
          __html: m.svg.replace(/<svg /, `<svg preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block" `),
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        placeItems: "center",
        fontSize: 90,
        background: `radial-gradient(circle at 50% 38%, ${ELEMENT_COLOR[m.element] || "#888"}44, transparent 70%)`,
      }}
    >
      {m.sprite}
    </div>
  );
}

// A full trading-card-game style frame. The art window accepts a
// rendered imageUrl when a backend provides one, and otherwise shows
// the AI SVG or emoji. Element drives the whole color treatment.
function TCGCard({ m, width = 280, footer = null }) {
  const accent = ELEMENT_COLOR[m.element] || "#c9a66b";
  const h = width * 1.4;
  return (
    <div style={{ ...tcg.card, width, height: h, "--accent": accent }}>
      {/* foil sheen */}
      <div style={tcg.sheen} />
      {/* ornate outer border */}
      <div style={{ ...tcg.border, ...gradBorderStyle(m, "#0f0d1c", 3), borderColor: undefined }}>
        {/* title bar */}
        <div style={tcg.titleBar}>
          <span style={tcg.name}>{m.name}{formLabel(m) ? <span style={{ fontSize: 10, color: "#ffd34d", marginLeft: 5 }}>{formLabel(m)}</span> : null}</span>
          <span style={{ ...tcg.elementGem, background: accent }}>{ELEMENT_GLYPH[m.element] || "◆"}</span>
        </div>

        {/* art window */}
        <div style={{ ...tcg.artWindow, boxShadow: `inset 0 0 0 2px ${accent}, inset 0 0 24px ${accent}55` }}>
          <MonsterArt m={m} />
          {/* HP badge */}
          <div style={{ ...tcg.hpBadge, background: accent }}>
            <span style={{ fontSize: 9, opacity: 0.8 }}>HP</span> {m.maxHp}
          </div>
          {/* corner filigree */}
          <span style={{ ...tcg.corner, top: 4, left: 4, borderColor: accent }} />
          <span style={{ ...tcg.corner, top: 4, right: 4, borderColor: accent, transform: "scaleX(-1)" }} />
        </div>

        {/* type line */}
        <div style={tcg.typeLine}>
          <span style={{ ...tcg.elementPillSm, background: accent }}>{monElements(m).join(" · ")}</span>
          <span style={{ opacity: 0.55, fontSize: 10, letterSpacing: 1 }}>SIGNATURE BEAST</span>
        </div>

        {/* description box */}
        <div style={tcg.descBox}>
          <p style={tcg.descText}>{m.desc || "A mysterious creature with untold power."}</p>
          {m.boon && (
            <div style={{ fontSize: 10, color: "#ff7ad9", fontWeight: 700, marginTop: 4 }}>
              ✦ {m.boon.name}
            </div>
          )}
          <div style={tcg.cardCount}>{m.cards.length} moves in deck</div>
        </div>

        {footer && <div style={tcg.footer}>{footer}</div>}
      </div>
    </div>
  );
}

// View-only collection, reachable from anywhere. Team changes happen at
// the Den (a place on the overworld map).
// ---------- NPC dialog + quest board ----------
function NPCTalk({ npc, stats, seen, activeQuests, doneQuests, onAccept, onTurnIn, onRivalBattle, onLeave }) {
  const chain = QUESTS.filter((q) => q.giver === npc.id);
  const next = chain.find((q) => !doneQuests.has(q.id) && !activeQuests.includes(q.id));
  const active = chain.filter((q) => activeQuests.includes(q.id));
  const allDone = chain.every((q) => doneQuests.has(q.id));
  return (
    <div>
      <div style={S.sectionHead}>
        <h2 style={S.h2}><span style={{ fontSize: 30 }}>{npc.icon}</span> {npc.name}</h2>
        <button style={{ ...S.ghostBtn, marginTop: 0 }} onClick={onLeave}>Leave</button>
      </div>
      <p style={{ opacity: 0.8, fontStyle: "italic" }}>"{allDone ? (npc.id === "rival" ? "Fine. You're... not terrible. Now stop following me." : "Splendid work. The dex sings your praises!") : npc.greet}"</p>
      {onRivalBattle && (
        <button style={{ ...S.bigBtn, marginBottom: 14 }} onClick={onRivalBattle}>⚔️ Battle {npc.name}!</button>
      )}
      {active.map((q) => {
        const pr = questProgress(q, stats, seen);
        return (
          <div key={q.id} style={{ ...S.adminRow, cursor: "default", borderColor: pr.done ? "#7ee787" : "#2c2a40" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: 13 }}>📜 {q.title}</strong>
              <span style={{ fontSize: 11, color: pr.done ? "#7ee787" : "#ffd34d" }}>{pr.cur}/{pr.need}</span>
              {pr.done && <button style={{ ...S.cheatBtn, marginLeft: "auto" }} onClick={() => onTurnIn(q)}>Turn in ✅</button>}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{q.text}</div>
          </div>
        );
      })}
      {next && (
        <div style={{ ...S.adminRow, cursor: "default", borderColor: "#ffd34d66" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <strong style={{ fontSize: 13 }}>❗ {next.title}</strong>
            <button style={{ ...S.cheatBtn, marginLeft: "auto" }} onClick={() => onAccept(next)}>Accept</button>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{next.text}</div>
        </div>
      )}
      {chain.filter((q) => doneQuests.has(q.id)).map((q) => (
        <div key={q.id} style={{ fontSize: 11, opacity: 0.45 }}>✅ {q.title}</div>
      ))}
    </div>
  );
}

function MonstersGallery({ collection, team }) {
  const [detail, setDetail] = useState(null);
  return (
    <div>
      <h2 style={S.h2}>Your Monsters ({collection.length})</h2>
      <p style={{ opacity: 0.65 }}>Browsing only. Visit 🏠 Your Den on the overworld to change your team, evolve, or tutor moves.</p>
      <div style={S.grid}>
        {collection.map((m) => (
          <div key={m.uid} style={{ ...S.monCard, borderColor: team.includes(m.uid) ? "#7ee787" : "#262633" }} onClick={() => setDetail(detail === m.uid ? null : m.uid)}>
            {team.includes(m.uid) && <div style={S.teamBadge}>TEAM</div>}
            <MonsterSprite m={m} size={52} />
            <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>
              {m.name} {formLabel(m) && <span style={{ fontSize: 10, color: "#ffd34d" }}>{formLabel(m)}</span>}
            </div>
            <ElementPills m={m} />
            <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{stageLabel(m)}</div>
            {detail === m.uid && (
              <div style={{ marginTop: 6, textAlign: "left" }}>
                {m.cards.map((c, i) => (
                  <div key={i} style={{ fontSize: 10, opacity: 0.8 }}>
                    {c.eggMove ? "🥚 " : c.learned ? "🎓 " : c.transferred ? "💸 " : "• "}{c.name} ({c.cost}) — {c.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Move Tutor (Den only) ----------
function MoveTutor({ collection, gold, items, materials, onLearnType, onLearnSpecial, onForget, onTransfer, iconArt, onPaint }) {
  const [uid2, setUid] = useState(null);
  const [transferIdx, setTransferIdx] = useState(null);
  const mon = collection.find((m) => m.uid === uid2) || null;
  const tomes = items.filter((i) => i === "ancienttome").length;
  return (
    <div style={{ marginTop: 26 }}>
      <h2 style={S.h2}>🎓 Move Tutor</h2>
      <p style={{ opacity: 0.65, fontSize: 13 }}>
        Every monster fights with Strike and Guard plus up to {MOVE_CAP} of its own moves. Learn type moves (80g),
        special moves (120g + 📕 Ancient Tome, you have {tomes}), or transfer ANY non-generic move between monsters
        for 400g + 1 🔮 Primal Core.
      </p>
      <select style={S.dexSelect} value={uid2 || ""} onChange={(e) => { setUid(e.target.value || null); setTransferIdx(null); }}>
        <option value="">Select a monster…</option>
        {collection.map((m) => <option key={m.uid} value={m.uid}>{m.sprite} {m.name}{formLabel(m) ? ` (${FORMS[m.form].label})` : ""}</option>)}
      </select>
      {mon && (
        <>
          <h3 style={S.bagSub}>Known moves ({mon.cards.length}/{MOVE_CAP})</h3>
          {mon.cards.map((c, i) => (
            <div key={i} style={{ ...S.adminRow, cursor: "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <IconArt svg={iconArt && iconArt[`move:${c.id}`] && iconArt[`move:${c.id}`] !== "…" ? iconArt[`move:${c.id}`] : moveIcon(c, mon.element)} emoji="" size={22} />
                <span style={{ fontSize: 10 }}>{c.eggMove ? "🥚" : c.learned ? "🎓" : c.transferred ? "💸" : "★"}</span>
                <strong style={{ fontSize: 12 }}>{c.name}</strong>
                <span style={{ fontSize: 10, opacity: 0.7 }}>({c.cost}) {c.text}</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                  {(c.learned || c.transferred) && <button style={{ ...S.cheatBtn, fontSize: 10, padding: "3px 7px" }} onClick={() => onForget(mon, i)}>Forget</button>}
                  {transferIdx === i ? (
                    <select style={{ ...S.dexSelect, padding: "3px 6px", fontSize: 10 }} defaultValue="" onChange={(e) => { const r = collection.find((m) => m.uid === e.target.value); if (r) onTransfer(mon, i, r); setTransferIdx(null); }}>
                      <option value="">to whom?</option>
                      {collection.filter((m) => m.uid !== mon.uid).map((m) => <option key={m.uid} value={m.uid}>{m.name}</option>)}
                    </select>
                  ) : (
                    <button style={{ ...S.cheatBtn, fontSize: 10, padding: "3px 7px" }} onClick={() => setTransferIdx(i)}>Transfer…</button>
                  )}
                </span>
              </div>
            </div>
          ))}
          <h3 style={S.bagSub}>Learn type moves (80g)</h3>
          {TYPE_MOVES.filter((tm) => (mon.elements && mon.elements.length ? mon.elements : [mon.element]).includes(tm.element)).map((tm) => {
            const known = mon.cards.some((c) => c.id === tm.id);
            return (
              <div key={tm.id} style={{ ...S.adminRow, cursor: "default", opacity: known ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconArt svg={moveIcon(tm, tm.element)} emoji="" size={22} />
                  <strong style={{ fontSize: 12 }}>{tm.name}</strong>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>({tm.cost}) {tm.text}</span>
                  {!known && <button style={{ ...S.cheatBtn, marginLeft: "auto", fontSize: 10, padding: "3px 7px" }} onClick={() => onLearnType(mon, tm)}>Learn 80g</button>}
                  {known && <span style={{ marginLeft: "auto", fontSize: 10, color: "#7ee787" }}>known</span>}
                </div>
              </div>
            );
          })}
          <h3 style={S.bagSub}>Special moves (120g + 📕)</h3>
          {SPECIAL_MOVES.map((sm) => {
            const known = mon.cards.some((c) => c.id === sm.id);
            return (
              <div key={sm.id} style={{ ...S.adminRow, cursor: "default", opacity: known ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <IconArt svg={moveIcon(sm, null)} emoji="" size={22} />
                  <strong style={{ fontSize: 12 }}>{sm.name}</strong>
                  <span style={{ fontSize: 10, opacity: 0.7 }}>({sm.cost}) {sm.text}</span>
                  {!known && <button style={{ ...S.cheatBtn, marginLeft: "auto", fontSize: 10, padding: "3px 7px" }} onClick={() => onLearnSpecial(mon, sm)}>Learn</button>}
                  {known && <span style={{ marginLeft: "auto", fontSize: 10, color: "#7ee787" }}>known</span>}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function Collection({ collection, team, setTeam, onDungeon, onEvolve, items }) {
  const [inspect, setInspect] = useState(null);
  const toggle = (uid) => {
    setTeam((t) => {
      if (t.includes(uid)) return t.filter((x) => x !== uid);
      if (t.length >= 3) return t;
      return [...t, uid];
    });
  };
  const evoTarget = inspect ? evolutionTarget(inspect) : null;
  const evoCheck = inspect ? checkEvolution(inspect, items || []) : null;
  return (
    <div>
      <div style={S.sectionHead}>
        <div>
          <h2 style={S.h2}>The Den</h2>
          <p style={{ opacity: 0.65, margin: 0 }}>
            Tap a monster to add it to your team (take 1 to 3 with you). Tap “view” for its card and evolution progress.
          </p>
        </div>
        <button style={{ ...S.bigBtn, marginTop: 0 }} disabled={team.length === 0} onClick={onDungeon}>
          Exit Den 🚪 ({team.length}/3)
        </button>
      </div>
      <div style={S.grid}>
        {collection.map((m) => {
          const idx = team.indexOf(m.uid);
          const ready = !!evolutionTarget(m) && checkEvolution(m, items || []).met;
          return (
            <div
              key={m.uid}
              style={{
                ...S.monCard,
                borderColor: idx >= 0 ? ELEMENT_COLOR[m.element] : "#262633",
                boxShadow: idx >= 0 ? `0 0 0 2px ${ELEMENT_COLOR[m.element]}55` : "none",
              }}
              onClick={() => toggle(m.uid)}
            >
              {idx >= 0 && <div style={S.teamBadge}>{idx + 1}</div>}
              {ready && <div style={S.evoDot} title="Ready to evolve">⬆</div>}
              <MonsterSprite m={m} />
              <div style={{ fontWeight: 700, marginTop: 6 }}>{m.name}</div>
              <ElementPills m={m} />
              <div style={{ fontSize: 11, color: RARITY_COLOR[m.rarity], fontWeight: 700, letterSpacing: 1 }}>
                {m.rarity}
              </div>
              <div style={{ fontSize: 12, opacity: 0.6 }}>HP {m.maxHp} · XP {m.prog?.xp || 0}</div>
              <button
                style={S.viewBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setInspect(m);
                }}
              >
                view card
              </button>
            </div>
          );
        })}
      </div>

      {inspect && (
        <div style={S.modalBackdrop} onClick={() => setInspect(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <TCGCard m={inspect} width={300} />
            <div style={S.moveList}>
              {inspect.cards.map((c) => (
                <div key={c.cid || c.id} style={{ ...S.moveChip, borderColor: ELEMENT_COLOR[inspect.element] }}>
                  <strong>{c.name}</strong> <span style={{ opacity: 0.6 }}>· {c.cost}⚡ {c.type}</span>
                  <div style={{ fontSize: 11, opacity: 0.75 }}>{c.text}</div>
                </div>
              ))}
            </div>

            {/* evolution panel */}
            {evoTarget && (
              <div style={S.evoPanel}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  Evolution → {evoTarget.name}
                </div>
                {evoCheck.req && evoCheck.req.flavor && (
                  <div style={{ fontSize: 11, fontStyle: "italic", opacity: 0.65, marginBottom: 8 }}>
                    {evoCheck.req.flavor}
                  </div>
                )}
                {evoCheck.reasons.map((r, i) => (
                  <div key={i} style={S.evoReq}>
                    <span style={{ color: r.ok ? "#7ee787" : "#ff8a8a" }}>{r.ok ? "✓" : "✗"}</span>
                    <span style={{ flex: 1 }}>{r.label}</span>
                    <span style={{ opacity: 0.7, fontFamily: "monospace" }}>
                      {Math.min(r.have, r.need)}/{r.need}
                    </span>
                  </div>
                ))}
                <button
                  style={{ ...S.bigBtn, marginTop: 10, opacity: evoCheck.met ? 1 : 0.4 }}
                  disabled={!evoCheck.met}
                  onClick={() => {
                    onEvolve(inspect);
                    setInspect(null);
                  }}
                >
                  {evoCheck.met ? `Evolve into ${evoTarget.name}` : "Requirements not met"}
                </button>
              </div>
            )}

            <button style={S.ghostBtn} onClick={() => setInspect(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Compendium ----------
// Discovery levels: undiscovered (locked), seen (fought: shows silhouette
// info only), owned (captured/owned now or before: shows full card).
function Compendium({ seen, collection, seenItems }) {
  const [detail, setDetail] = useState(null); // {template, level}
  const [tab, setTab] = useState("beasts"); // beasts | items | mechanics
  const [query, setQuery] = useState("");
  const [elFilter, setElFilter] = useState("all");
  const [rarFilter, setRarFilter] = useState("all");
  const ownedNames = new Set(collection.map((m) => m.name));
  const discovered = DEFAULT_MONSTERS.filter((t) => seen.has(t.name)).length;

  const levelOf = (t) => (ownedNames.has(t.name) ? "owned" : seen.has(t.name) ? "seen" : "locked");

  // dex-ordered entries; undiscovered hide whenever a filter could leak info
  const filtering = query.trim() !== "" || elFilter !== "all" || rarFilter !== "all";
  const dexEntries = CODEX_ORDER.map((name) => DEFAULT_MONSTERS.find((t) => t.name === name)).filter(Boolean).filter((t) => {
    const known = levelOf(t) !== "locked";
    if (!known) return !filtering; // ??? entries only show in the unfiltered dex
    if (query.trim() && !t.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (elFilter !== "all" && !(t.elements && t.elements.length ? t.elements : [t.element]).includes(elFilter)) return false;
    if (rarFilter !== "all" && t.rarity !== rarFilter) return false;
    return true;
  });

  return (
    <div>
      <h2 style={S.h2}>Codex</h2>

      {/* sub-tabs */}
      <div style={S.codexTabs}>
        {[
          ["beasts", "📖 Beasts"],
          ["items", "🎒 Items"],
          ["mechanics", "⚙️ Mechanics"],
        ].map(([k, label]) => (
          <button
            key={k}
            style={{ ...S.codexTab, ...(tab === k ? S.codexTabActive : null) }}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "beasts" && (
        <>
          <p style={{ opacity: 0.65 }}>
            {discovered} / {DEFAULT_MONSTERS.length} species discovered. Fight one to log it; capture or own it to reveal its full card.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              style={{ ...S.textarea, minHeight: 0, flex: 1, minWidth: 120, marginBottom: 0 }}
              placeholder="Search name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select style={S.dexSelect} value={elFilter} onChange={(e) => setElFilter(e.target.value)}>
              <option value="all">All elements</option>
              {ELEMENTS.map((el) => <option key={el} value={el}>{ELEMENT_GLYPH[el]} {el}</option>)}
            </select>
            <select style={S.dexSelect} value={rarFilter} onChange={(e) => setRarFilter(e.target.value)}>
              <option value="all">All rarities</option>
              {RARITY_LADDER.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {filtering && <p style={{ fontSize: 11, opacity: 0.5, marginTop: 0 }}>Filters only search discovered species; undiscovered entries stay hidden.</p>}
          <div style={S.codexGrid}>
            {dexEntries.map((t) => {
              const level = levelOf(t);
              const known = level !== "locked";
              const els = t.elements && t.elements.length ? t.elements : [t.element];
              return (
                <button
                  key={t.name}
                  disabled={!known}
                  onClick={() => known && setDetail({ template: t, level })}
                  style={{
                    ...S.codexCard,
                    borderColor: known ? ELEMENT_COLOR[t.element] + "66" : "#222230",
                    opacity: known ? 1 : 0.45,
                    cursor: known ? "pointer" : "default",
                    color: "#e8e6f0",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ fontSize: 9, opacity: 0.55, fontWeight: 700 }}>#{String(dexNumber(t.name)).padStart(3, "0")}</div>
                  <div style={{ fontSize: 34 }}>{known ? t.sprite : "❔"}</div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{known ? t.name : "???"}</div>
                  {known && (
                    <>
                      <div style={{ fontSize: 10, fontWeight: 700 }}>
                        {els.map((el) => <span key={el} style={{ color: ELEMENT_COLOR[el], marginRight: 4 }}>{ELEMENT_GLYPH[el]}{el}</span>)}
                      </div>
                      <div style={{ fontSize: 10, color: RARITY_COLOR[t.rarity], fontWeight: 700 }}>
                        {t.rarity} · T{t.tier}
                      </div>
                      {level === "owned" && <div style={S.ownedTag}>owned</div>}
                      {level === "seen" && <div style={S.seenTag}>seen</div>}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === "items" && <CodexItems seenItems={seenItems} />}
      {tab === "mechanics" && <CodexMechanics />}

      {detail && (
        <CodexDetail detail={detail} seen={seen} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

// ---- Codex: Items (only discovered items, locked otherwise) ----
function CodexItems({ seenItems }) {
  const groups = [
    ["special", "Special"],
    ["sigil", "Sigils"],
    ["potion", "Potions"],
  ];
  const discovered = ITEMS.filter((it) => seenItems.has(it.id)).length;
  return (
    <div>
      <p style={{ opacity: 0.65 }}>
        {discovered} / {ITEMS.length} items discovered. Find an item once to log it here permanently.
      </p>
      {groups.map(([kind, label]) => {
        const list = ITEMS.filter((it) => it.kind === kind);
        return (
          <div key={kind} style={{ marginBottom: 20 }}>
            <div style={S.bagSub}>{label}</div>
            <div style={S.itemGrid}>
              {list.map((it) => {
                const known = seenItems.has(it.id);
                return (
                  <div
                    key={it.id}
                    style={{
                      ...S.itemTile,
                      borderColor: known ? RARITY_COLOR[it.rarity] + "66" : "#222230",
                      opacity: known ? 1 : 0.55,
                    }}
                  >
                    <div style={{ fontSize: 26 }}>{known ? it.icon : "❔"}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{known ? it.name : "???"}</div>
                    {known ? (
                      <>
                        <div style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>
                          {it.kind} · {it.rarity}
                        </div>
                        <div style={{ fontSize: 11, opacity: 0.75 }}>{it.text}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 11, opacity: 0.5 }}>Undiscovered</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Codex: Mechanics reference ----
function CodexMechanics() {
  const section = (title, body) => (
    <div style={S.mechCard}>
      <div style={S.mechTitle}>{title}</div>
      <div style={S.mechBody}>{body}</div>
    </div>
  );
  return (
    <div>
      <p style={{ opacity: 0.65 }}>How the game works.</p>

      {section("⚔️ Card combat", "Each monster fights from its own deck of cards. You have energy (usually 3) per turn to play cards. Attacks deal damage, skills grant defense or utility, powers give lasting buffs. End your turn and the enemy acts.")}

      {section("🔄 Swapping & HP", "Only one monster is active at a time, with its own HP and hand. You may swap once per turn (free). HP carries between fights, so heal at rest sites and inns. A monster faints at 0 HP; lose all monsters and the battle ends.")}

      {section("🛡️ Block vs ✶ Shield", "Block protects only the active monster and resets at the start of your turn. Shield is a team-wide wall that also resets each turn but persists through swaps, so build it on a tank then swap to an attacker. Damage hits Shield first, then Block, then HP.")}

      {section("🔥 Statuses", "Burn: the enemy loses HP at end of turn (decays). Weak: the enemy deals less damage. Vulnerable 🎯: the enemy takes +50% damage. 💚 Regen heals the active monster each turn. Some cards heal the whole team at once.")}

      {section("🌟 Elements", "Six elements form a type chart. Strong matchups deal ×1.5, weak ones ×0.66. ember ▶ gale, stone · tide ▶ ember, stone · gale ▶ tide, lumen · stone ▶ gale, umbra · umbra ▶ ember, lumen · lumen ▶ tide, umbra. A monster also resists its own element (×0.75).")}

      {section("🔗 Team synergy & affinity", "Each monster gains +1 Strength for every other teammate sharing its element, so mono-element teams hit harder. Element affinity boosts themed statuses: ember adds extra Burn, tide extra Weak, umbra extra Vulnerable.")}

      {section("🃏 Card keywords", "Retain: the card stays in hand at end of turn instead of discarding. Exhaust: a powerful card that leaves the deck after one use. Some cards grant bonus energy or draw to enable combos.")}

      {section("⬆️ Evolution", "Monsters evolve when they meet their unique requirements (XP plus deeds like winning battles, defeating bosses, or looting treasure) and you hold an Evolution Stone, which is consumed. Each species has its own conditions.")}

      {section("⚗️ Fusion", "Combine two monsters at compatible evolution stages (same stage number, or both final forms) using a Fusion Catalyst. The AI designs a hybrid blending both parents' stats, art, and moves.")}

      {section("✨ Forging", "Spend a Genesis Spark to forge a brand-new monster from a description. A prize wheel rolls its rarity, evolution potential, stat focus, and a possible signature boon. Higher rarity means stronger stats but fewer possible evolutions.")}

      {section("🥚 Breeding", "In the Fusion Chamber's Nursery, two monsters sharing an element or a line can produce an egg; BOTH parents are kept. The egg hatches into a Baby of parent A's base species after a few battle wins, inheriting one egg move from parent B that survives evolution. Fusion consumes monsters to concentrate power; breeding grows your collection and customizes movesets.")}
      {section("🔴 Capture & items", "Catching a monster after a battle consumes a Beast Ball. Sigils are permanent team-wide passives, always active once owned. Artifacts are powerful passives found ONLY inside dungeons and crumble when the run ends. Potions are one-time uses; special items enable evolution, fusion, forging, and capture.")}

      {section("🗺️ Overworld & dungeons", "Explore the overworld on foot. Tall grass triggers wild encounters. Buildings are shops, inns, and dungeon entrances. Dungeons are branching runs of battles, elites, treasure, mystery, rest, and a boss, ending back in the overworld.")}
    </div>
  );
}

// Detail modal. Only renders what the player has earned the right to see.
function CodexDetail({ detail, seen, onClose }) {
  const { template: t, level } = detail;
  const accent = ELEMENT_COLOR[t.element] || "#c9a66b";
  const owned = level === "owned";
  // for the card art we reuse the TCG frame; description is hidden until owned
  const display = {
    name: t.name,
    element: t.element,
    sprite: t.sprite,
    svg: null,
    imageUrl: null,
    maxHp: owned ? t.hp : "??",
    desc: owned ? t.desc : "You have encountered this beast but not yet captured it. Its secrets remain hidden.",
    cards: owned ? t.cards : [],
    rarity: t.rarity,
  };
  // evolution line: only reveal the next form's name if that form is discovered
  const nextKnown = t.evolvesTo && seen.has(t.evolvesTo);
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 320 }}>
        <TCGCard m={display} width={300} />

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={S.codexInfoRow}>
            <span style={{ opacity: 0.6 }}>Element</span>
            <span style={{ color: accent, fontWeight: 700 }}>{t.element}</span>
          </div>
          <div style={S.codexInfoRow}>
            <span style={{ opacity: 0.6 }}>Rarity</span>
            <span style={{ color: RARITY_COLOR[t.rarity], fontWeight: 700 }}>{t.rarity}</span>
          </div>
          <div style={S.codexInfoRow}>
            <span style={{ opacity: 0.6 }}>Evolution</span>
            <span style={{ fontWeight: 700 }}>
              {!t.evolvesTo ? "Final form" : nextKnown ? `→ ${t.evolvesTo}` : "→ ???"}
            </span>
          </div>
        </div>

        {/* moveset only when owned */}
        {owned ? (
          <div style={S.moveList}>
            {t.cards.map((c) => (
              <div key={c.id} style={{ ...S.moveChip, borderColor: accent }}>
                <strong>{c.name}</strong> <span style={{ opacity: 0.6 }}>· {c.cost}⚡ {c.type}</span>
                <div style={{ fontSize: 11, opacity: 0.75 }}>{c.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={S.lockedMoves}>
            🔒 Moveset hidden. Capture this monster to study its cards.
          </div>
        )}

        <button style={S.ghostBtn} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

// ---------- Items / Bag ----------
function ItemsScreen({ items, materials, iconArt, onPaint }) {
  const counts = {};
  items.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
  const owned = Object.keys(counts).map((id) => ITEMS.find((it) => it.id === id)).filter(Boolean);
  const sigils = owned.filter((it) => it.kind === "sigil");
  const potions = owned.filter((it) => it.kind === "potion");
  const specials = owned.filter((it) => it.kind === "special");
  const matEntries = MATERIALS.filter((m) => ((materials || {})[m.id] || 0) > 0);
  const empty = owned.length === 0 && matEntries.length === 0;
  return (
    <div>
      <h2 style={S.h2}>The Bag</h2>
      <p style={{ opacity: 0.65 }}>
        What you're currently carrying. See the Codex for the full item catalog and what each does.
      </p>

      {empty && (
        <p style={{ opacity: 0.5, marginTop: 20 }}>
          Your bag is empty. Find items in shops, treasure, and battle rewards.
        </p>
      )}

      {specials.length > 0 && (
        <>
          <h3 style={S.bagSub}>Special</h3>
          <div style={S.itemGrid}>
            {specials.map((it) => (
              <ItemTile key={it.id} it={it} count={counts[it.id]} iconArt={iconArt} />
            ))}
          </div>
        </>
      )}

      {matEntries.length > 0 && (
        <>
          <h3 style={S.bagSub}>Materials</h3>
          <div style={S.dropsBar}>
            {matEntries.map((m) => (
              <span key={m.id} style={S.dropPill} title={m.text}>{m.icon} {m.name} ×{materials[m.id]}</span>
            ))}
          </div>
          <p style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>Use materials in the Workshop (⚒️ Craft tab).</p>
        </>
      )}

      {sigils.length > 0 && (
        <>
          <h3 style={S.bagSub}>Sigils</h3>
          <p style={{ fontSize: 11, opacity: 0.55, marginTop: 0 }}>
            Permanent team-wide passives, always active for your whole team in every battle.
          </p>
          <div style={S.itemGrid}>
            {sigils.map((it) => (
              <ItemTile key={it.id} it={it} count={counts[it.id]} iconArt={iconArt} />
            ))}
          </div>
        </>
      )}

      {potions.length > 0 && (
        <>
          <h3 style={S.bagSub}>Potions</h3>
          <div style={S.itemGrid}>
            {potions.map((it) => (
              <ItemTile key={it.id} it={it} count={counts[it.id]} iconArt={iconArt} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------- Crafting workshop ----------
function CraftScreen({ materials, collection, team, onCraft, onTransmute, seenMaterials, knownRecipes, onBack }) {
  const [sub, setSub] = useState("craft"); // craft | transmute
  const [confirmUid, setConfirmUid] = useState(null); // transmute confirm

  const matEntries = MATERIALS.filter((m) => (materials[m.id] || 0) > 0);
  const known = RECIPES.filter((r) => knownRecipes.has(r.item));
  const unknownCount = RECIPES.length - known.length;

  return (
    <div>
      <div style={S.sectionHead}>
        <h2 style={S.h2}>Workshop ⚒️</h2>
        {onBack && <button style={{ ...S.ghostBtn, marginTop: 0 }} onClick={onBack}>Back to Den</button>}
      </div>
      <div style={S.codexTabs}>
        <button style={{ ...S.codexTab, ...(sub === "craft" ? S.codexTabActive : {}) }} onClick={() => setSub("craft")}>⚒️ Craft</button>
        <button style={{ ...S.codexTab, ...(sub === "transmute" ? S.codexTabActive : {}) }} onClick={() => setSub("transmute")}>⚗️ Transmute</button>
      </div>

      {/* material stash, always visible */}
      <h3 style={S.bagSub}>Your materials</h3>
      {matEntries.length === 0 && (
        <p style={{ fontSize: 12, opacity: 0.55 }}>None yet. Defeat monsters to collect materials, or transmute a captured monster.</p>
      )}
      <div style={S.dropsBar}>
        {matEntries.map((m) => (
          <span key={m.id} style={S.dropPill} title={`${m.text} In battle: ${m.use}`}>{m.icon} {m.name} ×{materials[m.id]}</span>
        ))}
      </div>

      {sub === "craft" && (
        <>
          <h3 style={S.bagSub}>Recipes ({known.length}/{RECIPES.length} learned)</h3>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0 }}>
            "Any element" costs are paid with any mix of element materials (largest stacks first).
          </p>
          {known.length === 0 && (
            <p style={{ fontSize: 12, opacity: 0.55 }}>You don't know any recipes yet.</p>
          )}
          {known.map((r) => {
            const it = ITEMS.find((x) => x.id === r.item);
            if (!it) return null;
            const check = canCraft(r, materials);
            return (
              <div key={r.item} style={{ ...S.adminRow, cursor: "default" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 22 }}>{it.icon}</span>
                  <strong style={{ fontSize: 13 }}>{it.name}</strong>
                  <span style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>{it.kind}</span>
                  <button
                    style={{ ...S.cheatBtn, marginLeft: "auto", opacity: check.ok ? 1 : 0.35 }}
                    disabled={!check.ok}
                    onClick={() => onCraft(r)}
                  >
                    Craft
                  </button>
                </div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
                  Cost: {r.needs.map((n) => `${n.qty}× ${materialById(n.id).icon} ${materialById(n.id).name}`).join(", ")}
                  {r.anyElement > 0 && `${r.needs.length ? ", " : ""}${r.anyElement}× any element material`}
                </div>
                {!check.ok && (
                  <div style={{ fontSize: 10, color: "#ff8a8a", marginTop: 2 }}>Need {check.missing.join("; ")}</div>
                )}
              </div>
            );
          })}
          {unknownCount > 0 && (
            <div style={{ ...S.adminRow, cursor: "default", opacity: 0.6 }}>
              <div style={{ fontSize: 12 }}>
                📜 <strong>{unknownCount} undiscovered recipe{unknownCount > 1 ? "s" : ""}</strong>
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                Find recipe scrolls in elite and boss spoils, rarely in Deep Markets, or by completing feats.
              </div>
            </div>
          )}
        </>
      )}

      {sub === "transmute" && (
        <>
          <h3 style={S.bagSub}>Transmute a monster</h3>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 0 }}>
            Permanently destroys the monster. Each material below rolls independently at the shown chance; on a hit
            you gain one AND roll that chance again, repeating until a miss. Lucky streaks stack. Undiscovered
            materials show as ??? until you've found one. Your last monster can't be transmuted.
          </p>
          {collection.map((m) => {
            const table = transmuteTable(m);
            const onTeam = team.includes(m.uid);
            const isLast = collection.length <= 1;
            const confirming = confirmUid === m.uid;
            return (
              <div key={m.uid} style={{ ...S.adminRow, cursor: "default", borderColor: confirming ? "#ff5a4d" : "#2c2a40" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <MonsterSprite m={m} size={34} />
                  <strong style={{ fontSize: 13 }}>{m.name}</strong>
                  <span style={{ fontSize: 10, color: RARITY_COLOR[m.rarity] }}>{m.rarity}</span>
                  {onTeam && <span style={{ fontSize: 9, color: "#7ee787", fontWeight: 700 }}>ON TEAM</span>}
                  {!confirming ? (
                    <button
                      style={{ ...S.cheatBtn, marginLeft: "auto", opacity: isLast ? 0.35 : 1 }}
                      disabled={isLast}
                      onClick={() => setConfirmUid(m.uid)}
                    >
                      Transmute
                    </button>
                  ) : (
                    <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                      <button
                        style={{ ...S.cheatBtn, background: "#5a1f1f", color: "#ff8a8a", borderColor: "#ff5a4d88" }}
                        onClick={() => { setConfirmUid(null); onTransmute(m); }}
                      >
                        Confirm destroy
                      </button>
                      <button style={S.cheatBtn} onClick={() => setConfirmUid(null)}>Keep</button>
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {table.map((entry) => {
                    const mat = materialById(entry.id);
                    const found = seenMaterials.has(entry.id);
                    return (
                      <span key={entry.id} style={S.dropPill}>
                        {found ? `${mat.icon} ${mat.name}` : "❔ ???"} — {Math.round(entry.chance * 100)}%
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function ItemTile({ it, count, dim, iconArt }) {
  const ai = iconArt && iconArt[`item:${it.id}`];
  const art = ai && ai !== "…" ? ai : itemIcon(it);
  return (
    <div style={{ ...S.itemTile, borderColor: RARITY_COLOR[it.rarity] + "88", opacity: dim ? 0.45 : 1, background: "linear-gradient(180deg,#1b1930,#15132e)" }}>
      <div style={{ borderRadius: 8, overflow: "hidden", border: `1px solid ${RARITY_COLOR[it.rarity]}44`, width: 54, height: 54, margin: "0 auto" }}>
        <IconArt svg={art} emoji={it.icon} size={54} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>
        {it.name} {count > 0 && <span style={{ opacity: 0.6 }}>×{count}</span>}
      </div>
      <div style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>
        {it.kind} · {it.rarity}
      </div>
      <div style={{ fontSize: 11, opacity: 0.75 }}>{it.text}</div>
    </div>
  );
}

// ---------- Cheat / Debug panel ----------
// Show only the tail of a key so it's identifiable but not exposed.
function maskKey(k) {
  if (!k) return null;
  return `…${k.slice(-4)} (${k.length} chars)`;
}


// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/admin — debug console
// ║ UPDATE WHEN: ANY new content type (moves, materials, recipes, forms, artifacts…) gets a viewer/cheat here — this is the sync-debt hotspot
// ╚══════════════════════════════════════════════════════════════════╝
function CheatPanel({ onGiveItem, onGiveGold, onSpawn, onGiveXP, onRevealCodex, onLearnRecipes, onGiveMaterials, onMakeMonster, onAddMove, onMakeItem, onPaintIcon, onSaveNow, onExport, onImport, onReset, onClose, gold, items, collection, team, seen, seenItems, materials }) {
  const [mk, setMk] = useState({ name: "Testbeast", el: "pyre", el2: "", hp: 40, rarity: "uncommon", form: "regular", sprite: "🧪", desc: "A debug creature.", art: true, mvName: "Test Bolt", mvType: "attack", mvCost: 1, mvDmg: 8, mvBlock: 0, mvStatus: "", mvAmt: 2, mvTarget: "", itName: "Test Charm", itKind: "potion", itIcon: "🧿", itEffect: "potionHeal", itAmt: 10 });
  const up = (k) => (e) => setMk((o) => ({ ...o, [k]: e.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const [tab, setTab] = useState("cheats"); // cheats | roster | systems | state
  const [monQuery, setMonQuery] = useState("");
  const [expanded, setExpanded] = useState(null); // expanded roster monster
  const [keyInput, setKeyInput] = useState("");
  const [saveText, setSaveText] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [keyStatus, setKeyStatus] = useState(() =>
    typeof window !== "undefined" && window.ANTHROPIC_API_KEY ? maskKey(window.ANTHROPIC_API_KEY) : null
  );
  const filtered = DEFAULT_MONSTERS.filter((t) =>
    t.name.toLowerCase().includes(monQuery.toLowerCase())
  );
  const tabs = [
    ["cheats", "🛠️ Cheats"],
    ["roster", "📚 Roster"],
    ["systems", "⚙️ Systems"],
    ["state", "🧠 State"],
    ["maker", "🛠️ Maker"],
  ];
  return (
    <div>
      <div style={S.sectionHead}>
        <div>
          <h2 style={S.h2}>🛠️ Admin Console <span style={S.versionTag}>{APP_VERSION}</span></h2>
          <p style={{ opacity: 0.65, margin: 0 }}>Cheats, full content review, system tables, and live game state.</p>
        </div>
        <button style={{ ...S.ghostBtn, marginTop: 0 }} onClick={onClose}>Done</button>
      </div>

      <div style={S.codexTabs}>
        {tabs.map(([key, label]) => (
          <button key={key} style={{ ...S.codexTab, ...(tab === key ? S.codexTabActive : {}) }} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {/* ================= CHEATS ================= */}
      {tab === "cheats" && (
        <>
          <h3 style={S.bagSub}>Quick actions</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button style={S.cheatBtn} onClick={() => onGiveGold(100)}>+100 Gold</button>
            <button style={S.cheatBtn} onClick={() => onGiveGold(1000)}>+1000 Gold</button>
            <button style={S.cheatBtn} onClick={() => onGiveXP(300)}>+300 XP & deeds (team)</button>
            <button style={S.cheatBtn} onClick={onRevealCodex}>Reveal full Codex</button>
            <button style={S.cheatBtn} onClick={onLearnRecipes}>Learn all recipes</button>
            <button style={S.cheatBtn} onClick={onGiveMaterials}>+5 of every material</button>
          </div>

          <h3 style={S.bagSub}>Grant any item</h3>
          <div style={S.itemGrid}>
            {ITEMS.map((it) => (
              <button
                key={it.id}
                style={{ ...S.itemTile, borderColor: RARITY_COLOR[it.rarity] + "66", cursor: "pointer", color: "#e8e6f0", textAlign: "left", fontFamily: "inherit" }}
                onClick={() => onGiveItem(it.id)}
              >
                <div style={{ fontSize: 24 }}>{it.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{it.name}</div>
                <div style={{ fontSize: 9, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>
                  {it.kind} · {it.rarity}
                </div>
                <div style={{ fontSize: 10, opacity: 0.7 }}>{it.text}</div>
                <div style={{ fontSize: 9, color: "#7ee787", marginTop: 2 }}>tap to grant</div>
              </button>
            ))}
          </div>

          <h3 style={S.bagSub}>Spawn any monster</h3>
          <input
            style={{ ...S.textarea, minHeight: 0, marginBottom: 10 }}
            placeholder="Search monster name…"
            value={monQuery}
            onChange={(e) => setMonQuery(e.target.value)}
          />
          <div style={S.codexGrid}>
            {filtered.map((t) => (
              <button
                key={t.name}
                style={{ ...S.codexCard, borderColor: RARITY_COLOR[t.rarity] + "66", cursor: "pointer", color: "#e8e6f0", fontFamily: "inherit" }}
                onClick={() => onSpawn(t)}
              >
                <div style={{ fontSize: 30 }}>{t.sprite}</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{t.name}</div>
                <div style={{ fontSize: 9, color: RARITY_COLOR[t.rarity], fontWeight: 700 }}>{t.rarity} · T{t.tier}</div>
                <div style={{ fontSize: 9, color: "#7ee787" }}>tap to spawn</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ================= ROSTER (full content, lore included) ================= */}
      {tab === "roster" && (
        <>
          <p style={{ fontSize: 12, opacity: 0.65 }}>
            All {DEFAULT_MONSTERS.length} monsters with full data, including the hidden lore briefs and complete movesets. Tap to expand.
          </p>
          <input
            style={{ ...S.textarea, minHeight: 0, marginBottom: 10 }}
            placeholder="Search…"
            value={monQuery}
            onChange={(e) => setMonQuery(e.target.value)}
          />
          {ELEMENTS.map((el) => {
            const mons = filtered.filter((t) => t.element === el);
            if (mons.length === 0) return null;
            return (
              <div key={el}>
                <h3 style={{ ...S.bagSub, color: ELEMENT_COLOR[el] }}>
                  {ELEMENT_GLYPH[el]} {el} ({mons.length})
                </h3>
                {mons.map((t) => {
                  const open = expanded === t.name;
                  const evoInfo = t.evolvesTo ? `→ ${t.evolvesTo}` : "final/standalone";
                  return (
                    <div key={t.name} style={S.adminRow} onClick={() => setExpanded(open ? null : t.name)}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 22 }}>{t.sprite}</span>
                        <strong style={{ fontSize: 13 }}>{t.name}</strong>
                        <span style={{ fontSize: 10 }}>{monElements(t).map((el) => <span key={el} style={{ color: ELEMENT_COLOR[el], marginRight: 3 }}>{el}</span>)}</span>
                        <span style={{ fontSize: 10, color: RARITY_COLOR[t.rarity], fontWeight: 700 }}>{t.rarity}</span>
                        <span style={{ fontSize: 10, opacity: 0.6 }}>HP {t.hp} · T{t.tier} · {evoInfo}</span>
                        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.5 }}>{open ? "▲" : "▼"}</span>
                      </div>
                      {open && (
                        <div style={{ marginTop: 8 }}>
                          <div style={S.adminLabel}>codex desc</div>
                          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>{t.desc}</div>
                          <div style={S.adminLabel}>hidden lore (art/move brief)</div>
                          <div style={{ fontSize: 11.5, opacity: 0.75, lineHeight: 1.45, marginBottom: 6 }}>{t.lore || "(none)"}</div>
                          <div style={S.adminLabel}>cards</div>
                          {t.cards.map((c) => (
                            <div key={c.id} style={{ fontSize: 11, opacity: 0.8 }}>
                              <strong>{c.name}</strong> ({c.type}, cost {c.cost}) — {c.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </>
      )}

      {/* ================= SYSTEMS (matrix, reactions, tables) ================= */}
      {tab === "systems" && (
        <>
          <h3 style={S.bagSub}>Element matchup matrix</h3>
          {ELEMENTS.map((el) => (
            <div key={el} style={{ fontSize: 12, marginBottom: 4 }}>
              <strong style={{ color: ELEMENT_COLOR[el] }}>{ELEMENT_GLYPH[el]} {el}</strong>
              <span style={{ color: "#7ee787" }}> strong: {(MATRIX[el].strong || []).join(", ") || "none"}</span>
              <span style={{ color: "#ff8a8a" }}> · weak: {(MATRIX[el].weak || []).join(", ") || "none"}</span>
            </div>
          ))}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            strong ×{MULT_STRONG} · weak ×{MULT_WEAK} · self-element resist ×{SELF_RESIST}
          </div>

          <h3 style={S.bagSub}>Element statuses & affinity</h3>
          {Object.entries(ELEMENT_STATUS).map(([el, st]) => (
            <div key={el} style={{ fontSize: 12 }}>
              <strong style={{ color: ELEMENT_COLOR[el] }}>{el}</strong> → {st} (+1 affinity bonus)
            </div>
          ))}

          <h3 style={S.bagSub}>Reactions</h3>
          {REACTIONS.map((r) => (
            <div key={r.id} style={{ fontSize: 12 }}>
              <strong style={{ color: "#ffd34d" }}>{r.label}</strong>: {r.atk} hit on {r.needs === "any" ? "any status" : r.needs} · {r.clears ? "clears it" : "lingers"}
            </div>
          ))}

          <h3 style={S.bagSub}>Rarity stat budgets</h3>
          {RARITY_LADDER.map((r) => (
            <div key={r} style={{ fontSize: 12 }}>
              <strong style={{ color: RARITY_COLOR[r] }}>{r}</strong>: HP {RARITY_BUDGET[r].hp[0]}–{RARITY_BUDGET[r].hp[1]} · {RARITY_BUDGET[r].power}
            </div>
          ))}

          <h3 style={S.bagSub}>Boons</h3>
          {BOONS.filter((b) => b.id !== "none" && b.id !== "none2").map((b) => (
            <div key={b.id} style={{ fontSize: 12 }}>
              <strong>{b.name}</strong> (min {b.min}): {b.text}
            </div>
          ))}

          <h3 style={S.bagSub}>Materials & drop rules</h3>
          {MATERIALS.map((m) => (
            <div key={m.id} style={{ fontSize: 12 }}>
              {m.icon} <strong>{m.name}</strong>{m.element ? <span style={{ color: ELEMENT_COLOR[m.element] }}> ({m.element})</span> : " (universal)"} — {m.text}
            </div>
          ))}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
            Drops: dust always (×2 elite, ×3 boss) · element material ~70% (+qty for evolved) · essence 15%+8%/rarity rung ·
            core from rare+ · celestial from legendary+ · elite ×1.3, boss ×1.5, wild ×0.85. Transmute is deterministic and scales with rarity, stage, and XP.
          </div>

          <h3 style={S.bagSub}>Moves</h3>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Generic (auto in every deck):</div>
          {UNIVERSAL_CARDS.slice(0, 2).map((c) => <div key={c.id} style={{ fontSize: 12 }}><strong>{c.name}</strong> ({c.cost}) — {c.text}</div>)}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Type moves (tutor, 80g, element-gated):</div>
          {TYPE_MOVES.map((c) => <div key={c.id} style={{ fontSize: 12 }}><strong style={{ color: ELEMENT_COLOR[c.element] }}>{c.name}</strong> ({c.cost}) — {c.text}</div>)}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Special moves (tutor, 120g + Ancient Tome):</div>
          {SPECIAL_MOVES.map((c) => <div key={c.id} style={{ fontSize: 12 }}><strong>✦ {c.name}</strong> ({c.cost}) — {c.text}</div>)}
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>Transfer: 400g + 1 Primal Core. Cap {MOVE_CAP} moves/monster.</div>

          <h3 style={S.bagSub}>Recipes</h3>
          {RECIPES.map((r) => {
            const it = ITEMS.find((x) => x.id === r.item);
            return (
              <div key={r.item} style={{ fontSize: 12 }}>
                {it.icon} <strong>{it.name}</strong>: {r.needs.map((n) => `${n.qty}× ${materialById(n.id).name}`).join(", ")}
                {r.anyElement > 0 && `${r.needs.length ? ", " : ""}${r.anyElement}× any element`}
              </div>
            );
          })}
        </>
      )}

      {/* ================= MAKER (debug content creation) ================= */}
      {tab === "maker" && (() => {
        const num = (v) => parseInt(v, 10) || 0;
        const I = (k, w = 90) => <input style={{ ...S.textarea, minHeight: 0, width: w, marginBottom: 0 }} value={mk[k]} onChange={up(k)} />;
        const row = { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 };
        return (
          <>
            <h3 style={S.bagSub}>🧬 Monster maker</h3>
            <div style={row}>
              {I("name", 120)}
              <select style={S.dexSelect} value={mk.el} onChange={up("el")}>{ELEMENTS.map((e) => <option key={e}>{e}</option>)}</select>
              <select style={S.dexSelect} value={mk.el2} onChange={up("el2")}><option value="">no 2nd type</option>{ELEMENTS.map((e) => <option key={e}>{e}</option>)}</select>
              {I("hp", 55)}
              <select style={S.dexSelect} value={mk.rarity} onChange={up("rarity")}>{RARITY_LADDER.map((r) => <option key={r}>{r}</option>)}</select>
              <select style={S.dexSelect} value={mk.form} onChange={up("form")}>{FORM_ORDER.map((f) => <option key={f}>{f}</option>)}</select>
              {I("sprite", 50)}
            </div>
            <div style={row}><input style={{ ...S.textarea, minHeight: 0, flex: 1 }} value={mk.desc} onChange={up("desc")} placeholder="description (drives AI art)" /></div>
            <div style={row}>
              <label style={{ fontSize: 12 }}><input type="checkbox" checked={mk.art} onChange={up("art")} /> 🎨 generate AI art (needs key outside Claude)</label>
              <button style={S.cheatBtn} onClick={() => onMakeMonster({ name: mk.name, element: mk.el, elements: mk.el2 ? [mk.el, mk.el2] : [mk.el], hp: num(mk.hp), sprite: mk.sprite, rarity: mk.rarity, form: mk.form, desc: mk.desc, lore: mk.desc, cards: [TYPE_MOVES.find((t) => t.element === mk.el) || UNIVERSAL_CARDS[0], UNIVERSAL_CARDS[3]] }, mk.art)}>Create monster</button>
            </div>

            <h3 style={S.bagSub}>⚡ Move maker</h3>
            <div style={row}>
              {I("mvName", 110)}
              <select style={S.dexSelect} value={mk.mvType} onChange={up("mvType")}><option>attack</option><option>skill</option><option>power</option></select>
              cost {I("mvCost", 40)} dmg {I("mvDmg", 45)} block {I("mvBlock", 45)}
              <select style={S.dexSelect} value={mk.mvStatus} onChange={up("mvStatus")}><option value="">no status</option>{["burn","chill","soak","shock","poison","vulnerable","decay","weak","strength","draw","regen","teamheal","shield","energy"].map((k) => <option key={k}>{k}</option>)}</select>
              amt {I("mvAmt", 40)}
            </div>
            <div style={row}>
              <select style={S.dexSelect} value={mk.mvTarget} onChange={up("mvTarget")}><option value="">teach to…</option>{collection.map((m) => <option key={m.uid} value={m.uid}>{m.sprite} {m.name}</option>)}</select>
              <label style={{ fontSize: 11 }}><input type="checkbox" checked={mk.art} onChange={up("art")} /> 🎨</label>
              <button style={S.cheatBtn} onClick={() => { if (!mk.mvTarget) return; const c = { id: `mk_${Date.now()}`, name: mk.mvName, type: mk.mvType, cost: num(mk.mvCost) }; if (num(mk.mvDmg)) c.dmg = num(mk.mvDmg); if (num(mk.mvBlock)) c.block = num(mk.mvBlock); if (mk.mvStatus === "leech") c.leech = true; else if (mk.mvStatus) c[mk.mvStatus] = num(mk.mvAmt); c.text = `${c.dmg ? `Deal ${c.dmg}. ` : ""}${c.block ? `Gain ${c.block} block. ` : ""}${mk.mvStatus ? `${mk.mvStatus} ${num(mk.mvAmt)}.` : ""}`.trim() || "Debug move."; onAddMove(mk.mvTarget, c); if (mk.art) onPaintIcon("move", c.id, c.name, c.text); }}>Create & teach</button>
            </div>

            <h3 style={S.bagSub}>🧿 Item maker</h3>
            <div style={row}>
              {I("itName", 110)} {I("itIcon", 50)}
              <select style={S.dexSelect} value={mk.itKind} onChange={up("itKind")}><option>potion</option><option>sigil</option><option>special</option></select>
              <select style={S.dexSelect} value={mk.itEffect} onChange={up("itEffect")}>{["potionDmg","potionHeal","potionBlock","potionEnergy","dmgBonus","blockBonus","drawBonus","startStrength","maxHpBonus"].map((k) => <option key={k}>{k}</option>)}</select>
              amt {I("itAmt", 45)}
              <label style={{ fontSize: 11 }}><input type="checkbox" checked={mk.art} onChange={up("art")} /> 🎨</label>
              <button style={S.cheatBtn} onClick={() => { const id = `mk_${Date.now()}`; onMakeItem({ id, name: mk.itName, kind: mk.itKind, icon: mk.itIcon, rarity: "rare", text: `Debug: ${mk.itEffect} ${num(mk.itAmt)}.`, effect: { [mk.itEffect]: num(mk.itAmt) } }); if (mk.art) onPaintIcon("item", id, mk.itName, mk.itEffect); }}>Create item</button>
            </div>
            <p style={{ fontSize: 10, opacity: 0.5 }}>Maker content is session-only and skips dex numbering (#000). Sigil effects apply team-wide automatically; potion effects work in battle.</p>
          </>
        );
      })()}

      {/* ================= STATE (live game data) ================= */}
      {tab === "state" && (
        <>
          <h3 style={S.bagSub}>Build</h3>
          <div style={{ fontSize: 12 }}>Version: <strong style={{ color: "#ffd34d" }}>{APP_VERSION}</strong></div>
          <div style={{ fontSize: 12 }}>Roster size: {DEFAULT_MONSTERS.length} · Items defined: {ITEMS.length} · Elements: {ELEMENTS.length} · Reactions: {REACTIONS.length}</div>

          <h3 style={S.bagSub}>💾 Save</h3>
          <p style={{ fontSize: 11, opacity: 0.6, margin: "0 0 6px" }}>
            Auto-saves a moment after captures, battles, crafts, and purchases; loads on boot. Export/import below moves saves between devices.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <button style={S.cheatBtn} onClick={onSaveNow}>Save now</button>
            <button style={S.cheatBtn} onClick={() => setSaveText(JSON.stringify(onExport()))}>Export</button>
            <button style={S.cheatBtn} onClick={() => { try { const ok = onImport(JSON.parse(saveText)); if (!ok) alert("Invalid save data."); } catch { alert("Could not parse save data."); } }}>Import</button>
            <button style={{ ...S.cheatBtn, color: "#ff8a8a", borderColor: "#ff5a4d88" }} onClick={() => { if (confirmReset) { onReset(); setConfirmReset(false); } else setConfirmReset(true); }}>{confirmReset ? "Really erase everything?" : "New Game"}</button>
            {confirmReset && <button style={S.cheatBtn} onClick={() => setConfirmReset(false)}>Keep save</button>}
          </div>
          <textarea style={{ ...S.textarea, minHeight: 60, fontSize: 10 }} placeholder="Export fills this; paste a save here to Import." value={saveText} onChange={(e) => setSaveText(e.target.value)} />

          <h3 style={S.bagSub}>Anthropic API key (only needed OUTSIDE Claude)</h3>
          <p style={{ fontSize: 11, opacity: 0.6, margin: "0 0 6px" }}>
            Inside the Claude app, AI features work with no key; leave this empty. When running the game
            elsewhere (sandbox/local), paste a key to enable forge, fusion, and art. Held in memory only:
            never saved, gone on refresh. Use a low-limit key you can revoke.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
            <input
              type="password"
              style={{ ...S.textarea, minHeight: 0, flex: 1, minWidth: 160, marginBottom: 0 }}
              placeholder="sk-ant-…"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <button
              style={{ ...S.cheatBtn, opacity: keyInput.trim() ? 1 : 0.4 }}
              disabled={!keyInput.trim()}
              onClick={() => {
                window.ANTHROPIC_API_KEY = keyInput.trim();
                setKeyInput("");
                setKeyStatus(maskKey(window.ANTHROPIC_API_KEY));
              }}
            >
              Set
            </button>
            <button
              style={S.cheatBtn}
              onClick={() => {
                delete window.ANTHROPIC_API_KEY;
                setKeyStatus(null);
              }}
            >
              Clear
            </button>
          </div>
          <div style={{ fontSize: 11, color: keyStatus ? "#7ee787" : "#b8b4d0", opacity: 0.85 }}>
            {keyStatus ? `Key active: ${keyStatus}` : "No key set (fine inside Claude; AI features need one outside)."}
          </div>

          <h3 style={S.bagSub}>Player state</h3>
          <div style={{ fontSize: 12 }}>Gold: {gold}</div>
          <div style={{ fontSize: 12 }}>Bag ({(items || []).length}): {(items || []).join(", ") || "(empty)"}</div>
          <div style={{ fontSize: 12 }}>
            Materials: {Object.keys(materials || {}).length === 0 ? "(none)" : Object.keys(materials).map((id) => `${materialById(id).name}×${materials[id]}`).join(", ")}
          </div>
          <div style={{ fontSize: 12 }}>Codex discovered: {seen ? seen.size : 0}/{DEFAULT_MONSTERS.length} beasts · {seenItems ? seenItems.size : 0}/{ITEMS.length} items</div>

          <h3 style={S.bagSub}>Collection ({(collection || []).length})</h3>
          {(collection || []).map((m) => (
            <div key={m.uid} style={S.adminRow}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 18 }}>{m.sprite}</span>
                <strong style={{ fontSize: 12 }}>{m.name}</strong>
                <span style={{ fontSize: 10, color: RARITY_COLOR[m.rarity] }}>{m.rarity}</span>
                {(team || []).includes(m.uid) && <span style={{ fontSize: 9, color: "#7ee787", fontWeight: 700 }}>ON TEAM</span>}
                {m.forged && <span style={{ fontSize: 9, color: "#a571ff" }}>forged {m.forgedStage}/{m.forgedStages}</span>}
                {m.boon && <span style={{ fontSize: 9, color: "#ff7ad9" }}>✦ {m.boon.name}</span>}
              </div>
              <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2 }}>
                uid {m.uid} · HP {m.maxHp} · XP {m.prog ? m.prog.xp : 0} · wins {m.prog ? m.prog.wins : 0} · bosses {m.prog ? m.prog.bossKills : 0} · art: {m.svg ? "svg" : m.imageUrl ? "image" : "emoji"}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------- Starter selection ----------
// First-launch choice: adopt an uncommon stage-1 with a full 3-stage line,
// or forge a brand-new one (guaranteed uncommon, guaranteed 3 stages).
function StarterScreen({ onPick, onForged }) {
  const [forging, setForging] = useState(false);
  const starterLines = buildLines().filter((l) => l.length === 3 && l.baseRarity === "uncommon");
  if (forging) {
    return (
      <div>
        <h2 style={S.h2}>Forge your starter 🔥</h2>
        <p style={{ opacity: 0.65 }}>
          Describe your dream companion. The forge is pre-tuned: uncommon rarity, a full 3-stage destiny.
        </p>
        <Generate
          free={true}
          items={[]}
          forced={{ rarity: "uncommon", stages: 3 }}
          onCreated={onForged}
          onCancel={() => setForging(false)}
        />
      </div>
    );
  }
  return (
    <div>
      <h2 style={S.h2}>Choose your starter</h2>
      <p style={{ opacity: 0.65 }}>
        Every legend starts with one companion. Each of these has a full three-stage destiny ahead of it.
      </p>
      <div style={S.grid}>
        {starterLines.map((line) => {
          const t = DEFAULT_MONSTERS.find((x) => x.name === line.members[0]);
          if (!t) return null;
          return (
            <div key={t.name} style={{ ...S.monCard, borderColor: ELEMENT_COLOR[t.element] + "88", cursor: "pointer" }} onClick={() => onPick(t)}>
              <div style={{ fontSize: 44 }}>{t.sprite}</div>
              <div style={{ fontWeight: 700, marginTop: 4 }}>{t.name}</div>
              <ElementPills m={t} />
              <div style={{ fontSize: 11, opacity: 0.7, margin: "6px 0" }}>{t.desc}</div>
              <div style={{ fontSize: 10, color: "#ffd34d" }}>{line.members.join(" → ")}</div>
            </div>
          );
        })}
        <div style={{ ...S.monCard, borderColor: "#ffd34d", cursor: "pointer", borderStyle: "dashed" }} onClick={() => setForging(true)}>
          <div style={{ fontSize: 44 }}>🔥</div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>Forge your own</div>
          <div style={{ fontSize: 11, opacity: 0.7, margin: "6px 0" }}>
            Describe a brand-new monster and the forge will make it real: uncommon, with a full 3-stage line to grow through.
          </div>
          <div style={{ fontSize: 10, color: "#ffd34d" }}>??? → ??? → ???</div>
        </div>
      </div>
    </div>
  );
}

function Generate({ onCreated, onCancel, items, free, forced }) {
  const [desc, setDesc] = useState("");
  const [phase, setPhase] = useState("describe"); // describe | spinning | result | forging
  const [rolls, setRolls] = useState(null);
  const [spin, setSpin] = useState({ rarity: "common", stages: 1, emphasis: STAT_EMPHASES[0], boon: BOONS[0] });
  const [stageMsg, setStageMsg] = useState("");
  const [err, setErr] = useState(null);

  const sparks = (items || []).filter((id) => id === "genesisspark").length;
  const hasSpark = free || sparks > 0;
  const canReroll = free ? sparks > 0 : sparks > 1; // when free, any spark lets you re-roll

  // Animate the wheels rapidly, then settle on the real rolled result.
  function doSpin(finalRolls) {
    setPhase("spinning");
    let ticks = 0;
    const maxTicks = 28;
    const iv = setInterval(() => {
      ticks++;
      // flash random faces while spinning
      setSpin({
        rarity: RARITY_LADDER[Math.floor(Math.random() * RARITY_LADDER.length)],
        stages: 1 + Math.floor(Math.random() * 3),
        emphasis: STAT_EMPHASES[Math.floor(Math.random() * STAT_EMPHASES.length)],
        boon: BOONS[Math.floor(Math.random() * BOONS.length)],
      });
      if (ticks >= maxTicks) {
        clearInterval(iv);
        setSpin(finalRolls);
        setRolls(finalRolls);
        setPhase("result");
      }
    }, 70);
  }

  function startSpin() {
    if (!desc.trim()) return;
    if (!hasSpark) {
      setErr("You need a Genesis Spark to forge. Find one in shops or as a reward.");
      return;
    }
    setErr(null);
    doSpin(rollForge(forced));
  }

  function reroll() {
    if (!canReroll) return;
    doSpin(rollForge(forced));
  }

  async function forge() {
    setPhase("forging");
    setErr(null);
    try {
      const r = rolls;
      const budget = RARITY_BUDGET[r.rarity];
      setStageMsg("⚗️ designing stats and moveset…");
      const prompt = `You are the monster designer for a Pokémon x Slay the Spire card battler.
Design a STAGE 1 monster from the player's description, obeying the forged parameters. Respond with ONLY a JSON object, no prose.

Player description: "${desc}"
Forged parameters (obey these):
- Rarity: ${r.rarity} -> power level: ${budget.power}
- Stat emphasis: ${r.emphasis.name} (${r.emphasis.text})
- HP must be in range ${budget.hp[0]}-${budget.hp[1]}.

Return:
{
  "name": "short evocative name",
  "element": one of ${JSON.stringify(ELEMENTS)} (pick what best fits the description),
  "hp": integer ${budget.hp[0]}-${budget.hp[1]},
  "sprite": "a single emoji",
  "desc": "one vivid sentence",
  "cards": [ exactly 3 cards matching the emphasis; fields id,name,type(attack|skill|power),cost(0-2),text, optional dmg/block/strength/burn/weak/draw/hits/shield/teamheal/regen/vulnerable/energy/chill/soak/shock/poison/decay/leech and booleans retain/exhaust. Match status to element: pyre=burn, frost=chill, hydro=soak, charge=shock, toxin=poison, umbra=vulnerable, void=decay, blood=leech. (shield=team block, teamheal=heal all, regen=heal-over-time, poison=non-decaying DoT, chill=enemy hits weaker, soak=sets up reactions, shock=enemy fumbles, decay=enemy loses HP+block, vulnerable=+50% dmg taken, leech=heal from damage) ]
}
Scale card numbers to the rarity power level. Offense=more dmg, Defense=more block, Balanced=mix.`;
      const mon = await askClaudeJson(prompt);
      mon.element = ELEMENTS.includes(mon.element) ? mon.element : "umbra";
      mon.hp = clamp(Number(mon.hp) || budget.hp[0], budget.hp[0], budget.hp[1]);
      mon.cards = (mon.cards || []).slice(0, 3);
      if (mon.cards.length === 0) throw new Error("no cards returned");
      // attach forged metadata
      mon.rarity = r.rarity;
      mon.forged = true;
      mon.forgedStage = 1;
      mon.forgedStages = r.stages;
      mon.boon = r.boon && r.boon.id !== "none" && r.boon.id !== "none2" ? r.boon : null;

      setStageMsg("🎨 painting in the gallery style…");
      mon.svg = await generateArt({ name: mon.name, element: mon.element, desc: mon.desc });

      onCreated(mon); // parent consumes one Genesis Spark
    } catch (e) {
      setErr(`The forge sputtered: ${e.message}. Try again.`);
      setPhase("result");
    } finally {
      setStageMsg("");
    }
  }

  return (
    <div style={S.panel}>
      <h2 style={S.h2}>The Forge ✨</h2>

      {phase === "describe" && (
        <>
          <p style={{ opacity: 0.65 }}>
            Describe a creature, then spin the Forge to roll its rarity, evolution potential, stat focus, and a
            possible signature boon. Requires a Genesis Spark {hasSpark ? `(×${sparks})` : "(none owned)"}.
          </p>
          <textarea
            style={S.textarea}
            rows={4}
            placeholder="e.g. a crystalline owl made of frozen moonlight that hunts in total silence"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          {err && <div style={S.errorBox}>{err}</div>}
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ ...S.bigBtn, opacity: desc.trim() && hasSpark ? 1 : 0.4 }} disabled={!desc.trim() || !hasSpark} onClick={startSpin}>
              Spin the Forge
            </button>
            <button style={S.ghostBtn} onClick={onCancel}>Cancel</button>
          </div>
        </>
      )}

      {(phase === "spinning" || phase === "result" || phase === "forging") && (
        <>
          <div style={S.wheelRow}>
            <Wheel label="Rarity" value={spin.rarity} color={RARITY_COLOR[spin.rarity]} spinning={phase === "spinning"} />
            <Wheel label="Evolutions" value={`${spin.stages} stage${spin.stages > 1 ? "s" : ""}`} color="#7ee787" spinning={phase === "spinning"} />
            <Wheel label="Focus" value={spin.emphasis.name} color="#5fd0e0" spinning={phase === "spinning"} />
            <Wheel label="Boon" value={spin.boon.name} color="#ff7ad9" spinning={phase === "spinning"} />
          </div>

          {phase === "result" && rolls && (
            <>
              <div style={S.rollSummary}>
                <div style={{ color: RARITY_COLOR[rolls.rarity], fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>
                  {rolls.rarity} forge
                </div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>
                  {rolls.stages === 1 ? "Standalone (no evolutions)" : `Can evolve through ${rolls.stages} stages`} · {rolls.emphasis.name}
                </div>
                {rolls.boon && rolls.boon.id !== "none" && rolls.boon.id !== "none2" && (
                  <div style={{ fontSize: 12, color: "#ff7ad9" }}>
                    ✦ {rolls.boon.name}: {rolls.boon.text}
                  </div>
                )}
              </div>
              {err && <div style={S.errorBox}>{err}</div>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={S.bigBtn} onClick={forge}>Forge this monster</button>
                <button
                  style={{ ...S.ghostBtn, opacity: canReroll ? 1 : 0.4 }}
                  disabled={!canReroll}
                  title={canReroll ? "Spend a spare Genesis Spark to re-roll" : "Need a spare Genesis Spark to re-roll"}
                  onClick={reroll}
                >
                  Re-roll {canReroll ? "(uses a spare Spark)" : "(no spare)"}
                </button>
              </div>
            </>
          )}

          {phase === "forging" && (
            <div className="pulse" style={{ ...S.forgeAnim, textAlign: "center" }}>{stageMsg}</div>
          )}
        </>
      )}
    </div>
  );
}

// A single spinning stat wheel.
function Wheel({ label, value, color, spinning }) {
  return (
    <div style={S.wheel}>
      <div style={{ fontSize: 9, opacity: 0.6, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
      <div
        style={{
          ...S.wheelFace,
          borderColor: color,
          color,
          transform: spinning ? "scale(1.04)" : "scale(1)",
          boxShadow: spinning ? `0 0 14px ${color}88` : `0 0 6px ${color}44`,
        }}
        className={spinning ? "pulse" : ""}
      >
        {value}
      </div>
    </div>
  );
}

function Fuse({ collection, onFused, onFormFused, onCancel, items, eggs, materials, onBreed, canBreedCheck }) {
  const [chamber, setChamber] = useState("fuse"); // fuse | nursery
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [err, setErr] = useState(null);

  const pick = (uid) => {
    if (a === uid) return setA(null);
    if (b === uid) return setB(null);
    if (!a) return setA(uid);
    if (!b) return setB(uid);
    setA(b);
    setB(uid);
  };

  const mA = collection.find((m) => m.uid === a);
  const mB = collection.find((m) => m.uid === b);
  const hasCatalyst = (items || []).includes("fusioncatalyst");
  const formFusion = mA && mB ? isFormFusion(mA, mB) : false;
  const nextForm = formFusion ? nextFormOf(mA) : null;
  const compatible = mA && mB ? canFuse(mA, mB) : true;
  const bothPicked = !!(mA && mB);
  // form fusion is deterministic: same species merging needs no catalyst
  const canDoFusion = bothPicked && compatible && (formFusion || hasCatalyst) && !loading;

  // why is fusion blocked? for the message
  let blockReason = null;
  if (bothPicked && !compatible) blockReason = `${mA.name} (${stageLabel(mA)}) and ${mB.name} (${stageLabel(mB)}) aren't at compatible evolution stages.`;
  else if (bothPicked && !formFusion && !hasCatalyst) blockReason = "You need a Fusion Catalyst to fuse. Find one in shops or as a reward.";

  async function fuse() {
    if (!mA || !mB) return;
    if (formFusion) {
      // deterministic: two of the same species+form merge into the next form
      onFormFused(mA, mB, nextForm);
      setA(null);
      setB(null);
      return;
    }
    if (!compatible) {
      setErr("These two can't be fused: their evolution stages don't line up.");
      return;
    }
    if (!hasCatalyst) {
      setErr("You need a Fusion Catalyst.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      setStage("⚗️ merging essence…");
      const prompt = `You fuse two monsters in a Pokémon x Slay the Spire card battler. Respond with ONLY a JSON object, no prose, no markdown fences.

Monster A: ${JSON.stringify({ name: mA.name, element: mA.element, hp: mA.maxHp, desc: mA.desc, cards: mA.cards.map(({ cid, ...c }) => c) })}
Monster B: ${JSON.stringify({ name: mB.name, element: mB.element, hp: mB.maxHp, desc: mB.desc, cards: mB.cards.map(({ cid, ...c }) => c) })}

Create a single hybrid that blends both. Return:
{
  "name":"portmanteau or new name combining both",
  "element": one of ${JSON.stringify(ELEMENTS)},
  "hp": integer between the parents' hp and a bit higher, max 50,
  "sprite":"single emoji",
  "desc":"one sentence describing the hybrid",
  "cards":[ exactly 3 cards: one inherited-feeling card from each parent plus one brand new fused card; card fields: id, name, type(attack|skill|power), cost(0-2), text, and optional dmg/block/strength/burn/weak/draw/hits/shield/teamheal/regen/vulnerable/energy integers plus retain/exhaust booleans ]
}
Keep numbers Spire-scale and balanced.`;
      const mon = await askClaudeJson(prompt);
      mon.element = ELEMENTS.includes(mon.element) ? mon.element : mA.element;
      mon.hp = clamp(Number(mon.hp) || Math.round((mA.maxHp + mB.maxHp) / 2) + 4, 24, 50);
      mon.cards = (mon.cards || []).slice(0, 3);
      if (mon.cards.length === 0) throw new Error("no cards returned");

      setStage("🎨 painting the hybrid…");
      mon.svg = await generateArt({ name: mon.name, element: mon.element, desc: mon.desc });

      onFused(mon); // parent consumes the catalyst
    } catch (e) {
      setErr(`Fusion unstable: ${e.message}. Try again.`);
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  return (
    <div>
      <h2 style={S.h2}>{chamber === "fuse" ? "Fusion Chamber ⚗️" : "Nursery 🥚"}</h2>
      <div style={S.codexTabs}>
        <button style={{ ...S.codexTab, ...(chamber === "fuse" ? S.codexTabActive : {}) }} onClick={() => setChamber("fuse")}>⚗️ Fuse</button>
        <button style={{ ...S.codexTab, ...(chamber === "nursery" ? S.codexTabActive : {}) }} onClick={() => setChamber("nursery")}>🥚 Nursery {eggs.length > 0 ? `(${eggs.length})` : ""}</button>
      </div>
      {chamber === "nursery" && (
        <Nursery collection={collection} eggs={eggs} materials={materials} onBreed={onBreed} canBreedCheck={canBreedCheck} />
      )}
      {chamber === "fuse" && (<>
      <p style={{ opacity: 0.65 }}>
        Select two monsters at compatible evolution stages (needs a Fusion Catalyst {hasCatalyst ? "✓" : "✗"}), or two of the SAME
        species and form to merge them into the next form, no catalyst needed.
      </p>

      <div style={S.fuseStage}>
        <FuseSlot m={mA} label="A" />
        <div style={{ fontSize: 34 }} className={loading ? "pulse" : ""}>＋</div>
        <FuseSlot m={mB} label="B" />
        <div style={{ fontSize: 28 }}>＝</div>
        <div style={{ ...S.fuseSlot, borderStyle: "dashed", opacity: 0.5 }}>?</div>
      </div>

      {blockReason && <div style={{ ...S.errorBox, background: "#a571ff22", borderColor: "#a571ff", color: "#d4b8ff" }}>{blockReason}</div>}
      {err && <div style={S.errorBox}>{err}</div>}
      {loading && stage && <div className="pulse" style={S.forgeAnim}>{stage}</div>}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button style={{ ...S.bigBtn, opacity: canDoFusion ? 1 : 0.4 }} disabled={!canDoFusion} onClick={fuse}>
          {loading ? "Fusing…" : formFusion ? `Form Fusion → ${FORMS[nextForm].badge} ${FORMS[nextForm].label}` : "Fuse"}
        </button>
        <button style={S.ghostBtn} onClick={onCancel}>Cancel</button>
      </div>

      <div style={S.grid}>
        {collection.map((m) => {
          const sel = m.uid === a ? "A" : m.uid === b ? "B" : null;
          // dim monsters that can't fuse with the currently-picked single one
          const other = a && !b ? mA : null;
          const incompatible = other && other.uid !== m.uid && !canFuse(other, m);
          return (
            <div
              key={m.uid}
              style={{
                ...S.monCard,
                borderColor: sel ? "#ffd34d" : "#262633",
                opacity: incompatible ? 0.4 : 1,
              }}
              onClick={() => pick(m.uid)}
            >
              {sel && <div style={{ ...S.teamBadge, background: "#ffd34d", color: "#111" }}>{sel}</div>}
              <MonsterSprite m={m} size={52} />
              <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>{m.name}</div>
              <ElementPills m={m} />
              <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{stageLabel(m)}{formLabel(m) ? ` · ${formLabel(m)}` : ""}</div>
            </div>
          );
        })}
      </div>
      </>)}
    </div>
  );
}

// ---------- Nursery (breeding) ----------
// Unlike fusion, BOTH parents are kept. Parent A decides the species (the
// egg is a baby of A's stage-1 form); parent B passes down one egg move.
function Nursery({ collection, eggs, materials, onBreed, canBreedCheck }) {
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const pick = (uid) => {
    if (a === uid) return setA(null);
    if (b === uid) return setB(null);
    if (!a) return setA(uid);
    if (!b) return setB(uid);
    setA(b); setB(uid);
  };
  const mA = collection.find((m) => m.uid === a);
  const mB = collection.find((m) => m.uid === b);
  const check = mA && mB ? canBreedCheck(mA, mB) : { ok: false, why: null };
  const rootName = mA ? (lineOf(mA.name) ? lineOf(mA.name).members[0] : mA.name) : null;
  return (
    <div>
      <p style={{ opacity: 0.65, fontSize: 13 }}>
        Pick two parents that share an element or a line. Both are KEPT. The egg hatches into a 🍼 Baby {rootName || "…"}
        (parent A's base species) that inherits one random egg move 🥚 from parent B. Egg moves survive evolution.
        Costs 1× 💠 Vital Essence + 2× 🌫️ Chimera Dust. Eggs hatch as you win battles.
      </p>

      {eggs.length > 0 && (
        <>
          <h3 style={S.bagSub}>Incubating ({eggs.length}/3)</h3>
          {eggs.map((egg) => (
            <div key={egg.id} style={{ ...S.adminRow, cursor: "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 22 }}>🥚</span>
                <strong style={{ fontSize: 13 }}>{egg.template.name} egg</strong>
                <span style={{ fontSize: 11, opacity: 0.6 }}>{egg.parents}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#ffd34d" }}>hatches in {egg.hatchIn} win{egg.hatchIn > 1 ? "s" : ""}</span>
              </div>
              {egg.eggCard && <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>🥚 egg move: {egg.eggCard.name}</div>}
            </div>
          ))}
        </>
      )}

      <div style={S.fuseStage}>
        <FuseSlot m={mA} label="A" />
        <div style={{ fontSize: 30 }}>♥</div>
        <FuseSlot m={mB} label="B" />
        <div style={{ fontSize: 28 }}>＝</div>
        <div style={{ ...S.fuseSlot, borderStyle: "dashed", opacity: 0.6, fontSize: 30 }}>🥚</div>
      </div>
      {mA && mB && !check.ok && check.why && (
        <div style={{ ...S.errorBox, background: "#a571ff22", borderColor: "#a571ff", color: "#d4b8ff" }}>{check.why}</div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <button style={{ ...S.bigBtn, opacity: check.ok ? 1 : 0.4 }} disabled={!check.ok} onClick={() => { onBreed(mA, mB); setA(null); setB(null); }}>
          Breed 🥚
        </button>
      </div>

      <div style={S.grid}>
        {collection.map((m) => {
          const sel = m.uid === a ? "A" : m.uid === b ? "B" : null;
          return (
            <div key={m.uid} style={{ ...S.monCard, borderColor: sel ? "#ff7ad9" : "#262633" }} onClick={() => pick(m.uid)}>
              {sel && <div style={{ ...S.teamBadge, background: "#ff7ad9", color: "#111" }}>{sel}</div>}
              <MonsterSprite m={m} size={52} />
              <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>{m.name}</div>
              <ElementPills m={m} />
              <div style={{ fontSize: 10, opacity: 0.55, marginTop: 2 }}>{stageLabel(m)}{formLabel(m) ? ` · ${formLabel(m)}` : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function FuseSlot({ m, label }) {
  return (
    <div style={S.fuseSlot}>
      {m ? <MonsterSprite m={m} size={64} /> : <span style={{ opacity: 0.4, fontSize: 30 }}>{label}</span>}
      {m && <div style={{ fontSize: 11, marginTop: 4 }}>{m.name}</div>}
    </div>
  );
}

function Battle({ battle, team, onPlay, onEnd, onPotion, onSwap, onWin, onLose, materials, onMaterial, iconArt, vp }) {
  const wide = vp && vp.landscape;
  // ---- juice: floating numbers, shake, sound triggers ----
  const [floaties, setFloaties] = useState([]);
  const [shake, setShake] = useState(false);
  const [viewCard, setViewCard] = useState(null);
  const [drag, setDrag] = useState(null); // {cid, card, sx, sy, x, y}
  const DRAG_PLAY_LIFT = 70; // px upward to trigger a play
  function startDrag(e, c, playable) {
    if (!playable) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    setDrag({ cid: c.cid, card: c, sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY });
  }
  function moveDrag(e) {
    setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
  }
  function endDrag(e, c, playable) {
    setDrag((d) => {
      if (d && d.cid === c.cid && playable && d.sy - d.y >= DRAG_PLAY_LIFT) {
        SFX.card();
        setTimeout(() => onPlay(c), 0);
      }
      return null;
    });
  }
  const prevJ = useRef({ ehp: null, php: null, over: null });
  useEffect(() => {
    if (!battle) return;
    const pr = prevJ.current;
    const af = battle.fighters[battle.activeIdx];
    const spawn = (text, color, side) => setFloaties((f) => [...f.slice(-5), { id: Math.random(), text, color, side }]);
    if (pr.ehp != null && battle.enemyHp < pr.ehp) {
      const d = pr.ehp - battle.enemyHp;
      spawn(`-${d}`, "#ff8a8a", "enemy");
      SFX.hit(d >= 15);
      if (d >= 15) { setShake(true); setTimeout(() => setShake(false), 320); }
    }
    if (pr.ehp != null && battle.enemyHp > pr.ehp) spawn(`+${battle.enemyHp - pr.ehp}`, "#7ee787", "enemy");
    if (af && pr.php != null && af.hp < pr.php) { spawn(`-${pr.php - af.hp}`, "#ff8a8a", "ally"); SFX.hit(pr.php - af.hp >= 12); }
    if (af && pr.php != null && af.hp > pr.php) { spawn(`+${af.hp - pr.php}`, "#7ee787", "ally"); SFX.heal(); }
    if (battle.over && battle.over !== pr.over) { if (battle.over === "win") SFX.victory(); else SFX.defeat(); }
    prevJ.current = { ehp: battle.enemyHp, php: af ? af.hp : null, over: battle.over };
  }, [battle && battle.enemyHp, battle && battle.fighters[battle.activeIdx] && battle.fighters[battle.activeIdx].hp, battle && battle.over]);
  const b = battle;
  const enemyHpPct = (b.enemyHp / b.enemyMaxHp) * 100;
  const active = b.fighters[b.activeIdx];
  const activeHpPct = (active.hp / active.maxHp) * 100;

  useEffect(() => {
    if (b.over === "win") {
      const t = setTimeout(onWin, 1100);
      return () => clearTimeout(t);
    }
    if (b.over === "lose") {
      const t = setTimeout(onLose, 1400);
      return () => clearTimeout(t);
    }
  }, [b.over]);

  const intentText = (it) =>
    !it ? "" : it.kind === "attack" ? `⚔ ${it.value}` : it.kind === "block" ? `🛡 ${it.value}` : "✦ buff";

  return (
    <div className={shake ? "shake" : ""} style={{ ...S.battle, position: "relative", maxWidth: wide ? 1100 : 720, width: "100%", flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <button
        style={{ position: "absolute", top: 4, right: 4, zIndex: 6, background: "#15132e", border: "1px solid #2c2a40", borderRadius: 8, color: "#e8e6f0", fontSize: 12, padding: "3px 7px", cursor: "pointer" }}
        onClick={() => { SFX.muted = !SFX.muted; setFloaties((f) => [...f]); }}
      >
        {SFX.muted ? "🔇" : "🔊"}
      </button>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
        {floaties.map((f) => (
          <div key={f.id} className="floatie" style={{ position: "absolute", top: f.side === "enemy" ? "16%" : "60%", left: f.side === "enemy" ? "60%" : "22%", color: f.color, fontWeight: 900, fontSize: 22, textShadow: "0 2px 6px #000" }}>{f.text}</div>
        ))}
      </div>
      {/* play zone hint while dragging a card upward */}
      {drag && (
        <div style={{ position: "absolute", inset: "0 0 130px 0", zIndex: 4, pointerEvents: "none", border: `3px dashed ${drag.sy - drag.y >= DRAG_PLAY_LIFT ? "#7ee787" : "#ffffff44"}`, borderRadius: 14, margin: 6, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10, color: drag.sy - drag.y >= DRAG_PLAY_LIFT ? "#7ee787" : "#ffffff66", fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
          {drag.sy - drag.y >= DRAG_PLAY_LIFT ? "RELEASE TO PLAY" : "DRAG UP TO PLAY"}
        </div>
      )}
      {/* stage: two matching monster cards, ally vs enemy, side by side */}
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", gap: 6 }}>
        <div style={{ display: "flex", gap: wide ? 16 : 8, alignItems: "stretch", justifyContent: "center" }}>
          <BattleCombatCard
            side="ally"
            mon={active}
            hpPct={activeHpPct}
            hp={active.hp}
            maxHp={active.maxHp}
            block={active.block}
            teamShield={b.teamShield || 0}
            str={active.str}
            regen={active.regenStacks || 0}
            synergy={active.synergy || 0}
            wide={wide}
            onView={() => { const full = (team || []).find((t) => t.uid === active.uid); setViewCard(full || active); }}
          />
          <BattleCombatCard
            side="enemy"
            mon={b.enemy}
            hpPct={enemyHpPct}
            hp={b.enemyHp}
            maxHp={b.enemyMaxHp}
            block={b.enemyBlock}
            status={b.enemyStatus}
            intent={intentText(b.enemy.intent)}
            matchup={defenseMultiplier(active.element, b.enemy)}
            matchEl={active.element}
            reaction={b.lastReaction}
            wide={wide}
            onView={() => setViewCard(b.enemy)}
          />
        </div>
        <div style={S.log}>
          {b.log.map((l, i) => (
            <div key={i} style={{ opacity: 0.4 + (i / b.log.length) * 0.6 }}>{l}</div>
          ))}
        </div>
      </div>
      {/* ===== pinned bottom: controls + consumables + hand ===== */}
      <div style={{ flex: "0 0 auto", paddingTop: 4 }}>
      {b.fighters.length > 1 && (
        <div style={S.benchRow}>
          {b.fighters.map((f, i) => {
            const isActive = i === b.activeIdx;
            const fainted = f.hp <= 0;
            const canSwap = !isActive && !fainted && !b.swappedThisTurn && b.turn === "player" && !b.over;
            return (
              <button key={f.uid} style={{ ...S.benchMon, borderColor: isActive ? ELEMENT_COLOR[f.element] : "#2c2a40", opacity: fainted ? 0.35 : isActive ? 1 : 0.85, cursor: canSwap ? "pointer" : "default" }} disabled={!canSwap} onClick={() => canSwap && onSwap(i)}>
                <MonsterSprite m={f} size={26} />
                <span style={{ fontSize: 9, marginTop: 1 }}>{fainted ? "💀" : `${f.hp}/${f.maxHp}`}</span>
                {isActive && <span style={S.activeTag}>active</span>}
              </button>
            );
          })}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, margin: "2px 2px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={S.energyOrb}>{b.energy}/{b.maxEnergy}</div>
          <span style={{ fontSize: 10, opacity: 0.6 }}>energy</span>
        </div>
        <button style={{ ...S.endBtn, padding: "8px 18px", fontSize: 14 }} disabled={!!b.over} onClick={onEnd}>End Turn ⏭</button>
      </div>
      {/* consumables: potions + materials in one compact, scrollable row */}
      {((b.potions && b.potions.length > 0) || (materials && Object.keys(materials).length > 0)) && (
        <div style={S.consumeBar}>
          {(b.potions || []).map((id, i) => {
            const it = ITEMS.find((x) => x.id === id);
            if (!it) return null;
            return (
              <button key={id + i} style={S.consumeBtn} disabled={!!b.over} title={`${it.name}: ${it.text}`} onClick={() => onPotion(id)}>
                <span style={{ fontSize: 17 }}>{it.icon}</span>
              </button>
            );
          })}
          {MATERIALS.filter((m) => (materials[m.id] || 0) > 0).map((m) => (
            <button key={m.id} style={{ ...S.consumeBtn, opacity: b.turn === "player" && !b.over ? 1 : 0.4 }} disabled={!!b.over || b.turn !== "player"} title={`${m.name}: ${m.use} (consumes 1)`} onClick={() => onMaterial(m.id)}>
              <span style={{ fontSize: 15 }}>{m.icon}</span>
              <span style={S.consumeCount}>{materials[m.id]}</span>
            </button>
          ))}
        </div>
      )}

      {/* hand: drag a card up to play it; release low to cancel */}
      <div style={S.hand}>
        {active.hand.map((c) => {
          const playable = c.cost <= b.energy && !b.over && b.turn === "player";
          const accent = c.element ? ELEMENT_COLOR[c.element] : "#ffd34d";
          const dragging = drag && drag.cid === c.cid;
          return (
            <div
              key={c.cid}
              className="card"
              style={{
                ...S.playCard,
                borderColor: accent,
                opacity: dragging ? 0.25 : playable ? 1 : 0.45,
                cursor: playable ? "grab" : "default",
                touchAction: "none",
              }}
              onPointerDown={(e) => startDrag(e, c, playable)}
              onPointerMove={moveDrag}
              onPointerUp={(e) => endDrag(e, c, playable)}
              onPointerCancel={() => setDrag(null)}
            >
              <div style={{ ...S.cardCost, background: accent }}>{c.cost}</div>
              <div style={{ borderRadius: 6, overflow: "hidden", margin: "0 auto 2px", width: 30, height: 30, border: `1px solid ${accent}55` }}>
                <IconArt svg={iconArt && iconArt[`move:${c.id}`] && iconArt[`move:${c.id}`] !== "…" ? iconArt[`move:${c.id}`] : moveIcon(c, c.element)} emoji="" size={30} />
              </div>
              <div style={S.cardName}>{c.name}</div>
              <div style={S.cardText}>{c.text}</div>
            </div>
          );
        })}
      </div>
      {/* floating clone that follows the finger while dragging */}
      {drag && (() => {
        const c = drag.card;
        const accent = c.element ? ELEMENT_COLOR[c.element] : "#ffd34d";
        const arm = drag.sy - drag.y >= DRAG_PLAY_LIFT;
        return (
          <div style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%,-50%) rotate(-3deg)", zIndex: 50, pointerEvents: "none", ...S.playCard, borderColor: arm ? "#7ee787" : accent, opacity: 1, boxShadow: `0 10px 30px #000a, 0 0 0 2px ${arm ? "#7ee787" : accent}55` }}>
            <div style={{ ...S.cardCost, background: accent }}>{c.cost}</div>
            <div style={{ borderRadius: 6, overflow: "hidden", margin: "0 auto 2px", width: 30, height: 30, border: `1px solid ${accent}55` }}>
              <IconArt svg={iconArt && iconArt[`move:${c.id}`] && iconArt[`move:${c.id}`] !== "…" ? iconArt[`move:${c.id}`] : moveIcon(c, c.element)} emoji="" size={30} />
            </div>
            <div style={S.cardName}>{c.name}</div>
            <div style={S.cardText}>{c.text}</div>
          </div>
        );
      })()}

      <div style={S.deckInfo}>
        {active.name}'s deck · Draw {active.drawPile.length} · Discard {active.discard.length}
      </div>
      </div>

      {viewCard && (
        <div style={S.modalBackdrop} onClick={() => setViewCard(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <TCGCard m={viewCard} width={280} />
            <button style={S.ghostBtn} onClick={() => setViewCard(null)}>Close</button>
          </div>
        </div>
      )}

      {b.over && (
        <div style={S.overlay}>
          <div style={{ fontSize: 40 }}>{b.over === "win" ? "🏆" : "💀"}</div>
          <h2 style={{ margin: 0 }}>{b.over === "win" ? "Victory" : "Defeated"}</h2>
        </div>
      )}
    </div>
  );
}

// One combat card: a compact TCG-styled panel for a fighter or the enemy,
// matching on both sides. Art, name, types, HP, statuses, and a button to
// open that monster's full codex card.
function BattleCombatCard({ side, mon, hpPct, hp, maxHp, block, teamShield, str, regen, synergy, status, intent, matchup, matchEl, reaction, wide, onView }) {
  const accent = monAccent(mon);
  const isEnemy = side === "enemy";
  return (
    <div style={{ flex: "1 1 0", minWidth: 0, maxWidth: 240, ...gradBorderStyle(mon, "#17142e", 2), borderRadius: 14, padding: wide ? "10px 10px 8px" : "8px 8px 6px", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", boxShadow: `0 4px 16px #0006, inset 0 0 18px ${accent}22` }}>
      <div style={{ position: "absolute", top: 6, left: 8, fontSize: 9, letterSpacing: 1, fontWeight: 800, color: isEnemy ? "#ff8a8a" : "#7ee787", textTransform: "uppercase" }}>{isEnemy ? "Foe" : "You"}</div>
      {isEnemy && intent && <div style={{ position: "absolute", top: 4, right: 6, fontSize: 11, color: "#ffd34d", fontWeight: 700 }}>{intent}</div>}
      <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${accent}66`, marginTop: 8 }}>
        <MonsterSprite m={mon} size={wide ? 60 : 64} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4, textAlign: "center", lineHeight: 1.1 }}>
        {mon.name}{formLabel(mon) ? <span style={{ fontSize: 9, color: "#ffd34d", display: "block" }}>{formLabel(mon)}</span> : null}
      </div>
      <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "wrap", margin: "2px 0" }}>
        {monElements(mon).map((el) => (
          <span key={el} style={{ ...S.elementPill, background: ELEMENT_COLOR[el], position: "static", display: "inline-block", fontSize: 8 }}>{el}</span>
        ))}
      </div>
      <div style={{ width: "100%" }}>
        <Bar pct={hpPct} color={isEnemy ? "#ff5a4d" : "#7ee787"} label={`${hp}/${maxHp}`} />
      </div>
      {isEnemy && matchup > 1 && <div style={S.matchGood}>{matchEl} strong ▲</div>}
      {isEnemy && matchup < 1 && <div style={S.matchBad}>{matchEl} weak ▼</div>}
      <div style={S.statusRow}>
        {!isEnemy && (teamShield || 0) > 0 && <span style={S.statShield}>✶ {teamShield}</span>}
        {(block || 0) > 0 && <span style={S.statBlock}>🛡 {block}</span>}
        {!isEnemy && (str || 0) > 0 && <span style={S.statStr}>💪 {str}</span>}
        {!isEnemy && (regen || 0) > 0 && <span style={S.statRegen}>💚 {regen}</span>}
        {!isEnemy && (synergy || 0) > 0 && <span style={S.statSyn}>🔗 +{synergy}</span>}
        {isEnemy && status && status.burn > 0 && <span style={S.statBurn}>🔥 {status.burn}</span>}
        {isEnemy && status && status.poison > 0 && <span style={S.statPoison}>☣ {status.poison}</span>}
        {isEnemy && status && status.weak > 0 && <span style={S.statWeak}>💧 {status.weak}</span>}
        {isEnemy && status && status.vulnerable > 0 && <span style={S.statVuln}>🎯 {status.vulnerable}</span>}
        {isEnemy && status && status.chill > 0 && <span style={S.statChill}>❆ {status.chill}</span>}
        {isEnemy && status && status.soak > 0 && <span style={S.statSoak}>💦 {status.soak}</span>}
        {isEnemy && status && status.shock > 0 && <span style={S.statShock}>⚡ {status.shock}</span>}
        {isEnemy && status && status.decay > 0 && <span style={S.statDecay}>⬤ {status.decay}</span>}
      </div>
      {isEnemy && reaction && <div style={S.reactionFlash}>✦ {reaction}!</div>}
      <button style={{ marginTop: "auto", background: "none", border: `1px solid ${accent}66`, color: "#cfc8e8", borderRadius: 8, fontSize: 10, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }} onClick={onView}>📖 Codex</button>
    </div>
  );
}

function Bar({ pct, color, label }) {
  return (
    <div style={S.barOuter}>
      <div style={{ ...S.barInner, width: `${pct}%`, background: color, transition: "width 0.45s ease" }} />
      <span style={S.barLabel}>{label}</span>
    </div>
  );
}

function Reward({ reward, onTake, floor, ballCount }) {
  const [selected, setSelected] = useState(null);
  const [armed, setArmed] = useState(false);
  // Disable the confirm button briefly so a stray tap carried over from the
  // victory screen can't immediately commit a reward.
  useEffect(() => {
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 450);
    return () => clearTimeout(t);
  }, [reward]);

  const sel = selected != null ? reward.choices[selected] : null;
  const captureNoBall = sel && sel.kind === "capture" && ballCount <= 0;

  function confirm() {
    if (!sel || !armed) return;
    onTake(sel);
  }

  return (
    <div style={S.panel}>
      <h2 style={S.h2}>{reward.isBoss ? "Boss defeated!" : "Victory"}</h2>
      <p style={{ opacity: 0.65 }}>Tap a reward to select it, then confirm.</p>
      {reward.drops && Object.keys(reward.drops).length > 0 && (
        <div style={S.dropsBar}>
          <span style={{ opacity: 0.7, marginRight: 6 }}>Materials found:</span>
          {Object.keys(reward.drops).map((id) => {
            const mat = materialById(id);
            return (
              <span key={id} style={S.dropPill}>
                {mat.icon} {mat.name} ×{reward.drops[id]}
              </span>
            );
          })}
        </div>
      )}
      <div style={S.rewardRow}>
        {reward.choices.map((c, i) => {
          const isSel = selected === i;
          return (
            <div
              key={i}
              style={{
                ...S.rewardCard,
                borderColor: isSel ? "#ffd34d" : "#3a2a40",
                boxShadow: isSel ? "0 0 0 2px #ffd34d88" : "none",
              }}
              onClick={() => setSelected(i)}
            >
              {c.kind === "capture" && (
                <>
                  <MonsterSprite m={c.template} size={60} />
                  <strong style={{ marginTop: 6 }}>
                    Catch {c.template.name.replace(/^(BOSS |Elite )/, "")}
                    {formLabel(c.template) && <span style={{ fontSize: 11, color: "#ffd34d", marginLeft: 5 }}>{formLabel(c.template)}</span>}
                  </strong>
                  <span style={S.rewardDesc}>
                    Uses 1 Beast Ball 🔴 (you have {ballCount}).
                  </span>
                </>
              )}
              {c.kind === "item" && (
                <>
                  <div style={{ fontSize: 50 }}>{c.item.icon}</div>
                  <strong style={{ color: RARITY_COLOR[c.item.rarity] }}>{c.item.name}</strong>
                  <span style={S.rewardDesc}>{c.item.text}</span>
                  <span style={{ fontSize: 10, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>{c.item.kind}</span>
                </>
              )}
              {c.kind === "artifact" && (
                <>
                  <div style={{ fontSize: 50 }}>{c.artifact.icon}</div>
                  <strong style={{ color: "#ffd34d" }}>{c.artifact.name}</strong>
                  <span style={S.rewardDesc}>{c.artifact.text}</span>
                  <span style={{ fontSize: 10, opacity: 0.5, textTransform: "uppercase", letterSpacing: 1 }}>artifact · this run only</span>
                </>
              )}
              {c.kind === "recipe" && (() => {
                const it = ITEMS.find((x) => x.id === c.item);
                return (
                  <>
                    <div style={{ fontSize: 50 }}>📜</div>
                    <strong style={{ color: "#ffd34d" }}>Recipe: {it ? it.name : c.item}</strong>
                    <span style={S.rewardDesc}>Learn to craft this in the Workshop.</span>
                  </>
                );
              })()}
              {c.kind === "generate" && (
                <>
                  <div style={{ fontSize: 50 }}>🧬</div>
                  <strong>Forge a Monster</strong>
                  <span style={S.rewardDesc}>Rare reward: describe a brand-new creature.</span>
                </>
              )}
              {c.kind === "gold" && (
                <>
                  <div style={{ fontSize: 50 }}>🪙</div>
                  <strong>{c.amount} Gold</strong>
                  <span style={S.rewardDesc}>Spend it at shops.</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      {captureNoBall && (
        <div style={{ ...S.errorBox, marginTop: 14 }}>
          You have no Beast Balls. Pick another reward, or buy Beast Balls at a shop.
        </div>
      )}

      <button
        style={{
          ...S.bigBtn,
          width: "100%",
          marginTop: 16,
          opacity: sel && armed && !captureNoBall ? 1 : 0.4,
        }}
        disabled={!sel || !armed || captureNoBall}
        onClick={confirm}
      >
        {!sel ? "Select a reward" : !armed ? "…" : `Confirm: ${rewardLabel(sel)}`}
      </button>
    </div>
  );
}

function rewardLabel(c) {
  if (c.kind === "capture") return `Catch ${c.template.name.replace(/^(BOSS |Elite )/, "")}`;
  if (c.kind === "item") return c.item.name;
  if (c.kind === "recipe") { const it = ITEMS.find((x) => x.id === c.item); return `Recipe: ${it ? it.name : c.item}`; }
  if (c.kind === "artifact") return c.artifact.name;
  if (c.kind === "generate") return "Forge a Monster";
  if (c.kind === "gold") return `${c.amount} Gold`;
  return "Confirm";
}

// ---------- Dungeon Map (branching paths) ----------
function DungeonMap({ map, currentRow, currentCol, onPick, onLeave }) {
  // which nodes are reachable now?
  const reachable = (node) => {
    if (currentRow < 0) return node.row === 0; // start: pick any row-0 node
    if (node.row !== currentRow + 1) return false;
    const cur = map[currentRow][currentCol];
    return cur && cur.edges.includes(node.col);
  };

  return (
    <div>
      <div style={S.sectionHead}>
        <div>
          <h2 style={S.h2}>The Descent</h2>
          <p style={{ opacity: 0.65, margin: 0 }}>
            Pick your path. Each choice leads deeper, ending at the boss. HP carries between fights.
          </p>
        </div>
        <button style={S.ghostBtn} onClick={onLeave}>Abandon run</button>
      </div>

      <div style={S.mapScroll}>
        <div style={S.mapInner}>
          {[...map].map((row, rIdx) => {
            const r = map.length - 1 - rIdx; // render boss at top, start at bottom
            const realRow = map[r];
            return (
              <div key={r} style={S.mapRow}>
                <div style={S.mapRowLabel}>
                  {r === map.length - 1 ? "BOSS" : r === 0 ? "START" : `L${r + 1}`}
                </div>
                <div style={S.mapNodes}>
                  {realRow.map((node) => {
                    const t = NODE_TYPES[node.type];
                    const canPick = reachable(node);
                    const isCurrent = node.row === currentRow && node.col === currentCol;
                    return (
                      <button
                        key={node.id}
                        disabled={!canPick}
                        onClick={() => canPick && onPick(node)}
                        title={t.label}
                        style={{
                          ...S.mapNode,
                          borderColor: node.visited ? "#3a3a4a" : t.color,
                          background: isCurrent
                            ? t.color + "33"
                            : canPick
                            ? "#1a1530"
                            : "#121020",
                          opacity: node.visited ? 0.4 : canPick ? 1 : 0.55,
                          boxShadow: canPick ? `0 0 12px ${t.color}66` : "none",
                          cursor: canPick ? "pointer" : "default",
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{t.icon}</span>
                        <span style={{ fontSize: 9, color: t.color, fontWeight: 700 }}>{t.label}</span>
                        {canPick && <span style={S.pickHint}>tap</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.legend}>
        {Object.entries(NODE_TYPES).map(([k, t]) => (
          <span key={k} style={{ fontSize: 11, opacity: 0.7 }}>
            {t.icon} {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Rest Site ----------
function RestSite({ team, runHp, onRest }) {
  return (
    <div style={S.panel}>
      <h2 style={S.h2}>🔥 Rest Site</h2>
      <p style={{ opacity: 0.65 }}>Your team gathers around the fire. Recover 40% of each monster's max HP.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
        {team.map((m) => {
          const cur = runHp[m.uid] == null ? m.maxHp : runHp[m.uid];
          return (
            <div key={m.uid} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MonsterSprite m={m} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</div>
                <Bar pct={(cur / m.maxHp) * 100} color="#7ee787" label={`${cur}/${m.maxHp}`} />
              </div>
            </div>
          );
        })}
      </div>
      <button style={S.bigBtn} onClick={() => onRest("all")}>Rest by the fire</button>
    </div>
  );
}

// ---------- Shop ----------
// ---------- Overworld map view ----------
const OW_TILE_COLOR = {
  0: "#2f5d3a",
  1: "#3f7d4a",
  2: "#2f6db5",
  3: "#1f3a26",
  4: "#b9975b",
};

function Overworld({ ow, pos, onMove, onLeave, vp }) {
  // ---- Canvas RPG renderer: camera follow, smooth movement, animated
  // terrain, day/night cycle. Logic (tiles/features/encounters) unchanged.
  const cnv = useRef(null);
  const anim = useRef({ x: pos.x, y: pos.y, t: 0, facing: 1 });
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowUp" || e.key === "w") onMove(0, -1);
      else if (e.key === "ArrowDown" || e.key === "s") onMove(0, 1);
      else if (e.key === "ArrowLeft" || e.key === "a") onMove(-1, 0);
      else if (e.key === "ArrowRight" || e.key === "d") onMove(1, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onMove]);

  useEffect(() => {
    let raf;
    const TS = vp && vp.landscape ? 34 : 28;
    const c = cnv.current;
    let W = c.width, H = c.height;
    if (!c) return;
    const ctx = c.getContext("2d");
    const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const draw = () => {
      const a = anim.current;
      a.t += 1;
      // fit canvas to its container every frame (handles rotate/resize)
      const host = c.parentElement;
      if (host) {
        const cw = Math.max(200, Math.floor(host.clientWidth));
        const ch = Math.max(200, Math.floor(host.clientHeight));
        if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
        W = c.width; H = c.height;
      }
      // smooth camera + player tween
      const dx = pos.x - a.x, dy = pos.y - a.y;
      if (Math.abs(dx) > 0.01) a.facing = dx > 0 ? 1 : -1;
      a.x += dx * 0.18; a.y += dy * 0.18;
      const camX = a.x * TS + TS / 2 - W / 2, camY = a.y * TS + TS / 2 - H / 2;
      ctx.clearRect(0, 0, W, H);
      const x0 = Math.floor(camX / TS) - 1, y0 = Math.floor(camY / TS) - 1;
      for (let ty = y0; ty < y0 + H / TS + 2; ty++) {
        for (let tx = x0; tx < x0 + W / TS + 2; tx++) {
          const px = tx * TS - camX, py = ty * TS - camY;
          const inb = ty >= 0 && ty < ow.tiles.length && tx >= 0 && tx < ow.tiles[0].length;
          const t = inb ? ow.tiles[ty][tx] : 2;
          const h = hash(tx, ty);
          if (t === 2) { // animated water
            const ph = Math.sin(a.t * 0.04 + (tx + ty) * 0.9);
            ctx.fillStyle = ph > 0.3 ? "#2b5fae" : "#274f93";
            ctx.fillRect(px, py, TS, TS);
            ctx.fillStyle = "#4d86d8";
            const wy = py + 6 + ((h % 12) + ph * 3);
            ctx.fillRect(px + 4, wy, TS - 10, 2);
          } else { // grass base with variation
            ctx.fillStyle = h % 5 === 0 ? "#3c7a3a" : h % 7 === 0 ? "#356f35" : "#407f3d";
            ctx.fillRect(px, py, TS, TS);
            if (h % 11 === 0) { ctx.fillStyle = "#4f9347"; ctx.fillRect(px + (h % 18), py + (h % 14) + 6, 2, 3); }
            if (t === 1) { // tall grass: waving blades
              ctx.fillStyle = "#2f6b2e";
              for (let b = 0; b < 4; b++) {
                const bx = px + 4 + b * 6, sway = Math.sin(a.t * 0.06 + tx + b) * 2;
                ctx.fillRect(bx + sway, py + 8, 3, TS - 10);
              }
              ctx.fillStyle = "#57a04e";
              ctx.fillRect(px + 6 + Math.sin(a.t * 0.06 + tx) * 2, py + 6, 2, 8);
            }
            if (t === 3) { // tree: shadow, trunk, two-tone canopy
              ctx.fillStyle = "#00000033"; ctx.beginPath(); ctx.ellipse(px + TS / 2, py + TS - 4, 9, 3, 0, 0, 7); ctx.fill();
              ctx.fillStyle = "#5d4024"; ctx.fillRect(px + TS / 2 - 2, py + 12, 4, 12);
              ctx.fillStyle = "#2e6b2c"; ctx.beginPath(); ctx.arc(px + TS / 2, py + 10, 9, 0, 7); ctx.fill();
              ctx.fillStyle = "#3f8a39"; ctx.beginPath(); ctx.arc(px + TS / 2 - 3, py + 8, 6, 0, 7); ctx.fill();
            }
          }
        }
      }
      // features as structures (emoji renders crisply on canvas)
      ctx.font = "20px serif"; ctx.textAlign = "center";
      ow.features.forEach((f) => {
        const px = f.x * TS - camX + TS / 2, py = f.y * TS - camY + TS / 2;
        ctx.fillStyle = "#00000044"; ctx.beginPath(); ctx.ellipse(px, py + 9, 11, 4, 0, 0, 7); ctx.fill();
        ctx.fillText(f.icon, px, py + 7);
      });
      // player: drawn sprite with walk bob
      const ppx = a.x * TS - camX + TS / 2, ppy = a.y * TS - camY + TS / 2;
      const moving = Math.abs(dx) + Math.abs(dy) > 0.02;
      const bob = moving ? Math.sin(a.t * 0.4) * 1.6 : Math.sin(a.t * 0.08) * 0.6;
      ctx.fillStyle = "#00000055"; ctx.beginPath(); ctx.ellipse(ppx, ppy + 10, 8, 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#e8b04b"; ctx.fillRect(ppx - 4, ppy - 2 + bob, 8, 9); // tunic
      ctx.fillStyle = "#f1c27d"; ctx.beginPath(); ctx.arc(ppx, ppy - 7 + bob, 5, 0, 7); ctx.fill(); // head
      ctx.fillStyle = "#5d4024"; ctx.fillRect(ppx - 5, ppy - 12 + bob, 10, 4); // hair
      ctx.fillStyle = "#1d1d2b"; ctx.fillRect(ppx + (a.facing > 0 ? 1 : -3), ppy - 8 + bob, 2, 2); // eye
      // day/night tint (slow cycle) + vignette
      const day = (Math.sin(a.t * 0.0015) + 1) / 2;
      ctx.fillStyle = `rgba(10,8,40,${0.28 * (1 - day)})`; ctx.fillRect(0, 0, W, H);
      const g = ctx.createRadialGradient(W / 2, H / 2, H / 3, W / 2, H / 2, H);
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ow, pos, vp && vp.landscape, vp && vp.w, vp && vp.h]);

  const near = ow.features.find((f) => Math.abs(f.x - pos.x) + Math.abs(f.y - pos.y) <= 1);
  const Dpad = (
    <div style={{ position: "absolute", right: 14, bottom: 14, display: "grid", gridTemplateColumns: "repeat(3,40px)", gridTemplateRows: "repeat(3,40px)", gap: 4, opacity: 0.92, touchAction: "none" }}>
      <span /><button style={S.dBtn} onClick={() => onMove(0, -1)}>▲</button><span />
      <button style={S.dBtn} onClick={() => onMove(-1, 0)}>◀</button><span /><button style={S.dBtn} onClick={() => onMove(1, 0)}>▶</button>
      <span /><button style={S.dBtn} onClick={() => onMove(0, 1)}>▼</button><span />
    </div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <p style={{ opacity: 0.65, margin: "0 0 6px", fontSize: 12, flex: "0 0 auto", textAlign: "center" }}>
        {near ? `Near: ${near.icon} ${near.label} — step onto it to enter.` : "🗺️ Tall grass hides wild monsters. WASD / arrows / D-pad."}
      </p>
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, borderRadius: 14, overflow: "hidden", border: "1px solid #2c2a40" }}>
        <canvas ref={cnv} style={{ width: "100%", height: "100%", display: "block", imageRendering: "pixelated", touchAction: "none" }} />
        {Dpad}
      </div>
    </div>
  );
}

function Shop({ gold, owned, onBuy, onLeave, deep, depth, unknownRecipes, onBuyRecipe }) {
  // Deep (dungeon) shops: pricier, randomized, and stocked with rarer and
  // special items. Overworld shops: cheaper basics.
  const priceOf = (it) => {
    const base =
      it.rarity === "godly" ? 140 :
      it.rarity === "legendary" ? 110 :
      it.rarity === "mythic" ? 95 :
      it.rarity === "epic" ? 80 :
      it.rarity === "rare" ? 60 :
      it.rarity === "uncommon" ? 40 : 25;
    return deep ? Math.round(base * 1.5) : base;
  };
  // build stock once per shop visit
  const stock = useState(() => {
    if (deep) {
      // rarer items + always at least one special (stone/catalyst/spark)
      const specials = ITEMS.filter((it) => it.kind === "special");
      const goodies = ITEMS.filter((it) => it.rarity !== "common");
      const pick = (arr, n) => shuffle(arr).slice(0, n);
      const chosen = [
        ...pick(specials, Math.min(2, specials.length)),
        ...pick(goodies, 4),
      ];
      // dedupe by id
      const seen = new Set();
      return chosen.filter((it) => (seen.has(it.id) ? false : seen.add(it.id)));
    }
    // overworld: a spread of basics, always including Beast Balls
    const ball = ITEMS.find((it) => it.id === "beastball");
    return [ball, ...shuffle(ITEMS.filter((it) => it.id !== "beastball")).slice(0, 5)];
  })[0];

  // a rare recipe scroll in deep shops (rolled once per visit)
  const scroll = useState(() => {
    if (deep && unknownRecipes && unknownRecipes.length > 0 && Math.random() < 0.35) {
      return unknownRecipes[Math.floor(Math.random() * unknownRecipes.length)];
    }
    return null;
  })[0];
  const scrollPrice = 120;
  const scrollItem = scroll ? ITEMS.find((x) => x.id === scroll) : null;

  return (
    <div>
      <div style={S.sectionHead}>
        <div>
          <h2 style={S.h2}>{deep ? "⛏️ Deep Market" : "🛒 Town Shop"}</h2>
          <p style={{ opacity: 0.65, margin: 0 }}>
            {deep
              ? `A hidden trader deep in the dungeon. Rare stock, steep prices.`
              : "A friendly town shop. Everyday sigils and potions."}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#ffd34d" }}>🪙 {gold}</div>
          <button style={S.ghostBtn} onClick={onLeave}>Leave</button>
        </div>
      </div>
      <div style={S.itemGrid}>
        {scrollItem && unknownRecipes.includes(scroll) && (
          <div style={{ ...S.itemTile, borderColor: "#ffd34d" }}>
            <div style={{ fontSize: 28 }}>📜</div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Recipe: {scrollItem.name}</div>
            <div style={{ fontSize: 10, color: "#ffd34d", fontWeight: 700, textTransform: "uppercase" }}>scroll · rare find</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Teaches you to craft {scrollItem.name} in the Workshop.</div>
            <button
              style={{ ...S.buyBtn, opacity: gold >= scrollPrice ? 1 : 0.4, cursor: gold >= scrollPrice ? "pointer" : "default" }}
              disabled={gold < scrollPrice}
              onClick={() => onBuyRecipe(scroll, scrollPrice)}
            >
              🪙 {scrollPrice}
            </button>
          </div>
        )}
        {stock.map((it, i) => {
          const price = priceOf(it);
          const afford = gold >= price;
          return (
            <div key={it.id + i} style={{ ...S.itemTile, borderColor: RARITY_COLOR[it.rarity] + (deep ? "" : "66") }}>
              <div style={{ fontSize: 28 }}>{it.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{it.name}</div>
              <div style={{ fontSize: 10, color: RARITY_COLOR[it.rarity], fontWeight: 700, textTransform: "uppercase" }}>
                {it.kind} · {it.rarity}
              </div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>{it.text}</div>
              <button
                style={{ ...S.buyBtn, opacity: afford ? 1 : 0.4, cursor: afford ? "pointer" : "default" }}
                disabled={!afford}
                onClick={() => onBuy(it, price)}
              >
                🪙 {price}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Mystery ----------
function Mystery({ onResolve }) {
  const [revealed, setRevealed] = useState(null);
  const options = [
    { key: "open", label: "Open the strange chest", outcomes: ["item", "gold", "hurt"] },
    { key: "drink", label: "Drink from the glowing spring", outcomes: ["heal", "hurt"] },
    { key: "pray", label: "Pray at the old shrine", outcomes: ["gold", "item", "heal"] },
  ];
  function choose(opt) {
    const outcome = opt.outcomes[Math.floor(Math.random() * opt.outcomes.length)];
    setRevealed(outcome);
    setTimeout(() => onResolve(outcome), 900);
  }
  const outcomeText = {
    item: "✨ You receive an item!",
    gold: "🪙 You find gold!",
    heal: "💚 You feel restored.",
    hurt: "💢 It was a trap! You take damage.",
  };
  return (
    <div style={S.panel}>
      <h2 style={S.h2}>❓ A Mysterious Encounter</h2>
      {!revealed ? (
        <>
          <p style={{ opacity: 0.65 }}>Something strange lies ahead. What do you do?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {options.map((o) => (
              <button key={o.key} style={S.mysteryBtn} onClick={() => choose(o)}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: 20, fontSize: 18 }} className="pulse">
          {outcomeText[revealed]}
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================

export { useViewport, Header, Title, Feat, MonsterSprite, MonsterArt, TCGCard, NPCTalk, MonstersGallery, MoveTutor, Collection, Compendium, CodexItems, CodexMechanics, CodexDetail, ItemsScreen, CraftScreen, ItemTile, maskKey, CheatPanel, StarterScreen, Generate, Wheel, Fuse, Nursery, FuseSlot, Battle, BattleCombatCard, Bar, Reward, rewardLabel, DungeonMap, RestSite, OW_TILE_COLOR, Overworld, Shop, Mystery };
