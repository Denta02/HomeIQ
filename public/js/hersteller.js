/**
 * HomeIQ – Herstellerbezogene Nummernarten
 * ------------------------------------------------------------------
 * Zweck: Beim Typenschild-Scan sollen Nummern mit dem Namen benannt
 * werden, den der Hersteller selbst verwendet. Sonst sucht der Nutzer
 * später mit der falschen Nummer nach Handbuch oder Ersatzteil.
 *
 * Grundsätze:
 *  - Muster erzeugen nur HINWEISE, niemals Ablehnung. Typenschilder
 *    variieren zu stark, eine harte Validierung sperrt echte Geräte aus.
 *  - `geprueft: false` heißt: Bezeichnung plausibel, aber nicht an einer
 *    Herstellerquelle verifiziert. Die App zeigt solche Felder neutral an.
 *  - Keine erfundenen Support-URLs. `supportUrl: null` bis verifiziert.
 */

'use strict';

/* Rollen einer Nummer:
 *   modell         – identifiziert die Baureihe, führt zu Handbuch/Ersatzteil
 *   exemplar       – identifiziert das einzelne Gerät
 *   datierung      – sagt etwas über den Produktionszeitpunkt
 *   variante       – Ausführungs-/Indexkennung innerhalb einer Baureihe
 *   servicekomfort – reine Bequemlichkeit, z. B. fürs Telefonmenü
 */

var HERSTELLER = [
  {
    key: 'bsh',
    marken: ['Bosch', 'Siemens', 'Neff', 'Constructa', 'Gaggenau'],
    geprueft: true,
    supportUrl: 'https://www.bosch-home.com/de/',
    nummern: [
      { art: 'e_nr', label: 'E-Nr.', rolle: 'modell', pflicht: true,
        hinweis: 'Modellnummer aus Zahlen und Buchstaben. Führt zu Handbuch und Ersatzteilen.' },
      { art: 'e_nr_index', label: 'Index hinter dem Schrägstrich', rolle: 'variante', pflicht: false,
        hinweis: 'Die Ziffern nach dem "/" gehören zur E-Nr. und dürfen nicht weggelassen werden.' },
      { art: 'fd', label: 'FD-Nummer', rolle: 'datierung', pflicht: true,
        hinweis: 'Kennzeichnet den Produktionszeitraum. Innerhalb einer E-Nr. ändern sich Bauteile über die Jahre.' },
      { art: 'z_nr', label: 'Z-Nr.', rolle: 'exemplar', pflicht: false, hinweis: '' }
    ]
  },
  {
    key: 'miele',
    marken: ['Miele'],
    geprueft: false,
    supportUrl: null,
    nummern: [
      { art: 'typ', label: 'Typenbezeichnung', rolle: 'modell', pflicht: true, hinweis: '' },
      { art: 'material_nr', label: 'Materialnummer', rolle: 'modell', pflicht: false, hinweis: '' },
      { art: 'fabrikations_nr', label: 'Fabrikationsnummer', rolle: 'exemplar', pflicht: true,
        hinweis: 'Für den Miele-Service meist zusammen mit dem Baujahr nötig.' }
    ]
  },
  {
    key: 'electrolux',
    marken: ['AEG', 'Electrolux', 'Zanussi', 'Juno'],
    geprueft: true,
    supportUrl: null,
    nummern: [
      { art: 'pnc', label: 'PNC', rolle: 'modell', pflicht: true,
        hinweis: 'Product Number Code. Die Nummer, mit der Ersatzteile gefunden werden.' },
      { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: false, hinweis: '' },
      { art: 'modell', label: 'Modellbezeichnung', rolle: 'modell', pflicht: false, hinweis: '' }
    ]
  },
  {
    key: 'whirlpool',
    marken: ['Bauknecht', 'Whirlpool', 'Privileg', 'Ignis'],
    geprueft: true,
    supportUrl: null,
    nummern: [
      { art: 'servicenummer', label: 'Servicenummer', rolle: 'modell', pflicht: true, hinweis: '' },
      { art: 'modell', label: 'Modell', rolle: 'modell', pflicht: false, hinweis: '' },
      { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: false, hinweis: '' }
    ]
  },
  {
    key: 'beko',
    marken: ['Beko', 'Grundig', 'Blomberg'],
    geprueft: true,
    supportUrl: null,
    nummern: [
      { art: 'servicenummer', label: 'Servicenummer', rolle: 'modell', pflicht: true, hinweis: '' },
      { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: false, hinweis: '' }
    ]
  },
  {
    key: 'liebherr',
    marken: ['Liebherr'],
    geprueft: true,
    supportUrl: null,
    nummern: [
      { art: 'servicenummer', label: 'Servicenummer', rolle: 'modell', pflicht: true, hinweis: '' },
      { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: false, hinweis: '' }
    ]
  },
  {
    key: 'dell',
    marken: ['Dell', 'Alienware'],
    geprueft: true,
    supportUrl: null,
    nummern: [
      { art: 'service_tag', label: 'Service-Tag', rolle: 'exemplar', pflicht: true,
        hinweis: 'Sieben Zeichen. Bei Dell zugleich die Seriennummer und der Schlüssel zu Handbuch, Treibern und Garantiestatus.',
        muster: '^[A-Za-z0-9]{7}$' },
      { art: 'express_servicecode', label: 'Express-Servicecode', rolle: 'servicekomfort', pflicht: false,
        hinweis: 'Rein numerische Umrechnung des Service-Tags, gedacht fürs Telefonmenü.' },
      { art: 'modell', label: 'Modell', rolle: 'modell', pflicht: false, hinweis: '' }
    ]
  },
  {
    key: 'hp',
    marken: ['HP', 'Hewlett-Packard', 'Compaq'],
    geprueft: false,
    supportUrl: null,
    nummern: [
      { art: 'produktnummer', label: 'Produktnummer (P/N)', rolle: 'modell', pflicht: true,
        hinweis: 'Unterscheidet Ausstattungsvarianten desselben Modells.' },
      { art: 'seriennummer', label: 'Seriennummer (S/N)', rolle: 'exemplar', pflicht: true, hinweis: '' }
    ]
  },
  {
    key: 'lenovo',
    marken: ['Lenovo', 'ThinkPad', 'IBM'],
    geprueft: false,
    supportUrl: null,
    nummern: [
      { art: 'mtm', label: 'Machine Type Model', rolle: 'modell', pflicht: true,
        hinweis: 'Vier Zeichen Maschinentyp, drei Zeichen Modell.' },
      { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: true, hinweis: '' }
    ]
  },
  {
    key: 'apple',
    marken: ['Apple'],
    geprueft: false,
    supportUrl: null,
    nummern: [
      { art: 'modellnummer', label: 'Modellnummer', rolle: 'modell', pflicht: false,
        hinweis: 'Beginnt mit einem A, gefolgt von vier Ziffern.' },
      { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: true, hinweis: '' }
    ]
  },
  {
    key: 'samsung_lg',
    marken: ['Samsung', 'LG'],
    geprueft: false,
    supportUrl: null,
    nummern: [
      { art: 'modellcode', label: 'Modellcode', rolle: 'modell', pflicht: true, hinweis: '' },
      { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: true, hinweis: '' }
    ]
  },
  {
    key: 'heizung',
    marken: ['Vaillant', 'Viessmann', 'Buderus', 'Junkers', 'Wolf'],
    geprueft: false,
    supportUrl: null,
    nummern: [
      { art: 'artikelnummer', label: 'Artikelnummer', rolle: 'modell', pflicht: false, hinweis: '' },
      { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: true,
        hinweis: 'Bei Heizungen oft sehr lang. Vollständig erfassen, Teilstücke sind wertlos.' },
      { art: 'typ', label: 'Typbezeichnung', rolle: 'modell', pflicht: true, hinweis: '' }
    ]
  }
];

/* Rückfallebene, wenn der Hersteller unbekannt ist. */
var STANDARD = {
  key: 'standard',
  marken: [],
  geprueft: true,
  supportUrl: null,
  nummern: [
    { art: 'modell', label: 'Modell', rolle: 'modell', pflicht: true, hinweis: '' },
    { art: 'seriennummer', label: 'Seriennummer', rolle: 'exemplar', pflicht: false, hinweis: '' },
    { art: 'typ', label: 'Typbezeichnung', rolle: 'modell', pflicht: false, hinweis: '' }
  ]
};

/* ================================================================
 * Zugriff
 * ================================================================ */

function normMarke(s) {
  return String(s == null ? '' : s).toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

/** Liefert das Nummernschema zu einem Herstellernamen. Nie null. */
function schemaFuer(herstellerName) {
  var gesucht = normMarke(herstellerName);
  if (!gesucht) return STANDARD;
  for (var i = 0; i < HERSTELLER.length; i++) {
    var h = HERSTELLER[i];
    for (var j = 0; j < h.marken.length; j++) {
      if (normMarke(h.marken[j]) === gesucht) return h;
    }
  }
  return STANDARD;
}

function istBekannt(herstellerName) {
  return schemaFuer(herstellerName) !== STANDARD;
}

/** Anzeigename einer Nummernart, herstellerabhängig. */
function labelFuer(herstellerName, art) {
  var s = schemaFuer(herstellerName);
  for (var i = 0; i < s.nummern.length; i++) {
    if (s.nummern[i].art === art) return s.nummern[i].label;
  }
  return art;
}

/**
 * Prüft erfasste Nummern gegen das Schema.
 * Liefert nur Hinweise, blockiert nichts.
 * nummern: [{ art, wert }]
 */
function pruefeNummern(herstellerName, nummern) {
  var schema = schemaFuer(herstellerName);
  var vorhanden = {};
  (nummern || []).forEach(function (n) {
    if (n && n.wert && String(n.wert).trim()) vorhanden[n.art] = String(n.wert).trim();
  });

  var hinweise = [];

  schema.nummern.forEach(function (feld) {
    if (feld.pflicht && !vorhanden[feld.art]) {
      hinweise.push({
        schwere: 'fehlt',
        art: feld.art,
        text: feld.label + ' fehlt. ' + (feld.hinweis || 'Ohne sie ist das Gerät schlecht auffindbar.')
      });
    }
    if (feld.muster && vorhanden[feld.art] && !new RegExp(feld.muster).test(vorhanden[feld.art])) {
      hinweise.push({
        schwere: 'ungewoehnlich',
        art: feld.art,
        text: feld.label + ' hat ein ungewohntes Format. Bitte am Typenschild gegenprüfen.'
      });
    }
  });

  Object.keys(vorhanden).forEach(function (art) {
    var bekannt = schema.nummern.some(function (f) { return f.art === art; });
    if (!bekannt && art !== 'unbekannt') {
      hinweise.push({
        schwere: 'unpassend',
        art: art,
        text: 'Nummernart "' + art + '" ist für diesen Hersteller nicht vorgesehen.'
      });
    }
  });

  if (!schema.geprueft && schema !== STANDARD) {
    hinweise.push({
      schwere: 'ungeprueft',
      art: null,
      text: 'Die Bezeichnungen für diesen Hersteller sind noch nicht an einer Herstellerquelle verifiziert.'
    });
  }

  return hinweise;
}

/**
 * Baut den Prompt-Baustein für die Typenschild-Erkennung.
 * Bewusst als Text, damit die Regeln im Klartext prüfbar bleiben.
 */
function promptBaustein(herstellerName) {
  var schema = schemaFuer(herstellerName);
  var zeilen = schema.nummern.map(function (f) {
    return '- ' + f.art + ' (' + f.label + ')' + (f.pflicht ? ', wichtig' : '') +
           (f.hinweis ? ': ' + f.hinweis : '');
  });

  return [
    schema === STANDARD
      ? 'Der Hersteller ist unbekannt. Erfasse die Nummern so, wie sie auf dem Schild beschriftet sind.'
      : 'Hersteller: ' + herstellerName + '. Auf dem Typenschild sind folgende Nummernarten zu erwarten:',
    zeilen.join('\n'),
    '',
    'Regeln:',
    '- Übernimm Nummern exakt, einschließlich Bindestrichen, Schrägstrichen und Leerzeichen.',
    '- Ordne eine Nummer nur dann einer Art zu, wenn sie auf dem Schild so beschriftet ist',
    '  oder eindeutig zum beschriebenen Format passt.',
    '- Ist die Art unklar, verwende art "unbekannt" und übernimm die Beschriftung',
    '  vom Schild im Feld beschriftung. Rate nicht.',
    '- Erfinde keine Werte. Fehlende Angaben bleiben leer.',
    '',
    'Antworte ausschließlich mit JSON:',
    '{"hersteller":"","modell":"","nummern":[{"art":"","beschriftung":"","wert":""}]}'
  ].join('\n');
}

var Hersteller = {
  HERSTELLER: HERSTELLER,
  STANDARD: STANDARD,
  schemaFuer: schemaFuer,
  istBekannt: istBekannt,
  labelFuer: labelFuer,
  pruefeNummern: pruefeNummern,
  promptBaustein: promptBaustein,
  normMarke: normMarke
};

if (typeof module !== 'undefined' && module.exports) module.exports = Hersteller;
if (typeof window !== 'undefined') window.Hersteller = Hersteller;
