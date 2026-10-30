/**
 * HomeIQ – Startschicht
 * ------------------------------------------------------------------
 * Verbindet Speicher, Abgleich und die Android-Brücke und liefert den
 * Screens einen fertigen Datenstand. Die Screens sollen sich nicht
 * damit befassen, woher die Daten kommen.
 *
 * Ablauf beim Start:
 *   1. Speicher aufbauen
 *   2. Brücke suchen. Ist keine da (Browser), läuft alles ohne Drive.
 *   3. Laden. Ist noch nichts gespeichert, werden die Demodaten
 *      als Anfangsbestand genommen und sofort gesichert.
 *
 * Jede Änderung geht durch `speichern()`. Das schreibt lokal sofort
 * und stößt den Drive-Abgleich an, sofern eine Brücke da ist.
 */

(function () {
  'use strict';

  var NAME = 'objekt';

  /* Wird in der Seite gesetzt, bevor app.js lädt:
       <script>window.HOMEIQ_CLIENT_ID = '....apps.googleusercontent.com';</script>
     Die Client-ID ist bei Web-OAuth kein Geheimnis und darf sichtbar
     im Quelltext stehen. Ein Client-Secret gibt es für diesen Typ
     nicht und gehört auch nie nach public/. */
  function clientId() {
    return (typeof window !== 'undefined' && window.HOMEIQ_CLIENT_ID) || '';
  }

  var zustand = {
    objekt: null,
    speicher: null,
    belege: null,
    driveArt: null,     // 'android', 'web' oder null
    sync: null,
    drive: null,
    quelle: null,
    konflikte: [],
    defekt: false,
    ersteinrichtung: false
  };

  function tiefeKopie(x) {
    return JSON.parse(JSON.stringify(x));
  }

  function bruecke() {
    return (typeof window !== 'undefined' && window.HomeIQBruecke) ? window.HomeIQBruecke : null;
  }

  /**
   * Startet die App. Liefert ein Promise auf den Zustand.
   * Wirft nicht – Fehler stehen im Zustand und werden angezeigt.
   */
  function starten() {
    zustand.speicher = window.Speicher.erzeuge();

    /* Reihenfolge mit Absicht: Läuft die App im WebView, gewinnt die
       Android-Brücke – dort ist das Konto schon angemeldet. Sonst der
       Browser-Adapter, sofern eine Client-ID hinterlegt ist. Sonst
       gar kein Drive, und die App arbeitet rein lokal weiter. */
    var b = bruecke();
    if (b && window.DriveAdapter) {
      zustand.drive = window.DriveAdapter.erzeuge({ bruecke: b });
      window.DriveAdapter.registriereGlobal(zustand.drive);
      zustand.driveArt = 'android';
    } else if (window.DriveWeb && clientId()) {
      var web = window.DriveWeb.erzeuge({ clientId: clientId() });
      if (web.vorhanden()) {
        zustand.drive = web;
        zustand.driveArt = 'web';
      }
    }

    zustand.sync = window.Sync.erzeuge({
      speicher: zustand.speicher,
      drive: zustand.drive,
      name: NAME,
      zusammenfuehren: window.Speicher.zusammenfuehren
    });

    var vorgabe = (window.Demodaten && window.Demodaten.OBJEKT)
      ? tiefeKopie(window.Demodaten.OBJEKT) : null;

    /* Der Belegspeicher wird nebenher geöffnet. Scheitert er, läuft
       die App trotzdem – dann eben ohne dauerhafte Dateien. */
    var belegeFertig = window.Belege
      ? window.Belege.erzeuge().then(function (b) { zustand.belege = b; })
      : Promise.resolve();

    return belegeFertig.then(function () {
      return zustand.sync.beimStart(vorgabe);
    }).then(function (r) {
      zustand.objekt = r.daten;
      zustand.quelle = r.quelle;
      zustand.konflikte = r.konflikte || [];
      zustand.defekt = !!r.defekt;

      /* Beim allerersten Start liegt nichts im Speicher. Dann sind die
         Demodaten der Anfangsbestand und werden gleich festgeschrieben,
         damit Änderungen daran auch bleiben. */
      return zustand.speicher.laden(NAME).then(function (geladen) {
        if (!geladen.gefunden && zustand.objekt) {
          zustand.ersteinrichtung = true;
          return zustand.sync.aenderung(zustand.objekt).then(function () { return zustand; });
        }
        return zustand;
      });
    });
  }

  /** Nach jeder Änderung am Objekt aufrufen. */
  function speichern() {
    if (!zustand.sync || !zustand.objekt) return Promise.resolve({ erfolg: false });
    return zustand.sync.aenderung(zustand.objekt);
  }

  /* Einstellungen der Oberfläche. Absichtlich getrennt vom Objekt:
     welche Ansicht jemand bevorzugt, gehört auf dieses Gerät und
     nicht in den Abgleich mit Drive. */
  function einstellungLesen(feld, vorgabe) {
    if (!zustand.speicher) return Promise.resolve(vorgabe);
    return zustand.speicher.laden('einstellungen', {}).then(function (r) {
      var d = r.daten || {};
      return (d[feld] === undefined || d[feld] === null) ? vorgabe : d[feld];
    });
  }

  function einstellungSetzen(feld, wert) {
    if (!zustand.speicher) return Promise.resolve();
    return zustand.speicher.laden('einstellungen', {}).then(function (r) {
      var d = r.daten || {};
      d[feld] = wert;
      return zustand.speicher.sichern('einstellungen', d);
    });
  }

  /** Setzt auf die Demodaten zurück. Für Tests unentbehrlich. */
  function zuruecksetzen() {
    if (!zustand.speicher) return Promise.resolve();
    return zustand.speicher.loeschen(NAME)
      .then(function () { return zustand.speicher.loeschen(NAME + ':vermerk'); });
  }

  /**
   * Kurzer Text über den Speicherzustand, für die Kopfzeile.
   * Sagt ausdrücklich, wenn nichts dauerhaft gespeichert wird.
   */
  function lageText() {
    if (!zustand.speicher) return 'nicht gestartet';
    var sp = zustand.speicher.zustand();
    var teile = [];

    teile.push(sp.dauerhaft ? 'lokal gespeichert' : 'nur im Arbeitsspeicher');

    if (zustand.sync) {
      var sy = zustand.sync.zustand();
      var driveText = {
        aus: 'Drive nicht verbunden',
        abgeschaltet: 'Abgleich abgeschaltet',
        aktuell: 'Drive aktuell',
        wartet: 'Drive wartet',
        laeuft: 'Drive überträgt',
        fehler: 'Drive fehlgeschlagen'
      }[sy.drive] || sy.drive;
      teile.push(driveText + (zustand.driveArt === 'web' && sy.drive !== 'aus' ? ' (Browser)' : ''));
    }

    if (zustand.belege && !zustand.belege.zustand().dauerhaft) {
      teile.push('Belege nur im Arbeitsspeicher');
    }
    if (zustand.ersteinrichtung) teile.push('Demodaten angelegt');
    if (zustand.defekt) teile.push('gespeicherte Daten waren beschädigt');

    return teile.join(' · ');
  }

  window.App = {
    starten: starten,
    einstellungLesen: einstellungLesen,
    einstellungSetzen: einstellungSetzen,
    speichern: speichern,
    zuruecksetzen: zuruecksetzen,
    lageText: lageText,
    zustand: zustand
  };
})();
