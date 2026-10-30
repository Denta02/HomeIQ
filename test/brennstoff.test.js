const B = require('../public/js/brennstoff.js');
const F = require('../public/js/fristen.js');
const gueltig = F.istGueltigesDatum, tz = F.tageZwischen;
let ok=0, fehler=0;
function p(n,ist,soll){const g=JSON.stringify(ist)===JSON.stringify(soll);
 if(g)ok++;else{fehler++;console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(ist)+'\n  soll: '+JSON.stringify(soll));}}
function nahe(n,ist,soll,tol){ if(Math.abs(ist-soll)<=tol) ok++;
 else{fehler++;console.log('FEHLER: '+n+' ist '+ist+', erwartet ~'+soll);} }

const L = (datum, liter, euro, voll) => ({
  id:'lf_'+datum, datum, einheit:'liter',
  mengeHundertstel: Math.round(liter*100),
  gesamtCent: Math.round(euro*100),
  volltankung: voll, lieferant:'Öl Meier'
});

/* Preis je 100 Liter */
p('2500 l für 2250 €', Math.round(B.preisProBezug(L('2026-09-01',2500,2250,true))), 9000);
p('Preistext', B.preisText(L('2026-09-01',2500,2250,true)), '90,00 € je 100 l');
p('Menge ohne Nachkomma', B.mengeText(250000,'liter'), '2500 l');
p('kleine Menge mit Nachkomma', B.mengeText(1550,'kg'), '15,50 kg');
p('Euro', B.eurText(225000), '2250,00 €');
p('Preis ohne Menge', B.preisProBezug({mengeHundertstel:0,gesamtCent:100}), null);
p('Pellets je Tonne', B.preisText({mengeHundertstel:300000,gesamtCent:90000,einheit:'kg'}), '300,00 € je Tonne');

/* Pruefung */
const schlecht = {datum:'2026-13-01', mengeHundertstel:0, gesamtCent:-5};
p('drei Fehler erkannt', B.pruefeLieferung(schlecht,gueltig).filter(h=>h.schwere==='fehler').length, 3);
p('fehlende Volltankung gemeldet',
  B.pruefeLieferung(L('2026-09-01',2500,2250,undefined),gueltig).some(h=>h.feld==='volltankung'), true);
p('saubere Lieferung ohne Fehler',
  B.pruefeLieferung(L('2026-09-01',2500,2250,true),gueltig).length, 0);
p('volltankung false ist eine Angabe',
  B.pruefeLieferung(L('2026-09-01',2500,2250,false),gueltig).length, 0);

/* Sortierung und Summe */
const eintraege = [
  L('2027-10-05', 2200, 1980, true),
  L('2025-09-12', 2500, 2250, true),
  L('2026-10-01', 2400, 2280, true)
];
p('sortiert nach Datum', B.sortiert(eintraege,gueltig).map(e=>e.datum),
  ['2025-09-12','2026-10-01','2027-10-05']);
const s = B.summe(eintraege,gueltig);
p('Summe Menge', s.mengeHundertstel, 710000);
p('Summe Kosten', s.gesamtCent, 651000);
p('erste und letzte', [s.erste,s.letzte], ['2025-09-12','2027-10-05']);
p('kaputte Eintraege fliegen raus',
  B.summe(eintraege.concat([{datum:'quatsch',mengeHundertstel:100}]),gueltig).anzahl, 3);
p('leere Liste', B.summe([],gueltig).anzahl, 0);

/* Abschnitte */
const ab = B.verbrauchsAbschnitte(eintraege,gueltig,tz);
p('zwei Abschnitte', ab.length, 2);
p('erster Abschnitt', [ab[0].von, ab[0].bis], ['2025-09-12','2026-10-01']);
p('Menge des spaeteren Eintrags', ab[0].mengeHundertstel, 240000);
p('belastbar', ab[0].belastbar, true);
nahe('Verbrauch pro Tag', ab[0].proTagHundertstel, 240000/384, 1);

/* Teilbefuellung entwertet den Abschnitt */
const mitTeil = [
  L('2025-09-12',2500,2250,true),
  L('2026-02-01',800,760,false),
  L('2026-10-01',1600,1520,true)
];
const ab2 = B.verbrauchsAbschnitte(mitTeil,gueltig,tz);
p('Teilbefuellung nicht belastbar', ab2.map(a=>a.belastbar), [false,false]);
p('Grund genannt', typeof ab2[0].grund, 'string');

/* Spanne mittelt Teilbefuellungen heraus */
const sp = B.verbrauchSpanne(mitTeil,gueltig,tz);
p('Spanne belastbar', sp.belastbar, true);
p('Spanne von bis', [sp.von,sp.bis], ['2025-09-12','2026-10-01']);
p('Teilmenge zaehlt mit', sp.mengeHundertstel, 240000);
p('erste Lieferung zaehlt nicht mit', sp.mengeHundertstel !== 490000, true);
nahe('Jahresverbrauch', sp.proJahrHundertstel, 240000/384*365, 100);

p('eine Volltankung reicht nicht',
  B.verbrauchSpanne([L('2025-09-12',2500,2250,true)],gueltig,tz).belastbar, false);
p('ohne Volltankung keine Spanne',
  B.verbrauchSpanne(mitTeil.map(e=>({...e,volltankung:false})),gueltig,tz).belastbar, false);
p('gleiches Datum keine Spanne',
  B.verbrauchSpanne([L('2026-01-01',100,90,true),L('2026-01-01',100,90,true)],gueltig,tz).belastbar, false);

/* Jahre */
const j = B.jahresUebersicht(eintraege,gueltig);
p('drei Jahre', j.map(x=>x.jahr), ['2025','2026','2027']);
p('Menge 2026', j[1].mengeHundertstel, 240000);
p('Schnittpreis 2026', Math.round(j[1].schnittPreisProBezug), 9500);

/* Preisreihe */
p('Reihe sortiert', B.preisReihe(eintraege,gueltig).map(x=>x.datum),
  ['2025-09-12','2026-10-01','2027-10-05']);
p('Preis faellt 2027', B.preisReihe(eintraege,gueltig)[2].preisProBezug < 9500, true);

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
