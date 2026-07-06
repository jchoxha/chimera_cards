// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/combat/CombatFx — the spring-physics "juice" layer for moves.  ║
// ║ A fixed overlay fed a queue of FX descriptors (built in CombatScreen from ║
// ║ the combat log). Renders, on @react-spring:                               ║
// ║  • PROJECTILE — a glowing bolt that flies attacker→target (element-tinted) ║
// ║    and bursts on arrival;                                                  ║
// ║  • BURST — an expanding impact ring at the target;                        ║
// ║  • NUM — a damage/heal/block number that pops (spring scale) then rises.   ║
// ║ Card recoil / attacker lunge / hit-flash are done imperatively (WAAPI) in ║
// ║ CombatScreen on the units' `[data-drop-id]` nodes — see there.            ║
// ╚══════════════════════════════════════════════════════════════════╝
import React from 'react';
import { useSpring, animated } from '@react-spring/web';

function Projectile({ x0, y0, x1, y1, color }) {
  const s = useSpring({
    from: { x: x0, y: y0, sc: 0.3, op: 0 },
    to: async (next) => {
      await next({ op: 1, sc: 1, config: { duration: 70 } });
      await next({ x: x1, y: y1, config: { tension: 260, friction: 20 } });   // arc to target
      await next({ sc: 1.9, op: 0, config: { duration: 130 } });               // burst on impact
    },
  });
  return (
    <animated.div className="fxProj"
      style={{ x: s.x, y: s.y, scale: s.sc, opacity: s.op,
        background: `radial-gradient(circle at 50% 50%, #fff, ${color} 55%, transparent 72%)`,
        boxShadow: `0 0 14px ${color}, 0 0 26px ${color}` }} />
  );
}

function Burst({ x, y, color, delay }) {
  const s = useSpring({ from: { sc: 0.2, op: 0.85 }, to: { sc: 1.9, op: 0 }, delay, config: { tension: 210, friction: 22 } });
  return <animated.div className="fxBurst" style={{ left: x, top: y, scale: s.sc, opacity: s.op, borderColor: color }} />;
}

function Num({ x, y, text, kind, delay }) {
  const s = useSpring({
    from: { sc: 0, ny: 0, op: 0 },
    to: async (next) => {
      await next({ sc: 1.28, op: 1, config: { tension: 420, friction: 11 } });   // pop
      await next({ sc: 1, config: { tension: 300, friction: 16 } });
      await next({ ny: -52, op: 0, config: { tension: 70, friction: 18 } });       // drift up + fade
    },
    delay,
  });
  return (
    <animated.span className={`floatNum ${kind}`}
      style={{ left: x, top: y, scale: s.sc, y: s.ny, opacity: s.op }}>{text}</animated.span>
  );
}

export default function CombatFx({ items = [] }) {
  if (!items.length) return null;
  return (
    <div className="combatFx">
      {items.map((it) => {
        if (it.type === 'proj') return <Projectile key={it.key} x0={it.x0} y0={it.y0} x1={it.x1} y1={it.y1} color={it.color} />;
        if (it.type === 'burst') return <Burst key={it.key} x={it.x} y={it.y} color={it.color} delay={it.delay || 0} />;
        if (it.type === 'num') return <Num key={it.key} x={it.x} y={it.y} text={it.text} kind={it.kind} delay={it.delay || 0} />;
        return null;
      })}
    </div>
  );
}
