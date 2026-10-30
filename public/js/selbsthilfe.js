/**
 * HomeIQ – Sicherheitsgatter für die KI-Selbsthilfe
 * ------------------------------------------------------------------
 * Grundsatz: Die Sperre sitzt im Code, nicht im Prompt. Ein Prompt
 * lässt sich umformulieren, überreden oder durch ungewöhnliche
 * Eingaben aushebeln. Eine Fallunterscheidung nicht.
 *
 * Die Funktionen hier entscheiden VOR jedem Modellaufruf, ob und
 * worüber überhaupt beraten werden darf.
 *
 * Stufen:
 *   frei            Anleitung möglich
 *   eingeschraenkt  Nur klar begrenzte Themen, kein Öffnen des Geräts
 *   gesperrt        Keine Anleitung, nur Verweis auf den Fachbetrieb
 */

'use strict';

var STUFEN = ['frei', 'eingeschraenkt', 'gesperrt'];

/* ================================================================
 * 1. Notfälle – schlagen alles andere
 * ================================================================ */

/**
 * Stichworte, bei denen keine Diagnose stattfindet, sondern sofort
 * eine Handlungsanweisung. Bewusst grob gehalten: ein Fehlalarm ist
 * harmlos, ein übersehener Gasaustritt nicht.
 */
var NOTFAELLE = [
  {
    key: 'gas',
    stichworte: ['gasgeruch', 'gas riecht', 'riecht nach gas', 'gasleck', 'gas austritt', 'gas ausgetreten'],
    titel: 'Möglicher Gasaustritt',
    schritte: [
      'Keine elektrischen Schalter, Stecker oder Klingeln betätigen und kein Licht anmachen.',
      'Keine offene Flamme, nicht rauchen, das Telefon im Haus nicht benutzen.',
      'Fenster und Türen öffnen.',
      'Wenn gefahrlos erreichbar: den Gashaupthahn schließen.',
      'Das Gebäude verlassen, andere Bewohner warnen.',
      'Von draußen den Notruf 112 oder den Gasnotdienst des Versorgers anrufen.'
    ]
  },
  {
    key: 'feuer',
    stichworte: ['brennt', 'feuer', 'flammen', 'qualm', 'rauch aus', 'raucht aus', 'schmort', 'verschmort'],
    titel: 'Feuer oder Schmorgeruch',
    schritte: [
      'Wenn gefahrlos möglich: Stecker ziehen oder Sicherung ausschalten.',
      'Nicht mit Wasser an ein brennendes Elektrogerät gehen.',
      'Bei offenem Feuer oder starker Rauchentwicklung das Gebäude verlassen.',
      'Notruf 112.'
    ]
  },
  {
    key: 'stromschlag',
    stichworte: ['stromschlag', 'geschlagen bekommen', 'gewischt', 'unter strom', 'elektrisiert'],
    titel: 'Stromschlag',
    schritte: [
      'Das Gerät nicht mehr berühren, Sicherung ausschalten.',
      'Bei betroffenen Personen: nicht anfassen, bevor der Strom abgeschaltet ist.',
      'Nach einem Stromschlag ärztliche Abklärung, auch wenn es einem gut geht – Herzrhythmusstörungen können verzögert auftreten.',
      'Notruf 112.'
    ]
  },
  {
    key: 'co',
    stichworte: ['kohlenmonoxid', 'co-melder', 'co melder', 'übelkeit heizung', 'kopfschmerzen heizung'],
    titel: 'Verdacht auf Kohlenmonoxid',
    schritte: [
      'Sofort ins Freie gehen und alle Personen mitnehmen.',
      'Fenster und Türen auf dem Weg nach draußen öffnen, wenn es keine Zeit kostet.',
      'Nicht zurück ins Gebäude gehen.',
      'Notruf 112. Kohlenmonoxid ist geruchlos, Symptome werden leicht für einen Infekt gehalten.'
    ]
  },
  {
    key: 'wasser_strom',
    stichworte: ['wasser im sicherungskasten', 'wasser an der steckdose', 'steckdose nass', 'sicherungskasten nass'],
    titel: 'Wasser an elektrischen Anlagen',
    schritte: [
      'Den betroffenen Bereich nicht betreten und nichts berühren.',
      'Wenn der Sicherungskasten trocken und gefahrlos erreichbar ist: Strom abschalten.',
      'Sonst den Netzbetreiber oder die Feuerwehr verständigen.'
    ]
  }
];

function normText(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
}

/** Sucht Notfallstichworte im freien Text. Liefert null oder den Fall. */
function pruefeNotfall(text) {
  var t = normText(text);
  if (!t.trim()) return null;
  for (var i = 0; i < NOTFAELLE.length; i++) {
    var fall = NOTFAELLE[i];
    for (var j = 0; j < fall.stichworte.length; j++) {
      if (t.indexOf(normText(fall.stichworte[j])) !== -1) return fall;
    }
  }
  return null;
}

/* ================================================================
 * 2. Kategorien
 * ================================================================ */

var KATEGORIEN = {
  heizung_gas: {
    stufe: 'gesperrt',
    grund: 'Gasführende Anlage. Arbeiten daran sind dem zugelassenen Fachbetrieb vorbehalten.',
    fachbetrieb: 'Heizungsbauer oder Gasinstallateur'
  },
  heizung_oel: {
    stufe: 'gesperrt',
    grund: 'Feuerungsanlage mit Brennstoff unter Druck.',
    fachbetrieb: 'Heizungsbauer'
  },
  elektro_fest: {
    stufe: 'gesperrt',
    grund: 'Fest installierte Elektrik hinter der Steckdose. Arbeiten daran sind der Elektrofachkraft vorbehalten.',
    fachbetrieb: 'Elektrofachbetrieb'
  },
  klima_waermepumpe: {
    stufe: 'gesperrt',
    grund: 'Geschlossener Kältemittelkreis unter Druck, sachkundepflichtig.',
    fachbetrieb: 'Kälteanlagenbauer'
  },
  druckbehaelter: {
    stufe: 'gesperrt',
    grund: 'Druckbehälter. Unsachgemäße Eingriffe können zu schweren Verletzungen führen.',
    fachbetrieb: 'Fachbetrieb für Druckgeräte'
  },
  gastherme: {
    stufe: 'gesperrt',
    grund: 'Gasführendes Gerät.',
    fachbetrieb: 'Heizungsbauer oder Gasinstallateur'
  },

  haushaltsgeraet: {
    stufe: 'eingeschraenkt',
    grund: 'Nur Bedienung, Reinigung und frei zugängliche Teile. Das Gehäuse bleibt zu.',
    erlaubt: ['Fehlercode deuten', 'Filter und Sieb reinigen', 'Dichtung prüfen',
              'Abfluss und Zulauf prüfen', 'Beladung und Programmwahl', 'Gerät ausrichten']
  },
  wasser_sanitaer: {
    stufe: 'eingeschraenkt',
    grund: 'Nur drucklose, frei zugängliche Teile. Kein Eingriff in Leitungen.',
    erlaubt: ['Perlator reinigen', 'Siphon prüfen', 'Eckventil schließen', 'Spülkasten einstellen']
  },
  elektronik: {
    stufe: 'frei',
    grund: 'Netzbetriebenes Kleingerät ohne besondere Gefährdung.',
    erlaubt: ['Fehlermeldung deuten', 'Lüftung reinigen', 'Software und Treiber',
              'Akku und Netzteil prüfen', 'Datensicherung', 'Reparatur wirtschaftlich?']
  },
  rauchmelder: {
    stufe: 'frei',
    grund: 'Batteriebetriebenes Gerät.',
    erlaubt: ['Funktionsprüfung', 'Batterie wechseln', 'Fehlalarm eingrenzen', 'Austauschfrist prüfen']
  },
  moebel_bau: {
    stufe: 'frei',
    grund: 'Keine elektrische oder gasführende Gefährdung.',
    erlaubt: ['Beschläge nachziehen', 'Oberfläche pflegen']
  }
};

var UNBEKANNT = {
  stufe: 'eingeschraenkt',
  grund: 'Die Gerätekategorie ist nicht hinterlegt. Vorsichtshalber nur allgemeine Hinweise.',
  erlaubt: ['Fehlermeldung deuten', 'Bedienung nachschlagen', 'Anschluss und Stromversorgung prüfen']
};

function kategorieInfo(kategorie) {
  var k = KATEGORIEN[kategorie];
  return k ? k : UNBEKANNT;
}

/* ================================================================
 * 3. Gesamturteil
 * ================================================================ */

/**
 * Entscheidet, ob und worüber die KI-Selbsthilfe beraten darf.
 *
 * Rückgabe:
 *   { stufe, notfall, grund, erlaubteThemen, fachbetrieb, darfModellFragen }
 *
 * `darfModellFragen` ist das Signal für die Oberfläche: ist es false,
 * wird der Knopf gar nicht erst angeboten.
 */
function bewerteAnliegen(kategorie, symptomText) {
  var notfall = pruefeNotfall(symptomText);
  if (notfall) {
    return {
      stufe: 'gesperrt',
      notfall: notfall,
      grund: notfall.titel + '. Vor allem anderen gilt die Handlungsanweisung unten.',
      erlaubteThemen: [],
      fachbetrieb: null,
      darfModellFragen: false
    };
  }

  var info = kategorieInfo(kategorie);
  return {
    stufe: info.stufe,
    notfall: null,
    grund: info.grund,
    erlaubteThemen: info.erlaubt || [],
    fachbetrieb: info.fachbetrieb || null,
    darfModellFragen: info.stufe !== 'gesperrt'
  };
}

/**
 * Baut den Prompt-Baustein für die Selbsthilfe. Wird nur aufgerufen,
 * wenn `darfModellFragen` true ist – der Text ist eine zusätzliche
 * Leitplanke, nicht die Sperre selbst.
 */
function selbsthilfePrompt(urteil, geraetBezeichnung) {
  if (!urteil || !urteil.darfModellFragen) {
    throw new Error('Für dieses Anliegen darf kein Modell befragt werden.');
  }
  var zeilen = [
    'Gerät: ' + (geraetBezeichnung || 'unbekannt'),
    'Erlaubte Themen: ' + (urteil.erlaubteThemen.join(', ') || 'allgemeine Bedienhinweise'),
    '',
    'Regeln:',
    '- Beschränke dich auf die erlaubten Themen.',
    '- Keine Anleitung zum Öffnen des Geräts, wenn das Thema es nicht ausdrücklich abdeckt.',
    '- Keine Arbeiten an Gas, fester Elektroinstallation, Kältemittelkreisen oder Druckbehältern.',
    '- Wenn die Lösung außerhalb der erlaubten Themen liegt, sage das und verweise auf den Fachbetrieb.',
    '- Nenne zuerst den einfachsten Schritt.',
    '- Rate nicht. Bei unklarer Fehlerlage frage nach einer konkreten Beobachtung.'
  ];
  if (urteil.stufe === 'eingeschraenkt') {
    zeilen.push('- Das Gehäuse bleibt geschlossen.');
  }
  return zeilen.join('\n');
}

var Selbsthilfe = {
  STUFEN: STUFEN,
  NOTFAELLE: NOTFAELLE,
  KATEGORIEN: KATEGORIEN,
  UNBEKANNT: UNBEKANNT,
  pruefeNotfall: pruefeNotfall,
  kategorieInfo: kategorieInfo,
  bewerteAnliegen: bewerteAnliegen,
  selbsthilfePrompt: selbsthilfePrompt
};

if (typeof module !== 'undefined' && module.exports) module.exports = Selbsthilfe;
if (typeof window !== 'undefined') window.Selbsthilfe = Selbsthilfe;
