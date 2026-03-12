// === Google Apps Script für ScaleX Hub ===
// Dieses Script in Google Apps Script einfügen und als Web-App deployen

const SHEET_ID = '1pMTWsd2EkqKfsC32VicpjT5tP2x_QrgTMM319tojAgM';

function doGet(e) {
  const action = e.parameter.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheets()[0];
  
  if (action === 'getTodos') {
    return jsonResponse(readRange(sheet, 'A', 'F'));
  }
  if (action === 'getVideos') {
    return jsonResponse(readRange(sheet, 'H', 'O'));
  }
  return jsonResponse({ error: 'Unknown action' });
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheets()[0];
  
  if (action === 'addTodo') {
    const row = [data.id, data.datum, data.aufgabe, data.kategorie, data.erledigt, data.erstellt];
    sheet.appendRow_Alt('A', 'F', row);
    return jsonResponse({ ok: true });
  }
  
  if (action === 'updateTodo') {
    const rows = sheet.getRange('A:F').getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        sheet.getRange(i + 1, 5).setValue(data.erledigt); // Column E = Erledigt
        break;
      }
    }
    return jsonResponse({ ok: true });
  }
  
  if (action === 'deleteTodo') {
    const rows = sheet.getRange('A:F').getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][0]) === String(data.id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return jsonResponse({ ok: true });
  }
  
  if (action === 'addVideo') {
    const lastRow = getLastRow(sheet, 'H');
    const row = lastRow + 1;
    sheet.getRange(row, 8, 1, 8).setValues([[data.id, data.datum, data.kunde, data.projekt, data.videoart, data.anzahl, data.status, data.notiz]]);
    return jsonResponse({ ok: true });
  }
  
  if (action === 'updateVideo') {
    const rows = sheet.getRange('H:O').getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        sheet.getRange(i + 1, 8, 1, 8).setValues([[data.id, data.datum, data.kunde, data.projekt, data.videoart, data.anzahl, data.status, data.notiz]]);
        break;
      }
    }
    return jsonResponse({ ok: true });
  }
  
  if (action === 'deleteVideo') {
    const rows = sheet.getRange('H:O').getValues();
    for (let i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][0]) === String(data.id)) {
        // Clear the row in H:O
        sheet.getRange(i + 1, 8, 1, 8).clearContent();
        break;
      }
    }
    return jsonResponse({ ok: true });
  }
  
  if (action === 'syncAll') {
    // Full sync: clear and rewrite everything
    // Todos
    const todoLastRow = getLastRow(sheet, 'A');
    if (todoLastRow > 1) sheet.getRange(2, 1, todoLastRow - 1, 6).clearContent();
    if (data.todos && data.todos.length > 0) {
      const todoRows = data.todos.map(t => [t.id, t.datum, t.aufgabe, t.kategorie, t.erledigt, t.erstellt]);
      sheet.getRange(2, 1, todoRows.length, 6).setValues(todoRows);
    }
    
    // Videos
    const videoLastRow = getLastRow(sheet, 'H');
    if (videoLastRow > 1) sheet.getRange(2, 8, videoLastRow - 1, 8).clearContent();
    if (data.videos && data.videos.length > 0) {
      const videoRows = data.videos.map(v => [v.id, v.datum, v.kunde, v.projekt, v.videoart, v.anzahl, v.status, v.notiz]);
      sheet.getRange(2, 8, videoRows.length, 8).setValues(videoRows);
    }
    
    return jsonResponse({ ok: true, todos: data.todos?.length || 0, videos: data.videos?.length || 0 });
  }
  
  return jsonResponse({ error: 'Unknown action' });
}

function readRange(sheet, startCol, endCol) {
  const range = sheet.getRange(startCol + ':' + endCol).getValues();
  const headers = range[0];
  const rows = [];
  for (let i = 1; i < range.length; i++) {
    if (!range[i][0] && !range[i][1]) continue; // Skip empty rows
    const obj = {};
    headers.forEach((h, j) => obj[h] = range[i][j]);
    rows.push(obj);
  }
  return rows;
}

function getLastRow(sheet, col) {
  const values = sheet.getRange(col + ':' + col).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0] !== '') return i + 1;
  }
  return 1;
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
