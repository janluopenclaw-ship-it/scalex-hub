// Thumbnail Generator — Apps Script Backend
// Empfängt Thema/Template/Stimmung und generiert 3 Thumbnails via Gemini API
// Bilder werden auf Google Drive gespeichert und URLs zurückgegeben

// === CONFIG ===
var GEMINI_API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || 'AIzaSyCRVWpbR44MDiXUW9Akhlsmtrl8uIRtcEo';
var DRIVE_FOLDER_NAME = 'Thumbnail Generator Output';

// === HEADSHOT CONFIG ===
// Google Drive File IDs der Headshots (müssen im Drive liegen)
var HEADSHOTS = {
  positive: {
    thumbsUp: '', // Drive File ID für Daumen hoch
    smile: '',    // Drive File ID für Lächeln
    pointUp: ''   // Drive File ID für Zeigefinger hoch
  },
  warning: {
    facepalm: '', // Drive File ID für Facepalm
    shock: '',    // Drive File ID für Schock
    thumbsDown: '' // Drive File ID für Daumen runter
  },
  thinking: {
    chinHand: '', // Drive File ID für Denker
    armsCrossed: '' // Drive File ID für Arme verschränkt
  },
  confident: {
    blazer: '',   // Drive File ID für Blazer
    pointRight: '' // Drive File ID für zeigt nach rechts
  }
};

// === TEMPLATES ===
var TEMPLATES = {
  a: {
    name: 'Standard Positiv',
    bgPrompt: 'modern apartment building with subtle green upward arrow. Dark cinematic background with dark blue-grey tones, green only as accent on arrow.',
    defaultMood: 'positive'
  },
  b: {
    name: 'Warnung/Fehler', 
    bgPrompt: 'crumbling house with red warning triangles, red X symbol, falling euro bills. Dark cinematic background with red moody lighting.',
    defaultMood: 'warning'
  },
  c: {
    name: 'Split-Screen',
    bgPrompt: 'Split screen with SOFT GRADIENT BLEND. LEFT half: dark ugly run-down apartment, red tint. RIGHT half: beautiful luxury apartment, golden warm light. Smooth gradient transition.',
    defaultMood: 'thinking'
  },
  d: {
    name: 'Curiosity Gap',
    bgPrompt: 'giant glowing golden magnifying glass over a city map with one bright spot, mysterious atmosphere. Dark cinematic background dark blue with gold accent.',
    defaultMood: 'confident'
  },
  e: {
    name: 'Premium',
    bgPrompt: 'luxury penthouse skyline at night, golden city lights reflecting, executive premium atmosphere. Dark cinematic background with warm gold tones.',
    defaultMood: 'confident'
  },
  f: {
    name: 'Menschenmenge',
    bgPrompt: 'massive crowd of people queuing outside modern apartment building door at night. Warm golden light from apartment door illuminates everyone. Atmospheric fog.',
    defaultMood: 'confident'
  }
};

var MOOD_PROMPTS = {
  positive: 'confident smile with thumbs up',
  warning: 'frustrated facepalm expression',
  thinking: 'thoughtful analyzing expression with hand on chin',
  shock: 'shocked expression with both hands on head',
  confident: 'confident knowing expression pointing up'
};

var POSITION_PROMPTS = {
  left: 'on LEFT side',
  right: 'on RIGHT side',
  center: 'in CENTER'
};

function doGet(e) {
  var callback = e.parameter.callback || 'callback';
  var action = e.parameter.action || '';
  var result;

  try {
    if (action === 'generate') {
      var topic = e.parameter.topic || '';
      var template = e.parameter.template || 'auto';
      var position = e.parameter.position || 'left';
      var mood = e.parameter.mood || 'positive';
      
      result = generateThumbnails(topic, template, position, mood);
    } else {
      result = { ok: true, status: 'Thumbnail Generator API ready' };
    }
  } catch (err) {
    result = { ok: false, error: err.toString() };
  }

  var output = ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ')');
  output.setMimeType(ContentService.MimeType.JAVASCRIPT);
  return output;
}

function generateThumbnails(topic, templateKey, position, mood) {
  // Auto-select template based on topic keywords
  if (templateKey === 'auto') {
    templateKey = autoSelectTemplate(topic);
  }
  
  var template = TEMPLATES[templateKey] || TEMPLATES['a'];
  var moodPrompt = MOOD_PROMPTS[mood] || MOOD_PROMPTS['positive'];
  var posPrompt = POSITION_PROMPTS[position] || POSITION_PROMPTS['left'];
  
  // Generate text suggestions
  var textSuggestions = generateTextSuggestions(topic, templateKey);
  
  var thumbnails = [];
  var debugInfo = { apiKey: GEMINI_API_KEY ? 'set (length ' + GEMINI_API_KEY.length + ')' : 'MISSING', textSuggestions: textSuggestions };
  
  // Generate only 1 thumbnail per request (Apps Script timeout is ~6min)
  for (var i = 0; i < 1; i++) {
    var texts = textSuggestions[i] || textSuggestions[0];
    
    var prompt = buildPrompt(template, moodPrompt, posPrompt, texts.top, texts.bottom, position);
    
    try {
      var imageData = callGeminiImageApi(prompt);
      if (imageData) {
        var driveUrl = saveToGDrive(imageData, 'thumbnail_' + templateKey + '_' + (i+1) + '_' + Date.now() + '.png');
        thumbnails.push({
          url: driveUrl,
          filename: 'thumbnail_' + (i+1) + '.png',
          topText: texts.top,
          bottomText: texts.bottom,
          template: templateKey
        });
      } else {
        thumbnails.push({ error: 'No image data for thumbnail ' + (i+1), prompt: prompt.substring(0, 200) });
      }
    } catch (err) {
      thumbnails.push({ error: err.toString(), stack: (err.stack || '').substring(0, 200) });
    }
  }
  
  return { ok: true, thumbnails: thumbnails, template: templateKey, debug: debugInfo };
}

function autoSelectTemplate(topic) {
  var t = topic.toLowerCase();
  
  // Warning keywords
  if (t.match(/fehler|risiko|scheitern|warnung|achtung|verlust|gefahr|schlecht|problem/)) return 'b';
  
  // Comparison keywords
  if (t.match(/oder|vergleich|versus|vs\.|besser|unterschied/)) return 'c';
  
  // Mystery/curiosity keywords
  if (t.match(/trick|geheim|keiner|wenige|warum|wieso/)) return 'd';
  
  // Premium keywords
  if (t.match(/führungskraft|executive|premium|luxus|high.?class|exklusiv/)) return 'e';
  
  // Crowd/demand keywords
  if (t.match(/nachfrage|menschenmenge|alle wollen|beliebt/)) return 'f';
  
  // Default: positive
  return 'a';
}

function generateTextSuggestions(topic, templateKey) {
  // Use Gemini text API to generate 3 text variations
  var textPrompt = 'Du bist ein YouTube-Thumbnail-Texter für die Immobilien-Nische (deutsch). ' +
    'Erstelle 3 verschiedene Text-Varianten für ein Thumbnail. ' +
    'Jede Variante hat eine obere Zeile (2-3 Wörter, weiß) und eine untere Zeile (2-3 Wörter, auf rotem Banner). ' +
    'Curiosity Gap nutzen — nicht alles verraten! ' +
    'Video-Thema: "' + topic + '"\n\n' +
    'Antwort als JSON Array: [{"top":"OBERE ZEILE","bottom":"UNTERE ZEILE"}, ...]';
  
  try {
    var response = callGeminiTextApi(textPrompt);
    var jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    Logger.log('Text generation error: ' + err);
  }
  
  // Fallback
  return [
    { top: 'DAS MUSST DU', bottom: 'WISSEN...' },
    { top: 'ACHTUNG', bottom: 'WICHTIG!' },
    { top: 'SO GEHTS', bottom: 'RICHTIG!' }
  ];
}

function buildPrompt(template, moodPrompt, posPrompt, topText, bottomText, position) {
  var textPosition = position === 'left' ? 'right' : 'left';
  
  return 'YouTube thumbnail 16:9. Man ' + posPrompt + ', extremely large filling 85% height, close crop, ' + 
    moodPrompt + '. IMPORTANT: Keep skin texture completely natural and realistic - visible pores, no smoothing. ' +
    template.bgPrompt + ' ' +
    'Text top ' + textPosition + ': \'' + topText + '\' white bold Montserrat with drop shadow. ' +
    'Bottom ' + textPosition + ': \'' + bottomText + '\' white extra-bold on solid red banner bar. ' +
    'Text never overlapping face. Professional cinematic thumbnail. All text in German.';
}

function callGeminiImageApi(prompt) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' + GEMINI_API_KEY;
  
  var payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE']
    }
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  Logger.log('Calling Gemini with prompt length: ' + prompt.length);
  var response = UrlFetchApp.fetch(url, options);
  var responseCode = response.getResponseCode();
  var responseText = response.getContentText();
  Logger.log('Response code: ' + responseCode);
  Logger.log('Response length: ' + responseText.length);
  
  if (responseCode !== 200) {
    Logger.log('API Error: ' + responseText.substring(0, 500));
    return null;
  }
  
  var data = JSON.parse(responseText);
  
  if (data.error) {
    Logger.log('Gemini Error: ' + data.error.message);
    return null;
  }
  
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    var parts = data.candidates[0].content.parts;
    Logger.log('Parts count: ' + parts.length);
    for (var i = 0; i < parts.length; i++) {
      if (parts[i].inlineData) {
        Logger.log('Found image! Mime: ' + parts[i].inlineData.mimeType + ' Data length: ' + parts[i].inlineData.data.length);
        return parts[i].inlineData.data;
      }
      if (parts[i].text) {
        Logger.log('Text part: ' + parts[i].text.substring(0, 100));
      }
    }
  } else {
    Logger.log('No candidates in response: ' + responseText.substring(0, 300));
  }
  
  return null;
}

function callGeminiTextApi(prompt) {
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;
  
  var payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  var response = UrlFetchApp.fetch(url, options);
  var data = JSON.parse(response.getContentText());
  
  if (data.candidates && data.candidates[0]) {
    return data.candidates[0].content.parts[0].text;
  }
  
  return '';
}

function saveToGDrive(base64Data, filename) {
  // Get or create output folder
  var folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  var folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  
  // Decode base64 and save
  var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/png', filename);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // Return direct download URL
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}
