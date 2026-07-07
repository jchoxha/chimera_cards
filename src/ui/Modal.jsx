// ╔══════════════════════════════════════════════════════════════════╗
// ║ MODULE: ui/Modal — THE shared modal primitive. Backdrop click-to-close, ║
// ║ an ✕ button, an optional gilded title row. Styled by the `.ui*` classes  ║
// ║ in ui/theme.css. Use this for every dialog instead of hand-rolling an     ║
// ║ overlay/close button (see docs/ui-conventions.md). Legacy bespoke modals  ║
// ║ (select/run/combat) are being migrated onto it.                           ║
// ╚══════════════════════════════════════════════════════════════════╝
import React from 'react';

const Icon = ({ icon }) => <iconify-icon icon={icon}></iconify-icon>;

/**
 * @param {object}   props
 * @param {()=>void} props.onClose        backdrop / ✕ handler
 * @param {React.ReactNode} [props.title] optional heading (string or node)
 * @param {string}   [props.icon]         optional iconify icon beside the title
 * @param {'sm'|'md'|'lg'} [props.size]   width preset (default md)
 * @param {string}   [props.className]    extra classes on the modal box
 * @param {React.ReactNode} props.children
 */
export default function Modal({ onClose, title, icon, size = 'md', className = '', children }) {
  return (
    <div className="uiOverlay" onClick={onClose}>
      <div className={`uiModal ${size} ${className}`} onClick={(e) => e.stopPropagation()}>
        <button className="uiModalClose" onClick={onClose} aria-label="Close">✕</button>
        {title != null && <h2 className="uiModalHead">{icon && <Icon icon={icon} />}{title}</h2>}
        {children}
      </div>
    </div>
  );
}
