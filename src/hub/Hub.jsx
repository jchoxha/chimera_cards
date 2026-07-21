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
import '../ui/theme.css';
import './hub.css';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';
const buildUrl = (href) => `${BASE}${href}`;

/** The deployed builds/versions, newest-direction first. VERSIONS[0] = the "current" build. */
const VERSIONS = [
  { href: 'battle.html', icon: '⚔️', name: 'Chimera — the game', tag: 'current', tone: 'good',
    desc: 'The current build: a seamless open-world roguelike run — explore biomes, fight Pokémon-style simultaneous squad battles, earn card & gold rewards, capture creatures, shop in towns, and beat the boss to win the run.' },
  { href: 'app.html', icon: '🎴', name: 'Chimera v1', tag: 'v1', tone: 'info',
    desc: 'The v1 game: roguelike runs on the Vanguard/Peek combat engine, collection & team building, practice combat, the editor and codex.' },
  { href: 'editor.html', icon: '🛠️', name: 'Editor', tag: 'tool', tone: 'info',
    desc: 'Standalone card & creature editor (also reachable inside the game).' },
  { href: 'combat.html', icon: '🧪', name: 'Combat demo', tag: 'demo', tone: 'info',
    desc: 'The v1 engine combat screen as a standalone sandbox.' },
  { href: 'prototype.html', icon: '📜', name: 'Original prototype', tag: 'legacy', tone: 'muted',
    desc: 'The original single-file Claude-artifact game that started it all.' },
];
const CURRENT = VERSIONS[0];                                   // battle.html — the current build
const V1 = VERSIONS.find((v) => v.href === 'app.html');        // the v1 game

// The offline-capable Android app, built by the "Build Android APK" workflow and
// published to a rolling release (docs/offline-android.md). Direct APK link;
// resolves once the first CI build has run.
const ANDROID_APK = 'https://github.com/jchoxha/chimera_cards/releases/download/android-latest/chimera-cards.apk';

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
      <div className="hubHero">
        <h1>CHIMERA<span>CARDS</span></h1>
        <p className="hubTagline">A Pokémon × Slay-the-Spire creature deckbuilder.</p>
        <a className="hubPlay" href={buildUrl(CURRENT.href)}>▶ Play Chimera</a>
        <div className="hubHeroSub">
          <a className="hubHeroChip" href={buildUrl(V1.href)}>🎴 Play the v1 game</a>
          <a className="hubHeroChip" href={ANDROID_APK}>📥 Download for Android (offline)</a>
        </div>
        <div className="hubHeroNav">
          <a className="hubHeroTile" href="#/versions"><span>📚</span><b>Version History</b><em>Every build in one place</em></a>
          <a className="hubHeroTile" href="#/docs"><span>📖</span><b>Documentation</b><em>Design docs &amp; specs</em></a>
        </div>
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
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
  if (route.view === 'versions') return <Versions />;
  if (route.view === 'docs') return <Docs param={route.param} />;
  return <Landing />;
}
