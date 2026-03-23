// Apps Script v5 — JSONP Sync + Google Calendar Integration
// Sheet: Tabellenblatt1
// Todos: Spalten A:G (ID, Datum, Aufgabe, Kategorie, Erledigt, Erstellt, Fällig)
// Leistungen: Spalten I:S (V_ID, Datum, Kunde, Projekt, Videoart, Anzahl, Geliefert, Stückpreis, Betrag, Status, Quelle, Notiz)
// Kalender: Erstellt/aktualisiert Events für Todos mit Fälligkeitsdatum

function doGet(e) {
  var action = e.parameter.action || 'getAll';
  var callback = e.parameter.callback || 'callback';
  var result;

  try {
    if (action === 'syncAll') {
      var data = JSON.parse(e.parameter.data);
      result = syncAll(data);
    } else {
      result = getAll();
    }
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }

  var output = ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ')');
  output.setMimeType(ContentService.MimeType.JAVASCRIPT);
  return output;
}

function syncAll(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Tabellenblatt1');

  // === TODOS (Spalten A:G) ===
  var todos = data.todos || [];

  // Alte Todo-Daten löschen (A2:H)
  var lastRowTodo = Math.max(sheet.getLastRow(), 2);
  if (lastRowTodo > 1) {
    sheet.getRange(2, 1, lastRowTodo - 1, 8).clearContent();
  }

  // Neue Todos schreiben (8 Spalten: A-H)
  if (todos.length > 0) {
    var todoRows = todos.map(function(t) {
      return [t.id, t.datum, t.aufgabe, t.kategorie, t.erledigt, t.erstellt, t.faellig || '', t.quelle_todo || 'scalex'];
    });
    sheet.getRange(2, 1, todoRows.length, 8).setValues(todoRows);
  }

  // === LEISTUNGEN (Spalten I:S, also 9:19) ===
  var videos = data.videos || [];

  // Alte Video-Daten löschen (I2:S)
  if (lastRowTodo > 1) {
    sheet.getRange(2, 9, lastRowTodo - 1, 11).clearContent();
  }

  // Neue Videos schreiben
  if (videos.length > 0) {
    var videoRows = videos.map(function(v) {
      return [v.id, v.datum, v.kunde, v.projekt, v.videoart, v.anzahl,
              v.geliefert, v.betrag, v.status, v.quelle, v.notiz];
    });
    sheet.getRange(2, 9, videoRows.length, 11).setValues(videoRows);
  }

  // === KALENDER-SYNC ===
  syncCalendar(todos);
  cleanupCalendar(todos);

  return { ok: true, todosWritten: todos.length, videosWritten: videos.length };
}

function syncCalendar(todos) {
  var cal = CalendarApp.getDefaultCalendar();

  // Farben: ScaleX = BLUEBERRY (9), Rebland = TANGERINE (6), Privat = GRAPHITE (8)
  var colorMap = {
    'scalex': CalendarApp.EventColor.BLUE,
    'rebland': CalendarApp.EventColor.ORANGE,
    'privat': CalendarApp.EventColor.GRAPHITE
  };

  // Prefix je nach Quelle
  var prefixMap = {
    'scalex': '[ScaleX] ',
    'rebland': '[Rebland] ',
    'privat': '[Privat] '
  };

  // Todos mit Fälligkeitsdatum
  var todosWithDue = todos.filter(function(t) {
    return t.faellig && t.faellig !== '';
  });

  for (var i = 0; i < todosWithDue.length; i++) {
    var t = todosWithDue[i];
    var source = t.quelle_todo || 'scalex';
    var prefix = prefixMap[source] || '[ScaleX] ';
    var title = prefix + t.aufgabe;
    var dueDate = new Date(t.faellig + 'T09:00:00');
    var isDone = t.erledigt === 'TRUE';
    var color = colorMap[source] || CalendarApp.EventColor.BLUE;

    // Suche ob Event schon existiert (suche mit und ohne prefix)
    var existingEvents = cal.getEventsForDay(dueDate, { search: t.aufgabe });

    if (isDone) {
      // Wenn erledigt: Event löschen falls vorhanden
      for (var j = 0; j < existingEvents.length; j++) {
        existingEvents[j].deleteEvent();
      }
    } else if (existingEvents.length === 0) {
      // Wenn nicht erledigt und kein Event: erstellen mit Farbe
      var event = cal.createAllDayEvent(title, dueDate, {
        description: 'Quelle: ' + source + '\nKategorie: ' + t.kategorie + '\nErstellt: ' + t.erstellt + '\nAus ScaleX Hub'
      });
      event.setColor(color);
    }
  }
}

function cleanupCalendar(todos) {
  var cal = CalendarApp.getDefaultCalendar();
  
  // Sammle alle aktiven Todo-Titel (nicht erledigte mit Fälligkeitsdatum)
  var activeTitles = {};
  var prefixMap = { 'scalex': '[ScaleX] ', 'rebland': '[Rebland] ', 'privat': '[Privat] ' };
  
  for (var i = 0; i < todos.length; i++) {
    var t = todos[i];
    if (t.faellig && t.faellig !== '' && t.erledigt !== 'TRUE') {
      var source = t.quelle_todo || 'scalex';
      var prefix = prefixMap[source] || '[ScaleX] ';
      activeTitles[prefix + t.aufgabe] = true;
    }
  }
  
  // Suche ScaleX Hub Events in den nächsten 90 Tagen und lösche die, die nicht mehr in der Todo-Liste sind
  var now = new Date();
  var future = new Date();
  future.setDate(future.getDate() + 90);
  
  var allEvents = cal.getEvents(now, future, { search: 'ScaleX Hub' });
  // Auch nach den Prefixes suchen
  var prefixEvents = cal.getEvents(now, future, { search: '[ScaleX]' });
  var reblandEvents = cal.getEvents(now, future, { search: '[Rebland]' });
  var privatEvents = cal.getEvents(now, future, { search: '[Privat]' });
  
  var allFoundEvents = prefixEvents.concat(reblandEvents).concat(privatEvents);
  
  // Deduplizieren nach Event-ID
  var seen = {};
  var uniqueEvents = [];
  for (var j = 0; j < allFoundEvents.length; j++) {
    var id = allFoundEvents[j].getId();
    if (!seen[id]) {
      seen[id] = true;
      uniqueEvents.push(allFoundEvents[j]);
    }
  }
  
  // Events löschen die nicht mehr in activeTitles sind
  for (var k = 0; k < uniqueEvents.length; k++) {
    var event = uniqueEvents[k];
    var title = event.getTitle();
    if (!activeTitles[title]) {
      event.deleteEvent();
    }
  }
}

function getAll() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Tabellenblatt1');
  var data = sheet.getDataRange().getValues();

  var todos = [];
  var videos = [];

  for (var i = 1; i < data.length; i++) {
    // Todos (Spalte A-G)
    if (data[i][0]) {
      todos.push({
        id: data[i][0], datum: data[i][1], aufgabe: data[i][2],
        kategorie: data[i][3], erledigt: data[i][4], erstellt: data[i][5],
        faellig: data[i][6] || ''
      });
    }
    // Videos (Spalte I-S = Index 8-18)
    if (data[i][8]) {
      videos.push({
        id: data[i][8], datum: data[i][9], kunde: data[i][10],
        projekt: data[i][11], videoart: data[i][12], anzahl: data[i][13],
        geliefert: data[i][14], betrag: data[i][15], status: data[i][16],
        quelle: data[i][17], notiz: data[i][18]
      });
    }
  }

  return { ok: true, todos: todos, videos: videos };
}
