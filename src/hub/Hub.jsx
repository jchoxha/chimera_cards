// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: hub/Hub — the Dev Hub SPA at the base URL. Three hash-routed      ║
// ║ views sharing one URL: a LANDING that links straight to the current       ║
// ║ build (#/), a VERSIONS page listing every build (#/versions), and a       ║
// ║ DOCUMENTATION browser (#/docs, deep-linkable #/docs/<slug>). Docs are      ║
// ║ bundled at build time (import.meta.glob + marked). Hash routing works on   ║
// ║ static GH Pages with no server config.                                     ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useEffect, useMemo, useState } from 'react';
import { marked } from 'marked';
import AiSettings from '../ai/AiSettings.jsx';
import GameMenu from './GameMenu.jsx';
import { isNativeShell } from '../ai/provider.js';
import '../ui/theme.css';
import './hub.css';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
const buildUrl = (href) => `${BASE}${href}`;

/** The deployed builds/pages, newest-direction first. VERSIONS[0] = the "current" build. */
const VERSIONS = [
  { href: 'battle.html', icon: '⚔️', name: 'Chimera — the game', tag: 'current', tone: 'good', sub: 'The current build',
    desc: 'The current build: a seamless open-world roguelike run — explore biomes, fight Pokémon-style simultaneous squad battles, earn card & gold rewards, capture creatures, shop in towns, and beat the boss to win the run.' },
  { href: 'app.html', icon: '🎴', name: 'Chimera v1', tag: 'v1', tone: 'info', sub: 'The v1 game',
    desc: 'The v1 game: roguelike runs on the Vanguard/Peek combat engine, collection & team building, practice combat, the editor and codex.' },
  { href: 'lab.html', icon: '🧬', name: 'Creature Lab', tag: 'tool', tone: 'good', sub: 'Generation & fusion testbed',
    desc: 'Dynamic creature generation + seamless fusion testbed: spin the wheels for rarity/form/evolutions, describe a creature in plain text to set its identity, then fuse any two creatures into a new one (order matters).' },
  { href: 'anim-preview.html', icon: '🎬', name: 'Animation Viewer', tag: 'tool', tone: 'good', sub: 'Preview creature animations',
    desc: 'Preview generated creature animation sheets — loop every direction and drive the sprite around a field with the arrow keys / WASD. New animations appear automatically as they are baked.' },
  { href: 'editor.html', icon: '🛠️', name: 'Editor', tag: 'tool', tone: 'info', sub: 'Cards & creatures',
    desc: 'Standalone card & creature editor (also reachable inside the game).' },
  { href: 'combat.html', icon: '🧪', name: 'Combat demo', tag: 'demo', tone: 'info', sub: 'v1 engine sandbox',
    desc: 'The v1 engine combat screen as a standalone sandbox.' },
  { href: 'prototype.html', icon: '📜', name: 'Original prototype', tag: 'legacy', tone: 'muted', sub: 'The original artifact',
    desc: 'The original single-file Claude-artifact game that started it all.' },
];
const CURRENT = VERSIONS[0];                                   // battle.html — the current build

// Hash-routed hub views + the offline Android build, shown as tiles alongside the pages.
const ANDROID_APK_TILE = { href: 'https://github.com/jchoxha/chimera_cards/releases/download/android-latest/chimera-cards.apk', icon: '📥', name: 'Android APK', sub: 'Offline build', external: true };
const HUB_TILES = [
  { hash: '#/versions', icon: '📚', name: 'Version History', sub: 'Every build in one place' },
  { hash: '#/docs', icon: '📖', name: 'Documentation', sub: 'Design docs & specs' },
];

// Bundle every doc as raw text at build time (docs/*.md + root-level *.md).
const rawDocs = import.meta.glob(['../../docs/*.md', '../../*.md'], { query: '?raw', import: 'default', eager: true });
const PIN = ['game-overview', 'combat-v2-spec', 'combat-engine-spec', 'mechanics', 'synthesis-matrix-spec', 'biology-kits', 'archetype-design', 'hybrid-design', 'CLAUDE', 'README'];
const prettySlug = (s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const headingOf = (content) => { const m = content.match(/^#\s+(.+)$/m); return m ? m[1].replace(/[*_`]/g, '').trim() : ''; };
function titleOf(content, slug) {
  if (slug === 'CLAUDE') return 'CLAUDE.md — project state log';
  const h = headingOf(content);
  return (!h || /^chimera cards$/i.test(h)) ? prettySlug(slug) : h;
}
const DOCS = Object.entries(rawDocs).map(([path, content]) => {
  const file = path.split('/').pop();
  const slug = file.replace(/\.md$/, '');
  return { slug, file, title: titleOf(content, slug), content };
}).sort((a, b) => {
  const pa = PIN.indexOf(a.slug), pb = PIN.indexOf(b.slug);
  if (pa >= 0 || pb >= 0) return (pa < 0 ? 999 : pa) - (pb < 0 ? 999 : pb);
  return a.file.localeCompare(b.file);
});

function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const [view, ...rest] = h.split('/');
  return { view: view || 'home', param: rest.join('/') };
}

/** Slim top bar shown on the Versions + Docs views. */
function HubNav({ view }) {
  return (
    <nav className="hubNav">
      <a className="hubBrand" href="#/">Chimera <span className="hubDim">· Dev Hub</span></a>
      <div className="hubNavLinks">
        <a className={`hubNavLink${view === 'home' ? ' on' : ''}`} href="#/">Home</a>
        <a className={`hubNavLink${view === 'versions' ? ' on' : ''}`} href="#/versions">Versions</a>
        <a className={`hubNavLink${view === 'docs' ? ' on' : ''}`} href="#/docs">Docs</a>
        <a className="hubNavLink play" href={buildUrl(CURRENT.href)}>▶ Play</a>
      </div>
    </nav>
  );
}

function Landing() {
  return (
    <div className="hubLanding">
      <div className="hubHero hubHome">
        <h1>CHIMERA<span>CARDS</span></h1>
        <p className="hubTagline">A Pokémon × Slay-the-Spire creature deckbuilder.</p>
        <nav className="hubHeroNav hubHomeGrid">
          {VERSIONS.map((v) => (
            <a key={v.href} className={`hubHeroTile${v.tag === 'current' ? ' on' : ''}`} href={buildUrl(v.href)}>
              <span>{v.icon}</span><b>{v.name}</b><em>{v.sub}</em>
            </a>
          ))}
          {HUB_TILES.map((t) => (
            <a key={t.hash} className="hubHeroTile" href={t.hash}><span>{t.icon}</span><b>{t.name}</b><em>{t.sub}</em></a>
          ))}
          <a className="hubHeroTile" href={ANDROID_APK_TILE.href}><span>{ANDROID_APK_TILE.icon}</span><b>{ANDROID_APK_TILE.name}</b><em>{ANDROID_APK_TILE.sub}</em></a>
        </nav>
        <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center' }}>
          <AiSettings />
        </div>
      </div>
      <footer className="hubFoot">The base URL for the Chimera Cards project · builds deploy here on every push to <code>main</code>.</footer>
    </div>
  );
}

function Versions() {
  return (
    <div className="hubPage">
      <HubNav view="versions" />
      <div className="hubBody">
        <header className="hubPageHead"><h2>Version History</h2><p>Every deployed build of the project.</p></header>
        <section className="hubVersions">
          {VERSIONS.map((v) => (
            <a key={v.href} className="hubCard" href={buildUrl(v.href)}>
              <div className="hubCardIcon">{v.icon}</div>
              <div className="hubCardBody">
                <div className="hubCardName">{v.name} <span className={`hubTag ${v.tone}`}>{v.tag}</span></div>
                <div className="hubCardDesc">{v.desc}</div>
                <div className="hubCardUrl">/{v.href}</div>
              </div>
            </a>
          ))}
        </section>
      </div>
    </div>
  );
}

function Docs({ param }) {
  const initial = DOCS.find((d) => d.slug === param)?.slug || DOCS[0]?.slug || null;
  const [active, setActive] = useState(initial);
  useEffect(() => { const s = DOCS.find((d) => d.slug === param); if (s) setActive(s.slug); }, [param]);
  const doc = DOCS.find((d) => d.slug === active);
  const html = useMemo(() => (doc ? marked.parse(doc.content, { gfm: true, breaks: false }) : ''), [doc]);
  return (
    <div className="hubPage">
      <HubNav view="docs" />
      <div className="hubBody">
        <section className="hubDocs">
          <aside className="hubDocList">
            <div className="hubDocHead">Documentation <em>{DOCS.length}</em></div>
            {DOCS.map((d) => (
              <a key={d.slug} className={`hubDocLink${d.slug === active ? ' on' : ''}`} href={`#/docs/${d.slug}`}
                onClick={() => setActive(d.slug)} title={d.file}>{d.title}</a>
            ))}
          </aside>
          <article className="hubDocView">
            {doc
              ? <>
                  <div className="hubDocMeta"><span className="hubDocFile">{doc.file}</span></div>
                  <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
                </>
              : <p className="hubEmpty">No documents found.</p>}
          </article>
        </section>
      </div>
    </div>
  );
}

export default function Hub() {
  const [route, setRoute] = useState(parseHash);
  useEffect(() => {
    const onHash = () => { setRoute(parseHash()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // The Android app shows a clean, game-only menu — never the dev hub (versions/docs/builds).
  if (isNativeShell()) return <GameMenu />;
  if (route.view === 'versions') return <Versions />;
  if (route.view === 'docs') return <Docs param={route.param} />;
  return <Landing />;
}
