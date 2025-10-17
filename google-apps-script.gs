/**
 * @OnlyCurrentDoc
 */

// Delay+Age 설문 저장 + 평균 반환용
const SHEET_NAME = 'DelayAgeResponses';

function doPost(e) {
  try {
    const SPREADSHEET_ID = "1FaApyuZhluECy3RbfONLf3lo-JH6dwABRqYV9yIr8Vk"; // 네 시트 ID
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

    // 헤더 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['timestamp','age_group','gender','diet_score','activity_score','sleep_score','stress_score','total_score','raw_answers_json']);
    }

    const data = JSON.parse(e.postData.contents || '{}');
    const area = data.areaScores || {};

    const row = [
      new Date(),
      data.age_group || '',
      data.gender || '',
      Number(area.diet || 0),
      Number(area.activity || 0),
      Number(area.sleep || 0),
      Number(area.stress || 0),
      Number(data.totalScore || 0),
      JSON.stringify(data.answers || {})
    ];

    const lock = LockService.getScriptLock();
    lock.tryLock(10000);
    sheet.appendRow(row);
    lock.releaseLock();

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.avg === '1') {
      const ageParam = e.parameter.age || '';
      const stats = calcAverages(ageParam);
      const cb = e.parameter.callback;
      const payload = { ok: true, ...stats };
      return cb ? jsonp(cb, payload) : json(payload);
    }
    return json({ ok: true, service: 'DelayAge', method: 'GET' });
  } catch (err) {
    return json({ ok: false, error: err.toString() });
  }
}

function calcAverages(ageFilter) {
  const SPREADSHEET_ID = "1FaApyuZhluECy3RbfONLf3lo-JH6dwABRqYV9yIr8Vk";
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { count: 0, total_avg: 0 };

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return { count: 0, total_avg: 0 };

  const header = data[0];
  const idxAge = header.indexOf('age_group');
  const idxTot = header.indexOf('total_score');

  let sum = 0, count = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const ageVal = String(row[idxAge] || '');
    const to = Number(row[idxTot] || 0);
    if (to && (!ageFilter || ageVal === ageFilter)) {
      sum += to;
      count++;
    }
  }
  const avg = count > 0 ? Math.round(sum / count * 10) / 10 : 0;
  return { count, total_avg: avg };
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function jsonp(cb, obj) {
  return ContentService.createTextOutput(`${cb}(${JSON.stringify(obj)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}