// === ScaleX Hub API v3 ===
// Alles über GET, kein POST nötig

var SHEET_ID = '1pMTWsd2EkqKfsC32VicpjT5tP2x_QrgTMM319tojAgM';

function doGet(e) {
  var action = e.parameter.action;
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheets()[0];
  
  if (action === 'getTodos') {
    return jsonResponse(readRange(sheet, 1, 6));
  }
  
  if (action === 'getVideos') {
    return jsonResponse(readRange(sheet, 8, 15));
  }
  
  if (action === 'getAll') {
    return jsonResponse({
      todos: readRange(sheet, 1, 6),
      videos: readRange(sheet, 8, 15)
    });
  }
  
  if (action === 'syncAll') {
    var data = JSON.parse(e.parameter.data);
    
    // Clear and write todos
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
    
    // Clear and write videos
    var videoLastRow = getLastRowInCol(sheet, 8);
    if (videoLastRow > 1) {
      sheet.getRange(2, 8, videoLastRow - 1, 8).clearContent();
    }
    if (data.videos && data.videos.length > 0) {
      var videoRows = [];
      for (var j = 0; j < data.videos.length; j++) {
        var v = data.videos[j];
        videoRows.push([v.id, v.datum, v.kunde, v.projekt, v.videoart, v.anzahl, v.status, v.notiz]);
      }
      sheet.getRange(2, 8, videoRows.length, 8).setValues(videoRows);
    }
    
    return jsonResponse({ ok: true, todos: data.todos ? data.todos.length : 0, videos: data.videos ? data.videos.length : 0 });
  }
  
  return jsonResponse({ error: 'Unknown action' });
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var fakeE = { parameter: { action: data.action, data: JSON.stringify(data) } };
  return doGet(fakeE);
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

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
