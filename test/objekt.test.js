const O = require('../public/js/objekt.js');
const F = require('../public/js/fristen.js');
const D = require('../public/js/demodaten.js');
let ok=0, fehler=0;
function p(n,ist,soll){const g=JSON.stringify(ist)===JSON.stringify(soll);
 if(g)ok++;else{fehler++;console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(ist)+'\n  soll: '+JSON.stringify(soll));}}

const ST='2028-07-01';
const liste = O.alleFristen(D.OBJEKT, ST, F);

p('Liste nicht leer', liste.length > 0, true);
p('beide Geraete vertreten',
  new Set(liste.map(e=>e.geraetId)).size, 2);
p('beide Arten vertreten',
  new Set(liste.map(e=>e.art)).size, 2);

/* Sortierung: Dringlichkeit zuerst */
const rang={abgelaufen:0,laeuft_heute_ab:1,bald:2,ok:3,unbekannt:4};
let sortiert=true;
for(let i=1;i<liste.length;i++){
  const a=rang[liste[i-1].status], b=rang[liste[i].status];
  if(a>b) sortiert=false;
  if(a===b && liste[i-1].datum && liste[i].datum && liste[i-1].datum>liste[i].datum) sortiert=false;
}
p('korrekt sortiert', sortiert, true);
p('erster ist der dringendste', rang[liste[0].status] <= rang[liste[liste.length-1].status], true);

/* Zusammenfassung */
const z = O.zusammenfassung(liste);
p('Summe stimmt', z.abgelaufen+z.bald+z.ok+z.unbekannt, z.gesamt);
p('gesamt = Listenlaenge', z.gesamt, liste.length);
p('leere Liste', O.zusammenfassung([]), {gesamt:0,abgelaufen:0,bald:0,ok:0,unbekannt:0});
p('null vertraegt sich', O.zusammenfassung(null).gesamt, 0);

/* Filter je Geraet */
p('Filter Laptop', O.fuerGeraet(liste,'ger_1').every(e=>e.geraetId==='ger_1'), true);
p('Filter plus Filter = alles',
  O.fuerGeraet(liste,'ger_1').length + O.fuerGeraet(liste,'ger_2').length, liste.length);
p('unbekanntes Geraet leer', O.fuerGeraet(liste,'gibtsnicht').length, 0);

/* naechste */
p('naechste 3', O.naechste(liste,3).length, 3);
p('naechste Vorgabe 5', O.naechste(liste).length, Math.min(5,liste.length));
p('naechste mehr als vorhanden', O.naechste(liste,999).length, liste.length);

/* Fehlerhafte Eintraege verschwinden nicht */
const kaputt = { id:'g9', name:'Kaputt', ansprueche:[
  {id:'a1', art:'gewaehrleistung_kauf', aktiv:true, beginn:'', dauerMonate:24, gegenueber:{rolle:'verkaeufer',name:'X'}}
], aufgaben:[
  {id:'u1', titel:'Ohne Basis', aktiv:true, intervallWert:6, intervallEinheit:'monate', ankerDatum:'', erledigungen:[]}
]};
const kl = O.fristenDesGeraets(kaputt, ST, F);
p('kaputte Eintraege bleiben sichtbar', kl.length, 2);
p('beide als unbekannt', kl.every(e=>e.status==='unbekannt'), true);
p('Fehlertext vorhanden', kl.every(e=>typeof e.fehler==='string' && e.fehler.length>0), true);
p('unbekannte sortieren nach hinten',
  O.alleFristen({geraete:[kaputt, D.OBJEKT.geraete[0]]}, ST, F).slice(-2).every(e=>e.status==='unbekannt'), true);

/* Inaktives wird uebersprungen */
const inaktiv = { id:'g8', name:'Inaktiv',
  ansprueche:[{id:'a', art:'herstellergarantie', aktiv:false, beginn:'2026-01-01', dauerMonate:12, gegenueber:{rolle:'hersteller',name:'Y'}}],
  aufgaben:[{id:'u', titel:'aus', aktiv:false, intervallWert:1, intervallEinheit:'monate', ankerDatum:'2026-01-01', erledigungen:[]}] };
p('inaktive nicht in der Liste', O.fristenDesGeraets(inaktiv, ST, F).length, 0);

/* Leeres Objekt */
p('Objekt ohne Geraete', O.alleFristen({geraete:[]}, ST, F).length, 0);
p('Objekt null', O.alleFristen(null, ST, F).length, 0);

/* Inhaltliche Stichprobe */
const rauch = liste.find(e=>e.titel.indexOf('Rauchmelder')!==-1);
p('Rauchmelder als Aufgabe', rauch.art, 'aufgabe');
p('Rauchmelder Planmodus', rauch.zusatz, 'fester Plan');
const kaufA = liste.find(e=>e.art==='anspruch' && e.geraetId==='ger_1' && e.zusatz==='gesamtes Gerät');
p('Kaufanspruch Laptop endet 2029-08-15', kaufA.datum, '2029-08-15');

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
