'use strict';

/* Prüft: leerer Start, Gerät anlegen, Beispieldaten, alles löschen */
const fs=require('fs');
const P=require('path').join(__dirname,'..','public')+'/';
function seitenSkript(h){return [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).sort((a,b)=>b.length-a.length)[0];}
function bau(lager, suche){
  const knoten=[];
  function mach(id){let k=knoten.find(x=>x._id===id);
    if(!k){k={_id:id,innerHTML:'',textContent:'',value:'',checked:false,hidden:false,style:{},open:false,
      className:'',addEventListener(){},setAttribute(){},getAttribute(){return null;},
      querySelectorAll(){return[];},querySelector(){return null;},focus(){},closest(){return null;},
      setSelectionRange(){},selectionStart:0,files:[],disabled:false};knoten.push(k);}return k;}
  const win={localStorage:{getItem:k=>k in lager?lager[k]:null,setItem:(k,v)=>{lager[k]=String(v);},removeItem:k=>{delete lager[k];}},
    location:{search:suche||'',reload(){},href:''},setTimeout,clearTimeout,prompt:()=>null};
  win.document={readyState:'complete',getElementById:mach,querySelectorAll:()=>[],querySelector:()=>null,addEventListener(){}};
  ['fristen','hersteller','selbsthilfe','intervalle','brennstoff','objekt','speicher','sync','drive','drive-web','belege','demodaten','app']
   .forEach(m=>new Function('window','module','document',fs.readFileSync(P+'js/'+m+'.js','utf8'))(win,{exports:{}},win.document));
  return {win,mach};
}
let ok=0,fehler=0;
const p=(n,i,s)=>{if(JSON.stringify(i)===JSON.stringify(s))ok++;
  else{fehler++;console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(i)+'\n  soll: '+JSON.stringify(s));}};

(async()=>{
  /* Leerer erster Start */
  const lager={};
  const a=bau(lager);
  new Function('window','document',seitenSkript(fs.readFileSync(P+'index.html','utf8')))(a.win,a.win.document);
  await new Promise(r=>setTimeout(r,80));
  const leer=a.mach('huelle').innerHTML;
  p('kein Demobestand', /Laptop Dell/.test(leer), false);
  p('Aufforderung statt Meldung', /Noch kein Gerät erfasst/.test(leer), true);
  p('Gerät anlegen erreichbar', /geraeteakte\.html\?neu=1/.test(leer), true);
  p('Beispieldaten als zweite Wahl', /id="beispiele"/.test(leer), true);
  p('kein Brennpunkt ohne Geräte', /class="brennpunkt/.test(leer), false);
  p('gespeichert', Object.keys(lager).includes('homeiq:objekt'), true);

  /* Beispieldaten laden */
  const r=await a.win.App.demodatenLaden();
  p('Beispieldaten geladen', r.erfolg, true);
  p('zwei Geräte', r.objekt.geraete.length, 2);

  /* Zweiter Start mit Bestand */
  const b=bau(lager);
  new Function('window','document',seitenSkript(fs.readFileSync(P+'index.html','utf8')))(b.win,b.win.document);
  await new Promise(r=>setTimeout(r,80));
  const voll=b.mach('huelle').innerHTML;
  p('Geräte sichtbar', /Laptop Dell XPS 15/.test(voll), true);
  p('Heizung sichtbar', /Ölheizung/.test(voll), true);
  p('Brennpunkt da', /class="brennpunkt/.test(voll), true);
  p('Plus neben Geräte', /class="plus"/.test(voll), true);
  p('Gebäude nur als Zeile', /class="ort"/.test(voll), true);
  p('keine Ampel mehr', /class="ampel"/.test(voll), false);
  p('Verbrauch als Marke', /im Jahr/.test(voll), true);
  p('Alles löschen angeboten', /id="leeren"/.test(voll), true);

  /* Geräteakte ohne Gerät */
  const lager2={};
  const c=bau(lager2,'?neu=1');
  new Function('window','document',seitenSkript(fs.readFileSync(P+'geraeteakte.html','utf8')))(c.win,c.win.document);
  await new Promise(r=>setTimeout(r,80));
  const akte=c.mach('huelle').innerHTML;
  p('Formular statt leerer Akte', /Neues Gerät/.test(akte), true);
  p('keine Reiter bei null Geräten', /class="reiter/.test(akte), false);
  p('Rückweg zur Übersicht', /href="index\.html"/.test(akte), true);

  console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
  process.exit(fehler?1:0);
})();
