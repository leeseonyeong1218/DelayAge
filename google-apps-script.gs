/**
 * @OnlyCurrentDoc
 */

// DelayAge 설문 결과 저장 및 평균 계산용 Google Apps Script
function doPost(e) {
  try {
    const SPREADSHEET_ID = "https://script.google.com/macros/s/AKfycbyYx_SpaivLhxbGpGc4WGHC1VXKTLniFO59lhIst1BCUZLVT0Mz2yHUMUzy71IqCCgD/exec"; 
    // 예: https://docs.google.com/spreadsheets/d/1AbCdEfGhIJKlmnopQRstuVWxyz12345/edit
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName("Responses") || SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];

    const data = JSON.parse(e.postData.contents);
    const timestamp = new Date();

    // 헤더가 없다면 생성
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Timestamp", "Diet", "Activity", "Sleep", "Stress", "Total"]);
    }

    // 새 응답 저장
    const total = (data.diet + data.activity + data.sleep + data.stress);
    sheet.appendRow([timestamp, data.diet, data.activity, data.sleep, data.stress, total]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 평균 및 참여자 수 반환 (웹에서 doGet 호출)
function doGet(e) {
  try {
    const SPREADSHEET_ID = "https://script.google.com/macros/s/AKfycbyYx_SpaivLhxbGpGc4WGHC1VXKTLniFO59lhIst1BCUZLVT0Mz2yHUMUzy71IqCCgD/exec"; 
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return ContentService.createTextOutput(JSON.stringify({ count: 0, averages: {} }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const dataRange = sheet.getRange(2, 2, lastRow - 1, 5).getValues(); // Diet~Total 열
    const count = dataRange.length;
    const sums = [0, 0, 0, 0, 0];

    dataRange.forEach(row => {
      row.forEach((val, i) => sums[i] += Number(val) || 0);
    });

    const averages = {
      diet: (sums[0] / count).toFixed(1),
      activity: (sums[1] / count).toFixed(1),
      sleep: (sums[2] / count).toFixed(1),
      stress: (sums[3] / count).toFixed(1),
      total: (sums[4] / count).toFixed(1)
    };

    return ContentService
      .createTextOutput(JSON.stringify({ count, averages }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}