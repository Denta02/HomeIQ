'use strict';

/* Führt die Bearbeitungs- und Löschlogik direkt gegen die Daten aus,
   ohne DOM – prüft, was die Knöpfe bewirken. */
const fs = require('fs');
const P = require('path').join(__dirname, '..', 'public') + '/';
const B = require(P + 'js/brennstoff.js');
const F = require(P + 'js/fristen.js');

let ok=0, fehler=0;
const p=(n,i,s)=>{ if(JSON.stringify(i)===JSON.stringify(s)) ok++;
  else {fehler++; console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(i)+'\n  soll: '+JSON.stringify(s));} };

const L=(id,d,l,e,v)=>({id,datum:d,einheit:'liter',mengeHundertstel:l*100,
  gesamtCent:Math.round(e*100),volltankung:v,lieferant:'Öl Meier',notiz:'Notiz '+id});

function geraet(){ return { lieferungen:[L('a','2024-09-10',2800,2632,true),
  L('b','2025-09-12',2500,2250,true), L('c','2026-10-01',1500,1425,true)] }; }

/* Löschen */
{
  const g=geraet();
  g.lieferungen = g.lieferungen.filter(x=>x.id!=='b');
  p('Lieferung entfernt', g.lieferungen.map(x=>x.id), ['a','c']);
  const sp=B.verbrauchSpanne(g.lieferungen,F.istGueltigesDatum,F.tageZwischen);
  p('Verbrauch rechnet neu', sp.mengeHundertstel, 150000);
  p('Spanne passt sich an', [sp.von,sp.bis], ['2024-09-10','2026-10-01']);
}

/* Bearbeiten: Notiz und Beleg bleiben erhalten */
{
  const g=geraet();
  const alt = g.lieferungen.find(x=>x.id==='b');
  const neu = { id:'b', datum:'2025-10-01', einheit:'liter',
    mengeHundertstel:260000, gesamtCent:234000, volltankung:false,
    lieferant:'Brenner & Sohn', belegDokumentId:null };
  g.lieferungen = g.lieferungen.map(x => {
    if (x.id!=='b') return x;
    neu.notiz = x.notiz; neu.belegDokumentId = x.belegDokumentId; return neu;
  });
  const b = g.lieferungen.find(x=>x.id==='b');
  p('Menge geaendert', b.mengeHundertstel, 260000);
  p('Datum geaendert', b.datum, '2025-10-01');
  p('Volltankung geaendert', b.volltankung, false);
  p('Notiz erhalten', b.notiz, 'Notiz b');
  p('Reihenfolge bleibt', g.lieferungen.map(x=>x.id), ['a','b','c']);
  p('Teilbefuellung wirkt sofort',
    B.verbrauchsAbschnitte(g.lieferungen,F.istGueltigesDatum,F.tageZwischen).map(x=>x.belastbar),
    [false,false]);
}

/* Letzte Lieferung loeschen */
{
  const g=geraet();
  g.lieferungen = g.lieferungen.filter(x=>x.id!=='c');
  p('zwei uebrig', g.lieferungen.length, 2);
  p('Spanne weiter belastbar',
    B.verbrauchSpanne(g.lieferungen,F.istGueltigesDatum,F.tageZwischen).belastbar, true);
}
/* Alle loeschen */
{
  const g=geraet(); g.lieferungen=[];
  const sp=B.verbrauchSpanne(g.lieferungen,F.istGueltigesDatum,F.tageZwischen);
  p('leer faellt weich', sp.belastbar, false);
  p('mit Begruendung', typeof sp.grund, 'string');
}

/* Erledigung loeschen wirkt auf die Faelligkeit */
{
  const auf={id:'u1',titel:'x',aktiv:true,intervallBasis:'erledigung',
    intervallWert:6,intervallEinheit:'monate',ankerDatum:'2026-08-15',vorlaufTage:14,
    erledigungen:[{id:'e1',datum:'2027-03-20'},{id:'e2',datum:'2027-09-20'}]};
  p('vorher', F.naechsteFaelligkeit(auf,'2028-07-01').faellig, '2028-03-20');
  auf.erledigungen = auf.erledigungen.filter(x=>x.id!=='e2');
  p('nach dem Loeschen', F.naechsteFaelligkeit(auf,'2028-07-01').faellig, '2027-09-20');
  auf.erledigungen = [];
  p('alle geloescht faellt auf Anker', F.naechsteFaelligkeit(auf,'2028-07-01').basisArt, 'Ankerdatum');
}

/* Abhaengige Ansprueche einer Stoerung */
{
  const ansprueche=[{id:'a1',art:'gewaehrleistung_kauf',verlaengerungen:[
    {key:'nacherfuellung',grund:'Nacherfüllungsreparatur',monate:12,stoerungId:'sto_1'}]}];
  function abhaengig(id){ const t=[];
    ansprueche.forEach(a=>(a.verlaengerungen||[]).forEach(v=>{
      if(v.stoerungId===id) t.push('Verlängerung um '+v.monate+' Monate'); })); return t; }
  p('Abhaengigkeit gefunden', abhaengig('sto_1'), ['Verlängerung um 12 Monate']);
  p('fremde Stoerung ohne Treffer', abhaengig('sto_9'), []);
}


/* --- Ansprüche bearbeiten und löschen --- */
{
  const a = { id:'a1', art:'gewaehrleistung_kauf', bezug:'geraet', bauteil:'',
    gegenueber:{rolle:'verkaeufer',name:'Media Markt'},
    beginn:'2026-08-15', beginnKey:'uebergabe', beginnBezeichnung:'Übergabe',
    dauerMonate:24, endeManuell:null, grundlage:'Gesetz',
    verlaengerungen:[{key:'nacherfuellung',grund:'Nacherfüllungsreparatur',monate:12,stoerungId:'sto_1'}],
    aktiv:true };

  p('Ende vor der Aenderung', F.berechneAnspruchEnde(a).ende, '2029-08-15');

  /* Grundfrist aendern - Verlaengerung bleibt erhalten */
  const b = {...a, dauerMonate:12};
  p('Ende nach kuerzerer Grundfrist', F.berechneAnspruchEnde(b).ende, '2028-08-15');
  p('Verlaengerung erhalten', b.verlaengerungen.length, 1);
  p('Herleitung hat drei Schritte', F.berechneAnspruchEnde(b).herleitung.length, 3);

  /* Beginn aendern */
  p('Ende nach neuem Beginn',
    F.berechneAnspruchEnde({...a, beginn:'2027-01-31'}).ende, '2030-01-31');

  /* Handeingabe gewinnt */
  const m = F.berechneAnspruchEnde({...a, endeManuell:'2031-01-01'});
  p('Handeingabe gewinnt', m.ende, '2031-01-01');
  p('als manuell gefuehrt', m.endeQuelle, 'manuell');
  p('berechneter Wert bleibt in der Herleitung',
    m.herleitung[m.herleitung.length-1].schritt.indexOf('2029-08-15') !== -1, true);

  /* beginnKey wirkt auf den Erklaerschluessel */
  p('Schluessel folgt der Auswahl',
    F.berechneAnspruchEnde({...a, beginnKey:'abnahme'}).herleitung[0].key, 'beginn:abnahme');

  /* Inaktiv schalten statt loeschen */
  const liste = [a, {...a, id:'a2', aktiv:false}];
  p('nur aktive zaehlen', liste.filter(x=>x.aktiv!==false).length, 1);
}

/* --- Pruefung der Eingaben --- */
{
  function pruefe(a) {
    const f=[];
    if(!F.istGueltigesDatum(a.beginn)) f.push('beginn');
    if(!Number.isInteger(a.dauerMonate)||a.dauerMonate<0) f.push('dauer');
    if(a.bezug==='bauteil' && !String(a.bauteil||'').trim()) f.push('bauteil');
    if(!String(a.gegenueber.name||'').trim()) f.push('name');
    return f;
  }
  const gut={beginn:'2026-01-01',dauerMonate:24,bezug:'geraet',bauteil:'',gegenueber:{name:'X'}};
  p('gueltig', pruefe(gut), []);
  p('ohne Beginn', pruefe({...gut,beginn:''}), ['beginn']);
  p('Dauer keine Zahl', pruefe({...gut,dauerMonate:NaN}), ['dauer']);
  p('Bauteil ohne Namen', pruefe({...gut,bezug:'bauteil'}), ['bauteil']);
  p('ohne Ansprechpartner', pruefe({...gut,gegenueber:{name:'  '}}), ['name']);
  p('Dauer 0 erlaubt', pruefe({...gut,dauerMonate:0}), []);
}

/* --- Aufgaben bearbeiten --- */
{
  const auf = { id:'u1', titel:'Filter', aktiv:true, intervallBasis:'erledigung',
    intervallWert:6, intervallEinheit:'monate', ankerDatum:'2026-08-15',
    vorlaufTage:14, erledigungen:[{id:'e1',datum:'2027-03-20'}] };

  p('vorher', F.naechsteFaelligkeit(auf,'2028-07-01').faellig, '2027-09-20');
  p('Intervall geaendert',
    F.naechsteFaelligkeit({...auf, intervallWert:12},'2028-07-01').faellig, '2028-03-20');
  p('Einheit geaendert',
    F.naechsteFaelligkeit({...auf, intervallWert:1, intervallEinheit:'jahre'},'2028-07-01').faellig, '2028-03-20');
  p('Rhythmus auf Plan',
    F.naechsteFaelligkeit({...auf, intervallBasis:'plan'},'2028-07-01').faellig, '2027-08-15');
  p('Erledigungen bleiben',
    F.naechsteFaelligkeit({...auf, intervallWert:3},'2028-07-01').basisArt, 'letzte Erledigung');
  p('inaktiv verschwindet aus der Rechnung',
    F.naechsteFaelligkeit({...auf, aktiv:false},'2028-07-01'), null);
  /* Faelligkeit genau am Stichtag ist ein eigener Status */
  p('Faellig am Stichtag',
    F.naechsteFaelligkeit({...auf, ankerDatum:'2028-06-01', erledigungen:[], intervallWert:1},'2028-07-01').status,
    'laeuft_heute_ab');
  /* Mit grossem Vorlauf schlaegt eine spaetere Faelligkeit frueher an */
  p('kleiner Vorlauf: noch in Ordnung',
    F.naechsteFaelligkeit({...auf, ankerDatum:'2028-06-15', erledigungen:[], intervallWert:1, vorlaufTage:7},'2028-07-01').status,
    'ok');
  p('grosser Vorlauf: schon Vorwarnung',
    F.naechsteFaelligkeit({...auf, ankerDatum:'2028-06-15', erledigungen:[], intervallWert:1, vorlaufTage:60},'2028-07-01').status,
    'bald');
}

/* --- Neue Aufgabe --- */
{
  const neu = { id:'u9', titel:'Neu', aktiv:true, intervallBasis:'plan',
    intervallWert:12, intervallEinheit:'monate', ankerDatum:'2028-07-01',
    vorlaufTage:14, erledigungen:[] };
  const f = F.naechsteFaelligkeit(neu,'2028-07-01');
  p('erste Faelligkeit ein Jahr spaeter', f.faellig, '2029-07-01');
  p('Status in Ordnung', f.status, 'ok');
}


/* --- Geraete anlegen, aendern, loeschen --- */
{
  const HS = require(P + 'js/hersteller.js');
  const SH = require(P + 'js/selbsthilfe.js');

  function leer(id) {
    return { id, name:'', kategorie:'sonstiges', status:'aktiv', standort:'', notiz:'',
      identitaet:{hersteller:'',modell:'',nummern:[]},
      kauf:{datum:'',vertragsDatum:'',verkaeufer:'',preisCent:0},
      ansprueche:[], stoerungen:[], aufgaben:[], dokumente:[],
      handbuch:{url:'',quelle:'',dokumentId:null} };
  }

  function pruefe(g, preisText) {
    const f=[];
    if(!String(g.name).trim()) f.push('name');
    if(g.kauf.datum && !F.istGueltigesDatum(g.kauf.datum)) f.push('datum');
    if(g.kauf.vertragsDatum && !F.istGueltigesDatum(g.kauf.vertragsDatum)) f.push('vertrag');
    if(g.kauf.datum && g.kauf.vertragsDatum && g.kauf.vertragsDatum > g.kauf.datum) f.push('reihenfolge');
    if(preisText && preisText.trim() && !/^\d+([.,]\d{0,2})?$/.test(preisText.trim())) f.push('preis');
    return f;
  }

  const g = leer('ger_x');
  p('leeres Geraet faellt durch', pruefe(g,''), ['name']);
  g.name = 'Waschmaschine';
  p('mit Namen in Ordnung', pruefe(g,''), []);
  p('Vertrag nach Uebergabe faellt auf',
    pruefe({...g, kauf:{datum:'2026-01-01', vertragsDatum:'2026-02-01'}}, ''), ['reihenfolge']);
  p('Vertrag vor Uebergabe in Ordnung',
    pruefe({...g, kauf:{datum:'2026-02-01', vertragsDatum:'2026-01-01'}}, ''), []);
  p('ungueltiger Preis faellt auf', pruefe(g,'abc'), ['preis']);
  p('Preis mit Komma geht', pruefe(g,'1899,00'), []);
  p('leerer Preis geht', pruefe(g,'   '), []);

  /* Kategorie steuert das Sicherheitsgatter */
  p('Gastherme sperrt', SH.bewerteAnliegen('gastherme','').stufe, 'gesperrt');
  p('Elektronik frei', SH.bewerteAnliegen('elektronik','').stufe, 'frei');
  p('Sonstiges vorsichtig', SH.bewerteAnliegen('sonstiges','').stufe, 'eingeschraenkt');

  /* Hersteller steuert die Nummernfelder */
  p('Bosch-Felder', HS.schemaFuer('Bosch').nummern.map(n=>n.art),
    ['e_nr','e_nr_index','fd','z_nr']);
  p('Dell-Felder', HS.schemaFuer('Dell').nummern.map(n=>n.art),
    ['service_tag','express_servicecode','modell']);
  p('Wechsel aendert die Felder',
    HS.schemaFuer('Bosch').nummern.length !== HS.schemaFuer('Dell').nummern.length, true);

  /* Was haengt am Geraet */
  function inhalt(x){ const t=[];
    if((x.ansprueche||[]).length) t.push(x.ansprueche.length+' Ansprüche');
    if((x.aufgaben||[]).length) t.push(x.aufgaben.length+' Aufgaben');
    if((x.lieferungen||[]).length) t.push(x.lieferungen.length+' Lieferungen');
    return t; }
  p('leeres Geraet ohne Anhang', inhalt(g), []);
  p('Anhang wird gezaehlt',
    inhalt({ansprueche:[1,2],aufgaben:[1],lieferungen:[1,2,3]}),
    ['2 Ansprüche','1 Aufgaben','3 Lieferungen']);

  /* Loeschen aus einer Liste, Index bleibt gueltig */
  let liste = [leer('a'), leer('b'), leer('c')];
  let idx = 2;
  liste = liste.filter(x=>x.id!=='c');
  if (idx >= liste.length) idx = Math.max(0, liste.length-1);
  p('Index nach dem Loeschen', idx, 1);
  p('richtiges Geraet aktiv', liste[idx].id, 'b');
}

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
