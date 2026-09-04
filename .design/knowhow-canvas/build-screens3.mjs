import { writeFileSync } from "fs";
import { T, FONT_UI, FONT_DISPLAY, icon, docChip, statusPill, avatar, btn, page, sidebar, topbar, searchField } from "./lib.mjs";
import { shell, sec, cardBox, statTile, coverageBar, chip, dropChip, tabs, switchEl, checkbox, docRow, docHead, td, th, mono } from "./ui.mjs";

/* -------------------------------------------------------------- TEAM HUB */
const MKT = [
  { t:"SHEET", title:"Q4 Budget Tracker", owner:"Mike Ross", folder:"Marketing", date:"2 Sep", st:"visible" },
  { t:"DOC", title:"Q3 Marketing Plan", owner:"Sarah Chen", folder:"Marketing", date:"31 Aug", st:"visible" },
  { t:"SHEET", title:"Campaign Budget", owner:"Mike Ross", folder:"Marketing", date:"31 Aug", st:"hidden" },
  { t:"DOC", title:"Brand Guidelines Draft", owner:"David Kim", folder:"Marketing", date:"31 Aug", st:"hidden" },
  { t:"SHEET", title:"Vendor Contacts", owner:"David Kim", folder:"Marketing", date:"31 Aug", st:"visible" },
  { t:"SLIDE", title:"Board Update — August", owner:"Sarah Chen", folder:"Marketing", date:"31 Aug", st:"visible" },
];
const rosterRow = (name, ini, role, docs, lead) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 15px;border-top:1px solid ${T.border}">
  ${avatar(ini, 30, lead ? T.primary : "#c9d3e0", lead ? "#fff" : T.primary)}
  <span style="flex-grow:1;min-width:0"><span style="display:block;font-size:13px;font-weight:600;color:${T.fg}">${name}</span>
  <span style="display:block;font-size:11.5px;color:${T.mfg}">${role} · ${docs} documents</span></span>
  ${lead ? `<span style="display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;background:#e8effb;color:#1e4b96;font-size:10.5px;font-weight:700">LEAD</span>` : ""}</div>`;

writeFileSync("TeamHub.dc.html", page({ title:"Team hub", w:1440, h:1000, body: shell(
  sidebar({ active:"org", openGroup:"org", activeChild:"Marketing" }),
  `${topbar("Marketing", "Led by Sarah Chen · 3 people · 10 documents", `<div style="display:flex;gap:9px;align-items:center">${btn("Add person","outline",{icon:"plus"})}${btn("New document","default")}</div>`)}
  <div style="padding:18px 28px 32px">
    ${tabs(["Documents","People","Policy"], "Documents")}
    <div style="display:flex;gap:18px;align-items:flex-start;margin-top:18px">

      <div style="flex-grow:1;min-width:0">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:13px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:9px;width:250px;height:32px;padding:0 12px;border-radius:999px;background:${T.card};border:1px solid ${T.border}">
            ${icon("search",15,T.mfg,1.8)}<span style="font-size:13px;color:#8d95a1">Search this team</span></div>
          ${dropChip("Any type")}${dropChip("Anyone")}
          <span style="margin-left:auto;display:flex;align-items:center;gap:9px">
            <span style="font-size:12.5px;color:${T.mfg}">6 of 10 visible to you</span>${coverageBar(60, 110)}</span>
        </div>
        ${cardBox(`${docHead()}${MKT.map((d) => docRow(d)).join("")}`, "overflow:hidden")}
      </div>

      <div style="width:308px;flex-shrink:0;display:flex;flex-direction:column;gap:14px">
        ${cardBox(`<div style="padding:15px 15px 6px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <p style="margin:0;font-size:13px;font-weight:700;color:${T.fg}">Sharing policy</p>
            <span style="font-size:11.5px;color:${T.success};font-weight:600">Active</span></div>
          <p style="margin:5px 0 0;font-size:12px;line-height:1.5;color:${T.mfg}">Applied to every document anyone on this team creates.</p></div>
          ${[["Auto-share with team leader","Sarah Chen receives every new file", true],
             ["Auto-share with owner","Jordan Blake receives every new file", true],
             ["Include existing documents","Back-fill the 4 files created before the policy", false]]
            .map(([t,s,on]) => `<div style="display:flex;align-items:flex-start;gap:11px;padding:12px 15px;border-top:1px solid ${T.border}">
              <span style="flex-grow:1;min-width:0"><span style="display:block;font-size:12.8px;font-weight:600;color:${T.fg}">${t}</span>
              <span style="display:block;margin-top:1px;font-size:11.5px;color:${T.mfg}">${s}</span></span>${switchEl(on)}</div>`).join("")}`, "overflow:hidden")}

        ${cardBox(`<div style="padding:15px 15px 11px"><p style="margin:0;font-size:13px;font-weight:700;color:${T.fg}">People</p></div>
          ${rosterRow("Sarah Chen","SC","Team leader",4,true)}
          ${rosterRow("Mike Ross","MR","Member",3,false)}
          ${rosterRow("David Kim","DK","Member",3,false)}
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border-top:1px solid ${T.border};font-size:12.5px;font-weight:600;color:${T.primary}">${icon("plus",13,T.primary,2.2)}Add person</div>`, "overflow:hidden")}
      </div>
    </div>
  </div>`
)}));

/* ------------------------------------------------------------- ACTIVITY */
const evt = (ic, tone, msg, when, actor) => `<div style="display:flex;gap:12px;padding:13px 16px;border-top:1px solid ${T.border}">
  <span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:${tone}1f;flex-shrink:0">${icon(ic,15,tone,2)}</span>
  <span style="flex-grow:1;min-width:0"><span style="display:block;font-size:13.2px;line-height:1.5;color:${T.fg}">${msg}</span>
  <span style="display:block;margin-top:2px;font-size:11.5px;color:${T.mfg}">${actor} · ${when}</span></span></div>`;

writeFileSync("Activity.dc.html", page({ title:"Activity", w:1440, h:960, body: shell(
  sidebar({ active:"activity" }),
  `${topbar("Activity", "Every automated onboarding, offboarding and sharing action Knowhow has taken.", btn("Export log","outline"))}
  <div style="padding:20px 28px 32px;max-width:1000px">
    <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">
      ${chip("All events", true)}${chip("Sharing")}${chip("Onboarding")}${chip("Offboarding")}${chip("Reassignment")}
      <span style="margin-left:auto">${dropChip("Last 30 days")}</span>
    </div>

    <p style="margin:0 0 9px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${T.mfg}">Today</p>
    ${cardBox(`
      ${evt("share",T.success,"“Q4 Budget Tracker” created by Mike Ross — filed in Drive › Marketing, auto-shared with Sarah Chen (team leader) and Jordan Blake (owner).","12 minutes ago","Automatic")}
      ${evt("share",T.success,"“All-Hands Agenda” created by Jordan Blake — filed in Drive › Company, shared with everyone in the organization.","1 hour ago","Jordan Blake")}
      ${evt("userPlus",T.success,"Alex Rivera onboarded to Marketing as member — granted access to Google Drive, Gmail, Slack, Zoom.","2 hours ago","Jordan Blake")}
      ${evt("share",T.success,"Auto-share enabled for Alex Rivera's future documents (policy: Marketing).","2 hours ago","Automatic")}
    `, "overflow:hidden;border-top:1px solid " + T.border)}

    <p style="margin:22px 0 9px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${T.mfg}">Yesterday</p>
    ${cardBox(`
      ${evt("userMinus",T.danger,"Dana Cole offboarded from Sales.","16:40","Jordan Blake")}
      ${evt("file",T.mfg,"“Regional Pipeline” reassigned from Dana Cole to Priya Anand.","16:40","Automatic")}
      ${evt("file",T.mfg,"“Q3 Commission Sheet” reassigned from Dana Cole to Priya Anand.","16:40","Automatic")}
      ${evt("lock",T.danger,"Revoked Dana Cole's access to Google Drive, Gmail, Slack, Zoom.","16:41","Automatic")}
    `, "overflow:hidden;border-top:1px solid " + T.border)}
  </div>`
)}));

/* ------------------------------------------------------------- SETTINGS */
const settingRow = (t, s, ctrl) => `<div style="display:flex;align-items:center;gap:14px;padding:14px 17px;border-top:1px solid ${T.border}">
  <span style="flex-grow:1;min-width:0"><span style="display:block;font-size:13.2px;font-weight:600;color:${T.fg}">${t}</span>
  <span style="display:block;margin-top:2px;font-size:12px;color:${T.mfg}">${s}</span></span>${ctrl}</div>`;

writeFileSync("Settings.dc.html", page({ title:"Settings", w:1440, h:1030, body: shell(
  sidebar({ active:"settings" }),
  `${topbar("Settings", "Acme Collective")}
  <div style="padding:20px 28px 32px;max-width:940px;display:flex;flex-direction:column;gap:22px">

    <div>
      ${sec("Google Workspace")}
      ${cardBox(`<div style="display:flex;align-items:center;gap:14px;padding:17px">
        <span style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:11px;background:${T.muted};flex-shrink:0">
          <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.5-4H3.2v2.6A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.5 14.1a6 6 0 0 1 0-3.8V7.7H3.2a10 10 0 0 0 0 9Z"/><path fill="#EA4335" d="M12 6.1c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 3.2 7.7l3.3 2.6A5.9 5.9 0 0 1 12 6.1Z"/></svg></span>
        <span style="flex-grow:1;min-width:0">
          <span style="display:flex;align-items:center;gap:9px"><span style="font-size:13.5px;font-weight:700;color:${T.fg}">Workspace connection</span>
          <span style="display:inline-flex;align-items:center;gap:5px;height:21px;padding:0 9px;border-radius:999px;background:#fdf6ec;color:#7a5510;font-size:11.5px;font-weight:700">${icon("alert",11,"#7a5510",2.2)}Simulated</span></span>
          <span style="display:block;margin-top:3px;font-size:12.5px;line-height:1.5;color:${T.mfg}">Sharing, filing and access changes are modelled inside Knowhow and written to the activity log. Connecting a real Workspace needs a Google Cloud project with domain-wide delegation.</span></span>
        ${btn("Connect Workspace","default")}
      </div>`)}
    </div>

    <div>
      ${sec("Sharing policies", "The automation itself: what happens to a document the moment it is created.")}
      ${cardBox(`<div style="padding:14px 17px 3px"><div style="display:flex;align-items:center;gap:14px">
          <span style="flex-grow:1;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.mfg}">Team</span>
          <span style="width:104px;flex-shrink:0;text-align:center;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.mfg}">To leader</span>
          <span style="width:104px;flex-shrink:0;text-align:center;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.mfg}">To owner</span>
          <span style="width:96px;flex-shrink:0;text-align:right;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.mfg}">Coverage</span></div></div>
        ${[["Marketing","Sarah Chen",true,true,60],["Sales","Priya Anand",true,true,44],["Product","Wes Okoye",true,false,33]]
          .map(([n,l,a,b,c]) => `<div style="display:flex;align-items:center;gap:14px;padding:13px 17px;border-top:1px solid ${T.border}">
            <span style="flex-grow:1;min-width:0"><span style="display:block;font-size:13.2px;font-weight:600;color:${T.fg}">${n}</span>
            <span style="display:block;font-size:11.5px;color:${T.mfg}">Led by ${l}</span></span>
            <span style="width:104px;flex-shrink:0;display:flex;justify-content:center">${switchEl(a)}</span>
            <span style="width:104px;flex-shrink:0;display:flex;justify-content:center">${switchEl(b)}</span>
            <span style="width:96px;flex-shrink:0;display:flex;justify-content:flex-end">${coverageBar(c, 52)}</span></div>`).join("")}
        <div style="display:flex;align-items:flex-start;gap:9px;padding:12px 17px;border-top:1px solid ${T.border};background:#fdf6ec">
          ${icon("alert",14,"#7a5510",2.2)}
          <p style="margin:0;font-size:12.2px;line-height:1.5;color:#7a5510">Product does not share up to the owner, which is where 4 of your 15 invisible documents come from.</p></div>`, "overflow:hidden")}
    </div>

    <div>
      ${sec("Organization")}
      ${cardBox(`
        ${settingRow("Organization name","Acme Collective",`<span style="display:flex;align-items:center;width:230px;height:32px;padding:0 12px;border-radius:8px;border:1px solid ${T.border};font-size:13px;color:${T.fg}">Acme Collective</span>`)}
        ${settingRow("Owner","Jordan Blake receives everything shared upward.",`<span style="display:flex;align-items:center;gap:8px">${avatar("JB",26)}<span style="font-size:12.8px;color:${T.fg}">Jordan Blake</span></span>`)}
        ${settingRow("Default for new teams","Auto-share to leader and owner from day one.",switchEl(true))}
        ${settingRow("Weekly visibility digest","Email the owner what went unshared each week.",switchEl(false))}
      `, "overflow:hidden;border-top:none")}
    </div>
  </div>`
)}));
console.log("wrote TeamHub, Activity, Settings");
