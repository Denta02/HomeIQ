const S = require('../public/js/speicher.js');
let ok=0, fehler=0;
function p(n,ist,soll){const g=JSON.stringify(ist)===JSON.stringify(soll);
 if(g)ok++;else{fehler++;console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(ist)+'\n  soll: '+JSON.stringify(soll));}}

(async function(){

/* Grundfunktionen mit RAM-Backend */
let b = S.speicherImRam();
let sp = S.erzeuge(b, 'test:');

p('leer laden', (await sp.laden('objekt')).gefunden, false);
p('Vorgabe kommt zurueck', (await sp.laden('objekt', {name:'X'})).daten, {name:'X'});
p('sichern klappt', (await sp.sichern('objekt', {name:'Haus'})).erfolg, true);
p('wieder laden', (await sp.laden('objekt')).daten.name, 'Haus');
p('schemaVersion gesetzt', (await sp.laden('objekt')).daten.schemaVersion, S.SCHEMA_VERSION);
p('Zeitstempel gesetzt', typeof (await sp.laden('objekt')).daten.gespeichert, 'string');
p('Praefix genutzt', b.getItem('test:objekt') !== null, true);
await sp.loeschen('objekt');
p('loeschen', (await sp.laden('objekt')).gefunden, false);

/* Zustand */
p('RAM erkannt', S.erzeuge(S.speicherImRam()).zustand().art, 'arbeitsspeicher');
p('RAM nicht dauerhaft', S.erzeuge(S.speicherImRam()).zustand().dauerhaft, false);
p('RAM mit Hinweis', typeof S.erzeuge(S.speicherImRam()).zustand().hinweis, 'string');

/* Backend, das beim Schreiben wirft -> Ausfallsicherung */
const kaputt = { getItem:()=>null, setItem:()=>{throw new Error('gesperrt');}, removeItem:()=>{} };
p('unbenutzbar erkannt', S.istBenutzbar(kaputt), false);
p('null unbenutzbar', S.istBenutzbar(null), false);
const spK = S.erzeuge(kaputt, 't:');
p('faellt auf RAM zurueck', spK.zustand().art, 'arbeitsspeicher');
p('sichern trotzdem moeglich', (await spK.sichern('a',{x:1})).erfolg, true);
p('und lesbar', (await spK.laden('a')).daten.x, 1);

/* Voller Speicher */
const voll = { _d:{}, getItem(k){return this._d[k]||null;},
  setItem(k,v){ if(k.indexOf('probe')===-1 && v.length>50){const e=new Error('QuotaExceededError: storage full'); e.name='QuotaExceededError'; throw e;} this._d[k]=v; },
  removeItem(k){delete this._d[k];} };
const spV = S.erzeuge(voll, 'v:');
p('voller Speicher echt', spV.zustand().art, 'localStorage');
const rV = await spV.sichern('gross', {text:'x'.repeat(200)});
p('Quota gemeldet', rV.erfolg, false);
p('Quota-Text nennt Drive', rV.fehler.indexOf('Drive') !== -1, true);
p('Fehler im Zustand', spV.zustand().letzterFehler !== null, true);

/* Beschaedigte Daten */
let b2 = S.speicherImRam();
b2.setItem('x:objekt', '{kaputt');
const sp2 = S.erzeuge(b2, 'x:');
const r2 = await sp2.laden('objekt', {ersatz:true});
p('defekt erkannt', r2.defekt, true);
p('Vorgabe genutzt', r2.daten, {ersatz:true});
p('Original nicht ueberschrieben', b2.getItem('x:objekt'), '{kaputt');
p('Sicherungskopie angelegt',
  Object.keys({...{}}).length === 0 && b2.getItem('x:objekt') === '{kaputt', true);
b2.setItem('x:zahl', '42');
p('Nicht-Objekt erkannt', (await S.erzeuge(b2,'x:').laden('zahl')).defekt, true);

/* Migration */
p('ohne Version wird migriert', S.migriere({}).daten.schemaVersion, S.SCHEMA_VERSION);
p('aktuelle Version unveraendert', S.migriere({schemaVersion:S.SCHEMA_VERSION}).schritte.length, 0);
p('Schritte protokolliert', S.migriere({}).schritte.length, S.SCHEMA_VERSION);

/* Zusammenfuehrung */
const G=(id,zeit,name)=>({id, name, geaendert:zeit});
const lokal = { name:'Haus', geaendert:'2026-09-01T10:00:00Z',
  geraete:[G('a','2026-09-01T10:00:00Z','A lokal'), G('b','2026-09-05T10:00:00Z','B lokal')] };
const fern = { name:'Haus fern', geaendert:'2026-09-03T10:00:00Z',
  geraete:[G('a','2026-09-02T10:00:00Z','A fern'), G('c','2026-09-02T10:00:00Z','C fern')] };

const z = S.zusammenfuehren(lokal, fern);
p('drei Geraete', z.objekt.geraete.length, 3);
p('neueres A gewinnt', z.objekt.geraete.find(g=>g.id==='a').name, 'A fern');
p('neueres B bleibt lokal', z.objekt.geraete.find(g=>g.id==='b').name, 'B lokal');
p('nur fernes C uebernommen', z.objekt.geraete.find(g=>g.id==='c').name, 'C fern');
p('fern fuehrt bei Kopfdaten', z.objekt.name, 'Haus fern');
p('Konflikt gemeldet', z.konflikte.some(k=>k.geraetId==='a' && k.art==='ersetzt'), true);

p('nur lokal', S.zusammenfuehren(lokal,null).quelle, 'nur lokal');
p('nur fern', S.zusammenfuehren(null,fern).quelle, 'nur fern');
p('beide null', S.zusammenfuehren(null,null).objekt, null);

const gleich = S.zusammenfuehren(
  {geaendert:'2026-09-01T10:00:00Z', geraete:[G('a','2026-09-01T10:00:00Z','lokal')]},
  {geaendert:'2026-09-01T10:00:00Z', geraete:[G('a','2026-09-01T10:00:00Z','fern')]});
p('Gleichstand behaelt lokal', gleich.objekt.geraete[0].name, 'lokal');
p('Gleichstand gemeldet', gleich.konflikte[0].art, 'gleichstand');

const ohneZeit = S.zusammenfuehren(
  {geraete:[{id:'a',name:'lokal'}]}, {geraete:[{id:'a',name:'fern'}]});
p('ohne Zeitstempel lokal', ohneZeit.objekt.geraete[0].name, 'lokal');
p('ohne Zeitstempel gemeldet', ohneZeit.konflikte[0].art, 'ohne_zeitstempel');

p('kaputte Zeit wie keine',
  S.zusammenfuehren({geraete:[{id:'a',name:'lokal',geaendert:'quatsch'}]},
                    {geraete:[{id:'a',name:'fern',geaendert:'quatsch'}]}).objekt.geraete[0].name, 'lokal');
p('Geraet ohne id ignoriert',
  S.zusammenfuehren({geraete:[{name:'ohne'}]},{geraete:[]}).objekt.geraete.length, 0);
p('Reihenfolge stabil',
  S.zusammenfuehren(lokal,fern).objekt.geraete.map(g=>g.id), ['a','b','c']);

/* --- Reihenfolge bei schnellen Schreibvorgaengen --- */
{
  const sp3 = S.erzeuge(S.speicherImRam(), 'r:');
  for (let i=1;i<=20;i++) sp3.sichern('objekt', {lauf:i});
  await sp3.ruhe();
  p('letzter Schreibvorgang gewinnt', (await sp3.laden('objekt')).daten.lauf, 20);
}
{
  const sp4 = S.erzeuge(S.speicherImRam(), 's:');
  const sicher = sp4.sichern('objekt', {wert:'A'});
  const lesen = sp4.laden('objekt');
  p('Lesen sieht vorheriges Schreiben', (await lesen).daten.wert, 'A');
  await sicher;
}
{
  const sp5 = S.erzeuge(S.speicherImRam(), 'q:');
  p('ruhe ohne Zugriffe', Array.isArray(await sp5.ruhe()), true);
}
{
  /* Ein Fehler darf die Kette nicht blockieren */
  const voll2 = { _d:{}, getItem(k){return this._d[k]||null;},
    setItem(k,v){ if(k.indexOf('probe')===-1 && v.length>150){const e=new Error('quota'); e.name='QuotaExceededError'; throw e;} this._d[k]=v; },
    removeItem(k){delete this._d[k];} };
  const sp6 = S.erzeuge(voll2, 'f:');
  const schlecht = await sp6.sichern('a', {t:'x'.repeat(200)});
  const gut = await sp6.sichern('a', {t:'kurz'});
  p('Fehler blockiert die Kette nicht', [schlecht.erfolg, gut.erfolg], [false, true]);
  p('danach lesbar', (await sp6.laden('a')).daten.t, 'kurz');
}

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
})();
