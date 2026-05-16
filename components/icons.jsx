'use client';

// Minimal line-icon set for TeamBridge. 1.5 stroke, currentColor.

function Icon({ size = 18, viewBox = "0 0 24 24", children, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox={viewBox} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest}
    >
      {children}
    </svg>
  );
}

export function IconHome({ size = 18 }) {
  return <Icon size={size}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></Icon>;
}

export function IconCalendar({ size = 18 }) {
  return <Icon size={size}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></Icon>;
}

export function IconChat({ size = 18 }) {
  return <Icon size={size}><path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/></Icon>;
}

export function IconCheck({ size = 18 }) {
  return <Icon size={size}><path d="M4 12.5l5 5 11-11"/></Icon>;
}

export function IconTactics({ size = 18 }) {
  return <Icon size={size}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.5 5.5L18.5 18.5M18.5 5.5L5.5 18.5"/></Icon>;
}

export function IconMega({ size = 18 }) {
  return <Icon size={size}><path d="M3 11v2l13 5V6L3 11zM18 9v6"/></Icon>;
}

export function IconPlane({ size = 18 }) {
  return <Icon size={size}><path d="M3 14l8-2 4-9 2 1-2 9 8 4v2l-9-2-3 6h-2l-1-5-5-1z"/></Icon>;
}

export function IconHeart({ size = 18 }) {
  return <Icon size={size}><path d="M12 20s-7-4.5-9-9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 9 4.5C19 15.5 12 20 12 20z"/></Icon>;
}

export function IconChart({ size = 18 }) {
  return <Icon size={size}><path d="M3 21h18M6 17V9M11 17V5M16 17v-6M21 17v-9"/></Icon>;
}

export function IconStats({ size = 18 }) {
  return <Icon size={size}><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 6-7"/></Icon>;
}

export function IconUsers({ size = 18 }) {
  return <Icon size={size}><circle cx="9" cy="8" r="3"/><path d="M2 21c.5-3.5 3.5-6 7-6s6.5 2.5 7 6"/><circle cx="17" cy="6" r="2.5"/><path d="M16 14c3 .3 5 2.4 5.5 5"/></Icon>;
}

export function IconBell({ size = 18 }) {
  return <Icon size={size}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>;
}

export function IconSearch({ size = 18 }) {
  return <Icon size={size}><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></Icon>;
}

export function IconArrow({ size = 14 }) {
  return <Icon size={size}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>;
}

export function IconWarn({ size = 16 }) {
  return <Icon size={size}><path d="M12 3l10 17H2L12 3z"/><path d="M12 10v5M12 18.5h0"/></Icon>;
}

export function IconClock({ size = 14 }) {
  return <Icon size={size}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
}

export function IconPin({ size = 14 }) {
  return <Icon size={size}><path d="M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></Icon>;
}

export function IconPlay({ size = 14 }) {
  return <Icon size={size}><path d="M7 5l12 7-12 7V5z"/></Icon>;
}

export function IconPlus({ size = 14 }) {
  return <Icon size={size}><path d="M12 5v14M5 12h14"/></Icon>;
}

export function IconMore({ size = 16 }) {
  return <Icon size={size}><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></Icon>;
}

export function IconRefresh({ size = 14 }) {
  return <Icon size={size}><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></Icon>;
}

export function IconActivity({ size = 18 }) {
  return <Icon size={size}><path d="M3 12h4l3-7 4 14 3-7h4"/></Icon>;
}
