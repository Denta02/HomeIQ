/**
 * HomeIQ – Abgleich mit Drive
 * ------------------------------------------------------------------
 * Regel: Beim Start wird geladen, bei jeder Änderung wird geschrieben –
 * lokal UND in Drive.
 *
 * Reihenfolge ist dabei nicht beliebig:
 *
 *   1. localStorage zuerst. Das geht sofort und kann nicht am Netz
 *      scheitern. Der lokale Stand darf nie hinter dem Drive-Stand
 *      liegen.
 *   2. Drive danach, gebündelt. Zehn Tastendrücke sind eine Änderung,
 *      nicht zehn Uploads. Da immer das ganze Objekt geschrieben wird,
 *      ist nur der letzte Stand interessant – die Warteschlange fällt
 *      auf genau einen Eintrag zusammen.
 *
 * Schlägt Drive fehl, bleibt ein Vermerk "offen" im localStorage
 * stehen. Der überlebt einen Neustart und sorgt dafür, dass beim
 * nächsten Start der lokale Stand NICHT vom älteren Drive-Stand
 * überschrieben wird.
 *
 * Der Speicher arbeitet mit Promises. Wichtig dabei: Der Drive-Upload
 * wird eingeplant, BEVOR auf den lokalen Schreibvorgang gewartet wird.
 * Sonst hinge die Bündelung an einer Mikrotask-Reihenfolge, und eine
 * Änderung kurz vor dem Schließen der App käme nicht mehr durch.
 * Die Reihenfolge „lokal führt" bleibt davon unberührt: der lokale
 * Schreibvorgang ist angestoßen, bevor Drive überhaupt geplant wird.
 *
 * Beim Umschalten wird der überschriebene Stand als Sicherung
 * aufbewahrt und lässt sich zurückholen. Eine Entscheidung zwischen
 * zwei Ständen trifft man selten in voller Kenntnis – ohne
 * Rückholmöglichkeit ist ein Fehlgriff endgültig.
 *
 * Der Abgleich lässt sich abschalten. Dann wird nur noch lokal
 * geschrieben. Beim Wiedereinschalten wird NICHT automatisch
 * zusammengeführt: während der Pause können beide Seiten auseinander
 * gelaufen sein, und welche gelten soll, kann nur der Mensch wissen.
 * `einschalten()` liefert deshalb beide Stände zur Auswahl, und erst
 * `entscheidung()` schreibt.
 *
 * Der Schalter wird lokal gemerkt und nicht nach Drive übertragen –
 * er gehört zu diesem Gerät.
 *
 * Alles Zeitabhängige wird hereingereicht, damit sich das Modul ohne
 * echte Uhr und ohne Netz testen lässt.
 */

'use strict';

var VORGABE = {
  verzoegerungMs: 1500,   // Bündelung schneller Änderungen
  maxWarteMs: 10000,      // spätestens danach wird geschrieben
  versuche: 3,            // Wiederholungen je Schreibvorgang
  backoffMs: 2000         // Wartezeit vor der Wiederholung, verdoppelt sich
};

/**
 * drive muss zwei Funktionen anbieten, beide mit Promise:
 *   laden()        -> Objekt oder null
 *   sichern(obj)   -> beliebig, wirft bei Fehler
 */
function erzeuge(optionen) {
  var o = optionen || {};
  var speicher = o.speicher;
  var drive = o.drive || null;
  var name = o.name || 'objekt';
  var zusammenfuehren = o.zusammenfuehren;

  var verzoegerungMs = Number.isInteger(o.verzoegerungMs) ? o.verzoegerungMs : VORGABE.verzoegerungMs;
  var maxWarteMs = Number.isInteger(o.maxWarteMs) ? o.maxWarteMs : VORGABE.maxWarteMs;
  var maxVersuche = Number.isInteger(o.versuche) ? o.versuche : VORGABE.versuche;
  var backoffMs = Number.isInteger(o.backoffMs) ? o.backoffMs : VORGABE.backoffMs;

  var setze = o.setTimeoutFn || (typeof setTimeout !== 'undefined' ? setTimeout : null);
  var loesche = o.clearTimeoutFn || (typeof clearTimeout !== 'undefined' ? clearTimeout : null);
  var jetzt = o.jetzt || function () { return Date.now(); };

  var aktiv = o.aktiv === false ? false : true;   // Abgleich eingeschaltet?
  var offenerStand = null;      // wartet auf Drive
  var timer = null;
  var ersteAenderungUm = 0;
  var laeuft = false;
  var horcher = [];

  var lage = {
    lokal: 'unbekannt',         // gespeichert | fehler
    drive: drive ? 'aktuell' : 'aus',  // aktuell | wartet | laeuft | fehler |
                                       // aus (keine Verbindung möglich) |
                                       // abgeschaltet (vom Nutzer)
    offenSeit: null,
    letzterFehler: null,
    letzterErfolg: null,
    versuch: 0
  };

  function melden() {
    var kopie = JSON.parse(JSON.stringify(lage));
    horcher.forEach(function (fn) {
      try { fn(kopie); } catch (e) { /* ein kaputter Horcher darf den Abgleich nicht stoppen */ }
    });
  }

  function abonnieren(fn) {
    if (typeof fn === 'function') horcher.push(fn);
    return function () { horcher = horcher.filter(function (h) { return h !== fn; }); };
  }

  /* ---------- Vermerk über offene Drive-Schreibvorgänge ---------- */

  function vermerkSetzen(offen) {
    return speicher.sichern(name + ':vermerk',
      { offen: !!offen, seit: offen ? new Date(jetzt()).toISOString() : null });
  }

  /* ---------- Sicherung des überschriebenen Standes ---------- */

  function sicherungAnlegen(quelle, objekt) {
    if (!objekt) return Promise.resolve();
    return speicher.sichern(name + ':sicherung', {
      zeit: new Date(jetzt()).toISOString(),
      quelle: quelle,                 // 'lokal' oder 'fern'
      stand: objekt.geaendert || null,
      daten: objekt
    });
  }

  function sicherungLesen() {
    return speicher.laden(name + ':sicherung', null).then(function (r) {
      var s = r.daten;
      return (s && s.daten) ? s : null;
    });
  }

  /**
   * Holt den gesicherten Stand zurück. Der jetzige wird dabei zur
   * neuen Sicherung – das Zurückholen lässt sich also umkehren.
   */
  function sicherungWiederherstellen() {
    return Promise.all([sicherungLesen(), speicher.laden(name, null)])
      .then(function (beides) {
        var sicherung = beides[0];
        var jetziger = beides[1].daten;
        if (!sicherung) return { erfolg: false, fehler: 'Es liegt keine Sicherung vor.' };

        var zurueck = sicherung.daten;
        /* Neuer Zeitstempel, sonst verliert der zurückgeholte Stand
           beim nächsten Abgleich gegen Drive. */
        zurueck.geaendert = new Date(jetzt()).toISOString();

        return sicherungAnlegen(jetziger ? 'lokal' : 'fern', jetziger)
          .then(function () { return speicher.sichern(name, zurueck); })
          .then(function () {
            if (drive && aktiv) {
              offenerStand = zurueck;
              vermerkSetzen(true);
              lage.drive = 'wartet';
              planen(true);
              melden();
            }
            return { erfolg: true, daten: zurueck, quelle: sicherung.quelle, zeit: sicherung.zeit };
          });
      });
  }

  function schalterSetzen(wert) {
    return speicher.sichern(name + ':abgleich', { aktiv: !!wert });
  }

  function schalterLesen() {
    return speicher.laden(name + ':abgleich', { aktiv: true })
      .then(function (r) { return !(r.daten && r.daten.aktiv === false); });
  }

  function vermerkLesen() {
    return speicher.laden(name + ':vermerk', { offen: false, seit: null })
      .then(function (r) { return r.daten || { offen: false, seit: null }; });
  }

  /* ---------- Start ---------- */

  /**
   * Lädt lokal und aus Drive und führt zusammen.
   *
   * Der entscheidende Fall: Steht ein offener Vermerk, war der lokale
   * Stand beim letzten Beenden noch nicht in Drive. Dann darf Drive
   * nicht führen, auch wenn es dort einen Zeitstempel gibt.
   */
  function beimStart(vorgabeDaten) {
    return Promise.all([
      speicher.laden(name, vorgabeDaten || null),
      vermerkLesen(),
      schalterLesen()
    ]).then(function (alles) {
      aktiv = alles[2];
      return starten(alles[0], alles[1]);
    });
  }

  function starten(lokalErgebnis, vermerk) {
    var lokal = lokalErgebnis.daten;

    lage.lokal = lokalErgebnis.fehler ? 'fehler' : 'gespeichert';
    if (lokalErgebnis.fehler) lage.letzterFehler = lokalErgebnis.fehler;

    /* Abgeschaltet: gar nicht erst nach Drive greifen. */
    if (drive && !aktiv) {
      lage.drive = 'abgeschaltet';
      lage.offenSeit = vermerk.offen ? vermerk.seit : null;
      melden();
      return {
        daten: lokal, quelle: 'nur lokal (Abgleich abgeschaltet)', konflikte: [],
        defekt: lokalErgebnis.defekt, offenerVermerk: vermerk.offen, aktuell: null
      };
    }

    if (!drive) {
      lage.drive = 'aus';
      melden();
      return {
        daten: lokal, quelle: 'nur lokal', konflikte: [],
        defekt: lokalErgebnis.defekt, offenerVermerk: vermerk.offen
      };
    }

    /* Nur der Drive-Zugriff darf hier als "nicht erreichbar" gelten.
       Ein Fehler beim lokalen Speichern ist etwas anderes und wird
       deshalb ausdrücklich außerhalb dieses Fangnetzes behandelt. */
    return Promise.resolve()
      .then(function () { return drive.laden(); })
      .then(
        function (fern) { return { fern: fern, fehler: null }; },
        function (e) { return { fern: null, fehler: e }; }
      )
      .then(function (ergebnis) {
        if (ergebnis.fehler) {
          lage.drive = 'fehler';
          lage.letzterFehler = 'Drive beim Start nicht erreichbar: ' + ergebnis.fehler.message;
          melden();
          return {
            daten: lokal, quelle: 'nur lokal (Drive nicht erreichbar)', konflikte: [],
            defekt: lokalErgebnis.defekt, offenerVermerk: vermerk.offen
          };
        }

        var fern = ergebnis.fern;
        var z = zusammenfuehren(lokal, fern);

        if (vermerk.offen && lokal) {
          /* Lokale Änderungen haben Drive nie erreicht. Die
             Zusammenführung bleibt, aber lokal gibt bei Gleichstand
             den Ausschlag, und es wird sofort nachgeschrieben. */
          z.quelle = 'lokal führend (offener Stand)';
          offenerStand = z.objekt;
          planen(true);
        }

        lage.drive = vermerk.offen ? 'wartet' : 'aktuell';
        lage.offenSeit = vermerk.offen ? vermerk.seit : null;
        melden();

        return (z.objekt ? speicher.sichern(name, z.objekt) : Promise.resolve({ erfolg: true }))
          .then(function (r) {
            if (r && r.erfolg === false) {
              lage.lokal = 'fehler';
              lage.letzterFehler = r.fehler;
              melden();
            }
            return antwortAufbauen(z, lokalErgebnis, vermerk);
          });
      });
  }

  function antwortAufbauen(z, lokalErgebnis, vermerk) {
    return {
      daten: z.objekt, quelle: z.quelle, konflikte: z.konflikte,
      defekt: lokalErgebnis.defekt, offenerVermerk: vermerk.offen,
      /* true, wenn beide Seiten übereinstimmten; false, wenn eine Seite
         nachgezogen werden musste. */
      aktuell: z.konflikte.length === 0 && z.quelle !== 'nur fern'
    };
  }

  /* ---------- Änderung ---------- */

  /**
   * Jede Änderung geht hier durch. Lokal wird sofort geschrieben,
   * Drive gebündelt.
   */
  function aenderung(daten) {
    if (!daten) {
      return Promise.resolve({ erfolg: false, fehler: 'Keine Daten übergeben.' });
    }

    daten.geaendert = new Date(jetzt()).toISOString();

    /* Der lokale Schreibvorgang ist hiermit angestoßen. Auf sein
       Ergebnis wird erst unten gewartet – die Drive-Planung darf
       nicht an einer Mikrotask hängen. */
    var versprechen = speicher.sichern(name, daten);

    if (drive && aktiv) {
      offenerStand = daten;
      vermerkSetzen(true);
      if (!ersteAenderungUm) ersteAenderungUm = jetzt();
      lage.drive = 'wartet';
      if (!lage.offenSeit) lage.offenSeit = daten.geaendert;
      planen(false);
    } else if (drive && !aktiv) {
      lage.drive = 'abgeschaltet';
    }

    melden();

    return versprechen.then(function (r) {
      lage.lokal = r.erfolg ? 'gespeichert' : 'fehler';
      if (!r.erfolg) lage.letzterFehler = r.fehler;
      melden();
      return r;
    });
  }

  function planen(sofort) {
    if (!setze) return;
    if (timer) { loesche(timer); timer = null; }

    var wartetSchon = ersteAenderungUm ? jetzt() - ersteAenderungUm : 0;
    var verzoegerung = sofort || wartetSchon >= maxWarteMs ? 0 : verzoegerungMs;

    timer = setze(function () {
      timer = null;
      schreiben(1);
    }, verzoegerung);
  }

  function schreiben(versuch) {
    if (laeuft || !offenerStand || !drive) return Promise.resolve();
    laeuft = true;
    lage.drive = 'laeuft';
    lage.versuch = versuch;
    melden();

    var stand = offenerStand;

    return Promise.resolve()
      .then(function () { return drive.sichern(stand); })
      .then(function () {
        laeuft = false;
        lage.versuch = 0;
        if (offenerStand === stand) {
          /* Zwischenzeitlich kam nichts Neues: alles ist draußen. */
          offenerStand = null;
          ersteAenderungUm = 0;
          vermerkSetzen(false);
          lage.drive = 'aktuell';
          lage.offenSeit = null;
          lage.letzterErfolg = new Date(jetzt()).toISOString();
          lage.letzterFehler = null;
        } else {
          /* Während des Uploads wurde weiter geändert. */
          lage.drive = 'wartet';
          planen(false);
        }
        melden();
      })
      .catch(function (e) {
        laeuft = false;
        lage.letzterFehler = 'Drive: ' + e.message;
        if (versuch < maxVersuche && setze) {
          lage.drive = 'wartet';
          melden();
          timer = setze(function () {
            timer = null;
            schreiben(versuch + 1);
          }, backoffMs * Math.pow(2, versuch - 1));
        } else {
          /* Aufgegeben. Der Vermerk bleibt stehen, damit der nächste
             Start den lokalen Stand nicht verliert. */
          lage.drive = 'fehler';
          lage.versuch = 0;
          melden();
        }
      });
  }

  /* ---------- Abgleich ein- und ausschalten ---------- */

  function istAktiv() { return aktiv; }

  /* Eigene kleine Hilfe statt Zugriff auf speicher.js – sonst hinge
     sync.js an dessen innerem Aufbau. */
  function zeit(wert) {
    if (typeof wert !== 'string' || !wert) return 0;
    var t = Date.parse(wert);
    return Number.isFinite(t) ? t : 0;
  }

  /**
   * Schaltet den Abgleich ab. Alles Wartende wird verworfen – es wäre
   * sonst ein Upload, den niemand mehr erwartet.
   *
   * Der Aufrufer muss vorher warnen; die Warnung steht in
   * `warnungAbschalten()`, damit Android und Web denselben Text zeigen.
   */
  function abschalten() {
    aktiv = false;
    if (timer) { loesche(timer); timer = null; }
    offenerStand = null;
    ersteAenderungUm = 0;
    lage.drive = 'abgeschaltet';
    lage.versuch = 0;
    melden();
    return schalterSetzen(false);
  }

  function warnungAbschalten() {
    return 'Ohne Abgleich bleiben Änderungen nur auf diesem Gerät. ' +
      'Sie sind dann nicht gesichert: Geht das Gerät verloren oder werden ' +
      'die App-Daten gelöscht, sind sie weg. Andere Geräte sehen sie nicht.';
  }

  /**
   * Bereitet das Wiedereinschalten vor. Schreibt noch nichts.
   *
   * Rückgabe:
   *   { entscheidungNoetig, lokal, fern, empfehlung, fehler }
   *
   * `lokal` und `fern` beschreiben den jeweiligen Stand, damit die
   * Oberfläche eine sinnvolle Frage stellen kann statt "A oder B?".
   */
  function einschalten() {
    if (!drive) {
      aktiv = true;
      return schalterSetzen(true).then(function () {
        lage.drive = 'aus';
        melden();
        return { entscheidungNoetig: false, fehler: null, quelle: 'keine Verbindung möglich' };
      });
    }

    return Promise.all([
      speicher.laden(name, null),
      Promise.resolve().then(function () { return drive.laden(); })
        .then(function (f) { return { wert: f, fehler: null }; },
              function (e) { return { wert: null, fehler: e }; })
    ]).then(function (beides) {
      var lokal = beides[0].daten;
      var fern = beides[1].wert;

      if (beides[1].fehler) {
        return { entscheidungNoetig: false, fehler:
          'Drive ist nicht erreichbar: ' + beides[1].fehler.message +
          ' Der Abgleich bleibt abgeschaltet.' };
      }

      offeneWahl = { lokal: lokal, fern: fern };

      /* Kein Konflikt, wenn eine Seite leer ist oder beide gleich alt. */
      if (!fern) return anwenden('lokal', 'In Drive liegt noch nichts.');
      if (!lokal) return anwenden('fern', 'Lokal liegt noch nichts.');
      if (zeit(lokal.geaendert) === zeit(fern.geaendert)) {
        return anwenden('lokal', 'Beide Stände sind gleich alt.');
      }

      var neuer = zeit(fern.geaendert) > zeit(lokal.geaendert) ? 'fern' : 'lokal';
      return {
        entscheidungNoetig: true,
        fehler: null,
        lokal: beschreibe(lokal),
        fern: beschreibe(fern),
        empfehlung: neuer
      };
    });
  }

  var offeneWahl = null;

  function beschreibe(objekt) {
    if (!objekt) return null;
    var geraete = objekt.geraete || [];
    var eintraege = 0;
    geraete.forEach(function (g) {
      eintraege += (g.ansprueche || []).length + (g.aufgaben || []).length +
                   (g.stoerungen || []).length + (g.lieferungen || []).length;
    });
    return {
      geaendert: objekt.geaendert || null,
      geraete: geraete.length,
      eintraege: eintraege,
      name: objekt.name || ''
    };
  }

  /**
   * Übernimmt die Entscheidung.
   *   'lokal'     – der lokale Stand gilt und wird nach Drive geschrieben
   *   'fern'      – der Drive-Stand gilt und ersetzt den lokalen
   *   'zusammen'  – beide werden nach Zeitstempel je Gerät zusammengeführt
   *
   * Die dritte Möglichkeit ist nicht verlangt, aber oft die richtige:
   * wer auf dem Telefon eine Lieferung und am Rechner eine Wartung
   * eingetragen hat, verliert sonst eines von beidem.
   */
  function entscheidung(wahl) {
    return anwenden(wahl, null);
  }

  function anwenden(wahl, begruendung) {
    if (!offeneWahl) return Promise.resolve({ fehler: 'Es steht keine Wahl offen.' });

    var lokal = offeneWahl.lokal;
    var fern = offeneWahl.fern;
    var ergebnis, quelle, konflikte = [], ueberschrieben = null, ueberschriebenQuelle = null;

    if (wahl === 'fern') {
      ergebnis = fern; quelle = 'Drive übernommen';
      ueberschrieben = lokal; ueberschriebenQuelle = 'lokal';
    } else if (wahl === 'zusammen') {
      var z = zusammenfuehren(lokal, fern);
      ergebnis = z.objekt; quelle = 'zusammengeführt'; konflikte = z.konflikte;
      ueberschrieben = fern; ueberschriebenQuelle = 'fern';
    } else {
      ergebnis = lokal; quelle = 'lokal behalten';
      ueberschrieben = fern; ueberschriebenQuelle = 'fern';
    }

    offeneWahl = null;
    aktiv = true;

    /* Nur sichern, wenn wirklich etwas verloren ginge. */
    var vorbereiten = (ueberschrieben && begruendung === null)
      ? sicherungAnlegen(ueberschriebenQuelle, ueberschrieben)
      : Promise.resolve();

    return vorbereiten.then(function () { return schalterSetzen(true); })
      .then(function () { return ergebnis ? speicher.sichern(name, ergebnis) : null; })
      .then(function () {
        lage.drive = 'aktuell';
        lage.offenSeit = null;
        melden();
        /* Nach "lokal" und "zusammen" muss Drive nachgezogen werden. */
        if (ergebnis && wahl !== 'fern') {
          offenerStand = ergebnis;
          vermerkSetzen(true);
          lage.drive = 'wartet';
          planen(true);
        } else {
          vermerkSetzen(false);
        }
        melden();
        return {
          entscheidungNoetig: false, fehler: null, daten: ergebnis,
          quelle: quelle, konflikte: konflikte, begruendung: begruendung || null,
          sicherung: (ueberschrieben && begruendung === null) ? ueberschriebenQuelle : null
        };
      });
  }

  /** Erzwingt den Upload, etwa wenn die App in den Hintergrund geht. */
  function sofortSchreiben() {
    if (timer) { loesche(timer); timer = null; }
    return schreiben(1);
  }

  function zustand() {
    return JSON.parse(JSON.stringify(lage));
  }

  function offen() {
    return offenerStand !== null;
  }

  return {
    beimStart: beimStart,
    aenderung: aenderung,
    istAktiv: istAktiv,
    abschalten: abschalten,
    einschalten: einschalten,
    entscheidung: entscheidung,
    warnungAbschalten: warnungAbschalten,
    sicherungLesen: sicherungLesen,
    sicherungWiederherstellen: sicherungWiederherstellen,
    sofortSchreiben: sofortSchreiben,
    zustand: zustand,
    offen: offen,
    abonnieren: abonnieren,
    vermerkLesen: vermerkLesen
  };
}

var Sync = { VORGABE: VORGABE, erzeuge: erzeuge };

if (typeof module !== 'undefined' && module.exports) module.exports = Sync;
if (typeof window !== 'undefined') window.Sync = Sync;
