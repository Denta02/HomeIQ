'use strict';

/* Prüft das direkte Bearbeiten: Werte setzen, Fehlerfälle, Speicherung */
const path=require('path');
const F=require(path.join(__dirname,'..','public','js','fristen.js'));
const HS=require(path.join(__dirname,'..','public','js','hersteller.js'));
let ok=0,fehler=0;
const p=(n,i,s)=>{if(JSON.stringify(i)===JSON.stringify(s))ok++;
  else{fehler++;console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(i)+'\n  soll: '+JSON.stringify(s));}};

function zuHundertstel(text){
  var t=String(text==null?'':text).trim().replace(/\s/g,'').replace(',','.');
  if(!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  var teile=t.split('.');
  return parseInt(teile[0],10)*100+parseInt((teile[1]||'').padEnd(2,'0'),10);
}

function geraetBau(){
  return { id:'g1', name:'Babyfone', standort:'Kinderzimmer',
    identitaet:{hersteller:'Alecto', modell:'BO64', nummern:[]},
    kauf:{art:'neu', datum:'2026-11-09', verkaeufer:'Media Markt', preisCent:2999} };
}

/* Dieselben Schreibfunktionen wie in der Oberfläche */
function schreiber(geraet){
  return {
    name: w => { if(!String(w).trim()) return 'Ohne Namen ist das Gerät nicht zu finden.'; geraet.name=String(w).trim(); },
    hersteller: w => { geraet.identitaet.hersteller=String(w).trim(); },
    nummer: w => {
      const wert=String(w).trim();
      const liste=geraet.identitaet.nummern;
      const erste=liste.filter(x=>x&&x.wert)[0];
      if(erste){ erste.wert=wert; }
      else if(wert){
        const schema=HS.schemaFuer(geraet.identitaet.hersteller);
        const pflicht=schema.nummern.filter(f=>f.pflicht&&f.art!=='modell')[0]||schema.nummern[0];
        liste.push({art:pflicht?pflicht.art:'unbekannt', wert:wert});
      }
    },
    kaufdatum: w => { if(w&&!F.istGueltigesDatum(w)) return 'Das Datum ist ungültig.'; geraet.kauf.datum=w; },
    preis: w => {
      const t=String(w).trim();
      if(!t){ geraet.kauf.preisCent=0; return; }
      const c=zuHundertstel(t);
      if(c===null) return 'Der Preis ist keine gültige Zahl, zum Beispiel 29,99.';
      geraet.kauf.preisCent=c;
    }
  };
}

/* Name */
{
  const g=geraetBau(), s=schreiber(g);
  p('Name geaendert', (s.name('Babyfon Kinderzimmer'), g.name), 'Babyfon Kinderzimmer');
  p('Leerzeichen entfernt', (s.name('  Neu  '), g.name), 'Neu');
  p('leerer Name abgelehnt', typeof s.name('   '), 'string');
  p('alter Name bleibt', g.name, 'Neu');
}

/* Nummer anlegen, wenn noch keine da ist */
{
  const g=geraetBau(), s=schreiber(g);
  p('vorher keine Nummer', g.identitaet.nummern.length, 0);
  s.nummer('5448A18D3001330');
  p('Nummer angelegt', g.identitaet.nummern.length, 1);
  p('Wert gesetzt', g.identitaet.nummern[0].wert, '5448A18D3001330');
  p('Art aus dem Standardschema', g.identitaet.nummern[0].art, 'modell');

  s.nummer('ANDERS');
  p('vorhandene Nummer geaendert', g.identitaet.nummern.length, 1);
  p('neuer Wert', g.identitaet.nummern[0].wert, 'ANDERS');
}
{
  /* Bei bekanntem Hersteller die passende Art */
  const g=geraetBau(); g.identitaet.hersteller='Bosch';
  const s=schreiber(g);
  s.nummer('WAU28T40');
  p('Bosch: E-Nr. statt Modell', g.identitaet.nummern[0].art, 'e_nr');
}
{
  const g=geraetBau(), s=schreiber(g);
  s.nummer('   ');
  p('leere Eingabe legt nichts an', g.identitaet.nummern.length, 0);
}

/* Datum */
{
  const g=geraetBau(), s=schreiber(g);
  p('gueltiges Datum', (s.kaufdatum('2026-01-15'), g.kauf.datum), '2026-01-15');
  p('ungueltiges abgelehnt', typeof s.kaufdatum('2026-02-31'), 'string');
  p('altes Datum bleibt', g.kauf.datum, '2026-01-15');
  p('leeres Datum erlaubt', (s.kaufdatum(''), g.kauf.datum), '');
}

/* Preis */
{
  const g=geraetBau(), s=schreiber(g);
  p('Komma verstanden', (s.preis('49,90'), g.kauf.preisCent), 4990);
  p('Punkt verstanden', (s.preis('12.50'), g.kauf.preisCent), 1250);
  p('ganze Zahl', (s.preis('30'), g.kauf.preisCent), 3000);
  p('Text abgelehnt', typeof s.preis('teuer'), 'string');
  p('alter Preis bleibt', g.kauf.preisCent, 3000);
  p('leer setzt auf null', (s.preis(''), g.kauf.preisCent), 0);
  p('drei Nachkommastellen abgelehnt', typeof s.preis('1,234'), 'string');
}

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
