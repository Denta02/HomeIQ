/**
 * HomeIQ – Belegdateien
 * ------------------------------------------------------------------
 * Rechnungen, Typenschildfotos, Handbücher: die eigentlichen Dateien.
 *
 * Warum ein eigener Speicher und nicht das bestehende JSON:
 *
 *   - Eine Rechnung als Foto liegt bei 150 bis 400 kB. Als Base64 im
 *     JSON wären das ein Drittel mehr, und localStorage ist nach
 *     wenigen Belegen voll.
 *   - Das JSON wird bei JEDER Änderung vollständig nach Drive
 *     geschrieben. Lägen die Dateien darin, würde das Eintragen einer
 *     Wartung sämtliche Belege erneut hochladen.
 *
 * Deshalb: Beschreibung des Belegs bleibt im JSON (Titel, Typ, Datum,
 * erkannter Text), die Datei selbst liegt hier, angesprochen über
 * dieselbe `id`.
 *
 * Steht IndexedDB nicht zur Verfügung – in Tests, bei gesperrtem
 * Speicher –, wird still auf den Arbeitsspeicher ausgewichen und das
 * über `zustand()` gemeldet. Die App tut nie so, als wäre etwas
 * dauerhaft gespeichert, wenn es das nicht ist.
 */

'use strict';

var DB_NAME = 'homeiq-belege';
var DB_VERSION = 1;
var LAGER = 'dateien';

/* Ab hier wird gewarnt. Kein hartes Verbot: lieber ein großer Beleg
   als ein verlorener. */
var WARNUNG_AB_BYTES = 8 * 1024 * 1024;

function speicherImRam() {
  var daten = {};
  return {
    _art: 'ram',
    ablegen: function (eintrag) { daten[eintrag.id] = eintrag; return Promise.resolve(eintrag); },
    holen: function (id) { return Promise.resolve(daten[id] || null); },
    entfernen: function (id) { delete daten[id]; return Promise.resolve(true); },
    alle: function () {
      return Promise.resolve(Object.keys(daten).map(function (k) {
        var e = daten[k];
        return { id: e.id, dateiname: e.dateiname, mime: e.mime,
                 groesseBytes: e.groesseBytes, erstellt: e.erstellt };
      }));
    }
  };
}

function datenbankOeffnen(idb) {
  return new Promise(function (aufloesen, ablehnen) {
    var anfrage;
    try { anfrage = idb.open(DB_NAME, DB_VERSION); }
    catch (e) { ablehnen(e); return; }

    anfrage.onupgradeneeded = function () {
      var db = anfrage.result;
      if (!db.objectStoreNames.contains(LAGER)) db.createObjectStore(LAGER, { keyPath: 'id' });
    };
    anfrage.onsuccess = function () { aufloesen(anfrage.result); };
    anfrage.onerror = function () { ablehnen(anfrage.error || new Error('IndexedDB nicht zu öffnen')); };
    anfrage.onblocked = function () { ablehnen(new Error('IndexedDB blockiert, andere Instanz offen')); };
  });
}

function speicherInIdb(db) {
  function vorgang(modus, arbeit) {
    return new Promise(function (aufloesen, ablehnen) {
      var t;
      try { t = db.transaction(LAGER, modus); }
      catch (e) { ablehnen(e); return; }
      var lager = t.objectStore(LAGER);
      var anfrage = arbeit(lager);
      t.onerror = function () { ablehnen(t.error || new Error('Zugriff fehlgeschlagen')); };
      t.onabort = function () { ablehnen(t.error || new Error('Zugriff abgebrochen')); };
      t.oncomplete = function () { aufloesen(anfrage ? anfrage.result : null); };
    });
  }

  return {
    _art: 'indexeddb',
    ablegen: function (eintrag) {
      return vorgang('readwrite', function (l) { return l.put(eintrag); })
        .then(function () { return eintrag; });
    },
    holen: function (id) {
      return vorgang('readonly', function (l) { return l.get(id); })
        .then(function (r) { return r || null; });
    },
    entfernen: function (id) {
      return vorgang('readwrite', function (l) { return l.delete(id); })
        .then(function () { return true; });
    },
    alle: function () {
      return vorgang('readonly', function (l) { return l.getAll(); })
        .then(function (liste) {
          return (liste || []).map(function (e) {
            return { id: e.id, dateiname: e.dateiname, mime: e.mime,
                     groesseBytes: e.groesseBytes, erstellt: e.erstellt };
          });
        });
    }
  };
}

/**
 * Baut den Belegspeicher auf. Liefert ein Promise, weil IndexedDB
 * asynchron geöffnet wird.
 */
function erzeuge(optionen) {
  var o = optionen || {};
  var idb = o.indexedDB !== undefined
    ? o.indexedDB
    : (typeof window !== 'undefined' ? window.indexedDB : null);

  var letzterFehler = null;

  function mitSpeicher(unterbau, dauerhaft) {
    function groessePruefen(groesse) {
      return groesse > WARNUNG_AB_BYTES
        ? 'Die Datei ist größer als ' + Math.round(WARNUNG_AB_BYTES / 1024 / 1024) +
          ' MB. Ein kleineres Foto reicht für einen Beleg meist aus.'
        : null;
    }

    /**
     * Legt eine Datei ab.
     * `inhalt` ist ein Blob, eine Datei oder ein ArrayBuffer.
     * Rückgabe: { erfolg, id, groesseBytes, warnung, fehler }
     */
    function ablegen(id, inhalt, angaben) {
      var a = angaben || {};
      if (!id) return Promise.resolve({ erfolg: false, fehler: 'Ohne Kennung lässt sich nichts ablegen.' });
      if (!inhalt) return Promise.resolve({ erfolg: false, fehler: 'Keine Datei übergeben.' });

      var groesse = a.groesseBytes;
      if (!Number.isFinite(groesse)) {
        groesse = inhalt.size !== undefined ? inhalt.size
                : (inhalt.byteLength !== undefined ? inhalt.byteLength : 0);
      }

      var eintrag = {
        id: id,
        inhalt: inhalt,
        dateiname: a.dateiname || '',
        mime: a.mime || (inhalt.type || 'application/octet-stream'),
        groesseBytes: groesse,
        erstellt: a.erstellt || new Date().toISOString()
      };

      return unterbau.ablegen(eintrag)
        .then(function () {
          letzterFehler = null;
          return { erfolg: true, id: id, groesseBytes: groesse, warnung: groessePruefen(groesse), fehler: null };
        })
        .catch(function (e) {
          letzterFehler = e.message;
          var voll = /quota|exceeded|storage/i.test(String(e.name) + String(e.message));
          return { erfolg: false, id: id, fehler: voll
            ? 'Der Speicher ist voll. Ältere Belege entfernen oder kleinere Fotos verwenden.'
            : 'Ablegen fehlgeschlagen: ' + e.message };
        });
    }

    function holen(id) {
      return unterbau.holen(id).catch(function (e) {
        letzterFehler = e.message;
        return null;
      });
    }

    function entfernen(id) {
      return unterbau.entfernen(id).catch(function (e) {
        letzterFehler = e.message;
        return false;
      });
    }

    function liste() {
      return unterbau.alle().catch(function (e) {
        letzterFehler = e.message;
        return [];
      });
    }

    /**
     * Räumt Dateien ab, zu denen es keine Beschreibung mehr gibt.
     * Wird ein Gerät gelöscht, verschwinden seine Dokumenteinträge –
     * die Dateien blieben sonst für immer liegen.
     */
    function aufraeumen(bekannteIds) {
      var bekannt = {};
      (bekannteIds || []).forEach(function (x) { bekannt[x] = true; });
      return liste().then(function (vorhanden) {
        var verwaist = vorhanden.filter(function (e) { return !bekannt[e.id]; });
        return Promise.all(verwaist.map(function (e) { return entfernen(e.id); }))
          .then(function () {
            return {
              entfernt: verwaist.length,
              bytes: verwaist.reduce(function (a, b) { return a + (b.groesseBytes || 0); }, 0)
            };
          });
      });
    }

    function belegt() {
      return liste().then(function (l) {
        return {
          anzahl: l.length,
          bytes: l.reduce(function (a, b) { return a + (b.groesseBytes || 0); }, 0)
        };
      });
    }

    function zustand() {
      return {
        art: dauerhaft ? 'indexeddb' : 'arbeitsspeicher',
        dauerhaft: dauerhaft,
        letzterFehler: letzterFehler,
        hinweis: dauerhaft ? null
          : 'Belege werden nicht dauerhaft gespeichert und sind nach dem Schließen weg.'
      };
    }

    return {
      ablegen: ablegen, holen: holen, entfernen: entfernen,
      liste: liste, aufraeumen: aufraeumen, belegt: belegt, zustand: zustand,
      WARNUNG_AB_BYTES: WARNUNG_AB_BYTES
    };
  }

  if (!idb) {
    return Promise.resolve(mitSpeicher(speicherImRam(), false));
  }

  return datenbankOeffnen(idb)
    .then(function (db) { return mitSpeicher(speicherInIdb(db), true); })
    .catch(function (e) {
      letzterFehler = e.message;
      return mitSpeicher(speicherImRam(), false);
    });
}

var Belege = {
  DB_NAME: DB_NAME,
  WARNUNG_AB_BYTES: WARNUNG_AB_BYTES,
  speicherImRam: speicherImRam,
  erzeuge: erzeuge
};

if (typeof module !== 'undefined' && module.exports) module.exports = Belege;
if (typeof window !== 'undefined') window.Belege = Belege;
