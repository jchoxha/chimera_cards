// Smoke test for auto-derived card upgrades. Run: test:upgrade
import { deriveUpgrade, upgradeFor, upgradedPreview } from './upgrade.js';

let pass = 0, fail = 0;
const ok = (c, m) => (c ? (pass++, console.log('  ✓', m)) : (fail++, console.error('  ✗', m)));

{ const up = deriveUpgrade({ name: 'Bite', cost: 1, effects: [{ op: 'damage', value: 8 }] });
  ok(up.effects[0].value === 11, `single-hit damage +3 (${up.effects[0].value})`); }
{ const up = deriveUpgrade({ name: 'Rake', cost: 1, effects: [{ op: 'damage', value: 4, hits: 2 }] });
  ok(up.effects[0].value === 6 && up.effects[0].hits === 2, `multi-hit damage +2, hits kept (${up.effects[0].value}×${up.effects[0].hits})`); }
{ const up = deriveUpgrade({ name: 'Shell Up', cost: 1, effects: [{ op: 'block', value: 8, brace: true }] });
  ok(up.effects[0].value === 11 && up.effects[0].brace === true, 'block +3, brace kept'); }
{ const up = deriveUpgrade({ name: 'Infest', cost: 1, effects: [{ op: 'debuff', status: 'poison', value: 4 }] });
  ok(up.effects[0].value === 5, 'status +1'); }
{ const up = deriveUpgrade({ name: 'Bristle', cost: 1, type: 'power', trigger: { on: 'onDamageTaken', effects: [{ op: 'damage', value: 3 }] } });
  ok(up.trigger.effects[0].value === 6 && up.trigger.on === 'onDamageTaken', 'power trigger effects grow'); }
{ const up = deriveUpgrade({ name: 'Stance', cost: 2, effects: [{ op: 'stance', set: 'Rampage' }] });
  ok(up.cost === 1, 'nothing numeric → cost −1'); }
{ const up = deriveUpgrade({ name: 'Free Util', cost: 0, effects: [{ op: 'stance', set: 'Rampage' }] });
  ok(up === null, 'cost 0 + nothing numeric → un-upgradable'); }
{ const authored = { name: 'Strike', cost: 1, effects: [{ op: 'damage', value: 6 }], upgrade: { effects: [{ op: 'damage', value: 9 }] } };
  ok(upgradeFor(authored) === authored.upgrade, 'hand-authored payload wins'); }
{ const p = upgradedPreview({ name: 'Bite', cost: 1, effects: [{ op: 'damage', value: 8 }] });
  ok(p.name === 'Bite+' && p.upgraded === true && p.effects[0].value === 11, 'preview renames + applies'); }
{ // original card is never mutated
  const card = { name: 'Bite', cost: 1, effects: [{ op: 'damage', value: 8 }] };
  deriveUpgrade(card); upgradedPreview(card);
  ok(card.effects[0].value === 8 && card.name === 'Bite', 'derivation is pure'); }

console.log(`\nupgrade: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
