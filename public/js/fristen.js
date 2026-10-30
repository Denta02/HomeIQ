/**
 * HomeIQ – Fristen- und Fälligkeitsberechnung
 * ------------------------------------------------------------------
 * Reine Funktionen, keine Abhängigkeiten, kein Date-Objekt für
 * Monats-/Jahresarithmetik (vermeidet UTC-Verschiebungen).
 *
 * Grundsatz: Jede berechnete Frist liefert eine `herleitung` mit,
 * damit dem Gerätebesitzer nachvollziehbar erklärt werden kann,
 * wie das Datum zustande kommt.
 *
 * Datumsformat durchgehend: "YYYY-MM-DD" (String).
 */

'use strict';

/* ================================================================
 * 1. Datums-Grundlagen
 * ================================================================ */

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function istSchaltjahr(jahr) {
  return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0;
}

function tageImMonat(jahr, monat) {
  const tage = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (monat === 2 && istSchaltjahr(jahr)) return 29;
  return tage[monat - 1];
}

/** Zerlegt "YYYY-MM-DD". Wirft bei ungültigem oder nicht existierendem Datum. */
function parseISO(iso) {
  if (typeof iso !== 'string') throw new TypeError('Datum muss ein String sein: ' + iso);
  const m = ISO_RE.exec(iso);
  if (!m) throw new RangeError('Ungültiges Datumsformat (erwartet YYYY-MM-DD): ' + iso);
  const jahr = Number(m[1]), monat = Number(m[2]), tag = Number(m[3]);
  if (monat < 1 || monat > 12) throw new RangeError('Ungültiger Monat: ' + iso);
  if (tag < 1 || tag > tageImMonat(jahr, monat)) throw new RangeError('Tag existiert nicht: ' + iso);
  return { jahr, monat, tag };
}

function formatISO(jahr, monat, tag) {
  return String(jahr).padStart(4, '0') + '-' +
         String(monat).padStart(2, '0') + '-' +
         String(tag).padStart(2, '0');
}

function istGueltigesDatum(iso) {
  try { parseISO(iso); return true; } catch (_) { return false; }
}

/**
 * Monate addieren mit Clamping auf den letzten Monatstag.
 * 2026-01-31 + 1 Monat  -> 2026-02-28
 * 2028-02-29 + 24 Monate -> 2030-02-28
 *
 * Das deckt sich mit § 188 Abs. 3 BGB: fehlt im Zielmonat der
 * entsprechende Tag, endet die Frist am letzten Tag des Monats.
 */
function addMonate(iso, monate) {
  if (!Number.isInteger(monate)) throw new TypeError('monate muss ganzzahlig sein');
  const { jahr, monat, tag } = parseISO(iso);
  const gesamt = jahr * 12 + (monat - 1) + monate;
  const nJahr = Math.floor(gesamt / 12);
  const nMonat = (gesamt % 12 + 12) % 12 + 1;
  const nTag = Math.min(tag, tageImMonat(nJahr, nMonat));
  return formatISO(nJahr, nMonat, nTag);
}

/** Tage addieren. Nutzt Date.UTC bewusst nur für reine Tagesarithmetik. */
function addTage(iso, tage) {
  if (!Number.isInteger(tage)) throw new TypeError('tage muss ganzzahlig sein');
  const { jahr, monat, tag } = parseISO(iso);
  const ms = Date.UTC(jahr, monat - 1, tag) + tage * 86400000;
  const d = new Date(ms);
  return formatISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Ganze Tage von a nach b. Positiv, wenn b später liegt. */
function tageZwischen(a, b) {
  const x = parseISO(a), y = parseISO(b);
  const msA = Date.UTC(x.jahr, x.monat - 1, x.tag);
  const msB = Date.UTC(y.jahr, y.monat - 1, y.tag);
  return Math.round((msB - msA) / 86400000);
}

/** Heutiges Datum in LOKALER Zeit – nicht toISOString() verwenden. */
function heute(jetzt) {
  const d = jetzt instanceof Date ? jetzt : new Date();
  return formatISO(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function addIntervall(iso, wert, einheit) {
  if (!Number.isInteger(wert) || wert <= 0) throw new RangeError('Intervallwert muss > 0 sein');
  switch (einheit) {
    case 'tage':   return addTage(iso, wert);
    case 'monate': return addMonate(iso, wert);
    case 'jahre':  return addMonate(iso, wert * 12);
    default: throw new RangeError('Unbekannte Intervalleinheit: ' + einheit);
  }
}

/* ================================================================
 * 2. Regelwerk (ZU PRÜFEN vor Produktivgang)
 * ================================================================ */

/**
 * ACHTUNG – rechtliche Parameter. Vor dem Einsatz gegen den
 * Gesetzestext prüfen und mit Fundstelle dokumentieren.
 *
 * Bei Nacherfüllung durch Reparatur verlängert sich die
 * Verjährungsfrist einmalig um 12 Monate (§ 475e Abs. 5 BGB),
 * anwendbar auf Verträge ab dem 31.07.2026. Eine neue Zweijahres-
 * frist beginnt dadurch NICHT.
 *
 * Maßgeblich für die Anwendbarkeit ist der Tag des Vertragsschlusses,
 * für den Fristbeginn dagegen die Übergabe. Deshalb im Datenmodell
 * `kauf.vertragsDatum` UND `kauf.datum` getrennt führen.
 */
const REGELN = {
  nacherfuellungVerlaengerung: {
    giltAbVertragsDatum: '2026-07-31',
    monate: 12,
    einmalig: true,
    fundstelle: '§ 475e Abs. 5 BGB (zu verifizieren)'
  },
  standardDauer: {
    gewaehrleistung_kauf_neu: 24,
    gewaehrleistung_kauf_gebraucht: 12,
    gewaehrleistung_werk: 24  // § 634a Abs. 1 Nr. 1 BGB, ab Abnahme
  }
};

function nacherfuellungGreift(vertragsDatum) {
  if (!vertragsDatum || !istGueltigesDatum(vertragsDatum)) return null; // unbekannt
  return vertragsDatum >= REGELN.nacherfuellungVerlaengerung.giltAbVertragsDatum;
}

/* ================================================================
 * 3. Ansprüche
 * ================================================================ */

/**
 * Berechnet das Ende eines Anspruchs inklusive Herleitung.
 *
 * Jeder Schritt trägt einen stabilen `key`, an den die Oberfläche
 * Erklärtexte hängen kann. Formulierungen in `schritt` dürfen sich
 * ändern, Schlüssel nicht.
 *
 * Schlüssel:
 *   beginn:<beginnKey>          z. B. beginn:uebergabe, beginn:abnahme
 *   grundfrist
 *   verlaengerung:<key>         z. B. verlaengerung:nacherfuellung
 *   override
 *
 * Rückgabe: { ende, endeQuelle, herleitung: [{ key, schritt, ergebnis }] }
 */
function berechneAnspruchEnde(anspruch) {
  if (!anspruch || !istGueltigesDatum(anspruch.beginn)) {
    throw new RangeError('Anspruch ohne gültiges Beginn-Datum');
  }
  const herleitung = [];
  let stand = anspruch.beginn;

  herleitung.push({
    key: 'beginn:' + (anspruch.beginnKey || 'unbekannt'),
    schritt: 'Fristbeginn (' + (anspruch.beginnBezeichnung || 'Übergabe bzw. Abnahme') + ')',
    ergebnis: stand
  });

  const dauer = Number.isInteger(anspruch.dauerMonate) ? anspruch.dauerMonate : 0;
  if (dauer > 0) {
    stand = addMonate(stand, dauer);
    herleitung.push({
      key: 'grundfrist',
      schritt: '+ ' + dauer + ' Monate Grundfrist',
      ergebnis: stand
    });
  }

  const verl = Array.isArray(anspruch.verlaengerungen) ? anspruch.verlaengerungen : [];
  for (const v of verl) {
    const m = Number.isInteger(v.monate) ? v.monate : 0;
    if (m === 0) continue;
    stand = addMonate(stand, m);
    herleitung.push({
      key: 'verlaengerung:' + (v.key || 'sonstige'),
      schritt: '+ ' + m + ' Monate (' + (v.grund || 'Verlängerung') + ')',
      ergebnis: stand
    });
  }

  let endeQuelle = 'berechnet';
  if (anspruch.endeManuell && istGueltigesDatum(anspruch.endeManuell)) {
    herleitung.push({
      key: 'override',
      schritt: 'Manuell überschrieben (Beleg weicht ab), berechnet wäre ' + stand,
      ergebnis: anspruch.endeManuell
    });
    stand = anspruch.endeManuell;
    endeQuelle = 'manuell';
  }

  return { ende: stand, endeQuelle, herleitung };
}

/** Status eines Stichtags relativ zu heute. */
function bewerteStichtag(ende, stichtagHeute, vorlaufTage) {
  const vorlauf = Number.isInteger(vorlaufTage) ? vorlaufTage : 14;
  const rest = tageZwischen(stichtagHeute, ende);
  let status;
  if (rest < 0) status = 'abgelaufen';
  else if (rest === 0) status = 'laeuft_heute_ab';
  else if (rest <= vorlauf) status = 'bald';
  else status = 'ok';
  return { status, restTage: rest };
}

/**
 * Vollständige Auskunft zu einem Anspruch – die Datenbasis für die
 * spätere Anzeige beim Gerätebesitzer.
 */
function anspruchsAuskunft(anspruch, stichtagHeute, vorlaufTage) {
  const { ende, endeQuelle, herleitung } = berechneAnspruchEnde(anspruch);
  const bewertung = bewerteStichtag(ende, stichtagHeute, vorlaufTage);
  const rolle = anspruch.gegenueber && anspruch.gegenueber.rolle;

  const ansprechpartnerText = {
    verkaeufer: 'Verkäufer',
    hersteller: 'Hersteller',
    werkstatt: 'Werkstatt / Reparaturbetrieb'
  }[rolle] || 'unbekannt';

  return {
    anspruchId: anspruch.id,
    art: anspruch.art,
    bezug: anspruch.bezug === 'bauteil'
      ? 'nur Bauteil: ' + (anspruch.bauteil || 'unbenannt')
      : 'gesamtes Gerät',
    ansprechpartner: ansprechpartnerText,
    ansprechpartnerName: (anspruch.gegenueber && anspruch.gegenueber.name) || '',
    ende,
    endeQuelle,
    status: bewertung.status,
    restTage: bewertung.restTage,
    grundlage: anspruch.grundlage || '',
    herleitung,
    hinweis: 'Orientierungswert, keine Rechtsberatung.'
  };
}

/**
 * Trägt eine Nacherfüllungsreparatur nach. Verändert den Anspruch
 * NICHT, sondern liefert eine neue Verlängerung zurück, die der
 * Aufrufer bewusst übernehmen muss.
 */
function verlaengerungNachReparatur(anspruch, vertragsDatum, stoerungId, datum) {
  const bereitsVorhanden = (anspruch.verlaengerungen || [])
    .some(v => v.grund === 'Nacherfüllungsreparatur');
  if (bereitsVorhanden && REGELN.nacherfuellungVerlaengerung.einmalig) {
    return { anwendbar: false, begruendung: 'Verlängerung wurde bereits einmal angerechnet.' };
  }
  const greift = nacherfuellungGreift(vertragsDatum);
  if (greift === null) {
    return { anwendbar: false, begruendung: 'Vertragsdatum unbekannt – bitte nachtragen.' };
  }
  if (!greift) {
    return {
      anwendbar: false,
      begruendung: 'Vertrag vor dem ' + REGELN.nacherfuellungVerlaengerung.giltAbVertragsDatum +
                   ' geschlossen, die Verlängerungsregel greift nicht.'
    };
  }
  return {
    anwendbar: true,
    verlaengerung: {
      key: 'nacherfuellung',
      grund: 'Nacherfüllungsreparatur',
      monate: REGELN.nacherfuellungVerlaengerung.monate,
      stoerungId: stoerungId || null,
      datum: datum || null
    }
  };
}

/** Baut den eigenständigen Werkvertrags-Anspruch nach bezahlter Reparatur. */
function anspruchAusReparatur(stoerung, gegenueberName) {
  const abnahme = stoerung && stoerung.auftrag && stoerung.auftrag.abnahmeDatum;
  if (!istGueltigesDatum(abnahme)) {
    throw new RangeError('Abnahmedatum fehlt – Fristbeginn nach § 634a BGB nicht bestimmbar');
  }
  return {
    id: 'ans_' + Date.now(),
    art: 'gewaehrleistung_werk',
    bezug: 'bauteil',
    bauteil: (stoerung.auftrag.getauschteTeile || []).map(t => t.bezeichnung).join(', ') || 'Reparaturleistung',
    gegenueber: { rolle: 'werkstatt', name: gegenueberName || stoerung.auftrag.firma || '' },
    beginn: abnahme,
    beginnKey: 'abnahme',
    beginnBezeichnung: 'Abnahme der Reparatur',
    dauerMonate: REGELN.standardDauer.gewaehrleistung_werk,
    endeManuell: null,
    grundlage: '§ 634a Abs. 1 Nr. 1 BGB (zu verifizieren)',
    verlaengerungen: [],
    belegDokumentId: null,
    aktiv: true
  };
}

/* ================================================================
 * 4. Folgen einer Reparatur
 * ================================================================ */

/**
 * Leitet aus den Umständen einer Reparatur ab, was daraus folgt.
 *
 * Verändert nichts. Der Aufrufer bekommt Vorschläge und Begründungen
 * und übernimmt sie bewusst – oder eben nicht.
 *
 * angaben:
 *   traeger        'verkaeufer' | 'hersteller' | 'werkstatt' | 'selbst'
 *   bezahlt        true, wenn eine Rechnung gestellt wurde
 *   abnahmeDatum   Rückgabe des funktionierenden Geräts
 *   vertragsDatum  Vertragsschluss des Kaufs, für die Verlängerungsregel
 *   firma, stoerungId, getauschteTeile
 *
 * Rückgabe: { folgen: [...], hinweise: [...] }
 *   folgen: { art: 'verlaengerung', anspruchId, verlaengerung }
 *        oder { art: 'neuerAnspruch', anspruch }
 */
function folgeAusReparatur(ansprueche, angaben) {
  const liste = Array.isArray(ansprueche) ? ansprueche : [];
  const a = angaben || {};
  const folgen = [];
  const hinweise = [];

  const bezahlt = a.bezahlt === true;
  const traeger = a.traeger;

  if (['verkaeufer', 'hersteller', 'werkstatt', 'selbst'].indexOf(traeger) === -1) {
    return { folgen: [], hinweise: [{
      schwere: 'frage',
      text: 'Wer die Reparatur durchgeführt hat, ist nicht erfasst. Ohne diese Angabe lässt sich keine Folge bestimmen.'
    }] };
  }

  /* Eigenreparatur: keine Ansprüche, aber ein ehrlicher Hinweis. */
  if (traeger === 'selbst') {
    hinweise.push({
      schwere: 'warnung',
      text: 'Selbst repariert. Daraus entstehen keine neuen Ansprüche. ' +
            'Eingriffe können außerdem bestehende Garantien berühren – Bedingungen prüfen.'
    });
    return { folgen, hinweise };
  }

  /* Kostenlose Reparatur durch den Verkäufer: Nacherfüllung. */
  if (traeger === 'verkaeufer' && !bezahlt) {
    const kaufAnspruch = liste.filter(function (x) {
      return x && x.aktiv !== false && x.art === 'gewaehrleistung_kauf';
    })[0];

    if (!kaufAnspruch) {
      hinweise.push({
        schwere: 'frage',
        text: 'Kostenlose Reparatur durch den Verkäufer, aber kein Gewährleistungsanspruch hinterlegt. ' +
              'Bitte Kaufdatum und Verkäufer nachtragen.'
      });
      return { folgen, hinweise };
    }

    const vorschlag = verlaengerungNachReparatur(
      kaufAnspruch, a.vertragsDatum, a.stoerungId, a.abnahmeDatum
    );
    if (vorschlag.anwendbar) {
      folgen.push({
        art: 'verlaengerung',
        anspruchId: kaufAnspruch.id,
        verlaengerung: vorschlag.verlaengerung
      });
    } else {
      hinweise.push({ schwere: 'hinweis', text: vorschlag.begruendung });
    }
    return { folgen, hinweise };
  }

  /* Kostenlose Reparatur durch den Hersteller: Garantiefall. */
  if (traeger === 'hersteller' && !bezahlt) {
    hinweise.push({
      schwere: 'hinweis',
      text: 'Reparatur aus der Herstellergarantie. Die gesetzliche Gewährleistung gegenüber dem Verkäufer ' +
            'verlängert sich dadurch nicht. Ob auf die Reparatur selbst eine Garantie gegeben wird, ' +
            'steht in den Garantiebedingungen.'
    });
    return { folgen, hinweise };
  }

  /* Kostenlos durch eine freie Werkstatt: ungewöhnlich, nachfragen. */
  if (traeger === 'werkstatt' && !bezahlt) {
    hinweise.push({
      schwere: 'frage',
      text: 'Kostenlose Reparatur durch eine freie Werkstatt. Bitte prüfen, ob sie im Auftrag des ' +
            'Verkäufers oder des Herstellers gehandelt hat – davon hängt die Folge ab.'
    });
    return { folgen, hinweise };
  }

  /* Bezahlte Reparatur: eigener Werkvertragsanspruch. */
  if (!istGueltigesDatum(a.abnahmeDatum)) {
    hinweise.push({
      schwere: 'frage',
      text: 'Bezahlte Reparatur ohne Abnahmedatum. Der Fristbeginn lässt sich ohne diesen Tag nicht bestimmen.'
    });
    return { folgen, hinweise };
  }

  const neu = anspruchAusReparatur({
    auftrag: {
      abnahmeDatum: a.abnahmeDatum,
      firma: a.firma || '',
      getauschteTeile: a.getauschteTeile || []
    }
  }, a.firma || '');

  neu.gegenueber = {
    rolle: traeger,
    name: a.firma || ''
  };

  folgen.push({ art: 'neuerAnspruch', anspruch: neu });
  hinweise.push({
    schwere: 'hinweis',
    text: 'Der neue Anspruch gilt nur für die Reparatur und die getauschten Teile, nicht für das ganze Gerät.'
  });
  return { folgen, hinweise };
}

/**
 * Jüngste Erledigung. Ist `bisDatum` gesetzt, werden Einträge nach
 * diesem Tag ignoriert – eine Erledigung in der Zukunft ist entweder
 * ein Tippfehler oder eine geplante Buchung, aber keine Grundlage
 * für die nächste Fälligkeit.
 */
/* ================================================================
 * 5. Wartungsaufgaben
 * ================================================================ */

function letzteErledigung(aufgabe, bisDatum) {
  const alle = (aufgabe.erledigungen || []).filter(e => e && istGueltigesDatum(e.datum));
  const grenze = istGueltigesDatum(bisDatum) ? bisDatum : null;
  const gueltig = grenze ? alle.filter(e => e.datum <= grenze) : alle;
  if (!gueltig.length) return null;
  // ISO-Strings sind lexikografisch sortierbar
  return gueltig.reduce((a, b) => (b.datum > a.datum ? b : a));
}

/** Zählt Erledigungen, die nach dem Stichtag datiert sind. */
function zukuenftigeErledigungen(aufgabe, stichtag) {
  if (!istGueltigesDatum(stichtag)) return 0;
  return (aufgabe.erledigungen || [])
    .filter(e => e && istGueltigesDatum(e.datum) && e.datum > stichtag).length;
}

/**
 * Erlaubte Werte für `aufgabe.intervallBasis`:
 *
 *   erledigung (Vorgabe) – Der nächste Termin zählt ab der letzten
 *     Erledigung. Passend für Aufgaben, bei denen der Abstand zählt:
 *     Filter wechseln, Schlitze reinigen.
 *
 *   plan – Die Termine liegen auf einem festen Raster ab dem
 *     Ankerdatum. Eine verspätete Erledigung verschiebt den Rhythmus
 *     nicht. Passend für jährlich vorgeschriebene Prüfungen.
 *
 * Im Planmodus wird der Termin immer aus dem Anker heraus gerechnet
 * (Anker + n × Intervall), nicht schrittweise. Sonst würde die
 * Monatsklammerung über die Jahre wandern: der 31.01. würde über
 * 28.02. und 28.03. schleichend nach vorn rutschen.
 */
const INTERVALL_BASIS = ['erledigung', 'plan'];

function intervallBasisVon(aufgabe) {
  return aufgabe && aufgabe.intervallBasis === 'plan' ? 'plan' : 'erledigung';
}

/** Kleinster Rastertermin, der echt nach `nachDatum` liegt. */
function planTermin(aufgabe, nachDatum) {
  const anker = aufgabe.ankerDatum;
  const GRENZE = 5000;
  let n = 1;
  let termin = addIntervall(anker, aufgabe.intervallWert * n, aufgabe.intervallEinheit);
  while (termin <= nachDatum && n < GRENZE) {
    n += 1;
    termin = addIntervall(anker, aufgabe.intervallWert * n, aufgabe.intervallEinheit);
  }
  return { termin, nummer: n };
}

/**
 * Nächste Fälligkeit einer wiederkehrenden Aufgabe.
 * Wird immer berechnet, nie gespeichert.
 */
function naechsteFaelligkeit(aufgabe, stichtagHeute) {
  if (!aufgabe || aufgabe.aktiv === false) return null;

  const modus = intervallBasisVon(aufgabe);
  const zukunft = zukuenftigeErledigungen(aufgabe, stichtagHeute);
  const letzte = letzteErledigung(aufgabe, stichtagHeute);
  const letztesDatum = letzte ? letzte.datum : null;

  const grund = {
    aufgabeId: aufgabe.id,
    titel: aufgabe.titel,
    intervallBasis: modus,
    letzteErledigung: letztesDatum,
    ignorierteZukunft: zukunft
  };

  let basis, basisArt, faellig;

  if (modus === 'plan') {
    if (!istGueltigesDatum(aufgabe.ankerDatum)) {
      return Object.assign({}, grund, {
        fehler: 'Planmodus braucht ein Ankerdatum als Raster'
      });
    }
    const ab = letztesDatum || aufgabe.ankerDatum;
    const treffer = planTermin(aufgabe, ab);
    basis = aufgabe.ankerDatum;
    basisArt = 'Planraster ab Ankerdatum';
    faellig = treffer.termin;
  } else {
    basis = letztesDatum || aufgabe.ankerDatum;
    if (!istGueltigesDatum(basis)) {
      return Object.assign({}, grund, {
        fehler: 'Weder Erledigung noch Ankerdatum vorhanden'
      });
    }
    basisArt = letztesDatum ? 'letzte Erledigung' : 'Ankerdatum';
    faellig = addIntervall(basis, aufgabe.intervallWert, aufgabe.intervallEinheit);
  }

  const bewertung = bewerteStichtag(faellig, stichtagHeute, aufgabe.vorlaufTage);

  return Object.assign({}, grund, {
    basis,
    basisArt,
    faellig,
    status: bewertung.status,
    restTage: bewertung.restTage,
    ueberfaelligTage: bewertung.restTage < 0 ? -bewertung.restTage : 0
  });
}

/* ================================================================
 * 6. Export
 * ================================================================ */

const Fristen = {
  istSchaltjahr, tageImMonat, parseISO, formatISO, istGueltigesDatum,
  addMonate, addTage, tageZwischen, heute, addIntervall,
  REGELN, nacherfuellungGreift,
  berechneAnspruchEnde, bewerteStichtag, anspruchsAuskunft,
  verlaengerungNachReparatur, anspruchAusReparatur, folgeAusReparatur,
  letzteErledigung, zukuenftigeErledigungen, naechsteFaelligkeit,
  INTERVALL_BASIS, intervallBasisVon, planTermin
};

if (typeof module !== 'undefined' && module.exports) module.exports = Fristen;
if (typeof window !== 'undefined') window.Fristen = Fristen;
