/**
 * HomeIQ – Objektebene
 * ------------------------------------------------------------------
 * Fasst zusammen, was in einem Gebäude ansteht: Ansprüche, die
 * ablaufen, und Aufgaben, die fällig werden – über alle Geräte hinweg
 * in einer Liste, nach Dringlichkeit sortiert.
 *
 * Das Modul rechnet nichts selbst. Es ruft `Fristen` auf und bringt
 * die Ergebnisse in eine gemeinsame Form. Die Rechenregeln bleiben an
 * einer Stelle.
 *
 * `F` wird übergeben statt importiert, damit sich das Modul ohne
 * globalen Zustand testen lässt.
 */

'use strict';

var ARTTEXT = {
  gewaehrleistung_kauf: 'Gewährleistung aus dem Kauf',
  gewaehrleistung_werk: 'Gewährleistung auf die Reparatur',
  herstellergarantie:   'Herstellergarantie'
};

var RANG = { abgelaufen: 0, laeuft_heute_ab: 1, bald: 2, ok: 3, unbekannt: 4 };

/**
 * Alle Fristen eines Geräts in einheitlicher Form.
 * Fehlerhafte Einträge verschwinden nicht, sondern kommen mit
 * `fehler` zurück – sonst fällt eine kaputte Aufgabe still hinten runter.
 */
function fristenDesGeraets(geraet, stichtag, F) {
  var raus = [];
  if (!geraet) return raus;

  (geraet.ansprueche || []).forEach(function (a) {
    if (a.aktiv === false) return;
    try {
      var auskunft = F.anspruchsAuskunft(a, stichtag, 30);
      raus.push({
        art: 'anspruch',
        geraetId: geraet.id,
        geraetName: geraet.name,
        id: a.id,
        titel: ARTTEXT[a.art] || a.art,
        zusatz: a.bezug === 'bauteil'
          ? 'nur ' + (a.bauteil || 'Bauteil')
          : 'gesamtes Gerät',
        gegenueber: (a.gegenueber && a.gegenueber.name) || '',
        datum: auskunft.ende,
        status: auskunft.status,
        restTage: auskunft.restTage,
        fehler: null
      });
    } catch (e) {
      raus.push({
        art: 'anspruch', geraetId: geraet.id, geraetName: geraet.name, id: a.id,
        titel: ARTTEXT[a.art] || a.art, zusatz: '', gegenueber: '',
        datum: null, status: 'unbekannt', restTage: null, fehler: e.message
      });
    }
  });

  (geraet.aufgaben || []).forEach(function (auf) {
    var f = F.naechsteFaelligkeit(auf, stichtag);
    if (!f) return;
    if (f.fehler) {
      raus.push({
        art: 'aufgabe', geraetId: geraet.id, geraetName: geraet.name, id: auf.id,
        titel: f.titel || auf.titel, zusatz: '', gegenueber: '',
        datum: null, status: 'unbekannt', restTage: null, fehler: f.fehler
      });
      return;
    }
    raus.push({
      art: 'aufgabe',
      geraetId: geraet.id,
      geraetName: geraet.name,
      id: auf.id,
      titel: f.titel,
      zusatz: f.intervallBasis === 'plan' ? 'fester Plan' : 'ab Erledigung',
      gegenueber: '',
      datum: f.faellig,
      status: f.status,
      restTage: f.restTage,
      fehler: null
    });
  });

  return raus;
}

/**
 * Alle Fristen eines Objekts, sortiert: erst nach Dringlichkeit,
 * innerhalb derselben Stufe nach Datum.
 */
function alleFristen(objekt, stichtag, F) {
  var liste = [];
  ((objekt && objekt.geraete) || []).forEach(function (g) {
    liste = liste.concat(fristenDesGeraets(g, stichtag, F));
  });

  liste.sort(function (a, b) {
    var ra = RANG[a.status] === undefined ? 9 : RANG[a.status];
    var rb = RANG[b.status] === undefined ? 9 : RANG[b.status];
    if (ra !== rb) return ra - rb;
    if (!a.datum) return 1;
    if (!b.datum) return -1;
    return a.datum < b.datum ? -1 : (a.datum > b.datum ? 1 : 0);
  });

  return liste;
}

/** Zählt nach Status. */
function zusammenfassung(liste) {
  var z = { gesamt: 0, abgelaufen: 0, bald: 0, ok: 0, unbekannt: 0 };
  (liste || []).forEach(function (e) {
    z.gesamt += 1;
    if (e.status === 'abgelaufen') z.abgelaufen += 1;
    else if (e.status === 'bald' || e.status === 'laeuft_heute_ab') z.bald += 1;
    else if (e.status === 'ok') z.ok += 1;
    else z.unbekannt += 1;
  });
  return z;
}

/** Die dringendsten n Einträge, Erledigtes ausgenommen. */
function naechste(liste, n) {
  var zahl = Number.isInteger(n) && n > 0 ? n : 5;
  return (liste || []).slice(0, zahl);
}

/** Fristen eines einzelnen Geräts aus einer fertigen Gesamtliste. */
function fuerGeraet(liste, geraetId) {
  return (liste || []).filter(function (e) { return e.geraetId === geraetId; });
}

var Objekt = {
  ARTTEXT: ARTTEXT,
  fristenDesGeraets: fristenDesGeraets,
  alleFristen: alleFristen,
  zusammenfassung: zusammenfassung,
  naechste: naechste,
  fuerGeraet: fuerGeraet
};

if (typeof module !== 'undefined' && module.exports) module.exports = Objekt;
if (typeof window !== 'undefined') window.Objekt = Objekt;
