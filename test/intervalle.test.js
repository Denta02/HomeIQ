const I = require('../public/js/intervalle.js');
const F = require('../public/js/fristen.js');
let ok=0, fehler=0;
function p(n, ist, soll){ const g=JSON.stringify(ist)===JSON.stringify(soll);
  if(g) ok++; else {fehler++; console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(ist)+'\n  soll: '+JSON.stringify(soll));} }
function wirft(n, fn){ try{fn(); fehler++; console.log('FEHLER: '+n+' haette werfen muessen');}catch(_){ok++;} }

/* Geltungsbereich */
const privat = {nutzung:'privat', einheiten:1};
const mfh    = {nutzung:'privat', einheiten:8};
const betrieb= {nutzung:'gewerblich', einheiten:1};

p('Feuerloescher privat: Empfehlung',
  I.vorlagenFuer('feuerloescher', privat).map(v=>v.pflichtArt), ['empfehlung']);
p('Feuerloescher gewerblich: Pflicht',
  I.vorlagenFuer('feuerloescher', betrieb).filter(v=>v.pflichtArt==='gesetzlich').length, 2);
p('privat keine gewerbliche Vorlage',
  I.vorlagenFuer('feuerloescher', privat).some(v=>v.gilt.nutzung.indexOf('gewerblich')!==-1 && v.gilt.nutzung.length===1), false);

p('GEG 60b nicht im EFH',
  I.vorlagenFuer('heizung', privat).some(v=>v.key==='heizungspruefung_geg60b'), false);
p('GEG 60b ab sechs Einheiten',
  I.vorlagenFuer('heizung', mfh).some(v=>v.key==='heizungspruefung_geg60b'), true);
p('Grenze 5 Einheiten',
  I.anwendbar(I.vorlageNach('heizungspruefung_geg60b'), {nutzung:'privat',einheiten:5}), false);
p('Grenze 6 Einheiten',
  I.anwendbar(I.vorlageNach('heizungspruefung_geg60b'), {nutzung:'privat',einheiten:6}), true);

p('Rauchmelder ueberall', I.vorlagenFuer('rauchmelder', privat).length, 2);
p('ohne Kontext privat als Vorgabe',
  I.vorlagenFuer('feuerloescher').map(v=>v.pflichtArt), ['empfehlung']);
p('unsinniger Kontext faellt auf privat',
  I.vorlagenFuer('feuerloescher', {nutzung:'quatsch', einheiten:-3}).map(v=>v.pflichtArt), ['empfehlung']);
p('ohne Kategorie alles Passende',
  I.vorlagenFuer(null, privat).length > 5, true);

/* Aufgabe bauen */
const a = I.aufgabeAusVorlage('rauchmelder_inspektion', '2026-03-01');
p('Titel uebernommen', a.titel, 'Rauchwarnmelder prüfen');
p('Quelle vermerkt', a.quelle, 'vorlage:rauchmelder_inspektion');
p('Planmodus', a.intervallBasis, 'plan');
p('12 Monate', a.intervallWert, 12);
p('Aufgabe rechnet', F.naechsteFaelligkeit(a, '2026-09-09').faellig, '2027-03-01');
p('Filter im Erledigungsmodus',
  I.aufgabeAusVorlage('dunstabzug_fettfilter','2026-01-01').intervallBasis, 'erledigung');

wirft('einmalige Vorlage wirft', ()=>I.aufgabeAusVorlage('heizungspruefung_geg60b','2026-01-01'));
wirft('externe Vorlage wirft', ()=>I.aufgabeAusVorlage('schornsteinfeger','2026-01-01'));
wirft('unbekannte Vorlage wirft', ()=>I.aufgabeAusVorlage('gibtsnicht','2026-01-01'));

/* Herkunft */
p('Herkunft gesetzlich',
  I.herkunftText(I.vorlageNach('feuerloescher_inspektion_gewerblich')).indexOf('Gesetzliche Pflicht'), 0);
p('Herkunft Empfehlung',
  I.herkunftText(I.vorlageNach('dachrinne')), 'Empfehlung, keine Pflicht');
p('Herkunft normativ nennt Norm',
  I.herkunftText(I.vorlageNach('rauchmelder_inspektion')), 'Aus einer Norm · DIN 14676');
p('Herkunft ohne Vorlage', I.herkunftText(null), '');

/* Pruefstatus */
p('ungeprueft nicht leer', I.ungeprueft().length > 0, true);
p('Rauchmelder-Inspektion geprueft', I.vorlageNach('rauchmelder_inspektion').geprueft, true);
p('Heizungswartung noch offen', I.vorlageNach('heizungswartung').geprueft, false);
p('jeder Eintrag hat geprueft-Flag',
  I.VORLAGEN.every(v=>typeof v.geprueft==='boolean'), true);
p('jeder Eintrag hat gilt',
  I.VORLAGEN.every(v=>v.gilt && Array.isArray(v.gilt.nutzung)), true);
p('jeder Eintrag hat pflichtArt',
  I.VORLAGEN.every(v=>['gesetzlich','normativ','vertraglich','empfehlung'].indexOf(v.pflichtArt)!==-1), true);
p('Schluessel eindeutig',
  new Set(I.VORLAGEN.map(v=>v.key)).size, I.VORLAGEN.length);
p('wiederkehrende haben Intervall',
  I.VORLAGEN.filter(v=>v.art==='wiederkehrend').every(v=>v.intervallWert>0 && v.intervallEinheit), true);

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
