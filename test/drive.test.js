const DA = require('../public/js/drive.js');
const Sync = require('../public/js/sync.js');
const S = require('../public/js/speicher.js');
let ok=0, fehler=0;
function p(n,ist,soll){const g=JSON.stringify(ist)===JSON.stringify(soll);
 if(g)ok++;else{fehler++;console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(ist)+'\n  soll: '+JSON.stringify(soll));}}
async function wirft(n, fn, teil){
  try { await fn(); fehler++; console.log('FEHLER: '+n+' haette ablehnen muessen'); }
  catch(e){ if(teil && e.message.indexOf(teil)===-1){fehler++;console.log('FEHLER: '+n+' Text: '+e.message);} else ok++; }
}

function uhr(){
  let zeit=0; const geplant=[];
  return { setTimeoutFn:(fn,ms)=>{const t={fn,faellig:zeit+ms};geplant.push(t);return t;},
    clearTimeoutFn:(t)=>{const i=geplant.indexOf(t); if(i>=0)geplant.splice(i,1);},
    vor(ms){ zeit+=ms; geplant.filter(t=>t.faellig<=zeit).forEach(t=>{const i=geplant.indexOf(t); if(i>=0)geplant.splice(i,1); t.fn();}); },
    offen:()=>geplant.length };
}

/* Brueckenattrappe: merkt sich die Kennungen, antwortet auf Zuruf */
function bruecke(opts){
  const o=opts||{};
  return { rufe:[], statusJson: o.statusJson,
    driveLaden(k){ this.rufe.push(['laden',k]); if(o.wirft) throw new Error('Brücke kaputt'); },
    driveSichern(k,t){ this.rufe.push(['sichern',k,t]); if(o.wirft) throw new Error('Brücke kaputt'); },
    driveAnmelden(k){ this.rufe.push(['anmelden',k]); },
    driveStatus(){ if(o.statusWirft) throw new Error('nope'); return this.statusJson; } };
}

(async function(){

/* --- Laden --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u, timeoutMs:1000});
  const versprechen=a.laden();
  p('Bruecke gerufen', b.rufe[0][0], 'laden');
  p('eine Anfrage offen', a.offeneAnfragen(), 1);
  a.antwort(b.rufe[0][1], JSON.stringify({name:'Haus'}), null);
  p('Objekt geliefert', (await versprechen).name, 'Haus');
  p('nichts mehr offen', a.offeneAnfragen(), 0);
  p('Timer aufgeraeumt', u.offen(), 0);
}

/* --- Leerer Stand --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u});
  let v=a.laden(); a.antwort(b.rufe[0][1], null, null);
  p('null bei leerem Drive', await v, null);
  v=a.laden(); a.antwort(b.rufe[1][1], '', null);
  p('leerer String wie null', await v, null);
}

/* --- Kaputtes JSON aus Drive --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u});
  const v=a.laden(); a.antwort(b.rufe[0][1], '{kaputt', null);
  await wirft('kaputtes JSON lehnt ab', ()=>v, 'kein gültiges JSON');
  const v2=a.laden(); a.antwort(b.rufe[1][1], '42', null);
  await wirft('Zahl ist kein Objekt', ()=>v2, 'kein Objekt');
}

/* --- Fehler von Android --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u});
  const v=a.laden(); a.antwort(b.rufe[0][1], null, 'Kein Netz');
  await wirft('Fehler durchgereicht', ()=>v, 'Kein Netz');
}

/* --- Sichern --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u});
  const v=a.sichern({name:'Haus'});
  p('JSON uebergeben', JSON.parse(b.rufe[0][2]).name, 'Haus');
  a.antwort(b.rufe[0][1], null, null);
  p('sichern aufgeloest', await v, true);
}

/* --- Zirkelbezug --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u});
  const x={}; x.selbst=x;
  await wirft('Zirkel abgelehnt', ()=>a.sichern(x), 'JSON');
  p('keine Anfrage entstanden', b.rufe.length, 0);
}

/* --- Zeitueberschreitung --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u, timeoutMs:5000});
  const v=a.laden();
  u.vor(5000);
  await wirft('Timeout', ()=>v, 'Zeitüberschreitung');
  p('Anfrage entfernt', a.offeneAnfragen(), 0);
  p('spaete Antwort verpufft', a.antwort(b.rufe[0][1], '{}', null), false);
}

/* --- Brueckenfehler beim Aufruf --- */
{
  const u=uhr(), b=bruecke({wirft:true});
  const a=DA.erzeuge({bruecke:b, ...u});
  await wirft('Wurf der Bruecke', ()=>a.laden(), 'abgelehnt');
  p('kein Leck', a.offeneAnfragen(), 0);
  p('kein Timer haengt', u.offen(), 0);
}

/* --- Keine Bruecke --- */
{
  const a=DA.erzeuge({bruecke:null});
  p('vorhanden false', a.vorhanden(), false);
  await wirft('laden ohne Bruecke', ()=>a.laden(), 'Keine Drive-Brücke');
  p('Status ohne Bruecke', a.status(), {angemeldet:false, konto:null, fehler:'Keine Brücke vorhanden.', bruecke:false});
}

/* --- Status --- */
{
  const a=DA.erzeuge({bruecke:bruecke({statusJson:'{"angemeldet":true,"konto":"a@b.de"}'})});
  p('angemeldet', a.status().angemeldet, true);
  p('Konto', a.status().konto, 'a@b.de');
  const a2=DA.erzeuge({bruecke:bruecke({statusJson:'{kaputt'})});
  p('kaputter Status faellt weich', a2.status().angemeldet, false);
  p('Grund genannt', a2.status().fehler.indexOf('unlesbar')!==-1, true);
  const a3=DA.erzeuge({bruecke:bruecke({statusWirft:true})});
  p('werfender Status faellt weich', a3.status().angemeldet, false);
}

/* --- Abbrechen --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u});
  const v1=a.laden(), v2=a.laden();
  p('zwei offen', a.offeneAnfragen(), 2);
  a.abbrechen('Abgemeldet');
  await wirft('erste abgebrochen', ()=>v1, 'Abgemeldet');
  await wirft('zweite abgebrochen', ()=>v2, 'Abgemeldet');
  p('alles weg', a.offeneAnfragen(), 0);
  p('Timer weg', u.offen(), 0);
}

/* --- Globale Registrierung --- */
{
  const b=bruecke(); const ziel={};
  const a=DA.erzeuge({bruecke:b, ...uhr()});
  p('registriert', DA.registriereGlobal(a, ziel), true);
  const v=a.laden();
  ziel.HomeIQ.driveAntwort(b.rufe[0][1], '{"name":"Ueber global"}', null);
  p('ueber globalen Weg', (await v).name, 'Ueber global');
}

/* --- Zusammenspiel mit sync.js --- */
{
  const u=uhr(), b=bruecke();
  const a=DA.erzeuge({bruecke:b, ...u, timeoutMs:0});
  const sp=S.erzeuge(S.speicherImRam(),'t:');
  const sy=Sync.erzeuge({speicher:sp, drive:a, name:'objekt',
    zusammenfuehren:S.zusammenfuehren, setTimeoutFn:u.setTimeoutFn,
    clearTimeoutFn:u.clearTimeoutFn, verzoegerungMs:100, jetzt:()=>1});

  await sy.aenderung({name:'Haus', geraete:[]});
  p('lokal sofort', (await sp.laden('objekt')).daten.name, 'Haus');
  u.vor(100);
  await Promise.resolve();
  p('Upload angestossen', b.rufe.filter(r=>r[0]==='sichern').length, 1);
  a.antwort(b.rufe.find(r=>r[0]==='sichern')[1], null, null);
  for(let i=0;i<5;i++) await Promise.resolve();
  p('Sync meldet aktuell', sy.zustand().drive, 'aktuell');
  p('Vermerk geschlossen', (await sy.vermerkLesen()).offen, false);
}

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
})();
