import { writeFileSync } from "fs";
import { T, FONT_UI, FONT_DISPLAY, icon, docChip, statusPill, avatar, btn, logo, page, sidebar, topbar, searchField } from "./lib.mjs";
import { shell, sec, cardBox, statTile, coverageBar, tabs, docRow, docHead, td, th } from "./ui.mjs";

/* ---------------------------------------------------------------- LOGIN */
const doodle = (x, y, r, s, p) => `<div style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${r}deg);opacity:.13">${icon(p, s, T.primary, 1.2)}</div>`;
writeFileSync("Login.dc.html", page({ title:"Login", w:1200, h:820, body:`
<div style="position:relative;min-height:820px;display:flex;align-items:center;justify-content:center;overflow:hidden">
  ${doodle(120,110,-12,64,"file")}${doodle(300,560,8,52,"sheet")}${doodle(980,150,14,58,"org")}
  ${doodle(1040,600,-8,50,"folder")}${doodle(200,340,4,40,"search")}${doodle(900,400,-16,44,"slide")}
  <div style="position:relative;width:396px;padding:36px 34px 30px;background:${T.card};border:1px solid ${T.border};border-radius:20px;box-shadow:0 1px 2px rgba(21,32,48,.04),0 12px 32px rgba(21,32,48,.07)">
    <div style="display:flex;justify-content:center;margin-bottom:20px">${logo(23)}</div>
    <h1 style="margin:0;text-align:center;font-family:${FONT_DISPLAY};font-size:20px;font-weight:800;color:${T.fg};letter-spacing:-0.02em">Sign in to Knowhow</h1>
    <p style="margin:6px 0 24px;text-align:center;font-size:13.5px;color:${T.mfg}">Every document, visible to the people who need it.</p>
    <div style="display:flex;flex-direction:column;gap:15px">
      <div><p style="margin:0 0 6px;font-size:12.5px;font-weight:600;color:${T.fg}">Work Email</p>
        <div style="display:flex;align-items:center;height:36px;padding:0 12px;border-radius:9px;border:1px solid ${T.border};font-size:13.5px;color:#8d95a1">jane.doe@company.com</div></div>
      <div><p style="margin:0 0 6px;font-size:12.5px;font-weight:600;color:${T.fg}">Password</p>
        <div style="display:flex;align-items:center;height:36px;padding:0 12px;border-radius:9px;border:1px solid ${T.border};font-size:15px;letter-spacing:.18em;color:${T.mfg}">••••••••</div></div>
      <div style="display:flex;align-items:center;justify-content:center;height:38px;border-radius:999px;background:linear-gradient(180deg,${T.primary},#132a4a);color:#fff;font-size:14px;font-weight:700;box-shadow:0 1px 2px rgba(0,0,0,.08),0 6px 16px rgba(25,51,88,.22)">Sign In</div>
      <p style="margin:-3px 0 0;text-align:center;font-size:12.8px;color:${T.mfg}">Forgot password?</p>
      <div style="display:flex;align-items:center;gap:12px"><span style="flex-grow:1;height:1px;background:${T.border}"></span><span style="font-size:11.5px;color:#98a0ab">or</span><span style="flex-grow:1;height:1px;background:${T.border}"></span></div>
      <div style="display:flex;align-items:center;justify-content:center;gap:9px;height:38px;border-radius:999px;border:1px solid ${T.border};background:${T.card};font-size:13.5px;font-weight:600;color:${T.fg}">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14.1a6 6 0 0 1 0-3.8V7.7H3.2a10 10 0 0 0 0 9Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 3.2 7.7l3.3 2.6A5.9 5.9 0 0 1 12 6.1Z"/></svg>
        Sign in with Google</div>
      <p style="margin:0;text-align:center;font-size:12.8px;color:${T.mfg}">Or use <span style="font-weight:700;color:${T.fg}">Single Sign-On</span></p>
    </div>
    <p style="margin:24px 0 0;text-align:center;font-size:12.8px;color:${T.mfg}">Don't have an account? <span style="font-weight:700;color:${T.fg}">Sign up</span></p>
  </div>
</div>`}));

/* ------------------------------------------------------------ ORG CHART */
function personRow(name, initials, role, extra = "") {
  return `<div style="display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:9px;background:${T.muted}">
    ${avatar(initials, 26, "#c9d3e0", T.primary)}
    <span style="flex-grow:1;min-width:0"><span style="display:block;font-size:12.8px;font-weight:600;color:${T.fg}">${name}</span>
    ${role ? `<span style="display:block;font-size:11px;color:${T.mfg}">${role}</span>` : ""}</span>${extra}</div>`;
}
function teamCard(name, leader, li, members) {
  return `<div style="width:286px;background:${T.card};border:1px solid ${T.border};border-radius:14px;overflow:hidden">
    <div style="display:flex;height:4px">${[T.gblue,T.ggreen,T.gyellow,T.danger].map((c) => `<span style="flex-grow:1;background:${c}"></span>`).join("")}</div>
    <div style="padding:14px 15px 15px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:11px">
        <h3 style="margin:0;font-family:${FONT_DISPLAY};font-size:14.5px;font-weight:800;color:${T.fg}">${name}</h3>
        <span style="font-size:11.5px;color:${T.mfg}">${members.length + 1} people</span></div>
      ${personRow(leader, li, "Team leader", `<span style="display:inline-flex;align-items:center;height:19px;padding:0 8px;border-radius:999px;background:#e8effb;color:#1e4b96;font-size:10.5px;font-weight:700">LEAD</span>`)}
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:6px">
        ${members.map(([n, i]) => personRow(n, i, "")).join("")}
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:9px;height:32px;border-radius:9px;border:1px dashed ${T.border};font-size:12.5px;font-weight:600;color:${T.mfg}">${icon("plus", 14, T.mfg, 2)}Add person</div>
    </div></div>`;
}
writeFileSync("OrgChart.dc.html", page({ title:"Org chart", w:1440, h:940, body: shell(
  sidebar({ active:"org", openGroup:"org", activeChild:"Org chart" }),
  `${topbar("Organization chart", "Acme Collective · 3 teams · 9 people", `<div style="display:flex;gap:9px;align-items:center">${btn("Add team","outline",{icon:"plus"})}${btn("Save and continue","default")}</div>`)}
  <div style="display:flex;gap:22px;padding:24px 28px 32px;align-items:flex-start">
    <div style="flex-grow:1;min-width:0">
      <div style="position:relative;padding:22px 20px 24px;background:${T.card};border:1px solid ${T.border};border-radius:16px">
        <div style="display:flex;justify-content:center">
          <div style="display:flex;align-items:center;gap:11px;padding:11px 18px;border-radius:12px;background:${T.primary};color:#fff">
            ${avatar("JB", 32, "rgba(255,255,255,.18)", "#fff")}
            <span><span style="display:block;font-size:13.5px;font-weight:700">Jordan Blake</span><span style="display:block;font-size:11.5px;color:rgba(255,255,255,.7)">Organization owner · sees everything</span></span></div>
        </div>
        <div style="position:relative;height:34px">
          <span style="position:absolute;left:50%;top:0;width:1.5px;height:17px;background:${T.border}"></span>
          <span style="position:absolute;left:16.6%;right:16.6%;top:17px;height:1.5px;background:${T.border}"></span>
          <span style="position:absolute;left:16.6%;top:17px;width:1.5px;height:17px;background:${T.border}"></span>
          <span style="position:absolute;left:50%;top:17px;width:1.5px;height:17px;background:${T.border}"></span>
          <span style="position:absolute;left:83.4%;top:17px;width:1.5px;height:17px;background:${T.border}"></span>
        </div>
        <div style="display:flex;gap:16px;justify-content:center">
          ${teamCard("Marketing", "Sarah Chen", "SC", [["Mike Ross","MR"],["David Kim","DK"]])}
          ${teamCard("Sales", "Priya Anand", "PA", [["Leo Martins","LM"]])}
          ${teamCard("Product", "Wes Okoye", "WO", [["Nina Patel","NP"],["Tom Alvarez","TA"]])}
        </div>
      </div>
      <p style="margin:13px 2px 0;font-size:12.5px;color:${T.mfg}">Each team's sharing policy follows its position here — a document created by anyone in a team is shared up to that team's leader and to the owner, unless the policy says otherwise.</p>
    </div>
    <div style="width:268px;flex-shrink:0;display:flex;flex-direction:column;gap:14px">
      ${cardBox(`<div style="padding:14px 15px">
        <p style="margin:0 0 10px;font-size:12.5px;font-weight:700;color:${T.fg}">Unassigned people</p>
        <div style="display:flex;align-items:center;gap:9px;height:32px;padding:0 11px;border-radius:8px;border:1px solid ${T.border};margin-bottom:10px">${icon("search",14,T.mfg,1.8)}<span style="font-size:12.5px;color:#8d95a1">Search people or teams</span></div>
        <div style="display:flex;flex-direction:column;gap:5px">
          ${personRow("Alex Rivera","AR","No team yet",`${icon("plus",14,T.mfg,2)}`)}
          ${personRow("Dana Cole","DC","No team yet",`${icon("plus",14,T.mfg,2)}`)}
        </div></div>`)}
      ${cardBox(`<div style="padding:14px 15px">
        <p style="margin:0 0 4px;font-size:12.5px;font-weight:700;color:${T.fg}">Automatic on join</p>
        <p style="margin:0 0 10px;font-size:12px;line-height:1.5;color:${T.mfg}">Adding someone here provisions their Workspace access and starts auto-sharing their new documents.</p>
        <div style="display:flex;flex-direction:column;gap:7px">
          ${["Google Drive","Gmail","Slack","Zoom"].map((a) => `<div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:${T.fg}">${icon("check",13,T.success,2.6)}${a}</div>`).join("")}
        </div></div>`)}
    </div>
  </div>`
)}));

/* ----------------------------------------------------------- OWNER HOME */
const GAPS = [
  { t:"SHEET", title:"Campaign Budget", owner:"Mike Ross", folder:"Marketing", date:"2 Sep", st:"hidden" },
  { t:"DOC",   title:"Brand Guidelines Draft", owner:"David Kim", folder:"Marketing", date:"31 Aug", st:"hidden" },
  { t:"SLIDE", title:"Client Pitch Template", owner:"Priya Anand", folder:"Sales", date:"31 Aug", st:"hidden" },
];
const folderCard = (name, count, latest, who) => `<div style="flex-grow:1;flex-basis:0;min-width:0;padding:13px 14px;background:${T.card};border:1px solid ${T.border};border-radius:13px">
  <div style="display:flex;align-items:center;gap:9px">
    <span style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;background:rgba(65,131,234,.13);flex-shrink:0">${icon("folder",15,T.gblue,1.8)}</span>
    <span style="flex-grow:1;min-width:0"><span style="display:block;font-size:13px;font-weight:600;color:${T.fg}">Drive › ${name}</span>
    <span style="display:block;font-size:11.5px;color:${T.mfg}">${count} files</span></span></div>
  <div style="display:flex;align-items:flex-start;gap:6px;margin-top:9px">${icon("cornerDR",12,T.mfg,1.8)}
    <span style="font-size:11.5px;color:${T.mfg};min-width:0">“${latest}” — ${who}</span></div></div>`;

writeFileSync("OwnerHome.dc.html", page({ title:"Owner home", w:1440, h:1180, body: shell(
  sidebar({ active:"home" }),
  `${topbar("Home", "Acme Collective · 9 people · 3 teams", searchField())}
  <div style="display:flex;flex-direction:column;gap:22px;padding:22px 28px 32px">
    <div style="display:flex;gap:12px">
      ${statTile("48%","Visible to you","14 of 29 documents")}
      ${statTile("15","Invisible to you","across 3 teams", T.danger)}
      ${statTile("29","Documents","in Google Workspace")}
      ${statTile("9","People","3 teams, 3 leaders")}
    </div>

    <div style="display:flex;gap:18px;align-items:flex-start">
      <div style="flex-grow:1;min-width:0">
        ${sec("Needs your attention", "Documents created in your organization that were never shared up to you.", btn("Open Visibility","outline"))}
        ${cardBox(`${GAPS.map((d) => docRow(d, { action: btn("Request access","secondary",{size:"sm"}) })).join("")}
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border-top:1px solid ${T.border};font-size:12.8px;font-weight:600;color:${T.primary}">12 more ${icon("chevR",13,T.primary,2)}</div>`, "overflow:hidden")}
      </div>
      <div style="width:340px;flex-shrink:0">
        ${sec("Coverage by team", "Share of each team's documents you can see.")}
        ${cardBox(`<div style="padding:16px 17px;display:flex;flex-direction:column;gap:13px">
          ${[["Marketing",60,"6 of 10"],["Sales",44,"4 of 9"],["Product",33,"3 of 9"],["Company",100,"1 of 1"]].map(([n,p,c]) => `
            <div><div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:5px">
              <span style="font-size:12.8px;font-weight:600;color:${T.fg}">${n}</span>
              <span style="font-size:11.5px;color:${T.mfg}">${c}</span></div>${coverageBar(p, 290)}</div>`).join("")}
        </div>`)}
      </div>
    </div>

    <div>
      ${sec("Drive auto-filing", "Every new file is routed to its team's folder automatically — no manual moving, no lost documents.")}
      <div style="display:flex;gap:12px">
        ${folderCard("Company", 2, "All-Hands Agenda", "Jordan Blake")}
        ${folderCard("Marketing", 10, "Q4 Budget Tracker", "Mike Ross")}
        ${folderCard("Sales", 9, "Client Pitch Template", "Priya Anand")}
        ${folderCard("Product", 9, "Launch Deck v2.1", "Tom Alvarez")}
      </div>
    </div>

    <div>
      ${sec("Recent activity", "", btn("View all","ghost"))}
      ${cardBox(`<div style="display:flex;flex-direction:column">
        ${[["share",T.success,"“Q4 Budget Tracker” created by Mike Ross — filed in Drive › Marketing, auto-shared with Sarah Chen and you.","12 minutes ago"],
           ["userPlus",T.success,"Alex Rivera onboarded to Marketing — granted Google Drive, Gmail, Slack, Zoom.","2 hours ago"],
           ["userMinus",T.danger,"Dana Cole offboarded from Sales — 4 documents reassigned to Priya Anand.","Yesterday, 16:40"]]
          .map(([ic,c,msg,when],i) => `<div style="display:flex;gap:11px;padding:12px 16px;${i ? `border-top:1px solid ${T.border}` : ""}">
            ${icon(ic,16,c,1.8)}<span style="flex-grow:1;min-width:0"><span style="display:block;font-size:13px;color:${T.fg}">${msg}</span>
            <span style="display:block;margin-top:2px;font-size:11.5px;color:${T.mfg}">${when}</span></span></div>`).join("")}
      </div>`)}
    </div>
  </div>`
)}));
console.log("wrote Login, OrgChart, OwnerHome");
