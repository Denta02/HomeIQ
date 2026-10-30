const Sync = require('../public/js/sync.js');
const S = require('../public/js/speicher.js');
let ok=0, fehler=0;
function p(n,ist,soll){const g=JSON.stringify(ist)===JSON.stringify(soll);
 if(g)ok++;else{fehler++;console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(ist)+'\n  soll: '+JSON.stringify(soll));}}

/* Steuerbare Uhr und Timer */
function umgebung(){
  let zeit = 1000000;
  const geplant = [];
  return {
    jetzt: ()=>zeit,
    vor: (ms)=>{ zeit += ms; },
    setTimeoutFn: (fn, ms)=>{ const id={fn, faellig: zeit+ms}; geplant.push(id); return id; },
    clearTimeoutFn: (id)=>{ const i=geplant.indexOf(id); if(i>=0) geplant.splice(i,1); },
    // alle faelligen Timer feuern und Promises durchlaufen lassen
    async lauf(ms){
      zeit += (ms||0);
      for(let runde=0; runde<10; runde++){
        const dran = geplant.filter(t=>t.faellig<=zeit);
        dran.forEach(t=>{ const i=geplant.indexOf(t); if(i>=0) geplant.splice(i,1); t.fn(); });
        await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      }
    },
    offeneTimer: ()=>geplant.length
  };
}

function driveAttrappe(opts){
  const o = opts||{};
  return {
    stand: o.stand!==undefined ? o.stand : null,
    schreibVersuche: 0,
    fehlerRest: o.fehlerRest||0,
    ladeFehler: o.ladeFehler||false,
    laden(){ return this.ladeFehler ? Promise.reject(new Error('offline')) : Promise.resolve(this.stand); },
    sichern(obj){
      this.schreibVersuche++;
      if(this.fehlerRest>0){ this.fehlerRest--; return Promise.reject(new Error('offline')); }
      this.stand = JSON.parse(JSON.stringify(obj));
      return Promise.resolve();
    }
  };
}

function bau(opts){
  const u = umgebung();
  const back = S.speicherImRam();
  const sp = S.erzeuge(back,'t:');
  const dr = (opts&&opts.drive!==undefined) ? opts.drive : driveAttrappe();
  const sy = Sync.erzeuge({
    speicher: sp, drive: dr, name:'objekt',
    zusammenfuehren: S.zusammenfuehren,
    jetzt: u.jetzt, setTimeoutFn: u.setTimeoutFn, clearTimeoutFn: u.clearTimeoutFn,
    verzoegerungMs: 1500, maxWarteMs: 10000, versuche: 3, backoffMs: 2000
  });
  return {u, back, sp, dr, sy};
}

(async function(){

/* --- Lokal wird sofort geschrieben --- */
{
  const {sp, sy, dr} = bau();
  await sy.aenderung({name:'Haus', geraete:[]});
  p('lokal sofort da', (await sp.laden('objekt')).daten.name, 'Haus');
  p('Drive noch nicht', dr.schreibVersuche, 0);
  p('Zustand wartet', sy.zustand().drive, 'wartet');
  p('Vermerk offen', (await sy.vermerkLesen()).offen, true);
}

/* --- Drive nach der Verzoegerung --- */
{
  const {u, sy, dr} = bau();
  sy.aenderung({name:'Haus', geraete:[]});
  await u.lauf(1500);
  p('Drive geschrieben', dr.schreibVersuche, 1);
  p('Drive-Stand da', dr.stand.name, 'Haus');
  p('Zustand aktuell', sy.zustand().drive, 'aktuell');
  p('Vermerk geschlossen', (await sy.vermerkLesen()).offen, false);
  p('nichts mehr offen', sy.offen(), false);
}

/* --- Buendelung: viele Aenderungen, ein Upload --- */
{
  const {u, sy, dr} = bau();
  for(let i=0;i<10;i++){ sy.aenderung({name:'Stand '+i, geraete:[]}); u.vor(100); }
  await u.lauf(1500);
  p('nur ein Upload', dr.schreibVersuche, 1);
  p('letzter Stand gewinnt', dr.stand.name, 'Stand 9');
}

/* --- maxWarteMs: Dauertipper wird trotzdem geschrieben --- */
{
  const {u, sy, dr} = bau();
  sy.aenderung({name:'A', geraete:[]});
  for(let i=0;i<12;i++){ u.vor(1000); sy.aenderung({name:'B'+i, geraete:[]}); }
  await u.lauf(0);
  p('spaetestens nach maxWarteMs', dr.schreibVersuche >= 1, true);
}

/* --- Wiederholung bei Fehlern --- */
{
  const {u, sy, dr} = bau({drive: driveAttrappe({fehlerRest:2})});
  sy.aenderung({name:'Haus', geraete:[]});
  await u.lauf(1500);
  p('erster Versuch scheitert', sy.zustand().drive, 'wartet');
  await u.lauf(2000);
  await u.lauf(4000);
  p('dritter Versuch klappt', dr.schreibVersuche, 3);
  p('danach aktuell', sy.zustand().drive, 'aktuell');
  p('Vermerk geschlossen', (await sy.vermerkLesen()).offen, false);
}

/* --- Aufgeben nach drei Versuchen, Vermerk bleibt --- */
{
  const {u, sy, dr} = bau({drive: driveAttrappe({fehlerRest:99})});
  sy.aenderung({name:'Haus', geraete:[]});
  await u.lauf(1500); await u.lauf(2000); await u.lauf(4000); await u.lauf(8000);
  p('drei Versuche', dr.schreibVersuche, 3);
  p('Zustand Fehler', sy.zustand().drive, 'fehler');
  p('Vermerk bleibt offen', (await sy.vermerkLesen()).offen, true);
  p('Fehlertext da', typeof sy.zustand().letzterFehler, 'string');
}

/* --- Der wichtige Fall: Neustart mit offenem Vermerk --- */
{
  const u = umgebung();
  const back = S.speicherImRam();
  const sp = S.erzeuge(back,'t:');
  const dr = driveAttrappe({fehlerRest:99});
  const mach = () => Sync.erzeuge({speicher:sp, drive:dr, name:'objekt',
    zusammenfuehren:S.zusammenfuehren, jetzt:u.jetzt,
    setTimeoutFn:u.setTimeoutFn, clearTimeoutFn:u.clearTimeoutFn, versuche:1, backoffMs:100});

  // Sitzung 1: lokal neu, Drive scheitert
  const s1 = mach();
  s1.aenderung({name:'Neu lokal', geaendert:'2026-09-10T10:00:00Z',
    geraete:[{id:'a', name:'A neu', geaendert:'2026-09-10T10:00:00Z'}]});
  await u.lauf(1500);
  p('Drive leer geblieben', dr.stand, null);
  p('Vermerk offen nach Absturz', (await s1.vermerkLesen()).offen, true);

  // In Drive liegt ein AELTERER Stand
  dr.stand = {name:'Alt aus Drive', geaendert:'2026-09-01T10:00:00Z',
    geraete:[{id:'a', name:'A alt', geaendert:'2026-09-01T10:00:00Z'}]};
  dr.fehlerRest = 0;

  // Sitzung 2: Start
  const s2 = mach();
  const r = await s2.beimStart();
  p('lokal fuehrt bei offenem Vermerk', r.quelle, 'lokal führend (offener Stand)');
  p('neuerer lokaler Stand bleibt', r.daten.geraete.find(g=>g.id==='a').name, 'A neu');
  p('Vermerk wird gemeldet', r.offenerVermerk, true);
  await u.lauf(0);
  p('wird sofort nachgeschrieben', dr.stand.geraete[0].name, 'A neu');
  p('danach geschlossen', (await s2.vermerkLesen()).offen, false);
}

/* --- Start ohne offenen Vermerk: Drive kann fuehren --- */
{
  const {u, sy, dr} = bau();
  dr.stand = {name:'Aus Drive', geaendert:'2026-09-20T10:00:00Z', geraete:[]};
  const r = await sy.beimStart({name:'Vorgabe', geaendert:'2026-09-01T10:00:00Z', geraete:[]});
  p('Drive fuehrt', r.daten.name, 'Aus Drive');
  p('Quelle benannt', r.quelle, 'fern führend');
  p('kein offener Vermerk', r.offenerVermerk, false);
}

/* --- Start ohne Netz --- */
{
  const {sy, dr, sp} = bau({drive: driveAttrappe({ladeFehler:true})});
  await sp.sichern('objekt', {name:'Lokal', geraete:[]});
  const r = await sy.beimStart();
  p('laeuft mit lokalem Stand weiter', r.daten.name, 'Lokal');
  p('Quelle nennt den Grund', r.quelle.indexOf('nicht erreichbar') !== -1, true);
  p('Zustand Fehler', sy.zustand().drive, 'fehler');
}

/* --- Ohne Drive konfiguriert --- */
{
  const {sy, sp} = bau({drive: null});
  await sy.aenderung({name:'Nur lokal', geraete:[]});
  p('lokal gespeichert', (await sp.laden('objekt')).daten.name, 'Nur lokal');
  p('Drive aus', sy.zustand().drive, 'aus');
  const r = await sy.beimStart();
  p('Start ohne Drive', r.quelle, 'nur lokal');
}

/* --- Aenderung waehrend des Uploads geht nicht verloren --- */
{
  const u = umgebung();
  const sp = S.erzeuge(S.speicherImRam(),'t:');
  let freigabe;
  const dr = { stand:null, schreibVersuche:0,
    laden:()=>Promise.resolve(null),
    sichern(obj){ this.schreibVersuche++; const kopie=JSON.parse(JSON.stringify(obj));
      return new Promise(res=>{ freigabe = ()=>{ this.stand=kopie; res(); }; }); } };
  const sy = Sync.erzeuge({speicher:sp, drive:dr, name:'objekt',
    zusammenfuehren:S.zusammenfuehren, jetzt:u.jetzt,
    setTimeoutFn:u.setTimeoutFn, clearTimeoutFn:u.clearTimeoutFn, verzoegerungMs:100, backoffMs:100});

  sy.aenderung({name:'Erst', geraete:[]});
  await u.lauf(100);
  p('Upload laeuft', sy.zustand().drive, 'laeuft');
  sy.aenderung({name:'Zweit', geraete:[]});   // waehrend des Uploads
  freigabe();
  await u.lauf(0);
  p('zweiter Upload eingeplant', sy.zustand().drive !== 'aktuell', true);
  await u.lauf(200);
  p('zweiter Upload gestartet', dr.schreibVersuche, 2);
  freigabe();               // die Attrappe haelt jeden Upload fest
  await u.lauf(0);
  p('letzter Stand in Drive', dr.stand.name, 'Zweit');
  p('am Ende aktuell', sy.zustand().drive, 'aktuell');
  p('nichts mehr offen', sy.offen(), false);
}

/* --- Horcher --- */
{
  const {u, sy} = bau();
  const gesehen = [];
  const ab = sy.abonnieren(z=>gesehen.push(z.drive));
  sy.aenderung({name:'X', geraete:[]});
  await u.lauf(1500);
  p('Horcher hat gemeldet', gesehen.length > 1, true);
  p('Endzustand aktuell', gesehen[gesehen.length-1], 'aktuell');
  ab();
  const vorher = gesehen.length;
  sy.aenderung({name:'Y', geraete:[]});
  p('nach Abmeldung still', gesehen.length, vorher);
}

/* --- Kaputter Horcher stoppt nichts --- */
{
  const {u, sy, dr} = bau();
  sy.abonnieren(()=>{ throw new Error('kaputt'); });
  sy.aenderung({name:'X', geraete:[]});
  await u.lauf(1500);
  p('Upload trotzdem erfolgt', dr.schreibVersuche, 1);
}

/* --- sofortSchreiben --- */
{
  const {u, sy, dr} = bau();
  sy.aenderung({name:'X', geraete:[]});
  await sy.sofortSchreiben();
  await u.lauf(0);
  p('ohne Warten geschrieben', dr.schreibVersuche, 1);
  p('keine Timer offen', u.offeneTimer(), 0);
}

/* --- Leere Aenderung --- */
{
  const {sy} = bau();
  p('null abgelehnt', (await sy.aenderung(null)).erfolg, false);
}

/* --- Planung erfolgt synchron, nicht erst nach dem lokalen Schreiben --- */
{
  const {u, sy, dr} = bau();
  sy.aenderung({name:'Ohne Warten', geraete:[]});   // bewusst kein await
  await u.lauf(1500);
  p('Upload trotz fehlendem await', dr.schreibVersuche, 1);
  p('richtiger Stand', dr.stand.name, 'Ohne Warten');
}

/* --- Fehler beim lokalen Speichern wird nicht als Drive-Fehler gemeldet --- */
{
  const u = umgebung();
  const voll = { _d:{}, getItem(k){return this._d[k]||null;},
    setItem(k,v){ if(k.indexOf('probe')===-1 && v.length>150){const e=new Error('quota'); e.name='QuotaExceededError'; throw e;} this._d[k]=v; },
    removeItem(k){delete this._d[k];} };
  const sp = S.erzeuge(voll,'v:');
  const dr = driveAttrappe();
  const sy = Sync.erzeuge({speicher:sp, drive:dr, name:'objekt',
    zusammenfuehren:S.zusammenfuehren, jetzt:u.jetzt,
    setTimeoutFn:u.setTimeoutFn, clearTimeoutFn:u.clearTimeoutFn, verzoegerungMs:100});
  const r = await sy.aenderung({name:'x'.repeat(200), geraete:[]});
  p('lokales Speichern scheitert', r.erfolg, false);
  p('als lokaler Fehler gefuehrt', sy.zustand().lokal, 'fehler');
  p('nicht als Drive-Fehler', sy.zustand().drive !== 'fehler', true);
  p('Fehlertext nennt den Speicher', sy.zustand().letzterFehler.indexOf('Speicher') !== -1, true);
}


/* --- Abgleich abschalten und wieder einschalten --- */
{
  const {u, sy, sp, dr} = bau();
  await sy.aenderung({name:'Vor dem Abschalten', geraete:[]});
  await u.lauf(1500);
  p('zuerst in Drive', dr.stand.name, 'Vor dem Abschalten');

  p('ist aktiv', sy.istAktiv(), true);
  await sy.abschalten();
  p('nicht mehr aktiv', sy.istAktiv(), false);
  p('Zustand abgeschaltet', sy.zustand().drive, 'abgeschaltet');
  p('Warnung nennt den Verlust', sy.warnungAbschalten().indexOf('nicht gesichert') !== -1, true);

  const vorher = dr.schreibVersuche;
  await sy.aenderung({name:'Nur lokal', geraete:[]});
  await u.lauf(5000);
  p('kein Upload mehr', dr.schreibVersuche, vorher);
  p('lokal trotzdem gespeichert', (await sp.laden('objekt')).daten.name, 'Nur lokal');
  p('Drive unveraendert', dr.stand.name, 'Vor dem Abschalten');
}

/* --- Wiedereinschalten mit Konflikt --- */
{
  const {u, sy, sp, dr} = bau();
  await sy.aenderung({name:'Start', geraete:[{id:'a', name:'A', geaendert:'2026-01-01T10:00:00Z'}]});
  await u.lauf(1500);
  await sy.abschalten();

  /* Beide Seiten laufen auseinander */
  await sp.sichern('objekt', {name:'Lokal neuer', geaendert:'2026-03-01T10:00:00Z',
    geraete:[{id:'a', name:'A lokal', geaendert:'2026-03-01T10:00:00Z'},
             {id:'b', name:'B nur lokal', geaendert:'2026-03-01T10:00:00Z'}]});
  dr.stand = {name:'Fern neuer', geaendert:'2026-04-01T10:00:00Z',
    geraete:[{id:'a', name:'A fern', geaendert:'2026-04-01T10:00:00Z'},
             {id:'c', name:'C nur fern', geaendert:'2026-04-01T10:00:00Z'}]};

  const frage = await sy.einschalten();
  p('Entscheidung noetig', frage.entscheidungNoetig, true);
  p('noch nicht aktiv', sy.istAktiv(), false);
  p('lokal beschrieben', frage.lokal.geraete, 2);
  p('fern beschrieben', frage.fern.geraete, 2);
  p('Eintraege gezaehlt', frage.lokal.eintraege, 0);
  p('Empfehlung ist der neuere', frage.empfehlung, 'fern');
  p('nichts geschrieben', (await sp.laden('objekt')).daten.name, 'Lokal neuer');

  const r = await sy.entscheidung('fern');
  p('jetzt aktiv', sy.istAktiv(), true);
  p('Drive uebernommen', r.daten.name, 'Fern neuer');
  p('lokal ersetzt', (await sp.laden('objekt')).daten.name, 'Fern neuer');
  p('Quelle benannt', r.quelle, 'Drive übernommen');
  await u.lauf(2000);
  p('kein Rueckschreiben noetig', dr.stand.name, 'Fern neuer');
}

/* --- Wiedereinschalten, lokal behalten --- */
{
  const {u, sy, sp, dr} = bau();
  await sy.aenderung({name:'Start', geraete:[]});
  await u.lauf(1500);
  await sy.abschalten();
  await sp.sichern('objekt', {name:'Lokal', geaendert:'2026-03-01T10:00:00Z', geraete:[]});
  dr.stand = {name:'Fern', geaendert:'2026-04-01T10:00:00Z', geraete:[]};

  await sy.einschalten();
  const r = await sy.entscheidung('lokal');
  p('lokal behalten', r.daten.name, 'Lokal');
  await u.lauf(2000);
  p('lokaler Stand nach Drive geschrieben', dr.stand.name, 'Lokal');
  p('danach aktuell', sy.zustand().drive, 'aktuell');
}

/* --- Zusammenfuehren als dritte Moeglichkeit --- */
{
  const {u, sy, sp, dr} = bau();
  await sy.aenderung({name:'Start', geraete:[]});
  await u.lauf(1500);
  await sy.abschalten();
  await sp.sichern('objekt', {name:'Lokal', geaendert:'2026-03-01T10:00:00Z',
    geraete:[{id:'b', name:'B lokal', geaendert:'2026-03-01T10:00:00Z'}]});
  dr.stand = {name:'Fern', geaendert:'2026-04-01T10:00:00Z',
    geraete:[{id:'c', name:'C fern', geaendert:'2026-04-01T10:00:00Z'}]};

  await sy.einschalten();
  const r = await sy.entscheidung('zusammen');
  p('beide Geraete erhalten', r.daten.geraete.map(g=>g.id).sort(), ['b','c']);
  await u.lauf(2000);
  p('Ergebnis in Drive', dr.stand.geraete.length, 2);
}

/* --- Ohne Konflikt keine Rueckfrage --- */
{
  const {u, sy, sp, dr} = bau();
  await sy.aenderung({name:'Start', geraete:[]});
  await u.lauf(1500);
  await sy.abschalten();
  const r = await sy.einschalten();
  p('gleiche Staende ohne Frage', r.entscheidungNoetig, false);
  p('sofort aktiv', sy.istAktiv(), true);
  p('Begruendung genannt', r.begruendung.indexOf('gleich alt') !== -1, true);
}
{
  const {sy, dr} = bau();
  dr.stand = null;
  await sy.abschalten();
  const r = await sy.einschalten();
  p('leeres Drive ohne Frage', r.entscheidungNoetig, false);
  p('Begruendung leeres Drive', r.begruendung.indexOf('noch nichts') !== -1, true);
}

/* --- Drive beim Einschalten nicht erreichbar --- */
{
  const {sy} = bau({drive: driveAttrappe({ladeFehler:true})});
  await sy.abschalten();
  const r = await sy.einschalten();
  p('Fehler gemeldet', r.entscheidungNoetig, false);
  p('bleibt abgeschaltet', sy.istAktiv(), false);
  p('Fehlertext erklaert', r.fehler.indexOf('nicht erreichbar') !== -1, true);
}

/* --- Schalter ueberlebt den Neustart --- */
{
  const u = umgebung();
  const sp = S.erzeuge(S.speicherImRam(),'t:');
  const dr = driveAttrappe();
  const mach = () => Sync.erzeuge({speicher:sp, drive:dr, name:'objekt',
    zusammenfuehren:S.zusammenfuehren, jetzt:u.jetzt,
    setTimeoutFn:u.setTimeoutFn, clearTimeoutFn:u.clearTimeoutFn, verzoegerungMs:100});

  const s1 = mach();
  await s1.aenderung({name:'X', geraete:[]});
  await u.lauf(100);
  await s1.abschalten();

  const s2 = mach();
  const r = await s2.beimStart();
  p('nach Neustart weiter abgeschaltet', s2.istAktiv(), false);
  p('Quelle nennt den Grund', r.quelle, 'nur lokal (Abgleich abgeschaltet)');
  p('Zustand abgeschaltet', s2.zustand().drive, 'abgeschaltet');
  const vorher = dr.schreibVersuche;
  await s2.aenderung({name:'Y', geraete:[]});
  await u.lauf(5000);
  p('kein Upload nach Neustart', dr.schreibVersuche, vorher);
}


/* --- Sicherung des überschriebenen Standes --- */
{
  const {u, sy, sp, dr} = bau();
  await sy.aenderung({name:'Start', geraete:[]});
  await u.lauf(1500);
  await sy.abschalten();

  await sp.sichern('objekt', {name:'Lokal', geaendert:'2026-03-01T10:00:00Z',
    geraete:[{id:'b', name:'B lokal', geaendert:'2026-03-01T10:00:00Z'}]});
  dr.stand = {name:'Fern', geaendert:'2026-04-01T10:00:00Z',
    geraete:[{id:'c', name:'C fern', geaendert:'2026-04-01T10:00:00Z'}]};

  p('vorher keine Sicherung', await sy.sicherungLesen(), null);

  await sy.einschalten();
  const r = await sy.entscheidung('fern');
  p('Drive gilt jetzt', r.daten.name, 'Fern');
  p('Sicherung gemeldet', r.sicherung, 'lokal');

  const sicherung = await sy.sicherungLesen();
  p('Sicherung vorhanden', sicherung !== null, true);
  p('Sicherung ist der lokale Stand', sicherung.daten.name, 'Lokal');
  p('Quelle vermerkt', sicherung.quelle, 'lokal');
  p('Zeitpunkt vermerkt', typeof sicherung.zeit, 'string');

  /* Zurückholen */
  const zurueck = await sy.sicherungWiederherstellen();
  p('Zurueckholen klappt', zurueck.erfolg, true);
  p('alter Stand wieder da', zurueck.daten.name, 'Lokal');
  p('im Speicher angekommen', (await sp.laden('objekt')).daten.name, 'Lokal');
  p('Zeitstempel erneuert', zurueck.daten.geaendert !== '2026-03-01T10:00:00Z', true);

  /* Das Zurueckholen ist selbst umkehrbar */
  const wieder = await sy.sicherungLesen();
  p('neue Sicherung angelegt', wieder.daten.name, 'Fern');
  const nochmal = await sy.sicherungWiederherstellen();
  p('zweimal umkehrbar', nochmal.daten.name, 'Fern');

  await u.lauf(2000);
  p('nach Drive geschrieben', dr.stand.name, 'Fern');
}

/* --- Ohne echten Konflikt wird nichts gesichert --- */
{
  const {u, sy, dr} = bau();
  await sy.aenderung({name:'Start', geraete:[]});
  await u.lauf(1500);
  await sy.abschalten();
  const r = await sy.einschalten();
  p('kein Konflikt', r.entscheidungNoetig, false);
  p('keine Sicherung noetig', await sy.sicherungLesen(), null);
}

/* --- Ohne Sicherung lässt sich nichts zurückholen --- */
{
  const {sy} = bau();
  const r = await sy.sicherungWiederherstellen();
  p('nichts zurueckzuholen', r.erfolg, false);
  p('mit Begruendung', typeof r.fehler, 'string');
}

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
})();
