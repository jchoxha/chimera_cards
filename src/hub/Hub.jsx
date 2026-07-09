// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: hub/Hub — the Dev Hub landing page at the base URL. Lists every   ║
// ║ deployed BUILD (app / battle / editor / combat / prototype) and renders    ║
// ║ every design DOC (docs/*.md + root *.md, bundled at build time via         ║
// ║ import.meta.glob + marked). Self-contained; deploys with the site.         ║
// ╚══════════════════════════════════════════════════════════════════╝
import React, { useMemo, useState } from 'react';
import { marked } from 'marked';
import '../ui/theme.css';
import './hub.css';

const BASE = (import.meta.env && import.meta.env.BASE_URL) || '/';

/** The deployed builds/versions, newest-direction first. */
const VERSIONS = [
  { href: 'app.html', icon: '🎴', name: 'Chimera — the game (v1)', tag: 'live', tone: 'good',
    desc: 'The playable game: roguelike runs, collection & team building, practice combat, the editor and codex. Runs on the v1 Vanguard/Peek combat engine.' },
  { href: 'battle.html', icon: '⚔️', name: 'Squad Battle (v2)', tag: 'in progress', tone: 'warn',
    desc: 'The combat-v2 rebuild — Pokémon-style simultaneous blind-commit squad battles. Early prototype (demo cards + placeholder AI).' },
  { href: 'editor.html', icon: '🛠️', name: 'Editor', tag: 'tool', tone: 'info',
    desc: 'Standalone card & creature editor (also reachable inside the game).' },
  { href: 'combat.html', icon: '🧪', name: 'Combat demo', tag: 'demo', tone: 'info',
    desc: 'The v1 engine combat screen as a standalone sandbox.' },
  { href: 'prototype.html', icon: '📜', name: 'Original prototype', tag: 'legacy', tone: 'muted',
    desc: 'The original single-file Claude-artifact game that started it all.' },
];

// Bundle every doc as raw text at build time (docs/*.md + root-level *.md).
const rawDocs = import.meta.glob(['../../docs/*.md', '../../*.md'], { query: '?raw', import: 'default', eager: true });
const PIN = ['game-overview', 'combat-v2-spec', 'combat-engine-spec', 'mechanics', 'synthesis-matrix-spec', 'biology-kits', 'CLAUDE', 'README'];
const prettySlug = (s) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const headingOf = (content) => { const m = content.match(/^#\s+(.+)$/m); return m ? m[1].replace(/[*_`]/g, '').trim() : ''; };
function titleOf(content, slug) {
  if (slug === 'CLAUDE') return 'CLAUDE.md — project state log';
  const h = headingOf(content);
  // fall back to a prettified filename when the heading is missing or too generic to disambiguate.
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

export default function Hub() {
  const [active, setActive] = useState(DOCS[0]?.slug || null);
  const doc = DOCS.find((d) => d.slug === active);
  const html = useMemo(() => (doc ? marked.parse(doc.content, { gfm: true, breaks: false }) : ''), [doc]);

  return (
    <div className="hub">
      <header className="hubHead">
        <h1>Chimera Cards <span className="hubDim">· Dev Hub</span></h1>
        <p>Every build and design document in one place.</p>
      </header>

      <section className="hubVersions">
        {VERSIONS.map((v) => (
          <a key={v.href} className="hubCard" href={`${BASE}${v.href}`}>
            <div className="hubCardIcon">{v.icon}</div>
            <div className="hubCardBody">
              <div className="hubCardName">{v.name} <span className={`hubTag ${v.tone}`}>{v.tag}</span></div>
              <div className="hubCardDesc">{v.desc}</div>
            </div>
          </a>
        ))}
      </section>

      <section className="hubDocs">
        <aside className="hubDocList">
          <div className="hubDocHead">Documentation <em>{DOCS.length}</em></div>
          {DOCS.map((d) => (
            <button key={d.slug} className={`hubDocLink${d.slug === active ? ' on' : ''}`} onClick={() => setActive(d.slug)}
              title={d.file}>{d.title}</button>
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
  );
}
