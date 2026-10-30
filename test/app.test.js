'use strict';

/**
 * Prüft die Startschicht gegen eine localStorage-Attrappe:
 * Erstaufbau, Änderung, Neustart, Zurücksetzen.
 */

const fs = require('fs');
const P = require('path').join(__dirname, '..', 'public') + '/';

function fenster(lager) {
  const win = {
    localStorage: {
      getItem: k => (k in lager ? lager[k] : null),
      setItem: (k,v) => { lager[k] = String(v); },
      removeItem: k => { delete lager[k]; }
    },
    setTimeout, clearTimeout, document: { addEventListener(){} }
  };
  ['fristen','hersteller','selbsthilfe','intervalle','brennstoff','objekt',
   'speicher','sync','drive','drive-web','belege','demodaten','app'].forEach(m => {
    new Function('window','module','document',
      fs.readFileSync(P+'js/'+m+'.js','utf8'))(win, {exports:{}}, win.document);
  });
  return win;
}

(async () => {
  const lager = {};
  let ok=0, fehler=0;
  const p=(n,i,s)=>{ if(JSON.stringify(i)===JSON.stringify(s)) ok++;
    else {fehler++; console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(i)+'\n  soll: '+JSON.stringify(s));} };

  // Sitzung 1: Start mit leerem Speicher
  const w1 = fenster(lager);
  const z1 = await w1.App.starten();
  p('Demodaten als Anfangsbestand', z1.ersteinrichtung, true);
  p('Objekt da', z1.objekt.name, 'Haus Musterstraße 5');
  p('in den Speicher geschrieben', Object.keys(lager).includes('homeiq:objekt'), true);

  // Änderung: Erledigung an einer Aufgabe
  const laptop = z1.objekt.geraete[0];
  laptop.aufgaben[0].erledigungen.push({ id:'erl_neu', datum:'2028-06-01', ausfuehrender:'selbst' });
  const r = await w1.App.speichern();
  p('Speichern erfolgreich', r.erfolg, true);

  // Sitzung 2: frischer Start, gleicher Speicher
  const w2 = fenster(lager);
  const z2 = await w2.App.starten();
  p('kein Erstaufbau mehr', z2.ersteinrichtung, false);
  p('Erledigung ueberlebt',
    z2.objekt.geraete[0].aufgaben[0].erledigungen.some(e=>e.id==='erl_neu'), true);
  p('Lieferungen unveraendert', z2.objekt.geraete[1].lieferungen.length, 4);

  // Lieferung ergaenzen
  z2.objekt.geraete[1].lieferungen.push({ id:'lf_neu', datum:'2027-03-01', einheit:'liter',
    mengeHundertstel: 200000, gesamtCent: 190000, volltankung:true, lieferant:'Test' });
  await w2.App.speichern();

  const w3 = fenster(lager);
  const z3 = await w3.App.starten();
  p('Lieferung ueberlebt', z3.objekt.geraete[1].lieferungen.length, 5);
  p('Verbrauch rechnet weiter',
    w3.Brennstoff.verbrauchSpanne(z3.objekt.geraete[1].lieferungen,
      w3.Fristen.istGueltigesDatum, w3.Fristen.tageZwischen).belastbar, true);

  // Zuruecksetzen
  await w3.App.zuruecksetzen();
  p('Speicher geleert', lager['homeiq:objekt'], undefined);
  const w4 = fenster(lager);
  const z4 = await w4.App.starten();
  p('wieder Demodaten', z4.objekt.geraete[0].aufgaben[0].erledigungen.some(e=>e.id==='erl_neu'), false);
  p('Erstaufbau erneut', z4.ersteinrichtung, true);

  // Lagetext
  p('Lagetext nennt Speicher', w4.App.lageText().indexOf('lokal gespeichert')!==-1, true);
  p('Lagetext nennt Drive', w4.App.lageText().indexOf('Drive nicht verbunden')!==-1, true);

  console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
  process.exit(fehler?1:0);
})();
