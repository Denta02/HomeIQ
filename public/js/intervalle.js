/**
 * HomeIQ – Katalog der Wartungsintervalle
 * ------------------------------------------------------------------
 * Jeder Eintrag trägt seine Herkunft mit: Rechtsgrundlage, Quelle,
 * Geltungsbereich und ob er verifiziert ist.
 *
 * Wichtigste Unterscheidung im Katalog:
 *
 *   gesetzlich  – ergibt sich aus Gesetz oder Verordnung
 *   normativ    – ergibt sich aus einer Norm (DIN), oft nur mittelbar
 *                 verbindlich über Verweise in Vorschriften
 *   vertraglich – Herstellerbedingungen, Garantie, Mietvertrag
 *   empfehlung  – reine Erfahrungswerte, keine Pflicht
 *
 * Viele Pflichten gelten NUR gewerblich oder NUR ab einer Gebäude-
 * größe. Ein Katalog, der das verschweigt, erzeugt falsche Pflichten
 * im Kopf des Nutzers. Deshalb hat jeder Eintrag ein `gilt`-Objekt,
 * und `vorlagenFuer()` filtert danach.
 *
 * `geprueft: false` heißt: plausibel, aber nicht an einer belastbaren
 * Quelle verifiziert. Die Oberfläche muss das kenntlich machen.
 */

'use strict';

var VORLAGEN = [

  /* ---------- Rauchwarnmelder ---------- */
  {
    key: 'rauchmelder_inspektion',
    titel: 'Rauchwarnmelder prüfen',
    kategorie: 'rauchmelder',
    art: 'wiederkehrend',
    intervallWert: 12,
    intervallEinheit: 'monate',
    intervallBasis: 'plan',
    vorlaufTage: 30,
    pflichtArt: 'normativ',
    rechtsgrundlage: 'DIN 14676',
    beschreibung: 'Raucheintrittsöffnungen frei, keine Hindernisse im Umkreis, Funktionsprüfung, Batteriezustand.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: 'Die Norm setzt höchstens 12 Monate an. Ob und wer prüfen muss, regeln die Bauordnungen der Länder – das ist je Bundesland verschieden.',
    quelle: null,
    geprueft: true
  },
  {
    key: 'rauchmelder_austausch',
    titel: 'Rauchwarnmelder austauschen',
    kategorie: 'rauchmelder',
    art: 'einmalig',
    fristWert: 10,
    fristEinheit: 'jahre',
    fristAb: 'einbauDatum',
    pflichtArt: 'normativ',
    rechtsgrundlage: 'DIN 14676, Herstellerangabe',
    beschreibung: 'Melder werden nach etwa zehn Jahren ersetzt, nicht repariert.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: 'Maßgeblich ist die Herstellerangabe auf dem Gerät.',
    quelle: null,
    geprueft: false
  },

  /* ---------- Feuerlöscher ---------- */
  {
    key: 'feuerloescher_inspektion_gewerblich',
    titel: 'Feuerlöscher prüfen lassen',
    kategorie: 'feuerloescher',
    art: 'wiederkehrend',
    intervallWert: 24,
    intervallEinheit: 'monate',
    intervallBasis: 'plan',
    vorlaufTage: 60,
    pflichtArt: 'gesetzlich',
    rechtsgrundlage: 'DIN 14406-4 in Verbindung mit BetrSichV und ASR A2.2',
    beschreibung: 'Instandhaltung durch einen Sachkundigen, nicht durch den Betreiber selbst.',
    gilt: { nutzung: ['gewerblich'], minEinheiten: 1 },
    hinweis: 'Gilt für Arbeitsstätten. Im reinen Privathaushalt besteht keine Prüfpflicht.',
    quelle: null,
    geprueft: true
  },
  {
    key: 'feuerloescher_inspektion_privat',
    titel: 'Feuerlöscher prüfen lassen (freiwillig)',
    kategorie: 'feuerloescher',
    art: 'wiederkehrend',
    intervallWert: 24,
    intervallEinheit: 'monate',
    intervallBasis: 'plan',
    vorlaufTage: 60,
    pflichtArt: 'empfehlung',
    rechtsgrundlage: 'keine – angelehnt an DIN 14406-4',
    beschreibung: 'Im Privathaushalt keine Pflicht, aber dieselbe Logik: ein ungeprüfter Löscher kann im Ernstfall versagen.',
    gilt: { nutzung: ['privat'], minEinheiten: 1 },
    hinweis: 'Bewusst als Empfehlung geführt, nicht als Pflicht.',
    quelle: null,
    geprueft: true
  },
  {
    key: 'feuerloescher_innere_pruefung',
    titel: 'Feuerlöscher: innere Prüfung',
    kategorie: 'feuerloescher',
    art: 'wiederkehrend',
    intervallWert: 5,
    intervallEinheit: 'jahre',
    intervallBasis: 'plan',
    vorlaufTage: 60,
    pflichtArt: 'gesetzlich',
    rechtsgrundlage: 'BetrSichV',
    beschreibung: 'Innere Prüfung druckführender Geräte, spätestens nach fünf Jahren.',
    gilt: { nutzung: ['gewerblich'], minEinheiten: 1 },
    hinweis: 'Fristbeginn ist das Herstelldatum auf dem Behälter, nicht der Kauf.',
    quelle: null,
    geprueft: false
  },

  /* ---------- Heizung ---------- */
  {
    key: 'heizungspruefung_geg60b',
    titel: 'Heizungsprüfung und -optimierung nach § 60b GEG',
    kategorie: 'heizung',
    art: 'einmalig',
    fristWert: 15,
    fristEinheit: 'jahre',
    fristAb: 'einbauDatum',
    nachfristMonate: 12,
    pflichtArt: 'gesetzlich',
    rechtsgrundlage: '§ 60b GEG',
    beschreibung: 'Wasserführende Heizung, keine Wärmepumpe: Prüfung innerhalb eines Jahres nach Ablauf von 15 Jahren nach Einbau.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 6 },
    hinweis: 'Gilt erst ab sechs Wohn- oder Nutzungseinheiten. Ein- und Zweifamilienhäuser sind ausgenommen. Für Anlagen von vor dem 01.10.2009 gilt eine Frist bis zum 30.09.2027.',
    quelle: null,
    geprueft: true
  },
  {
    key: 'heizungswartung',
    titel: 'Heizung warten lassen',
    kategorie: 'heizung',
    art: 'wiederkehrend',
    intervallWert: 12,
    intervallEinheit: 'monate',
    intervallBasis: 'plan',
    vorlaufTage: 30,
    pflichtArt: 'vertraglich',
    rechtsgrundlage: 'Herstellervorgabe, häufig Bedingung für die Garantie',
    beschreibung: 'Regelmäßige Wartung durch den Fachbetrieb.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: 'Keine allgemeine gesetzliche Pflicht. Die Vorgabe steht in den Garantiebedingungen oder im Wartungsvertrag – dort das genaue Intervall nachsehen.',
    quelle: null,
    geprueft: false
  },
  {
    key: 'schornsteinfeger',
    titel: 'Schornsteinfegertermin',
    kategorie: 'heizung',
    art: 'extern',
    pflichtArt: 'gesetzlich',
    rechtsgrundlage: 'Kehr- und Überprüfungsordnung, Feuerstättenbescheid',
    beschreibung: 'Kehrung, Überprüfung und Feuerstättenschau.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: 'Die Termine stehen nicht frei fest, sondern im Feuerstättenbescheid des zuständigen Bezirksschornsteinfegers. Dort ablesen und als eigene Aufgabe eintragen.',
    quelle: null,
    geprueft: false
  },

  /* ---------- Geräte und Gebäude ---------- */
  {
    key: 'dachrinne',
    titel: 'Dachrinne reinigen',
    kategorie: 'gebaeude',
    art: 'wiederkehrend',
    intervallWert: 12,
    intervallEinheit: 'monate',
    intervallBasis: 'plan',
    vorlaufTage: 21,
    pflichtArt: 'empfehlung',
    rechtsgrundlage: null,
    beschreibung: 'Im Herbst nach dem Laubfall.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: 'Erfahrungswert. Bei viel Baumbestand zweimal jährlich.',
    quelle: null,
    geprueft: true
  },
  {
    key: 'dunstabzug_fettfilter',
    titel: 'Fettfilter der Dunstabzugshaube reinigen',
    kategorie: 'haushaltsgeraet',
    art: 'wiederkehrend',
    intervallWert: 3,
    intervallEinheit: 'monate',
    intervallBasis: 'erledigung',
    vorlaufTage: 7,
    pflichtArt: 'empfehlung',
    rechtsgrundlage: null,
    beschreibung: 'Fettfilter spülen, Aktivkohlefilter je nach Typ tauschen.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: 'Hängt stark vom Kochverhalten ab – hier zählt der Abstand, nicht ein fester Termin.',
    quelle: null,
    geprueft: true
  },
  {
    key: 'waschmaschine_flusensieb',
    titel: 'Flusensieb reinigen',
    kategorie: 'haushaltsgeraet',
    art: 'wiederkehrend',
    intervallWert: 6,
    intervallEinheit: 'monate',
    intervallBasis: 'erledigung',
    vorlaufTage: 7,
    pflichtArt: 'empfehlung',
    rechtsgrundlage: null,
    beschreibung: 'Sieb und Pumpenraum säubern.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: '',
    quelle: null,
    geprueft: true
  },
  {
    key: 'geraet_lueftung',
    titel: 'Lüftungsschlitze reinigen',
    kategorie: 'elektronik',
    art: 'wiederkehrend',
    intervallWert: 6,
    intervallEinheit: 'monate',
    intervallBasis: 'erledigung',
    vorlaufTage: 14,
    pflichtArt: 'empfehlung',
    rechtsgrundlage: null,
    beschreibung: 'Staub aus Lüftungsöffnungen entfernen, Gerät ausgeschaltet.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: '',
    quelle: null,
    geprueft: true
  },
  {
    key: 'datensicherung',
    titel: 'Datensicherung prüfen',
    kategorie: 'elektronik',
    art: 'wiederkehrend',
    intervallWert: 3,
    intervallEinheit: 'monate',
    intervallBasis: 'plan',
    vorlaufTage: 7,
    pflichtArt: 'empfehlung',
    rechtsgrundlage: null,
    beschreibung: 'Nicht nur ob gesichert wurde, sondern ob sich eine Datei zurückholen lässt.',
    gilt: { nutzung: ['privat', 'gewerblich'], minEinheiten: 1 },
    hinweis: '',
    quelle: null,
    geprueft: true
  }
];

/* ================================================================
 * Zugriff
 * ================================================================ */

var STANDARD_KONTEXT = { nutzung: 'privat', einheiten: 1 };

function kontextMit(kontext) {
  var k = kontext || {};
  return {
    nutzung: k.nutzung === 'gewerblich' ? 'gewerblich' : 'privat',
    einheiten: Number.isInteger(k.einheiten) && k.einheiten > 0 ? k.einheiten : 1
  };
}

/** Passt eine Vorlage zum Gebäude und zur Nutzung? */
function anwendbar(vorlage, kontext) {
  var k = kontextMit(kontext);
  var gilt = vorlage.gilt || {};
  if (Array.isArray(gilt.nutzung) && gilt.nutzung.indexOf(k.nutzung) === -1) return false;
  if (Number.isInteger(gilt.minEinheiten) && k.einheiten < gilt.minEinheiten) return false;
  return true;
}

/** Alle passenden Vorlagen einer Kategorie. */
function vorlagenFuer(kategorie, kontext) {
  return VORLAGEN.filter(function (v) {
    return (!kategorie || v.kategorie === kategorie) && anwendbar(v, kontext);
  });
}

function vorlageNach(key) {
  for (var i = 0; i < VORLAGEN.length; i++) {
    if (VORLAGEN[i].key === key) return VORLAGEN[i];
  }
  return null;
}

/**
 * Baut aus einer wiederkehrenden Vorlage eine Aufgabe für ein Gerät.
 * Wirft bei Vorlagen, die keine Intervallaufgabe sind – einmalige
 * Fristen und externe Termine brauchen eine andere Behandlung.
 */
function aufgabeAusVorlage(key, ankerDatum) {
  var v = vorlageNach(key);
  if (!v) throw new RangeError('Unbekannte Vorlage: ' + key);
  if (v.art !== 'wiederkehrend') {
    throw new RangeError('Vorlage "' + key + '" ist vom Typ "' + v.art +
      '" und lässt sich nicht als Intervallaufgabe anlegen.');
  }
  return {
    id: 'auf_' + Date.now(),
    titel: v.titel,
    quelle: 'vorlage:' + v.key,
    aktiv: true,
    intervallWert: v.intervallWert,
    intervallEinheit: v.intervallEinheit,
    intervallBasis: v.intervallBasis,
    ankerDatum: ankerDatum || '',
    vorlaufTage: v.vorlaufTage,
    erledigungen: []
  };
}

/** Kurztext für die Anzeige: woher kommt diese Aufgabe? */
function herkunftText(vorlage) {
  if (!vorlage) return '';
  var nach = {
    gesetzlich: 'Gesetzliche Pflicht',
    normativ: 'Aus einer Norm',
    vertraglich: 'Vertraglich oder vom Hersteller',
    empfehlung: 'Empfehlung, keine Pflicht'
  }[vorlage.pflichtArt] || 'Herkunft unklar';
  return vorlage.rechtsgrundlage ? nach + ' · ' + vorlage.rechtsgrundlage : nach;
}

/** Alle Einträge, die noch verifiziert werden müssen. */
function ungeprueft() {
  return VORLAGEN.filter(function (v) { return !v.geprueft; });
}

var Intervalle = {
  VORLAGEN: VORLAGEN,
  STANDARD_KONTEXT: STANDARD_KONTEXT,
  anwendbar: anwendbar,
  vorlagenFuer: vorlagenFuer,
  vorlageNach: vorlageNach,
  aufgabeAusVorlage: aufgabeAusVorlage,
  herkunftText: herkunftText,
  ungeprueft: ungeprueft
};

if (typeof module !== 'undefined' && module.exports) module.exports = Intervalle;
if (typeof window !== 'undefined') window.Intervalle = Intervalle;
