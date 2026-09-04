// Shared vocabulary for the Knowhow canvas. Token values are lifted verbatim
// from src/app/globals.css (oklch), with hex computed for artboard use.
export const T = {
  bg:"#f4f6f8", card:"#ffffff", muted:"#ecf1f5", border:"#dfe3e8",
  fg:"#152030", mfg:"#5b6472", primary:"#193358", ring:"#5787ce",
  sidebar:"#132643", sidebarAcc:"#1f3656", sidebarFg:"#f3f5f8",
  success:"#259f56", danger:"#e23532",
  gblue:"#4183ea", ggreen:"#23aa5b", gyellow:"#f3ba25",
};

export const FONT_UI = "'Public Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const FONT_DISPLAY = "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const P = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M8 13h8M8 17h5"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  org:'<rect x="9" y="2" width="6" height="5" rx="1.5"/><rect x="2" y="17" width="6" height="5" rx="1.5"/><rect x="16" y="17" width="6" height="5" rx="1.5"/><path d="M12 7v4M5 17v-3h14v3"/>',
  activity:'<path d="M22 12h-4l-3 8-6-16-3 8H2"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  plus:'<path d="M5 12h14M12 5v14"/>',
  folder:'<path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  sheet:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  slide:'<rect x="2" y="3" width="20" height="13" rx="2"/><path d="m8 21 4-4 4 4"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  chevD:'<path d="m6 9 6 6 6-6"/>',
  chevR:'<path d="m9 6 6 6-6 6"/>',
  cornerDR:'<path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',
  userPlus:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  userMinus:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/>',
  lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  filter:'<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
  google:'<path d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.2 2.7-7.1Z"/><path d="M12 21.5c2.5 0 4.6-.8 6.2-2.2l-3.1-2.4a5.6 5.6 0 0 1-8.3-2.9H3.6v2.5A9.5 9.5 0 0 0 12 21.5Z"/><path d="M6.8 14a5.7 5.7 0 0 1 0-3.6V7.9H3.6a9.5 9.5 0 0 0 0 8.5Z"/><path d="M12 6.4c1.4 0 2.6.5 3.6 1.4l2.7-2.7A9.5 9.5 0 0 0 3.6 7.9l3.2 2.5A5.7 5.7 0 0 1 12 6.4Z"/>',
};

export function icon(name, size = 18, color = "currentColor", sw = 1.7) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
}
export function iconFilled(name, size = 18, color = "currentColor") {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" aria-hidden="true">${P[name]}</svg>`;
}

// --- Document type chips -------------------------------------------------
// Glyph color is whichever of white / navy clears 3:1 on the chip fill:
// blue 3.4:1 and green 2.9:1 carry white; brand yellow is only 1.76:1 with
// white, so Slides takes the navy glyph.
export const DOC_TYPES = {
  DOC:   { label:"Doc",   product:"Google Docs",   fill:T.gblue,   glyph:"#ffffff", icon:"file"  },
  SHEET: { label:"Sheet", product:"Google Sheets", fill:T.ggreen,  glyph:"#ffffff", icon:"sheet" },
  SLIDE: { label:"Slide", product:"Google Slides", fill:T.gyellow, glyph:T.fg,      icon:"slide" },
};
export function docChip(type, size = 28) {
  const d = DOC_TYPES[type];
  const g = Math.round(size * 0.57);
  return `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:6px;background:${d.fill};flex-shrink:0">${icon(d.icon, g, d.glyph, 1.9)}</span>`;
}

// --- Status ---------------------------------------------------------------
// Never color alone: green/red sit at deutan ΔE 4.9, so every status carries
// an icon and a word.
export function statusPill(state) {
  const map = {
    visible:  { bg:"#e7f4ec", fg:"#166b3a", ic:"check", tx:"Visible to you" },
    hidden:   { bg:"#fdeceb", fg:"#a52320", ic:"alert", tx:"Not shared" },
    everyone: { bg:"#e8effb", fg:"#1e4b96", ic:"users", tx:"Everyone"  },
    private:  { bg:T.muted,   fg:T.mfg,     ic:"lock",  tx:"Private"   },
  }[state];
  return `<span style="display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 9px;border-radius:999px;background:${map.bg};color:${map.fg};font-size:12px;font-weight:600;white-space:nowrap">${icon(map.ic, 12, map.fg, 2.1)}${map.tx}</span>`;
}

export function avatar(initials, size = 28, bg = T.primary, fg = "#ffffff") {
  return `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:999px;background:${bg};color:${fg};font-size:${Math.round(size*0.38)}px;font-weight:700;flex-shrink:0;letter-spacing:0.02em">${initials}</span>`;
}

export function btn(label, variant = "default", opts = {}) {
  const h = opts.size === "lg" ? 36 : opts.size === "sm" ? 28 : 32;
  const px = opts.size === "lg" ? 14 : opts.size === "sm" ? 10 : 12;
  const fs = opts.size === "sm" ? 12.8 : 13.5;
  const styles = {
    default:`background:linear-gradient(180deg,${T.primary},#132a4a);color:#fff;border:1px solid transparent;box-shadow:0 1px 2px rgba(0,0,0,.08),0 4px 12px rgba(0,0,0,.10),inset 0 1px 0 rgba(255,255,255,.12)`,
    outline:`background:${T.card};color:${T.fg};border:1px solid ${T.border}`,
    secondary:`background:${T.muted};color:${T.primary};border:1px solid transparent`,
    ghost:`background:transparent;color:${T.mfg};border:1px solid transparent`,
    danger:`background:#fdeceb;color:#a52320;border:1px solid transparent`,
  }[variant];
  const ic = opts.icon ? icon(opts.icon, 14, "currentColor", 2) : "";
  return `<span style="display:inline-flex;align-items:center;justify-content:center;gap:6px;height:${h}px;padding:0 ${px}px;border-radius:999px;font-family:${FONT_UI};font-size:${fs}px;font-weight:600;white-space:nowrap;${styles}">${ic}${label}</span>`;
}

export function card(inner, extra = "") {
  return `<div style="background:${T.card};border:1px solid ${T.border};border-radius:14px;${extra}">${inner}</div>`;
}

export function h2(text, sub) {
  return `<div style="display:flex;flex-direction:column;gap:2px">
    <h2 style="margin:0;font-family:${FONT_DISPLAY};font-size:15px;font-weight:700;color:${T.fg};letter-spacing:-0.01em">${text}</h2>
    ${sub ? `<p style="margin:0;font-size:12.5px;color:${T.mfg}">${sub}</p>` : ""}
  </div>`;
}

// --- Brand ---------------------------------------------------------------
export function logo(size = 20, color = T.fg) {
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-family:${FONT_DISPLAY};font-weight:800;font-size:${size}px;color:${color};letter-spacing:-0.03em">Kn<span style="position:relative;display:inline-block;width:${size}px;height:${size}px">
    <span style="position:absolute;left:0;right:0;top:0;height:38%;border-radius:3px;background:${T.gblue}"></span>
    <span style="position:absolute;left:0;top:44%;width:48%;height:24%;border-radius:2px 0 0 2px;background:${T.ggreen}"></span>
    <span style="position:absolute;right:0;top:44%;width:48%;height:24%;border-radius:0 2px 2px 0;background:${T.gyellow}"></span>
    <span style="position:absolute;left:0;right:0;bottom:0;height:24%;border-radius:2px;background:${T.danger}"></span>
  </span>how</span>`;
}

// --- App shell -----------------------------------------------------------
const OWNER_NAV = [
  { id:"home",     label:"Home",         ic:"grid" },
  { id:"docs",     label:"Documents",    ic:"file", kids:["All documents","Shared with me","My documents","Drive folders"] },
  { id:"vis",      label:"Visibility",   ic:"eye",  badge:"15" },
  { id:"org",      label:"Organization", ic:"org",  kids:["Org chart","Marketing","Sales","Product"] },
  { id:"activity", label:"Activity",     ic:"activity" },
  { id:"settings", label:"Settings",     ic:"settings" },
];
const MEMBER_NAV = [
  { id:"home",     label:"Home",       ic:"grid" },
  { id:"docs",     label:"Documents",  ic:"file", kids:["Shared with me","My documents"] },
  { id:"org",      label:"My team",    ic:"users", kids:["Marketing"] },
  { id:"activity", label:"Activity",   ic:"activity" },
];

export function sidebar({ active, role = "OWNER", user = { name:"Jordan Blake", sub:"Organization Owner", initials:"JB" }, openGroup = null, activeChild = null }) {
  const nav = role === "OWNER" ? OWNER_NAV : MEMBER_NAV;
  const items = nav.map((n) => {
    const on = n.id === active;
    const row = `<div style="display:flex;align-items:center;gap:10px;height:34px;padding:0 10px;border-radius:8px;background:${on ? T.sidebarAcc : "transparent"};color:${on ? "#fff" : "rgba(243,245,248,.72)"};font-size:13.5px;font-weight:${on ? 600 : 500}">
      ${icon(n.ic, 17, "currentColor", 1.7)}
      <span style="flex-grow:1">${n.label}</span>
      ${n.badge ? `<span style="display:flex;align-items:center;justify-content:center;min-width:20px;height:19px;padding:0 6px;border-radius:999px;background:${T.danger};color:#fff;font-size:11px;font-weight:700">${n.badge}</span>` : ""}
      ${n.kids ? icon(openGroup === n.id ? "chevD" : "chevR", 14, "rgba(243,245,248,.45)", 2) : ""}
    </div>`;
    const kids = n.kids && openGroup === n.id
      ? `<div style="display:flex;flex-direction:column;gap:1px;margin:1px 0 2px">${n.kids.map((k) => {
          const kon = k === activeChild;
          return `<div style="display:flex;align-items:center;height:30px;padding:0 10px 0 38px;border-radius:8px;background:${kon ? "rgba(255,255,255,.09)" : "transparent"};color:${kon ? "#fff" : "rgba(243,245,248,.62)"};font-size:13px;font-weight:${kon ? 600 : 400}">${k}</div>`;
        }).join("")}</div>`
      : "";
    return row + kids;
  }).join("");

  return `<aside style="display:flex;flex-direction:column;width:236px;flex-shrink:0;background:${T.sidebar};padding:18px 12px 14px">
    <div style="padding:0 8px 20px">${logo(19, "#fff")}</div>
    <nav style="display:flex;flex-direction:column;gap:2px;flex-grow:1">${items}</nav>
    <div style="display:flex;align-items:center;gap:9px;padding-top:12px;margin-top:8px;border-top:1px solid rgba(255,255,255,.12)">
      ${avatar(user.initials, 30, "rgba(255,255,255,.14)", "#fff")}
      <div style="flex-grow:1;min-width:0">
        <p style="margin:0;font-size:13px;font-weight:600;color:#fff">${user.name}</p>
        <p style="margin:0;font-size:11.5px;color:rgba(243,245,248,.55)">${user.sub}</p>
      </div>
      ${icon("logout", 16, "rgba(243,245,248,.55)", 1.8)}
    </div>
  </aside>`;
}

export function topbar(title, sub, right = "") {
  return `<div style="display:flex;align-items:flex-start;gap:20px;padding:22px 28px 0">
    <div style="flex-grow:1">
      <h1 style="margin:0;font-family:${FONT_DISPLAY};font-size:22px;font-weight:800;color:${T.fg};letter-spacing:-0.02em">${title}</h1>
      ${sub ? `<p style="margin:4px 0 0;font-size:13.5px;color:${T.mfg}">${sub}</p>` : ""}
    </div>
    ${right}
  </div>`;
}

export function searchField(placeholder = "Search every document in your Workspace…", width = 420) {
  return `<div style="display:flex;align-items:center;gap:9px;width:${width}px;height:36px;padding:0 14px;border-radius:999px;background:${T.card};border:1px solid ${T.border}">
    ${icon("search", 16, T.mfg, 1.8)}<span style="font-size:13.5px;color:#8d95a1">${placeholder}</span>
  </div>`;
}

export function page({ title, w = 1440, h, body, bg = T.bg, font = FONT_UI }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Public+Sans:wght@400;500;600;700&display=swap">
  <style>
    body { margin: 0; font-family: ${font}; -webkit-font-smoothing: antialiased; }
    * { box-sizing: border-box; }
    a { color: ${T.ring}; text-decoration: none; }
    a:hover { color: ${T.primary}; }
    p, h1, h2, h3 { text-wrap: pretty; }
  </style>
</helmet>
<div style="width:${w}px;${h ? `min-height:${h}px;` : ""}background:${bg};font-family:${font};color:${T.fg}">
${body}
</div>
</x-dc>
</body>
</html>
`;
}
