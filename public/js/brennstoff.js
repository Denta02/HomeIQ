/**
 * HomeIQ – Brennstofflieferungen und Verbrauch
 * ------------------------------------------------------------------
 * Für Heizöl, Pellets und Brennholz: Lieferungen erfassen, daraus
 * Preisentwicklung und Verbrauch ableiten.
 *
 * NICHT für Gas oder Strom. Dort liefert der Zähler einen fortlaufenden
 * Stand, keine Liefermenge – das ist eine andere Rechnung und gehört
 * in ein eigenes Modul.
 *
 * Speicherregeln wie im übrigen Projekt:
 *   - Datum als "YYYY-MM-DD"
 *   - Geld als ganzzahlige Cent
 *   - Menge als ganzzahlige Hundertstel der Einheit
 *     (250000 = 2500,00 Liter), damit keine Fließkommafehler entstehen
 *   - Preis pro Einheit wird berechnet, nie gespeichert
 *
 * Die wichtigste Einschränkung steht in `verbrauchsAbschnitte`:
 * Aus Lieferungen allein lässt sich der Verbrauch nur dann sauber
 * ableiten, wenn beide Lieferungen den Tank bis zur gleichen Höhe
 * gefüllt haben. Sonst ist es eine Schätzung, und das muss dranstehen.
 */

'use strict';

var EINHEITEN = {
  liter: { label: 'Liter', kurz: 'l', bezug: 100, bezugText: 'je 100 l' },
  kg:    { label: 'Kilogramm', kurz: 'kg', bezug: 1000, bezugText: 'je Tonne' },
  rm:    { label: 'Raummeter', kurz: 'rm', bezug: 1, bezugText: 'je rm' },
  kwh:   { label: 'Kilowattstunde', kurz: 'kWh', bezug: 1, bezugText: 'je kWh' }
};

function einheitInfo(einheit) {
  return EINHEITEN[einheit] || EINHEITEN.liter;
}

function istGanzzahlPositiv(n) {
  return Number.isInteger(n) && n > 0;
}

/* ================================================================
 * 1. Einzelne Lieferung
 * ================================================================ */

/**
 * Prüft eine Lieferung. Liefert Hinweise, blockiert nichts –
 * die Entscheidung bleibt beim Aufrufer.
 */
function pruefeLieferung(eintrag, istDatumGueltig) {
  var hinweise = [];
  var e = eintrag || {};

  if (!istDatumGueltig(e.datum)) {
    hinweise.push({ feld: 'datum', schwere: 'fehler', text: 'Kein gültiges Lieferdatum.' });
  }
  if (!istGanzzahlPositiv(e.mengeHundertstel)) {
    hinweise.push({ feld: 'menge', schwere: 'fehler', text: 'Die Menge muss größer als null sein.' });
  }
  if (!Number.isInteger(e.gesamtCent) || e.gesamtCent < 0) {
    hinweise.push({ feld: 'preis', schwere: 'fehler', text: 'Der Gesamtpreis fehlt oder ist negativ.' });
  }
  if (e.volltankung !== true && e.volltankung !== false) {
    hinweise.push({ feld: 'volltankung', schwere: 'hinweis',
      text: 'Nicht vermerkt, ob bis zur gewohnten Höhe befüllt wurde. Ohne diese Angabe bleibt der Verbrauch eine Schätzung.' });
  }
  return hinweise;
}

/**
 * Preis je Bezugsmenge in Cent, als Zahl mit Nachkommastellen.
 * Nur zur Anzeige gedacht – gespeichert wird ausschließlich
 * `gesamtCent` und `mengeHundertstel`.
 */
function preisProBezug(eintrag) {
  if (!eintrag || !istGanzzahlPositiv(eintrag.mengeHundertstel)) return null;
  var info = einheitInfo(eintrag.einheit);
  var menge = eintrag.mengeHundertstel / 100;
  return (eintrag.gesamtCent / menge) * info.bezug;
}

/* ================================================================
 * 2. Sortieren und Summieren
 * ================================================================ */

function sortiert(eintraege, istDatumGueltig) {
  return (eintraege || [])
    .filter(function (e) { return e && istDatumGueltig(e.datum) && istGanzzahlPositiv(e.mengeHundertstel); })
    .slice()
    .sort(function (a, b) { return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : 0); });
}

function summe(eintraege, istDatumGueltig) {
  var liste = sortiert(eintraege, istDatumGueltig);
  var mengeH = 0, cent = 0;
  liste.forEach(function (e) {
    mengeH += e.mengeHundertstel;
    cent += Number.isInteger(e.gesamtCent) ? e.gesamtCent : 0;
  });
  return {
    anzahl: liste.length,
    mengeHundertstel: mengeH,
    gesamtCent: cent,
    erste: liste.length ? liste[0].datum : null,
    letzte: liste.length ? liste[liste.length - 1].datum : null
  };
}

/* ================================================================
 * 3. Verbrauch
 * ================================================================ */

/**
 * Abschnitte zwischen aufeinanderfolgenden Lieferungen.
 *
 * Die Menge der SPÄTEREN Lieferung ist das, was seit der früheren
 * verbraucht wurde – aber nur, wenn beide bis zur gleichen Höhe
 * gefüllt haben. Ist das bei einer der beiden nicht vermerkt oder
 * ausdrücklich verneint, wird der Abschnitt als nicht belastbar
 * gekennzeichnet.
 */
function verbrauchsAbschnitte(eintraege, istDatumGueltig, tageZwischen) {
  var liste = sortiert(eintraege, istDatumGueltig);
  var abschnitte = [];

  for (var i = 1; i < liste.length; i++) {
    var vor = liste[i - 1];
    var jetzt = liste[i];
    var tage = tageZwischen(vor.datum, jetzt.datum);
    if (tage <= 0) continue;

    var belastbar = vor.volltankung === true && jetzt.volltankung === true;
    abschnitte.push({
      von: vor.datum,
      bis: jetzt.datum,
      tage: tage,
      mengeHundertstel: jetzt.mengeHundertstel,
      proTagHundertstel: jetzt.mengeHundertstel / tage,
      kostenCent: Number.isInteger(jetzt.gesamtCent) ? jetzt.gesamtCent : 0,
      belastbar: belastbar,
      grund: belastbar ? null
        : 'Eine der beiden Lieferungen ist nicht als Befüllung bis zur gewohnten Höhe vermerkt.'
    });
  }
  return abschnitte;
}

/**
 * Verbrauch über die gesamte belastbare Spanne: von der ersten bis
 * zur letzten Volltankung. Alles, was dazwischen geliefert wurde,
 * ist in dieser Zeit auch verbraucht worden.
 *
 * Das ist die verlässlichere Zahl, weil sich einzelne Teilbefüllungen
 * über eine lange Spanne herausmitteln.
 */
function verbrauchSpanne(eintraege, istDatumGueltig, tageZwischen) {
  var liste = sortiert(eintraege, istDatumGueltig);
  var voll = liste.filter(function (e) { return e.volltankung === true; });

  if (voll.length < 2) {
    return { belastbar: false,
      grund: 'Es braucht mindestens zwei Lieferungen, die bis zur gewohnten Höhe befüllt haben.' };
  }

  var start = voll[0];
  var ende = voll[voll.length - 1];
  var tage = tageZwischen(start.datum, ende.datum);
  if (tage <= 0) {
    return { belastbar: false, grund: 'Die Spanne ist zu kurz für eine Aussage.' };
  }

  var mengeH = 0, cent = 0;
  liste.forEach(function (e) {
    if (e.datum > start.datum && e.datum <= ende.datum) {
      mengeH += e.mengeHundertstel;
      cent += Number.isInteger(e.gesamtCent) ? e.gesamtCent : 0;
    }
  });

  return {
    belastbar: true,
    von: start.datum,
    bis: ende.datum,
    tage: tage,
    mengeHundertstel: mengeH,
    kostenCent: cent,
    proTagHundertstel: mengeH / tage,
    proJahrHundertstel: (mengeH / tage) * 365,
    kostenProTagCent: cent / tage
  };
}

/** Menge und Kosten je Kalenderjahr. */
function jahresUebersicht(eintraege, istDatumGueltig) {
  var liste = sortiert(eintraege, istDatumGueltig);
  var nach = {};
  liste.forEach(function (e) {
    var jahr = e.datum.slice(0, 4);
    if (!nach[jahr]) nach[jahr] = { jahr: jahr, anzahl: 0, mengeHundertstel: 0, gesamtCent: 0 };
    nach[jahr].anzahl += 1;
    nach[jahr].mengeHundertstel += e.mengeHundertstel;
    nach[jahr].gesamtCent += Number.isInteger(e.gesamtCent) ? e.gesamtCent : 0;
  });
  return Object.keys(nach).sort().map(function (j) {
    var z = nach[j];
    z.schnittPreisProBezug = preisProBezug({
      mengeHundertstel: z.mengeHundertstel,
      gesamtCent: z.gesamtCent,
      einheit: liste.length ? liste[0].einheit : 'liter'
    });
    return z;
  });
}

/**
 * Preisentwicklung als Reihe für eine Grafik.
 * Enthält bewusst keine Prognose – aus Heizölpreisen der
 * Vergangenheit lässt sich der nächste Winter nicht ableiten.
 */
function preisReihe(eintraege, istDatumGueltig) {
  return sortiert(eintraege, istDatumGueltig).map(function (e) {
    return { datum: e.datum, preisProBezug: preisProBezug(e), einheit: e.einheit || 'liter' };
  });
}

/* ================================================================
 * 4. Anzeige
 * ================================================================ */

function mengeText(hundertstel, einheit) {
  if (!Number.isFinite(hundertstel)) return '–';
  var info = einheitInfo(einheit);
  var wert = hundertstel / 100;
  var nk = wert < 100 ? 2 : 0;
  return wert.toFixed(nk).replace('.', ',') + ' ' + info.kurz;
}

function eurText(cent) {
  if (!Number.isFinite(cent)) return '–';
  return (cent / 100).toFixed(2).replace('.', ',') + ' €';
}

function preisText(eintragOderCent, einheit) {
  var cent = typeof eintragOderCent === 'number' ? eintragOderCent : preisProBezug(eintragOderCent);
  if (cent === null || !Number.isFinite(cent)) return '–';
  var info = einheitInfo(einheit || (eintragOderCent && eintragOderCent.einheit));
  return (cent / 100).toFixed(2).replace('.', ',') + ' € ' + info.bezugText;
}

var Brennstoff = {
  EINHEITEN: EINHEITEN,
  einheitInfo: einheitInfo,
  pruefeLieferung: pruefeLieferung,
  preisProBezug: preisProBezug,
  sortiert: sortiert,
  summe: summe,
  verbrauchsAbschnitte: verbrauchsAbschnitte,
  verbrauchSpanne: verbrauchSpanne,
  jahresUebersicht: jahresUebersicht,
  preisReihe: preisReihe,
  mengeText: mengeText,
  eurText: eurText,
  preisText: preisText
};

if (typeof module !== 'undefined' && module.exports) module.exports = Brennstoff;
if (typeof window !== 'undefined') window.Brennstoff = Brennstoff;
