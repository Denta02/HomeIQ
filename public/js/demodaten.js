/**
 * HomeIQ – Demodaten
 * ------------------------------------------------------------------
 * Beispieldaten für die Prototypen. Nur hier gepflegt, damit
 * Geräteakte und Übersicht dieselben Stände zeigen.
 */

'use strict';

var GERAETE = [{
    id: 'ger_1',
    name: 'Laptop Dell XPS 15',
    kategorie: 'elektronik',
    status: 'aktiv',
    standort: 'Arbeitszimmer, Haus Musterstraße 5',
    identitaet: {
      hersteller: 'Dell',
      modell: 'XPS 15 9530',
      nummern: [
        { art: 'service_tag', wert: 'H7QL4M3' },
        { art: 'express_servicecode', wert: '' },
        { art: 'unbekannt', beschriftung: 'PPID', wert: 'CN0X7K42-74445' }
      ],
      eprelId: null,
      typenschildFotoId: 'dok_5'
    },
    kauf: {
      datum: '2026-08-15',
      vertragsDatum: '2026-08-01',
      verkaeufer: 'Media Markt Filiale Nord',
      preisCent: 189900,
      belegDokumentId: 'dok_1'
    },
    ansprueche: [
      {
        id: 'ans_1',
        art: 'gewaehrleistung_kauf',
        bezug: 'geraet',
        bauteil: null,
        gegenueber: { rolle: 'verkaeufer', name: 'Media Markt Filiale Nord' },
        beginn: '2026-08-15',
        beginnKey: 'uebergabe',
        beginnBezeichnung: 'Übergabe',
        dauerMonate: 24,
        endeManuell: null,
        grundlage: 'Gesetzliche Gewährleistung beim Kauf',
        verlaengerungen: [
          { key: 'nacherfuellung', grund: 'Nacherfüllungsreparatur', monate: 12,
            stoerungId: 'sto_1', datum: '2027-03-20' }
        ],
        belegDokumentId: 'dok_1',
        aktiv: true
      },
      {
        id: 'ans_2',
        art: 'gewaehrleistung_werk',
        bezug: 'bauteil',
        bauteil: 'Lüftereinheit',
        gegenueber: { rolle: 'werkstatt', name: 'Dell Service' },
        beginn: '2027-03-20',
        beginnKey: 'abnahme',
        beginnBezeichnung: 'Abnahme der Reparatur',
        dauerMonate: 24,
        endeManuell: null,
        grundlage: '§ 634a Abs. 1 Nr. 1 BGB – zwei Jahre ab Abnahme',
        verlaengerungen: [],
        belegDokumentId: 'dok_2',
        aktiv: true
      },
      {
        id: 'ans_3',
        art: 'herstellergarantie',
        bezug: 'bauteil',
        bauteil: 'Wechselakku',
        gegenueber: { rolle: 'hersteller', name: 'Dell' },
        beginn: '2027-03-20',
        beginnKey: 'einbau',
        beginnBezeichnung: 'Einbau',
        dauerMonate: 12,
        endeManuell: null,
        grundlage: 'Herstellergarantie laut Beipackzettel',
        verlaengerungen: [],
        belegDokumentId: 'dok_2',
        aktiv: true
      }
    ],
    stoerungen: [
      {
        id: 'sto_1',
        gemeldet: '2027-03-05',
        symptom: 'Lüfter laut, Gerät wird unter Last sehr heiß',
        fehlercode: '',
        status: 'erledigt',
        anspruchId: 'ans_1',
        kiVerlauf: [{ zeit: '2027-03-05', frage: 'Lüfter laut', antwort: 'Lüftungsschlitze prüfen und ausblasen', modell: 'demo' }],
        auftrag: {
          firma: 'Dell Service',
          auftragsnummer: 'DS-2027-88431',
          abgegeben: '2027-03-06',
          abnahmeDatum: '2027-03-20',
          kostenvoranschlagCent: 0,
          kostenCent: 0,
          getauschteTeile: [
            { bezeichnung: 'Lüftereinheit', teilenummer: '0RMYW3', neuerAnspruchId: 'ans_2' },
            { bezeichnung: 'Wechselakku', teilenummer: '0M59JH', neuerAnspruchId: 'ans_3' }
          ]
        },
        ergebnis: 'repariert',
        dokumentIds: ['dok_2', 'dok_3']
      }
    ],
    aufgaben: [
      {
        id: 'auf_1', titel: 'Lüftungsschlitze reinigen', aktiv: true,
        quelle: 'vorlage:geraet_lueftung',
        intervallBasis: 'erledigung',
        intervallWert: 6, intervallEinheit: 'monate',
        ankerDatum: '2026-08-15', vorlaufTage: 14,
        erledigungen: [{ id: 'erl_1', datum: '2027-03-20', ausfuehrender: 'firma', firma: 'Dell Service', kostenCent: 0 }]
      },
      {
        id: 'auf_2', titel: 'Datensicherung prüfen', aktiv: true,
        quelle: 'vorlage:datensicherung',
        intervallBasis: 'plan',
        intervallWert: 3, intervallEinheit: 'monate',
        ankerDatum: '2026-09-01', vorlaufTage: 7,
        erledigungen: [{ id: 'erl_2', datum: '2027-02-01', ausfuehrender: 'selbst', kostenCent: 0 }]
      },
      {
        id: 'auf_3', titel: 'Rauchmelder im Arbeitszimmer prüfen', aktiv: true,
        quelle: 'vorlage:rauchmelder_inspektion',
        intervallBasis: 'plan',
        intervallWert: 12, intervallEinheit: 'monate',
        ankerDatum: '2026-03-01', vorlaufTage: 30,
        erledigungen: [{ id: 'erl_3', datum: '2027-06-10', ausfuehrender: 'selbst', kostenCent: 0 }]
      }
    ],
    dokumente: [
      { id: 'dok_1', titel: 'Kaufbeleg', typ: 'kaufbeleg', erstellt: '2026-08-15',
        ocrText: 'Media Markt Filiale Nord Rechnung Dell XPS 15 9530 Seriennummer CN0X7K42-74445 1899,00 EUR' },
      { id: 'dok_2', titel: 'Reparaturbericht 03/2027', typ: 'reparaturrechnung', erstellt: '2027-03-20',
        ocrText: 'Dell Service Auftrag DS-2027-88431 Austausch Lueftereinheit 0RMYW3 Wechselakku 0M59JH Garantiefall keine Berechnung' },
      { id: 'dok_3', titel: 'Übergabeprotokoll', typ: 'uebergabeprotokoll', erstellt: '2027-03-20',
        ocrText: 'Abnahme der Reparatur am 20.03.2027 Geraet funktionsfaehig uebergeben' },
      { id: 'dok_5', titel: 'Typenschild Unterseite', typ: 'typenschild', erstellt: '2026-08-16',
        ocrText: 'Dell XPS 15 9530 Service Tag H7QL4M3 19.5V 6.15A Made in China' }
    ],
    handbuch: { url: 'https://www.dell.com/support/manuals/', quelle: 'hersteller', dokumentId: null }
  },
  {
    id: 'ger_2',
    name: 'Ölheizung Viessmann Vitoladens',
    kategorie: 'heizung_oel',
    status: 'aktiv',
    standort: 'Heizungskeller, Haus Musterstraße 5',
    identitaet: {
      hersteller: 'Viessmann',
      modell: 'Vitoladens 300-C',
      nummern: [
        { art: 'typ', wert: 'VC3-19' },
        { art: 'seriennummer', wert: '7521984-100-0000123456' }
      ],
      eprelId: null,
      typenschildFotoId: null
    },
    kauf: {
      datum: '2019-04-12',
      vertragsDatum: '2019-03-20',
      verkaeufer: 'Heizung Meier GmbH',
      preisCent: 894000,
      belegDokumentId: 'dok_h1'
    },
    ansprueche: [{
      id: 'ans_h1',
      art: 'gewaehrleistung_kauf',
      bezug: 'geraet',
      bauteil: null,
      gegenueber: { rolle: 'verkaeufer', name: 'Heizung Meier GmbH' },
      beginn: '2019-04-12',
      beginnKey: 'uebergabe',
      beginnBezeichnung: 'Übergabe',
      dauerMonate: 24,
      endeManuell: null,
      grundlage: 'Gesetzliche Gewährleistung beim Kauf',
      verlaengerungen: [],
      belegDokumentId: 'dok_h1',
      aktiv: true
    }],
    stoerungen: [],
    aufgaben: [{
      id: 'auf_h1', titel: 'Heizung warten lassen', aktiv: true,
      quelle: 'vorlage:heizungswartung',
      intervallBasis: 'plan',
      intervallWert: 12, intervallEinheit: 'monate',
      ankerDatum: '2019-10-01', vorlaufTage: 30,
      erledigungen: [{ id: 'erl_h1', datum: '2027-10-04', ausfuehrender: 'firma', firma: 'Heizung Meier GmbH', kostenCent: 18900 }]
    }],
    lieferungen: [
      { id: 'lf_1', datum: '2024-09-10', einheit: 'liter', mengeHundertstel: 280000,
        gesamtCent: 263200, volltankung: true, lieferant: 'Öl Meier', belegDokumentId: null },
      { id: 'lf_2', datum: '2025-09-12', einheit: 'liter', mengeHundertstel: 250000,
        gesamtCent: 225000, volltankung: true, lieferant: 'Öl Meier', belegDokumentId: null },
      { id: 'lf_3', datum: '2026-02-14', einheit: 'liter', mengeHundertstel: 90000,
        gesamtCent: 88200, volltankung: false, lieferant: 'Brenner & Sohn',
        notiz: 'Nachbestellung, es wurde knapp', belegDokumentId: null },
      { id: 'lf_4', datum: '2026-10-01', einheit: 'liter', mengeHundertstel: 150000,
        gesamtCent: 142500, volltankung: true, lieferant: 'Öl Meier', belegDokumentId: null }
    ],
    dokumente: [
      { id: 'dok_h1', titel: 'Rechnung Heizungseinbau', typ: 'kaufbeleg', erstellt: '2019-04-12',
        ocrText: 'Heizung Meier GmbH Vitoladens 300-C VC3-19 Einbau inkl. Inbetriebnahme 8940,00 EUR' }
    ],
    handbuch: { url: '', quelle: '', dokumentId: null }
  }];


var OBJEKT = {
  id: 'obj_1',
  name: 'Haus Musterstraße 5',
  typ: 'haus',
  adresse: 'Musterstraße 5, 12345 Musterstadt',
  baujahr: 1998,
  gebaeude: { nutzung: 'privat', einheiten: 1 },
  geaendert: '2026-09-09T08:15:00.000Z',
  geraete: GERAETE
};

var Demodaten = { OBJEKT: OBJEKT, GERAETE: GERAETE };

if (typeof module !== 'undefined' && module.exports) module.exports = Demodaten;
if (typeof window !== 'undefined') window.Demodaten = Demodaten;
