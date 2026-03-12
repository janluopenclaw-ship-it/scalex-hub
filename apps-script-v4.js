// === ScaleX Hub API v4 (JSONP) ===

var SHEET_ID = '1pMTWsd2EkqKfsC32VicpjT5tP2x_QrgTMM319tojAgM';

function doGet(e) {
  var action = e.parameter.action;
  var callback = e.parameter.callback;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheets()[0];
  var result = { error: 'Unknown action' };
  
  if (action === 'getAll') {
    result = {
      todos: readRange(sheet, 1, 6),
      videos: readRange(sheet, 8, 16)
    };
  }
  
  if (action === 'syncAll') {
    var data = JSON.parse(e.parameter.data);
    
    var todoLastRow = getLastRowInCol(sheet, 1);
    if (todoLastRow > 1) {
      sheet.getRange(2, 1, todoLastRow - 1, 6).clearContent();
    }
    if (data.todos && data.todos.length > 0) {
      var todoRows = [];
      for (var i = 0; i < data.todos.length; i++) {
        var t = data.todos[i];
        todoRows.push([t.id, t.datum, t.aufgabe, t.kategorie, t.erledigt, t.erstellt]);
      }
      sheet.getRange(2, 1, todoRows.length, 6).setValues(todoRows);
    }
    
    var videoLastRow = getLastRowInCol(sheet, 8);
    if (videoLastRow > 1) {
      sheet.getRange(2, 8, videoLastRow - 1, 9).clearContent();
    }
    if (data.videos && data.videos.length > 0) {
      var videoRows = [];
      for (var j = 0; j < data.videos.length; j++) {
        var v = data.videos[j];
        videoRows.push([v.id, v.datum, v.kunde, v.projekt, v.videoart, v.anzahl, v.betrag || 0, v.status, v.notiz]);
      }
      sheet.getRange(2, 8, videoRows.length, 9).setValues(videoRows);
    }
    
    result = { ok: true };
  }
  
  // Return as JSONP if callback provided, otherwise plain JSON
  var jsonStr = JSON.stringify(result);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonStr + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

function readRange(sheet, startCol, endCol) {
  var lastRow = Math.max(getLastRowInCol(sheet, startCol), 1);
  var range = sheet.getRange(1, startCol, lastRow, endCol - startCol + 1).getValues();
  var headers = range[0];
  var rows = [];
  for (var i = 1; i < range.length; i++) {
    if (!range[i][0] && !range[i][1]) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = range[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function getLastRowInCol(sheet, col) {
  var values = sheet.getRange(1, col, sheet.getMaxRows(), 1).getValues();
  for (var i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== '') return i + 1;
  }
  return 1;
}
