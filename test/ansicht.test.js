'use strict';

/* Prüft, dass die einfache Ansicht wirklich weniger zeigt und
   die Einstellung einen Neustart überlebt. */
const fs = require('fs');
const P = require('path').join(__dirname, '..', 'public') + '/';
function bau(lager) {
  const knoten = [];
  function mach(id){ let k=knoten.find(x=>x._id===id);
    if(!k){k={_id:id,innerHTML:'',textContent:'',value:'',checked:false,hidden:false,style:{},open:false,
      className:'',addEventListener(){},setAttribute(){},getAttribute(){return null;},
      querySelectorAll(){return [];},querySelector(){return null;},focus(){},closest(){return null;},
      setSelectionRange(){},selectionStart:0}; knoten.push(k);} return k; }
  const win={localStorage:{getItem:k=>k in lager?lager[k]:null,setItem:(k,v)=>{lager[k]=String(v);},removeItem:k=>{delete lager[k];}},
    location:{search:'',reload(){}},setTimeout,clearTimeout};
  win.document={readyState:'complete',getElementById:mach,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
  ['fristen','hersteller','selbsthilfe','intervalle','brennstoff','objekt','speicher','sync','drive','drive-web','belege','demodaten','app']
    .forEach(m=>new Function('window','module','document',fs.readFileSync(P+'js/'+m+'.js','utf8'))(win,{exports:{}},win.document));
  const html=fs.readFileSync(P+'geraeteakte.html','utf8');
  new Function('window','document',seitenSkript(html))(win,win.document);
  return {win, mach};
}

/* Die Seite enthält mehrere Inline-Blöcke (Client-ID, dann der
   App-Code). Gesucht ist der längste, nicht der erste. */
function seitenSkript(html) {
  const treffer = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  return treffer.sort((a, b) => b.length - a.length)[0];
}

let ok=0,fehler=0;
const p=(n,i,s)=>{ if(JSON.stringify(i)===JSON.stringify(s)) ok++;
  else {fehler++; console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(i)+'\n  soll: '+JSON.stringify(s));} };

(async()=>{
  const lager={};
  const a=bau(lager);
  await new Promise(r=>setTimeout(r,60));
  const voll=a.mach('huelle').innerHTML;
  p('volle Ansicht: Wartung da', /Wartung<\/span>/.test(voll), true);
  p('volle Ansicht: Ansprueche da', /Gewährleistung und Garantie/.test(voll), true);
  p('volle Ansicht: Stoerungen da', /Störungen und Reparaturen/.test(voll), true);
  p('Umschalter da', /data-ansicht="einfach"/.test(voll), true);

  // Einstellung setzen und neu starten
  await a.win.App.einstellungSetzen('ansicht','einfach');
  p('Einstellung gespeichert', Object.keys(lager).includes('homeiq:einstellungen'), true);

  const b=bau(lager);
  await new Promise(r=>setTimeout(r,60));
  const einfach=b.mach('huelle').innerHTML;
  p('einfach: Wartung weg', /Wartung<\/span>/.test(einfach), false);
  p('einfach: Ansprueche weg', /Gewährleistung und Garantie/.test(einfach), false);
  p('einfach: Stoerungen weg', /Störungen und Reparaturen/.test(einfach), false);
  p('einfach: Brennstoff weg', /Brennstoff<\/span>/.test(einfach), false);
  p('einfach: Gekauft da', /Gekauft/.test(einfach), true);
  p('einfach: Rechnungen da', /Rechnungen/.test(einfach), true);
  p('einfach: Geraetename da', /Laptop Dell XPS 15/.test(einfach), true);
  p('einfach: Verkaeufer da', /Media Markt/.test(einfach), true);
  p('einfach: Umschalter bleibt', /data-ansicht="alles"/.test(einfach), true);
  p('einfach ist deutlich kuerzer', einfach.length < voll.length / 3, true);
  p('Hinweis auf Alles', /Über <b>Alles<\/b>/.test(einfach), true);

  p('einfach: Gewaehrleistung da', /Gewährleistung aus dem Kauf/.test(einfach), true);
  p('einfach: Enddatum da', /bis 15\.08\.2029/.test(einfach), true);
  p('einfach: Ansprechpartner da', /Verkäufer/.test(einfach), true);
  p('einfach: Restzeit da', /noch etwa/.test(einfach), true);

  p('einfach: Plus zum Hinzufuegen', /data-beleg-neu/.test(einfach), true);
  p('voll: Plus bei den Dokumenten', /data-beleg-neu/.test(voll), true);
  /* Die Demo-Dokumente sind nur Beschreibungen ohne hinterlegte Datei.
     Dann darf auch kein "öffnen" angeboten werden. */
  p('ohne Datei kein Oeffnen', /data-beleg-oeffnen/.test(voll), false);
  p('loeschen trotzdem moeglich', /data-loeschen-frage="beleg"/.test(voll), true);

  /* Auswahl des gezeigten Anspruchs: ganzes Gerät schlägt Bauteil,
     danach entscheidet die längste Laufzeit. */
  const F = require(P + 'js/fristen.js');
  function waehle(ansprueche, stichtag) {
    const k = [];
    ansprueche.forEach(a => { if (a.aktiv === false) return;
      try { k.push({a, auskunft: F.anspruchsAuskunft(a, stichtag, 30)}); } catch(e){} });
    if (!k.length) return null;
    const ganz = k.filter(x => x.a.bezug !== 'bauteil');
    const pool = ganz.length ? ganz : k;
    return pool.reduce((x,y) => y.auskunft.ende > x.auskunft.ende ? y : x);
  }
  const A = (id,bezug,beginn,dauer,aktiv) => ({id, art:'gewaehrleistung_kauf', bezug,
    bauteil: bezug==='bauteil' ? 'Akku' : '', aktiv,
    gegenueber:{rolle:'verkaeufer',name:'X'}, beginn, beginnKey:'uebergabe',
    dauerMonate:dauer, endeManuell:null, verlaengerungen:[]});

  p('ganzes Geraet schlaegt laengeres Bauteil',
    waehle([A('g','geraet','2026-01-01',12,true), A('b','bauteil','2026-01-01',60,true)],'2026-06-01').a.id, 'g');
  p('unter gleichen laengste Laufzeit',
    waehle([A('k','geraet','2026-01-01',12,true), A('l','geraet','2026-01-01',36,true)],'2026-06-01').a.id, 'l');
  p('nur Bauteil wird gezeigt',
    waehle([A('b','bauteil','2026-01-01',24,true)],'2026-06-01').a.id, 'b');
  p('inaktive zaehlen nicht',
    waehle([A('g','geraet','2026-01-01',12,false), A('b','bauteil','2026-01-01',24,true)],'2026-06-01').a.id, 'b');
  p('ohne Anspruch kein Block', waehle([], '2026-06-01'), null);
  p('kaputter Anspruch wird uebersprungen',
    waehle([{id:'x',art:'gewaehrleistung_kauf',bezug:'geraet',aktiv:true,
      gegenueber:{rolle:'verkaeufer',name:'X'},beginn:'',dauerMonate:12,verlaengerungen:[]}],'2026-06-01'), null);

  console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
  process.exit(fehler?1:0);
})();
