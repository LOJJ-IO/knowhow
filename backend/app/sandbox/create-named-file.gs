/**
 * Knohow demo: opens a new Google Sheet, Slide or Form that already has the
 * name typed in Knohow's New dialog (Ronald, 2026-10-04). Google's blank-file
 * links only take a name for Docs, so for the other types this script makes
 * the file in the visitor's own Drive, named, and sends the tab to it.
 *
 * Deploy once (script.google.com → New project → paste this → Deploy →
 * New deployment → Web app):
 *   Execute as:     User accessing the web app
 *   Who has access: Anyone with a Google account
 * Put the /exec URL in the backend's SANDBOX_CREATE_URL. The first visit asks
 * that Google account for permission once.
 *
 * Called as  <exec URL>?kind=sheet|slide|form|doc&title=Monday
 */
function doGet(e) {
  var kind = (e.parameter.kind || "doc").toLowerCase();
  var title = (e.parameter.title || "").slice(0, 200) || "Untitled";
  var url;
  if (kind === "sheet") url = SpreadsheetApp.create(title).getUrl();
  else if (kind === "slide") url = SlidesApp.create(title).getUrl();
  else if (kind === "form") url = FormApp.create(title).setTitle(title).getEditUrl();
  else url = DocumentApp.create(title).getUrl();

  // Apps Script serves pages in a frame; send the whole tab to the new file.
  var safe = JSON.stringify(url);
  return HtmlService.createHtmlOutput(
    "<script>window.top.location.href = " + safe + ";</script>" +
      '<a href="' + url + '" target="_top">Open ' + title.replace(/[<>&"]/g, "") + "</a>"
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
