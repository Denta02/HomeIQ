const F = require('../public/js/fristen.js');

let ok = 0, fehler = 0;
function pruefe(name, ist, soll) {
  const gleich = JSON.stringify(ist) === JSON.stringify(soll);
  if (gleich) { ok++; }
  else { fehler++; console.log('FEHLER: ' + name + '\n  ist:  ' + JSON.stringify(ist) + '\n  soll: ' + JSON.stringify(soll)); }
}
function pruefeWirft(name, fn) {
  try { fn(); fehler++; console.log('FEHLER: ' + name + ' hätte werfen müssen'); }
  catch (_) { ok++; }
}

/* --- Monatsarithmetik / Clamping --- */
pruefe('31.01. + 1 Monat',        F.addMonate('2026-01-31', 1),  '2026-02-28');
pruefe('31.01. + 1 Monat (Schalt)', F.addMonate('2028-01-31', 1), '2028-02-29');
pruefe('29.02. + 24 Monate',      F.addMonate('2028-02-29', 24), '2030-02-28');
pruefe('31.03. + 1 Monat',        F.addMonate('2026-03-31', 1),  '2026-04-30');
pruefe('15.08. + 24 Monate',      F.addMonate('2026-08-15', 24), '2028-08-15');
pruefe('Monat 0',                 F.addMonate('2026-05-17', 0),  '2026-05-17');
pruefe('negativ, Jahreswechsel',  F.addMonate('2026-01-15', -1), '2025-12-15');

/* --- Tage / Differenzen --- */
pruefe('Jahreswechsel + 1 Tag', F.addTage('2026-12-31', 1), '2027-01-01');
pruefe('Schalttag',             F.addTage('2028-02-28', 1), '2028-02-29');
pruefe('Tage zwischen',         F.tageZwischen('2026-09-09', '2026-09-19'), 10);
pruefe('Tage rückwärts',        F.tageZwischen('2026-09-19', '2026-09-09'), -10);
pruefe('über Schaltjahr',       F.tageZwischen('2028-02-28', '2028-03-01'), 2);

/* --- Validierung --- */
pruefeWirft('31.02. existiert nicht', () => F.parseISO('2026-02-31'));
pruefeWirft('29.02. kein Schaltjahr', () => F.parseISO('2026-02-29'));
pruefeWirft('falsches Format',        () => F.parseISO('09.09.2026'));
pruefe('gültig erkannt',   F.istGueltigesDatum('2028-02-29'), true);
pruefe('ungültig erkannt', F.istGueltigesDatum('2026-13-01'), false);

/* --- Laptop-Szenario --- */
const anspruchKauf = {
  id: 'ans_1', art: 'gewaehrleistung_kauf', bezug: 'geraet',
  gegenueber: { rolle: 'verkaeufer', name: 'Media Markt' },
  beginn: '2026-08-15', beginnBezeichnung: 'Übergabe',
  dauerMonate: 24, endeManuell: null,
  grundlage: 'Gesetzliche Gewährleistung', verlaengerungen: []
};

pruefe('Grundfrist Laptop', F.berechneAnspruchEnde(anspruchKauf).ende, '2028-08-15');

const v = F.verlaengerungNachReparatur(anspruchKauf, '2026-08-01', 'sto_1', '2027-03-20');
pruefe('Verlängerung anwendbar', v.anwendbar, true);
anspruchKauf.verlaengerungen.push(v.verlaengerung);
pruefe('Nach Reparatur', F.berechneAnspruchEnde(anspruchKauf).ende, '2029-08-15');

const v2 = F.verlaengerungNachReparatur(anspruchKauf, '2026-08-01', 'sto_2', '2028-01-10');
pruefe('zweite Verlängerung blockiert', v2.anwendbar, false);

const alt = { ...anspruchKauf, verlaengerungen: [] };
pruefe('Altvertrag ohne Verlängerung',
  F.verlaengerungNachReparatur(alt, '2026-05-01', 'sto_x', null).anwendbar, false);
pruefe('Vertragsdatum unbekannt',
  F.verlaengerungNachReparatur(alt, null, 'sto_x', null).anwendbar, false);
pruefe('Stichtag genau 31.07.2026', F.nacherfuellungGreift('2026-07-31'), true);
pruefe('Stichtag 30.07.2026',       F.nacherfuellungGreift('2026-07-30'), false);

/* --- Werkvertrag aus Reparatur --- */
const stoerung = {
  auftrag: { firma: 'Dell Service', abnahmeDatum: '2027-03-20',
             getauschteTeile: [{ bezeichnung: 'Lüftereinheit' }] }
};
const werk = F.anspruchAusReparatur(stoerung, 'Dell Service');
pruefe('Werkvertrag 2 Jahre ab Abnahme', F.berechneAnspruchEnde(werk).ende, '2029-03-20');
pruefe('Werkvertrag nur Bauteil', werk.bezug, 'bauteil');
pruefeWirft('ohne Abnahmedatum', () => F.anspruchAusReparatur({ auftrag: {} }, 'X'));

/* --- Herleitung --- */
const herl = F.berechneAnspruchEnde(anspruchKauf).herleitung;
pruefe('Herleitung 3 Schritte', herl.length, 3);
pruefe('Herleitung Endwert', herl[2].ergebnis, '2029-08-15');

/* --- Manuelles Override --- */
pruefe('Override gewinnt',
  F.berechneAnspruchEnde({ ...anspruchKauf, endeManuell: '2030-01-01' }).endeQuelle, 'manuell');

/* --- Stichtagsbewertung --- */
pruefe('abgelaufen', F.bewerteStichtag('2026-09-01', '2026-09-09', 14).status, 'abgelaufen');
pruefe('heute',      F.bewerteStichtag('2026-09-09', '2026-09-09', 14).status, 'laeuft_heute_ab');
pruefe('bald',       F.bewerteStichtag('2026-09-15', '2026-09-09', 14).status, 'bald');
pruefe('Grenze bald',F.bewerteStichtag('2026-09-23', '2026-09-09', 14).status, 'bald');
pruefe('ok',         F.bewerteStichtag('2026-09-24', '2026-09-09', 14).status, 'ok');

/* --- Wartungsaufgabe --- */
const aufgabeNeu = {
  id: 'auf_1', titel: 'Jährliche Wartung', aktiv: true,
  intervallWert: 12, intervallEinheit: 'monate',
  ankerDatum: '2026-03-01', vorlaufTage: 14, erledigungen: []
};
pruefe('ohne Erledigung -> Anker', F.naechsteFaelligkeit(aufgabeNeu, '2026-09-09').faellig, '2027-03-01');
pruefe('Basisart Anker',           F.naechsteFaelligkeit(aufgabeNeu, '2026-09-09').basisArt, 'Ankerdatum');

const aufgabeAlt = { ...aufgabeNeu, erledigungen: [
  { datum: '2025-03-04' }, { datum: '2026-02-28' }, { datum: '2024-06-01' }
]};
const fa = F.naechsteFaelligkeit(aufgabeAlt, '2026-09-09');
pruefe('jüngste Erledigung gewinnt', fa.basis, '2026-02-28');
pruefe('Fälligkeit aus Erledigung', fa.faellig, '2027-02-28');

const ueberfaellig = { ...aufgabeNeu, ankerDatum: '2024-01-01', erledigungen: [] };
const uf = F.naechsteFaelligkeit(ueberfaellig, '2026-09-09');
pruefe('überfällig erkannt', uf.status, 'abgelaufen');
pruefe('Tage überfällig', uf.ueberfaelligTage > 500, true);

pruefe('inaktive Aufgabe', F.naechsteFaelligkeit({ ...aufgabeNeu, aktiv: false }, '2026-09-09'), null);
pruefe('Rauchmelder 12 Monate',
  F.addIntervall('2026-04-10', 12, 'monate'), '2027-04-10');


/* --- Schlüssel der Herleitung --- */
const kAnspruch = {
  id:'ans_k', art:'gewaehrleistung_kauf', bezug:'geraet',
  gegenueber:{rolle:'verkaeufer',name:'X'},
  beginn:'2026-08-15', beginnKey:'uebergabe', beginnBezeichnung:'Übergabe',
  dauerMonate:24, endeManuell:null,
  verlaengerungen:[{key:'nacherfuellung', grund:'Nacherfüllungsreparatur', monate:12}]
};
const kHerl = F.berechneAnspruchEnde(kAnspruch).herleitung.map(h => h.key);
pruefe('Schlüssel der Kette', kHerl, ['beginn:uebergabe','grundfrist','verlaengerung:nacherfuellung']);
pruefe('Schlüssel bei Override',
  F.berechneAnspruchEnde({...kAnspruch, endeManuell:'2030-01-01'}).herleitung.map(h=>h.key).pop(), 'override');
pruefe('beginnKey fehlt -> unbekannt',
  F.berechneAnspruchEnde({...kAnspruch, beginnKey:undefined}).herleitung[0].key, 'beginn:unbekannt');
pruefe('Verlängerung ohne key -> sonstige',
  F.berechneAnspruchEnde({...kAnspruch, verlaengerungen:[{grund:'Kulanz', monate:6}]})
   .herleitung.map(h=>h.key).pop(), 'verlaengerung:sonstige');
pruefe('erzeugte Verlängerung traegt key',
  F.verlaengerungNachReparatur({...kAnspruch, verlaengerungen:[]}, '2026-08-01','s',null).verlaengerung.key,
  'nacherfuellung');
pruefe('Werkvertrag beginnKey',
  F.anspruchAusReparatur({auftrag:{abnahmeDatum:'2027-03-20',firma:'D',getauschteTeile:[]}},'D').beginnKey,
  'abnahme');
pruefe('Schritttext unveraendert',
  F.berechneAnspruchEnde(kAnspruch).herleitung[2].schritt,
  '+ 12 Monate (Nacherfüllungsreparatur)');


/* --- Erledigungen in der Zukunft --- */
const zukunftAufgabe = {
  id:'auf_z', titel:'Lüftungsschlitze reinigen', aktiv:true,
  intervallWert:6, intervallEinheit:'monate',
  ankerDatum:'2026-08-15', vorlaufTage:14,
  erledigungen:[{ id:'e1', datum:'2027-03-20' }]
};
// Stichtag VOR der Erledigung: Eintrag darf nicht als Basis dienen
const zf = F.naechsteFaelligkeit(zukunftAufgabe, '2026-09-09');
pruefe('Zukunftseintrag ignoriert', zf.basisArt, 'Ankerdatum');
pruefe('Basis ist Ankerdatum', zf.basis, '2026-08-15');
pruefe('Fälligkeit aus Anker', zf.faellig, '2027-02-15');
pruefe('Zukunft gezählt', zf.ignorierteZukunft, 1);

// Stichtag NACH der Erledigung: normal rechnen
const zn = F.naechsteFaelligkeit(zukunftAufgabe, '2028-07-01');
pruefe('nach Stichtag zählt Erledigung', zn.basisArt, 'letzte Erledigung');
pruefe('Fälligkeit nach Erledigung', zn.faellig, '2027-09-20');
pruefe('keine Zukunft mehr', zn.ignorierteZukunft, 0);

// Erledigung genau am Stichtag zählt noch
pruefe('Stichtag = Erledigung zählt',
  F.naechsteFaelligkeit(zukunftAufgabe, '2027-03-20').basisArt, 'letzte Erledigung');

// letzteErledigung ohne Grenze bleibt abwaertskompatibel
pruefe('ohne Grenze unveraendert',
  F.letzteErledigung(zukunftAufgabe).datum, '2027-03-20');
pruefe('mit Grenze null',
  F.letzteErledigung(zukunftAufgabe, '2026-09-09'), null);

// mehrere Zukunftseintraege
const mehr = {...zukunftAufgabe, erledigungen:[
  {datum:'2027-03-20'},{datum:'2029-01-01'},{datum:'2026-05-05'}
]};
pruefe('zwei Zukunftseintraege gezaehlt',
  F.naechsteFaelligkeit(mehr, '2026-09-09').ignorierteZukunft, 2);
pruefe('juengste gueltige gewinnt',
  F.naechsteFaelligkeit(mehr, '2026-09-09').basis, '2026-05-05');

// Fehlerfall traegt jetzt Titel mit
const kaputt = F.naechsteFaelligkeit(
  {id:'x', titel:'Ohne Basis', aktiv:true, intervallWert:6, intervallEinheit:'monate', ankerDatum:'', erledigungen:[]},
  '2026-09-09');
pruefe('Fehler nennt Titel', kaputt.titel, 'Ohne Basis');


/* --- Intervallbasis: erledigung vs. plan --- */
const rauch = {
  id:'auf_r', titel:'Rauchmelder prüfen', aktiv:true,
  intervallWert:12, intervallEinheit:'monate',
  ankerDatum:'2026-03-01', vorlaufTage:30,
  intervallBasis:'plan', erledigungen:[]
};

pruefe('Vorgabe ist erledigung', F.intervallBasisVon({}), 'erledigung');
pruefe('plan wird erkannt', F.intervallBasisVon({intervallBasis:'plan'}), 'plan');
pruefe('Unsinn faellt auf erledigung', F.intervallBasisVon({intervallBasis:'quatsch'}), 'erledigung');

// Ohne Erledigung: erster Rasterpunkt nach dem Anker
pruefe('plan ohne Erledigung', F.naechsteFaelligkeit(rauch,'2026-09-09').faellig, '2027-03-01');

// Spät erledigt: Rhythmus bleibt
const spaet = {...rauch, erledigungen:[{datum:'2027-06-10'}]};
pruefe('plan haelt Rhythmus', F.naechsteFaelligkeit(spaet,'2027-07-01').faellig, '2028-03-01');

// Gleiche Daten im Modus erledigung: Termin wandert
const spaetE = {...spaet, intervallBasis:'erledigung'};
pruefe('erledigung verschiebt', F.naechsteFaelligkeit(spaetE,'2027-07-01').faellig, '2028-06-10');

// Früh erledigt: Plantermin bleibt stehen
const frueh = {...rauch, erledigungen:[{datum:'2027-01-15'}]};
pruefe('plan bei frueher Erledigung', F.naechsteFaelligkeit(frueh,'2027-02-01').faellig, '2027-03-01');
pruefe('erledigung bei frueher Erledigung',
  F.naechsteFaelligkeit({...frueh, intervallBasis:'erledigung'},'2027-02-01').faellig, '2028-01-15');

// Mehrere Jahre versaeumt: aeltester offener Termin
pruefe('versaeumte Jahre',
  F.naechsteFaelligkeit({...rauch, ankerDatum:'2023-03-01'},'2027-06-01').faellig, '2024-03-01');
pruefe('versaeumt = ueberfaellig',
  F.naechsteFaelligkeit({...rauch, ankerDatum:'2023-03-01'},'2027-06-01').status, 'abgelaufen');

// Kein Drift durch Monatsklammerung
const klammer = {
  id:'k', titel:'Monatsende', aktiv:true,
  intervallWert:1, intervallEinheit:'monate',
  ankerDatum:'2026-01-31', vorlaufTage:5,
  intervallBasis:'plan', erledigungen:[{datum:'2026-03-02'}]
};
pruefe('kein Drift im Planmodus', F.naechsteFaelligkeit(klammer,'2026-03-05').faellig, '2026-03-31');

// Planmodus ohne Anker meldet Fehler
pruefe('plan ohne Anker',
  F.naechsteFaelligkeit({...rauch, ankerDatum:''},'2026-09-09').fehler,
  'Planmodus braucht ein Ankerdatum als Raster');

// Zukunftseintrag wird auch im Planmodus ignoriert
const planZukunft = {...rauch, erledigungen:[{datum:'2029-01-01'}]};
pruefe('plan ignoriert Zukunft', F.naechsteFaelligkeit(planZukunft,'2026-09-09').faellig, '2027-03-01');
pruefe('plan zaehlt Zukunft', F.naechsteFaelligkeit(planZukunft,'2026-09-09').ignorierteZukunft, 1);

// Ergebnisfelder
const pf = F.naechsteFaelligkeit(spaet,'2027-07-01');
pruefe('Feld intervallBasis', pf.intervallBasis, 'plan');
pruefe('Feld letzteErledigung', pf.letzteErledigung, '2027-06-10');
pruefe('Basis ist der Anker', pf.basis, '2026-03-01');
pruefe('Basisart benannt', pf.basisArt, 'Planraster ab Ankerdatum');
pruefe('letzteErledigung null ohne Eintrag',
  F.naechsteFaelligkeit(rauch,'2026-09-09').letzteErledigung, null);

// planTermin direkt
pruefe('planTermin Nummer', F.planTermin(rauch,'2027-06-10').nummer, 2);


/* --- Folgen einer Reparatur --- */
const kaufA = {
  id:'ans_kauf', art:'gewaehrleistung_kauf', bezug:'geraet', aktiv:true,
  gegenueber:{rolle:'verkaeufer',name:'Media Markt'},
  beginn:'2026-08-15', beginnKey:'uebergabe', dauerMonate:24,
  endeManuell:null, verlaengerungen:[]
};
const basisAngaben = {
  abnahmeDatum:'2027-03-20', vertragsDatum:'2026-08-01',
  firma:'Dell Service', stoerungId:'sto_1',
  getauschteTeile:[{bezeichnung:'Lüftereinheit'}]
};

// Verkäufer, kostenlos -> Verlängerung
let r = F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'verkaeufer', bezahlt:false});
pruefe('Nacherfuellung erzeugt Verlaengerung', r.folgen.length, 1);
pruefe('Art Verlaengerung', r.folgen[0].art, 'verlaengerung');
pruefe('richtiger Anspruch', r.folgen[0].anspruchId, 'ans_kauf');
pruefe('12 Monate', r.folgen[0].verlaengerung.monate, 12);

// Hersteller, kostenlos -> KEINE Verlängerung
r = F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'hersteller', bezahlt:false});
pruefe('Garantie verlaengert nicht', r.folgen.length, 0);
pruefe('Garantie mit Hinweis', r.hinweise.length > 0, true);

// Werkstatt, bezahlt -> neuer Werkvertragsanspruch
r = F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'werkstatt', bezahlt:true});
pruefe('bezahlt erzeugt Anspruch', r.folgen[0].art, 'neuerAnspruch');
pruefe('Werkvertragsart', r.folgen[0].anspruch.art, 'gewaehrleistung_werk');
pruefe('gegen die Werkstatt', r.folgen[0].anspruch.gegenueber.rolle, 'werkstatt');
pruefe('Ende zwei Jahre nach Abnahme',
  F.berechneAnspruchEnde(r.folgen[0].anspruch).ende, '2029-03-20');
pruefe('nur Bauteil', r.folgen[0].anspruch.bezug, 'bauteil');

// Verkäufer, bezahlt -> Werkvertrag gegen den Verkäufer
r = F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'verkaeufer', bezahlt:true});
pruefe('bezahlt beim Verkaeufer', r.folgen[0].anspruch.gegenueber.rolle, 'verkaeufer');

// Selbst repariert -> nichts, aber Warnung
r = F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'selbst', bezahlt:false});
pruefe('selbst ohne Folge', r.folgen.length, 0);
pruefe('selbst mit Warnung', r.hinweise[0].schwere, 'warnung');

// Träger fehlt -> Rückfrage
r = F.folgeAusReparatur([kaufA], {...basisAngaben, bezahlt:false});
pruefe('ohne Traeger Rueckfrage', r.hinweise[0].schwere, 'frage');
pruefe('ohne Traeger keine Folge', r.folgen.length, 0);

// Kostenlos beim Verkäufer, aber kein Kaufanspruch hinterlegt
r = F.folgeAusReparatur([], {...basisAngaben, traeger:'verkaeufer', bezahlt:false});
pruefe('ohne Kaufanspruch Rueckfrage', r.hinweise[0].schwere, 'frage');

// Altvertrag: Verlängerungsregel greift nicht
r = F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'verkaeufer', bezahlt:false, vertragsDatum:'2026-05-01'});
pruefe('Altvertrag ohne Folge', r.folgen.length, 0);
pruefe('Altvertrag begruendet', r.hinweise[0].schwere, 'hinweis');

// Bezahlt ohne Abnahmedatum -> Rückfrage statt erfundener Frist
r = F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'werkstatt', bezahlt:true, abnahmeDatum:''});
pruefe('ohne Abnahme keine Folge', r.folgen.length, 0);
pruefe('ohne Abnahme Rueckfrage', r.hinweise[0].schwere, 'frage');

// Freie Werkstatt kostenlos -> nachfragen
r = F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'werkstatt', bezahlt:false});
pruefe('Werkstatt kostenlos Rueckfrage', r.hinweise[0].schwere, 'frage');

// Zweite Nacherfuellung wird blockiert
const schonVerlaengert = {...kaufA, verlaengerungen:[{key:'nacherfuellung',grund:'Nacherfüllungsreparatur',monate:12}]};
r = F.folgeAusReparatur([schonVerlaengert], {...basisAngaben, traeger:'verkaeufer', bezahlt:false});
pruefe('zweite Nacherfuellung blockiert', r.folgen.length, 0);

// Nichts wird veraendert
const vorher = JSON.stringify(kaufA);
F.folgeAusReparatur([kaufA], {...basisAngaben, traeger:'verkaeufer', bezahlt:false});
pruefe('Anspruch unveraendert', JSON.stringify(kaufA), vorher);

console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
