/**
 * Knohow survey → Google Sheet. Receives each response from knohow.app/survey
 * (the `submitSurvey` Server Action) and writes it as one row.
 *
 * Setup, once:
 *  1. Make a Google Sheet. Extensions → Apps Script. Paste this file in.
 *  2. Project Settings → Script properties → add SECRET = any long random
 *     string.
 *  3. Deploy → New deployment → Web app. Execute as: Me. Who has access:
 *     Anyone. Copy the /exec URL.
 *  4. On the Railway service that runs the Next.js app (and .env.local to
 *     test locally), set:
 *       SURVEY_WEBHOOK_URL    = the /exec URL
 *       SURVEY_WEBHOOK_SECRET = the same SECRET
 *     and redeploy.
 *
 * The first response writes the header row. New fields added to the survey
 * later get a new column on the right. A response that comes in again with
 * the same response_id (a resend) updates its row instead of adding one.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty("SECRET");
    if (!secret || body.secret !== secret) return reply({ ok: false, error: "forbidden" });

    var row = body.row || {};
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    var headers =
      sheet.getLastColumn() > 0
        ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
        : [];
    Object.keys(row).forEach(function (key) {
      if (headers.indexOf(key) === -1) headers.push(key);
    });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);

    var values = headers.map(function (h) {
      return row[h] === undefined ? "" : row[h];
    });

    var target = sheet.getLastRow() + 1;
    var idCol = headers.indexOf("response_id");
    if (row.response_id && idCol !== -1 && sheet.getLastRow() > 1) {
      var ids = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === row.response_id) {
          target = i + 2;
          break;
        }
      }
    }
    sheet.getRange(target, 1, 1, values.length).setValues([values]);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
