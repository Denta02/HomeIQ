/**
 * HomeIQ – Speicherschicht
 * ------------------------------------------------------------------
 * Wie in VehicleIQ: Der Arbeitsstand liegt im localStorage, der
 * Abgleich mit Drive läuft beim Start.
 *
 * Das Modul kapselt drei Dinge, die sonst überall verstreut landen:
 *
 *   1. Zugriff auf den Speicher, inklusive Ausfallsicherung.
 *      Ist localStorage nicht verfügbar oder gesperrt, wird still auf
 *      einen Speicher im Arbeitsspeicher umgeschaltet. Die App läuft
 *      dann weiter, meldet das aber über `zustand()` – sie tut nicht
 *      so, als wäre gespeichert worden.
 *
 *   2. Schemastand und Migration. Gelesen wird nie blind.
 *
 *   3. Zusammenführung von lokalem und fernem Stand anhand der
 *      `geaendert`-Zeitstempel.
 *
 * `laden`, `sichern` und `loeschen` liefern Promises. localStorage
 * arbeitet zwar synchron, aber IndexedDB kann das nicht – und die
 * Belege werden dort landen. Die Schnittstelle nimmt das vorweg,
 * damit der Wechsel später nur dieses Modul betrifft.
 *
 * Zugriffe auf denselben Schlüssel laufen nacheinander ab. Zwei rasch
 * aufeinanderfolgende Änderungen könnten sich sonst überholen, und
 * der ältere Stand käme zuletzt an.
 *
 * Der Backend wird übergeben, damit sich alles ohne Browser testen
 * lässt. Ohne Angabe wird window.localStorage genommen.
 */

'use strict';

var SCHEMA_VERSION = 1;

/* ================================================================
 * 1. Backend
 * ================================================================ */

/** Speicher im Arbeitsspeicher, gleiche Schnittstelle wie localStorage. */
function speicherImRam() {
  var daten = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(daten, k) ? daten[k] : null; },
    setItem: function (k, v) { daten[k] = String(v); },
    removeItem: function (k) { delete daten[k]; },
    _art: 'ram'
  };
}

/**
 * Prüft, ob ein Backend wirklich beschreibbar ist. Ein vorhandenes
 * localStorage-Objekt bedeutet nicht, dass es benutzt werden darf:
 * im privaten Modus oder bei gesperrten Cookies wirft setItem.
 */
function istBenutzbar(backend) {
  if (!backend) return false;
  var probe = '__homeiq_probe__';
  try {
    backend.setItem(probe, '1');
    backend.removeItem(probe);
    return true;
  } catch (e) {
    return false;
  }
}

/* ================================================================
 * 2. Migration
 * ================================================================ */

/**
 * Migrationen von einer Schemaversion zur nächsten.
 * Jede Funktion bekommt die Daten und gibt sie verändert zurück.
 * Noch leer – der Platz ist bewusst schon da.
 */
var MIGRATIONEN = {
  // 1: function (daten) { ... macht aus Version 1 Version 2 ... }
};

function migriere(daten) {
  var schritte = [];
  var stand = Number.isInteger(daten.schemaVersion) ? daten.schemaVersion : 0;

  while (stand < SCHEMA_VERSION) {
    var fn = MIGRATIONEN[stand];
    if (!fn) {
      /* Keine Migration hinterlegt: Version hochsetzen, aber vermerken.
         Besser als abbrechen, solange sich die Struktur nicht ändert. */
      schritte.push({ von: stand, nach: stand + 1, art: 'uebersprungen' });
    } else {
      daten = fn(daten);
      schritte.push({ von: stand, nach: stand + 1, art: 'ausgefuehrt' });
    }
    stand += 1;
  }

  daten.schemaVersion = SCHEMA_VERSION;
  return { daten: daten, schritte: schritte };
}

/* ================================================================
 * 3. Speicher
 * ================================================================ */

function erzeuge(backend, praefix) {
  var vorgabe = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null;
  var gewaehlt = backend || vorgabe;
  var echt = istBenutzbar(gewaehlt);
  var store = echt ? gewaehlt : speicherImRam();
  /* Ein benutzbares Backend ist nicht automatisch dauerhaft: wird ein
     RAM-Speicher übergeben, lässt er sich zwar beschreiben, überlebt
     aber das Schließen nicht. Die Kennung entscheidet, nicht der
     Schreibtest. */
  var dauerhaft = echt && store._art !== 'ram';
  var px = praefix || 'homeiq:';
  var letzterFehler = null;

  function schluessel(name) { return px + name; }

  /**
   * Lädt und migriert. Liefert immer ein Ergebnisobjekt, wirft nie.
   *   { daten, gefunden, migriert, defekt, fehler }
   */
  function ladenSofort(name, vorgabeDaten) {
    letzterFehler = null;
    var roh;
    try {
      roh = store.getItem(schluessel(name));
    } catch (e) {
      letzterFehler = e.message;
      return { daten: vorgabeDaten || null, gefunden: false, migriert: [], defekt: false, fehler: e.message };
    }

    if (roh === null || roh === undefined || roh === '') {
      return { daten: vorgabeDaten || null, gefunden: false, migriert: [], defekt: false, fehler: null };
    }

    var geparst;
    try {
      geparst = JSON.parse(roh);
    } catch (e) {
      /* Beschädigte Daten werden NICHT überschrieben, sondern zur
         Seite gelegt. Sonst ist der einzige Stand unwiederbringlich
         weg, bevor jemand hinsehen konnte. */
      try {
        store.setItem(schluessel(name) + ':defekt:' + Date.now(), roh);
      } catch (e2) { /* dann eben nicht */ }
      letzterFehler = 'Gespeicherte Daten waren nicht lesbar: ' + e.message;
      return { daten: vorgabeDaten || null, gefunden: true, migriert: [], defekt: true, fehler: letzterFehler };
    }

    if (!geparst || typeof geparst !== 'object') {
      return { daten: vorgabeDaten || null, gefunden: true, migriert: [], defekt: true,
               fehler: 'Gespeicherter Inhalt war kein Objekt.' };
    }

    var m = migriere(geparst);
    return { daten: m.daten, gefunden: true, migriert: m.schritte, defekt: false, fehler: null };
  }

  /**
   * Sichert. Liefert { erfolg, fehler, groesse }.
   * Bei vollem Speicher kommt ein klarer Fehler zurück statt einer
   * stillen Ausnahme mitten im Klickpfad.
   */
  function sichernSofort(name, daten) {
    letzterFehler = null;
    var kopie = daten || {};
    kopie.schemaVersion = SCHEMA_VERSION;
    kopie.gespeichert = new Date().toISOString();

    var text;
    try {
      text = JSON.stringify(kopie);
    } catch (e) {
      letzterFehler = 'Daten ließen sich nicht in JSON umwandeln: ' + e.message;
      return { erfolg: false, fehler: letzterFehler, groesse: 0 };
    }

    try {
      store.setItem(schluessel(name), text);
      return { erfolg: true, fehler: null, groesse: text.length };
    } catch (e) {
      var voll = /quota|exceeded|storage/i.test(String(e.name) + String(e.message));
      letzterFehler = voll
        ? 'Der lokale Speicher ist voll. Dokumente gehören als Drive-Verweis in die Daten, nicht als Inhalt.'
        : 'Speichern fehlgeschlagen: ' + e.message;
      return { erfolg: false, fehler: letzterFehler, groesse: text.length };
    }
  }

  function loeschenSofort(name) {
    try { store.removeItem(schluessel(name)); return true; }
    catch (e) { letzterFehler = e.message; return false; }
  }

  /* Eine Kette je Schlüssel. Jede Anfrage hängt sich hinten an,
     unabhängig davon, ob die vorherige erfolgreich war oder nicht. */
  var ketten = {};

  function inReihe(name, arbeit) {
    var vorher = ketten[name] || Promise.resolve();
    var naechste = vorher.then(arbeit, arbeit);
    ketten[name] = naechste.then(function () {}, function () {});
    return naechste;
  }

  function laden(name, vorgabeDaten) {
    return inReihe(name, function () { return ladenSofort(name, vorgabeDaten); });
  }

  function sichern(name, daten) {
    return inReihe(name, function () { return sichernSofort(name, daten); });
  }

  function loeschen(name) {
    return inReihe(name, function () { return loeschenSofort(name); });
  }

  /** Wartet, bis alles Angestoßene durch ist. Für Tests und fürs Beenden. */
  function ruhe() {
    return Promise.all(Object.keys(ketten).map(function (k) { return ketten[k]; }));
  }

  function zustand() {
    return {
      art: dauerhaft ? 'localStorage' : 'arbeitsspeicher',
      dauerhaft: dauerhaft,
      schemaVersion: SCHEMA_VERSION,
      letzterFehler: letzterFehler,
      hinweis: dauerhaft ? null
        : 'Kein dauerhafter Speicher verfügbar. Änderungen gehen beim Schließen verloren.'
    };
  }

  return {
    laden: laden,
    sichern: sichern,
    loeschen: loeschen,
    ruhe: ruhe,
    zustand: zustand
  };
}

/* ================================================================
 * 4. Zusammenführung für den Drive-Abgleich
 * ================================================================ */

function zeit(wert) {
  if (typeof wert !== 'string' || !wert) return 0;
  var t = Date.parse(wert);
  return Number.isFinite(t) ? t : 0;
}

/**
 * Führt lokalen und fernen Stand zusammen.
 *
 * Regel: je Gerät gewinnt der neuere `geaendert`-Zeitstempel.
 * Geräte, die nur auf einer Seite vorkommen, bleiben erhalten.
 *
 * ACHTUNG – bekannte Grenze: Löschungen lassen sich so nicht
 * übertragen. Ein auf Gerät A gelöschtes Gerät kommt von Gerät B
 * zurück, weil "gelöscht" und "dort neu angelegt" ununterscheidbar
 * sind. Wer löschen will, muss `geloescht: true` setzen statt den
 * Eintrag zu entfernen. Solche Einträge werden hier durchgereicht
 * und von der Oberfläche ausgeblendet.
 */
function zusammenfuehren(lokal, fern) {
  if (!fern) return { objekt: lokal, quelle: 'nur lokal', konflikte: [] };
  if (!lokal) return { objekt: fern, quelle: 'nur fern', konflikte: [] };

  var konflikte = [];
  var neuerFern = zeit(fern.geaendert) > zeit(lokal.geaendert);
  var basis = neuerFern ? fern : lokal;

  var ergebnis = {};
  Object.keys(basis).forEach(function (k) {
    if (k !== 'geraete') ergebnis[k] = basis[k];
  });

  var nach = {};
  var reihenfolge = [];

  function aufnehmen(geraet, seite) {
    if (!geraet || !geraet.id) return;
    if (!nach[geraet.id]) {
      nach[geraet.id] = { geraet: geraet, seite: seite };
      reihenfolge.push(geraet.id);
      return;
    }
    var da = nach[geraet.id];
    var tA = zeit(da.geraet.geaendert);
    var tB = zeit(geraet.geaendert);

    if (tA === 0 && tB === 0) {
      konflikte.push({
        geraetId: geraet.id,
        art: 'ohne_zeitstempel',
        text: 'Beide Stände haben keinen Zeitstempel. Der lokale wurde behalten.'
      });
      return;
    }
    if (tB > tA) {
      konflikte.push({
        geraetId: geraet.id,
        art: 'ersetzt',
        text: 'Der Stand aus "' + seite + '" ist neuer und hat den aus "' + da.seite + '" ersetzt.'
      });
      nach[geraet.id] = { geraet: geraet, seite: seite };
    } else if (tB === tA && da.seite !== seite) {
      konflikte.push({
        geraetId: geraet.id,
        art: 'gleichstand',
        text: 'Beide Stände sind gleich alt. Der aus "' + da.seite + '" wurde behalten.'
      });
    }
  }

  (lokal.geraete || []).forEach(function (g) { aufnehmen(g, 'lokal'); });
  (fern.geraete || []).forEach(function (g) { aufnehmen(g, 'fern'); });

  ergebnis.geraete = reihenfolge.map(function (id) { return nach[id].geraet; });
  ergebnis.geaendert = neuerFern ? fern.geaendert : lokal.geaendert;

  return {
    objekt: ergebnis,
    quelle: neuerFern ? 'fern führend' : 'lokal führend',
    konflikte: konflikte
  };
}

var Speicher = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  MIGRATIONEN: MIGRATIONEN,
  speicherImRam: speicherImRam,
  istBenutzbar: istBenutzbar,
  migriere: migriere,
  erzeuge: erzeuge,
  zusammenfuehren: zusammenfuehren
};

if (typeof module !== 'undefined' && module.exports) module.exports = Speicher;
if (typeof window !== 'undefined') window.Speicher = Speicher;
