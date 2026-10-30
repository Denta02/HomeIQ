const S = require('../public/js/selbsthilfe.js');
let ok=0, fehler=0;
function p(name, ist, soll){
  const g=JSON.stringify(ist)===JSON.stringify(soll);
  if(g) ok++; else {fehler++; console.log('FEHLER: '+name+'\n  ist:  '+JSON.stringify(ist)+'\n  soll: '+JSON.stringify(soll));}
}
function wirft(name, fn){ try{fn(); fehler++; console.log('FEHLER: '+name+' haette werfen muessen');}catch(_){ok++;} }

/* Kategorien */
p('Gastherme gesperrt',   S.bewerteAnliegen('gastherme','läuft nicht').stufe, 'gesperrt');
p('Gastherme kein Modell',S.bewerteAnliegen('gastherme','läuft nicht').darfModellFragen, false);
p('Gastherme nennt Fachbetrieb',
  S.bewerteAnliegen('gastherme','x').fachbetrieb, 'Heizungsbauer oder Gasinstallateur');
p('feste Elektrik gesperrt', S.bewerteAnliegen('elektro_fest','Steckdose tot').stufe, 'gesperrt');
p('Wärmepumpe gesperrt',  S.bewerteAnliegen('klima_waermepumpe','kühlt nicht').stufe, 'gesperrt');
p('Elektronik frei',      S.bewerteAnliegen('elektronik','Lüfter laut').stufe, 'frei');
p('Elektronik darf fragen',S.bewerteAnliegen('elektronik','Lüfter laut').darfModellFragen, true);
p('Haushaltsgerät eingeschraenkt', S.bewerteAnliegen('haushaltsgeraet','E18').stufe, 'eingeschraenkt');
p('Haushaltsgerät darf fragen', S.bewerteAnliegen('haushaltsgeraet','E18').darfModellFragen, true);
p('unbekannte Kategorie vorsichtig', S.bewerteAnliegen('gibtsnicht','x').stufe, 'eingeschraenkt');
p('leere Kategorie vorsichtig', S.bewerteAnliegen('','x').stufe, 'eingeschraenkt');
p('Themen bei Elektronik vorhanden',
  S.bewerteAnliegen('elektronik','x').erlaubteThemen.length > 0, true);
p('Themen bei gesperrt leer',
  S.bewerteAnliegen('gastherme','x').erlaubteThemen.length, 0);

/* Notfaelle schlagen die Kategorie */
p('Gasgeruch sperrt',      S.bewerteAnliegen('elektronik','Es riecht nach Gas').stufe, 'gesperrt');
p('Gasgeruch kein Modell', S.bewerteAnliegen('elektronik','Es riecht nach Gas').darfModellFragen, false);
p('Gasgeruch liefert Schritte',
  S.bewerteAnliegen('elektronik','Gasgeruch im Keller').notfall.schritte.length > 3, true);
p('Notfall schlaegt freie Kategorie',
  S.bewerteAnliegen('moebel_bau','da qualmt etwas').notfall.key, 'feuer');
p('verschmort erkannt', S.pruefeNotfall('riecht verschmort').key, 'feuer');
p('Stromschlag erkannt', S.pruefeNotfall('ich habe einen Stromschlag bekommen').key, 'stromschlag');
p('Kohlenmonoxid erkannt', S.pruefeNotfall('der CO-Melder piept').key, 'co');
p('Wasser im Sicherungskasten', S.pruefeNotfall('Wasser im Sicherungskasten').key, 'wasser_strom');
p('Umlaute egal', S.pruefeNotfall('GASGERUCH!').key, 'gas');
p('harmloser Text kein Notfall', S.pruefeNotfall('Lüfter ist laut'), null);
p('leerer Text kein Notfall', S.pruefeNotfall(''), null);
p('null kein Notfall', S.pruefeNotfall(null), null);

/* Prompt */
const urteil = S.bewerteAnliegen('haushaltsgeraet','E18');
const pr = S.selbsthilfePrompt(urteil, 'Bosch Waschmaschine');
p('Prompt nennt Gerät', pr.indexOf('Bosch Waschmaschine')!==-1, true);
p('Prompt verbietet Gas', pr.indexOf('Keine Arbeiten an Gas')!==-1, true);
p('Prompt haelt Gehaeuse zu', pr.indexOf('Gehäuse bleibt geschlossen')!==-1, true);
p('freie Stufe ohne Gehaeusesatz',
  S.selbsthilfePrompt(S.bewerteAnliegen('elektronik','x'),'Laptop').indexOf('Gehäuse bleibt geschlossen'), -1);
wirft('Prompt bei gesperrt wirft', ()=>S.selbsthilfePrompt(S.bewerteAnliegen('gastherme','x'),'Therme'));
wirft('Prompt bei Notfall wirft', ()=>S.selbsthilfePrompt(S.bewerteAnliegen('elektronik','Gasgeruch'),'Laptop'));
wirft('Prompt ohne Urteil wirft', ()=>S.selbsthilfePrompt(null,'x'));

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
