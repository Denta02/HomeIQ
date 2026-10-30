const H = require('../public/js/hersteller.js');
let ok=0, fehler=0;
function p(name, ist, soll){
  const g = JSON.stringify(ist)===JSON.stringify(soll);
  if(g) ok++; else { fehler++; console.log('FEHLER: '+name+'\n  ist:  '+JSON.stringify(ist)+'\n  soll: '+JSON.stringify(soll)); }
}

p('Bosch erkannt',        H.schemaFuer('Bosch').key, 'bsh');
p('Siemens gleiche Gruppe',H.schemaFuer('Siemens').key, 'bsh');
p('Schreibweise egal',    H.schemaFuer('  bOsCh ').key, 'bsh');
p('AEG -> electrolux',    H.schemaFuer('AEG').key, 'electrolux');
p('Unbekannt -> Standard',H.schemaFuer('Fantasiemarke').key, 'standard');
p('Leer -> Standard',     H.schemaFuer('').key, 'standard');
p('null -> Standard',     H.schemaFuer(null).key, 'standard');
p('istBekannt true',      H.istBekannt('Dell'), true);
p('istBekannt false',     H.istBekannt('Fantasiemarke'), false);

p('Label Dell',  H.labelFuer('Dell','service_tag'), 'Service-Tag');
p('Label Bosch', H.labelFuer('Bosch','e_nr'), 'E-Nr.');
p('Label unbek. Art', H.labelFuer('Bosch','quatsch'), 'quatsch');

// Bosch ohne FD -> Hinweis
let h = H.pruefeNummern('Bosch', [{art:'e_nr', wert:'WAU28T40/09'}]);
p('FD fehlt gemeldet', h.some(x=>x.art==='fd' && x.schwere==='fehlt'), true);
p('E-Nr nicht bemängelt', h.some(x=>x.art==='e_nr'), false);

// Bosch vollständig
h = H.pruefeNummern('Bosch', [{art:'e_nr',wert:'WAU28T40/09'},{art:'fd',wert:'9905'}]);
p('vollständig ohne Hinweise', h.length, 0);

// Dell Service-Tag Format
p('7 Zeichen ok',
  H.pruefeNummern('Dell',[{art:'service_tag',wert:'H7QL4M3'}]).length, 0);
p('zu kurz -> ungewoehnlich',
  H.pruefeNummern('Dell',[{art:'service_tag',wert:'H7QL'}]).some(x=>x.schwere==='ungewoehnlich'), true);
p('zu kurz blockiert nicht',
  H.pruefeNummern('Dell',[{art:'service_tag',wert:'H7QL'}]).every(x=>x.schwere!=='fehler'), true);

// Falsche Art am falschen Hersteller
p('PNC bei Dell unpassend',
  H.pruefeNummern('Dell',[{art:'service_tag',wert:'H7QL4M3'},{art:'pnc',wert:'123'}])
   .some(x=>x.schwere==='unpassend'), true);
p('art unbekannt toleriert',
  H.pruefeNummern('Dell',[{art:'service_tag',wert:'H7QL4M3'},{art:'unbekannt',wert:'X'}]).length, 0);

// ungeprüfte Hersteller markieren sich
p('Miele als ungeprüft markiert',
  H.pruefeNummern('Miele',[{art:'typ',wert:'W1'},{art:'fabrikations_nr',wert:'123'}])
   .some(x=>x.schwere==='ungeprueft'), true);
p('Bosch nicht als ungeprüft markiert',
  H.pruefeNummern('Bosch',[{art:'e_nr',wert:'X'},{art:'fd',wert:'Y'}])
   .some(x=>x.schwere==='ungeprueft'), false);

// Leerwerte zählen nicht als vorhanden
p('Leerstring zählt nicht',
  H.pruefeNummern('Dell',[{art:'service_tag',wert:'   '}]).some(x=>x.schwere==='fehlt'), true);

// Prompt
const pr = H.promptBaustein('Bosch');
p('Prompt nennt E-Nr.',  pr.indexOf('E-Nr.')!==-1, true);
p('Prompt nennt FD',     pr.indexOf('FD-Nummer')!==-1, true);
p('Prompt verbietet Raten', pr.indexOf('Rate nicht')!==-1, true);
p('Prompt fordert JSON', pr.indexOf('ausschließlich mit JSON')!==-1, true);
const pr2 = H.promptBaustein('Fantasiemarke');
p('Standard-Prompt anders', pr2.indexOf('Hersteller ist unbekannt')!==-1, true);

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
