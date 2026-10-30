/**
 * HomeIQ – Drive-Adapter für den Browser
 * ------------------------------------------------------------------
 * Erfüllt dieselbe Schnittstelle wie `drive.js` (Android):
 *
 *   laden()        -> Promise<Objekt|null>
 *   sichern(obj)   -> Promise<void>
 *
 * Dazu zwei freiwillige Erweiterungen, die `sync.js` nutzt, wenn es
 * sie vorfindet:
 *
 *   stand()        -> Promise<Zahl|null>   Stand ohne Herunterladen
 *   status()       -> { angemeldet, konto }
 *
 * `stand()` ist der Grund, warum der Stand zusätzlich in
 * `appProperties` der Drive-Datei liegt und nicht nur im Inhalt: So
 * lässt sich vergleichen, ohne die Datei zu holen. Bei einem Gerät
 * mit mobilem Datentarif ist das der Unterschied zwischen einem
 * Kilobyte und dem vollen Bestand.
 *
 * Alles von außen Kommende wird hereingereicht – Google Identity
 * Services, fetch, der Sitzungsspeicher –, damit sich der Adapter
 * ohne Browser und ohne Netz testen lässt.
 */

'use strict';

var SCOPE = 'https://www.googleapis.com/auth/drive.file';
var DATEINAME = 'homeiq_daten.json';

function erzeuge(optionen) {
  var o = optionen || {};
  var clientId = o.clientId || '';
  var scope = o.scope || SCOPE;
  var dateiname = o.dateiname || DATEINAME;

  var gis = o.google !== undefined
    ? o.google
    : (typeof window !== 'undefined' ? window.google : null);
  var hole = o.fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
  var jetzt = o.jetzt || function () { return Date.now(); };

  var sitzung = o.sitzung || (typeof sessionStorage !== 'undefined' ? sessionStorage : null);
  var merker = {};
  function merkeSetzen(k, v) {
    if (sitzung) { try { sitzung.setItem(k, v); return; } catch (e) { /* gesperrt */ } }
    merker[k] = v;
  }
  function merkeLesen(k) {
    if (sitzung) { try { return sitzung.getItem(k); } catch (e) { /* gesperrt */ } }
    return Object.prototype.hasOwnProperty.call(merker, k) ? merker[k] : null;
  }
  function merkeLoeschen(k) {
    if (sitzung) { try { sitzung.removeItem(k); } catch (e) { /* gesperrt */ } }
    delete merker[k];
  }

  var token = null;
  var konto = null;

  function vorhanden() {
    return !!(clientId && gis && gis.accounts && gis.accounts.oauth2 && hole);
  }

  /* ---------- Anmeldung ---------- */

  /**
   * Holt ein Zugriffstoken.
   * `still` versucht es ohne Dialog – das klappt nur, wenn die
   * Berechtigung schon erteilt wurde.
   */
  function tokenHolen(still) {
    if (!vorhanden()) {
      return Promise.reject(new Error('Google Identity Services ist nicht geladen oder die Client-ID fehlt.'));
    }

    return new Promise(function (aufloesen, ablehnen) {
      var klient = gis.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scope,
        prompt: still ? 'none' : '',
        callback: function (antwort) {
          if (antwort.error) { ablehnen(new Error(String(antwort.error))); return; }

          /* Der Nutzer kann im Google-Dialog das Häkchen für Drive
             weglassen. Dann ist das Token gültig, aber wertlos –
             und ohne diese Prüfung scheitert erst der nächste
             Aufruf, mit einer Fehlermeldung, die niemand versteht. */
          var alleErteilt = gis.accounts.oauth2.hasGrantedAllScopes
            ? gis.accounts.oauth2.hasGrantedAllScopes(antwort, scope)
            : true;
          if (!alleErteilt) {
            ablehnen(new Error('Im Google-Dialog wurde der Zugriff auf Drive nicht erlaubt.'));
            return;
          }

          token = antwort.access_token;
          merkeSetzen('homeiq_token', token);
          aufloesen(token);
        },
        error_callback: function (fehler) {
          ablehnen(new Error('Anmeldung abgebrochen: ' + ((fehler && fehler.type) || 'unbekannt')));
        }
      });
      klient.requestAccessToken();
    });
  }

  function anmelden() {
    return tokenHolen(false).then(function () { return kontoLaden(); }).then(function () { return true; });
  }

  function kontoLaden() {
    if (!token) return Promise.resolve(null);
    return hole('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + token }
    }).then(function (a) {
      if (!a.ok) return null;
      return a.json();
    }).then(function (info) {
      konto = (info && info.email) ? String(info.email).toLowerCase() : null;
      if (konto) merkeSetzen('homeiq_konto', konto);
      return konto;
    }).catch(function () { return null; });
  }

  function abmelden() {
    var alt = token;
    token = null;
    konto = null;
    merkeLoeschen('homeiq_token');
    merkeLoeschen('homeiq_konto');
    if (alt && gis && gis.accounts && gis.accounts.oauth2 && gis.accounts.oauth2.revoke) {
      try { gis.accounts.oauth2.revoke(alt, function () {}); } catch (e) { /* egal */ }
    }
    return Promise.resolve(true);
  }

  function status() {
    if (!token) token = merkeLesen('homeiq_token');
    if (!konto) konto = merkeLesen('homeiq_konto');
    return {
      angemeldet: !!token,
      konto: konto,
      fehler: vorhanden() ? null : 'Google Identity Services nicht verfügbar.',
      bruecke: vorhanden()
    };
  }

  /* ---------- Zugriff ---------- */

  /**
   * Ruft Drive auf. Bei 401 wird genau einmal still ein neues Token
   * geholt und wiederholt – Zugriffstoken laufen nach etwa einer
   * Stunde ab, und das soll den Nutzer nichts angehen.
   */
  function driveHole(url, einstellungen) {
    if (!token) token = merkeLesen('homeiq_token');

    var senden = function () {
      var e = einstellungen || {};
      var kopf = {};
      Object.keys(e.headers || {}).forEach(function (k) { kopf[k] = e.headers[k]; });
      kopf.Authorization = 'Bearer ' + token;
      var neu = {};
      Object.keys(e).forEach(function (k) { neu[k] = e[k]; });
      neu.headers = kopf;
      return hole(url, neu);
    };

    var zuerst = token ? senden() : tokenHolen(true).then(senden);

    return zuerst.then(function (antwort) {
      if (antwort.status !== 401) return antwort;
      return tokenHolen(true).then(senden);
    }).then(function (antwort) {
      if (antwort.ok) return antwort;
      return antwort.json().catch(function () { return null; }).then(function (koerper) {
        var grund = (koerper && koerper.error && koerper.error.errors &&
                     koerper.error.errors[0] && koerper.error.errors[0].reason) || '';
        var fehler = new Error('Drive antwortete mit ' + antwort.status +
          (grund ? ' (' + grund + ')' : ''));
        fehler.status = antwort.status;
        fehler.grund = grund;
        throw fehler;
      });
    });
  }

  /**
   * Fehlerart für die Anzeige. Aus VehicleIQ übernommen: ein voller
   * Drive und eine fehlende Berechtigung verlangen völlig
   * verschiedene Reaktionen des Nutzers.
   */
  function fehlerArt(e) {
    if (!e) return 'unbekannt';
    if (/ratelimit/i.test(e.grund || '')) return 'unbekannt';   // kurze Drosselung, kein Rechteproblem
    if (/quota|storage/i.test(e.grund || '')) return 'speicher';
    if (e.status === 401 || e.status === 403) return 'berechtigung';
    if (e instanceof TypeError) return 'netz';                  // fetch selbst gescheitert
    return 'unbekannt';
  }

  /** Neueste Datendatei oder null. Bei Dubletten gewinnt die jüngste. */
  function dateiSuchen() {
    var q = encodeURIComponent("name='" + dateiname + "' and trashed=false");
    var felder = encodeURIComponent('files(id,modifiedTime,appProperties)');
    return driveHole('https://www.googleapis.com/drive/v3/files?q=' + q +
      '&spaces=drive&orderBy=' + encodeURIComponent('modifiedTime desc') +
      '&fields=' + felder)
      .then(function (a) { return a.json(); })
      .then(function (r) { return (r && r.files && r.files[0]) || null; });
  }

  /** Stand einer Datei: appProperties, sonst die Änderungszeit. */
  function dateiStand(datei) {
    if (!datei) return null;
    var s = datei.appProperties && Number(datei.appProperties.stand);
    if (s > 0) return s;
    return datei.modifiedTime ? Date.parse(datei.modifiedTime) : null;
  }

  /** Stand in Drive, ohne die Datei zu holen. */
  function stand() {
    return dateiSuchen().then(dateiStand);
  }

  function laden() {
    return dateiSuchen().then(function (datei) {
      if (!datei) return null;      // noch nichts in Drive
      return driveHole('https://www.googleapis.com/drive/v3/files/' + datei.id + '?alt=media')
        .then(function (a) { return a.text(); })
        .then(function (text) {
          if (!text) return null;
          var geparst;
          try {
            geparst = JSON.parse(text);
          } catch (e) {
            /* Kein Rateversuch: eine beschädigte Datei darf nicht als
               "noch nichts da" durchgehen, sonst überschreibt der
               nächste Upload sie endgültig. */
            throw new Error('Inhalt aus Drive war kein gültiges JSON: ' + e.message);
          }
          if (!geparst || typeof geparst !== 'object') {
            throw new Error('Drive lieferte kein Objekt.');
          }
          return geparst;
        });
    });
  }

  function sichern(objekt) {
    var text;
    try {
      text = JSON.stringify(objekt);
    } catch (e) {
      return Promise.reject(new Error('Daten ließen sich nicht in JSON umwandeln: ' + e.message));
    }

    var meinStand = (objekt && objekt.geaendert) ? Date.parse(objekt.geaendert) : NaN;
    if (!Number.isFinite(meinStand)) meinStand = jetzt();

    return dateiSuchen().then(function (datei) {
      /* Ist Drive neuer, wird nicht überschrieben. sync.js sorgt
         normalerweise dafür, dass das nicht vorkommt – aber ein
         zweites Gerät kann dazwischengefunkt haben. */
      var dort = dateiStand(datei);
      if (dort !== null && dort > meinStand) {
        var fehler = new Error('In Drive liegt ein neuerer Stand. Nicht überschrieben.');
        fehler.grund = 'neuer';
        throw fehler;
      }

      var beschreibung = { appProperties: { stand: String(meinStand) } };
      if (!datei) {
        beschreibung.name = dateiname;
        beschreibung.mimeType = 'application/json';
      }

      var form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(beschreibung)], { type: 'application/json' }));
      form.append('file', new Blob([text], { type: 'application/json' }));

      var url = datei
        ? 'https://www.googleapis.com/upload/drive/v3/files/' + datei.id + '?uploadType=multipart'
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

      return driveHole(url, { method: datei ? 'PATCH' : 'POST', body: form });
    }).then(function () { return true; });
  }

  return {
    laden: laden,
    sichern: sichern,
    stand: stand,
    status: status,
    anmelden: anmelden,
    abmelden: abmelden,
    vorhanden: vorhanden,
    fehlerArt: fehlerArt,
    dateiStand: dateiStand
  };
}

var DriveWeb = { SCOPE: SCOPE, DATEINAME: DATEINAME, erzeuge: erzeuge };

if (typeof module !== 'undefined' && module.exports) module.exports = DriveWeb;
if (typeof window !== 'undefined') window.DriveWeb = DriveWeb;
