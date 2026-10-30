/**
 * HomeIQ – Drive-Adapter
 * ------------------------------------------------------------------
 * Erfüllt genau die Schnittstelle, die sync.js erwartet:
 *
 *   laden()        -> Promise<Objekt|null>
 *   sichern(obj)   -> Promise<void>
 *
 * Dazwischen liegt die Android-Brücke. Das Kernproblem dabei:
 * Ein @JavascriptInterface-Aufruf kehrt sofort zurück, ein Drive-
 * Zugriff dauert. Die Brücke kann das Ergebnis also nicht als
 * Rückgabewert liefern – sie meldet sich später zurück.
 *
 * Deshalb bekommt jeder Aufruf eine Kennung. Android ruft damit
 * `antwort(kennung, jsonText, fehlerText)` auf, und der Adapter löst
 * das passende Promise auf.
 *
 * Erwartete Brücke (Android, @JavascriptInterface):
 *
 *   driveLaden(kennung: String): void
 *   driveSichern(kennung: String, jsonText: String): void
 *   driveStatus(): String    // JSON, synchron
 *                            // { angemeldet: bool, konto: String|null,
 *                            //   fehler: String|null }
 *   driveAnmelden(kennung: String): void
 *
 * Android antwortet über:
 *   webView.evaluateJavascript(
 *     "window.HomeIQ.driveAntwort(" + json(kennung) + "," +
 *     json(inhaltOderNull) + "," + json(fehlerOderNull) + ")", null)
 *
 * Alles Zeitabhängige wird hereingereicht, damit der Adapter ohne
 * Android und ohne echte Wartezeit testbar bleibt.
 */

'use strict';

var VORGABE_TIMEOUT_MS = 30000;

function erzeuge(optionen) {
  var o = optionen || {};
  var bruecke = o.bruecke || null;
  var timeoutMs = Number.isInteger(o.timeoutMs) ? o.timeoutMs : VORGABE_TIMEOUT_MS;
  var setze = o.setTimeoutFn || (typeof setTimeout !== 'undefined' ? setTimeout : null);
  var loesche = o.clearTimeoutFn || (typeof clearTimeout !== 'undefined' ? clearTimeout : null);

  var zaehler = 0;
  var idGeber = o.idGeber || function () { zaehler += 1; return 'd' + zaehler; };

  var offen = {};   // kennung -> { aufloesen, ablehnen, timer, art }

  function vorhanden() {
    return !!(bruecke && typeof bruecke.driveLaden === 'function' &&
              typeof bruecke.driveSichern === 'function');
  }

  function anfrage(art, starten) {
    if (!vorhanden()) {
      return Promise.reject(new Error('Keine Drive-Brücke vorhanden. Läuft die App außerhalb des WebView?'));
    }

    var kennung = idGeber();

    return new Promise(function (aufloesen, ablehnen) {
      var eintrag = { aufloesen: aufloesen, ablehnen: ablehnen, art: art, timer: null };

      if (setze && timeoutMs > 0) {
        eintrag.timer = setze(function () {
          if (offen[kennung]) {
            delete offen[kennung];
            ablehnen(new Error('Zeitüberschreitung beim Drive-Zugriff (' + art + ').'));
          }
        }, timeoutMs);
      }

      offen[kennung] = eintrag;

      try {
        starten(kennung);
      } catch (e) {
        if (offen[kennung]) {
          if (eintrag.timer && loesche) loesche(eintrag.timer);
          delete offen[kennung];
        }
        ablehnen(new Error('Brücke hat den Aufruf abgelehnt: ' + e.message));
      }
    });
  }

  /**
   * Wird von Android aufgerufen.
   *   inhalt: JSON-Text, null oder "" (kein Stand vorhanden)
   *   fehler: Text oder null
   *
   * Unbekannte Kennungen werden still verworfen – eine verspätete
   * Antwort nach einer Zeitüberschreitung darf nichts umwerfen.
   */
  function antwort(kennung, inhalt, fehler) {
    var eintrag = offen[kennung];
    if (!eintrag) return false;

    if (eintrag.timer && loesche) loesche(eintrag.timer);
    delete offen[kennung];

    if (fehler) {
      eintrag.ablehnen(new Error(String(fehler)));
      return true;
    }

    if (eintrag.art === 'sichern' || eintrag.art === 'anmelden') {
      eintrag.aufloesen(true);
      return true;
    }

    if (inhalt === null || inhalt === undefined || inhalt === '') {
      eintrag.aufloesen(null);       // noch kein Stand in Drive
      return true;
    }

    try {
      var geparst = JSON.parse(inhalt);
      if (!geparst || typeof geparst !== 'object') {
        eintrag.ablehnen(new Error('Drive lieferte kein Objekt.'));
        return true;
      }
      eintrag.aufloesen(geparst);
    } catch (e) {
      /* Kein Rateversuch: eine kaputte Datei in Drive darf nicht als
         leerer Stand durchgehen, sonst überschreibt der nächste
         Upload sie endgültig. */
      eintrag.ablehnen(new Error('Inhalt aus Drive war kein gültiges JSON: ' + e.message));
    }
    return true;
  }

  function laden() {
    return anfrage('laden', function (kennung) { bruecke.driveLaden(kennung); });
  }

  function sichern(objekt) {
    var text;
    try {
      text = JSON.stringify(objekt);
    } catch (e) {
      return Promise.reject(new Error('Daten ließen sich nicht in JSON umwandeln: ' + e.message));
    }
    return anfrage('sichern', function (kennung) { bruecke.driveSichern(kennung, text); });
  }

  function anmelden() {
    if (!bruecke || typeof bruecke.driveAnmelden !== 'function') {
      return Promise.reject(new Error('Die Brücke bietet keine Anmeldung an.'));
    }
    return anfrage('anmelden', function (kennung) { bruecke.driveAnmelden(kennung); });
  }

  /** Synchron, weil Android das ohne Netzzugriff beantworten kann. */
  function status() {
    if (!bruecke || typeof bruecke.driveStatus !== 'function') {
      return { angemeldet: false, konto: null, fehler: 'Keine Brücke vorhanden.', bruecke: false };
    }
    try {
      var roh = bruecke.driveStatus();
      var z = typeof roh === 'string' ? JSON.parse(roh) : roh;
      return {
        angemeldet: !!(z && z.angemeldet),
        konto: (z && z.konto) || null,
        fehler: (z && z.fehler) || null,
        bruecke: true
      };
    } catch (e) {
      return { angemeldet: false, konto: null, fehler: 'Status unlesbar: ' + e.message, bruecke: true };
    }
  }

  function offeneAnfragen() {
    return Object.keys(offen).length;
  }

  /** Bricht alles Offene ab, etwa beim Abmelden. */
  function abbrechen(grund) {
    Object.keys(offen).forEach(function (k) {
      var e = offen[k];
      if (e.timer && loesche) loesche(e.timer);
      delete offen[k];
      e.ablehnen(new Error(grund || 'Abgebrochen.'));
    });
  }

  return {
    laden: laden,
    sichern: sichern,
    anmelden: anmelden,
    status: status,
    antwort: antwort,
    vorhanden: vorhanden,
    offeneAnfragen: offeneAnfragen,
    abbrechen: abbrechen
  };
}

/** Hängt den Adapter dorthin, wo Android ihn erwartet. */
function registriereGlobal(adapter, ziel) {
  var w = ziel || (typeof window !== 'undefined' ? window : null);
  if (!w) return false;
  w.HomeIQ = w.HomeIQ || {};
  w.HomeIQ.driveAntwort = function (kennung, inhalt, fehler) {
    return adapter.antwort(kennung, inhalt, fehler);
  };
  return true;
}

var DriveAdapter = {
  VORGABE_TIMEOUT_MS: VORGABE_TIMEOUT_MS,
  erzeuge: erzeuge,
  registriereGlobal: registriereGlobal
};

if (typeof module !== 'undefined' && module.exports) module.exports = DriveAdapter;
if (typeof window !== 'undefined') window.DriveAdapter = DriveAdapter;
