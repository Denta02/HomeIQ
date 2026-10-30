'use strict';

/**
 * Prüft den Belegspeicher gegen die Ausfallebene im Arbeitsspeicher
 * und gegen eine IndexedDB-Attrappe.
 */

const B = require('../public/js/belege.js');
let ok=0, fehler=0;
const p=(n,i,s)=>{ if(JSON.stringify(i)===JSON.stringify(s)) ok++;
  else {fehler++; console.log('FEHLER: '+n+'\n  ist:  '+JSON.stringify(i)+'\n  soll: '+JSON.stringify(s));} };

/* Einfache Attrappe eines Blobs */
const datei = (groesse, typ, name) => ({ size: groesse, type: typ||'image/jpeg', _name: name||'' });

(async () => {

/* --- Ausfallebene ohne IndexedDB --- */
{
  const sp = await B.erzeuge({ indexedDB: null });
  p('faellt auf RAM zurueck', sp.zustand().art, 'arbeitsspeicher');
  p('nicht dauerhaft', sp.zustand().dauerhaft, false);
  p('mit Hinweis', typeof sp.zustand().hinweis, 'string');

  const r = await sp.ablegen('dok_1', datei(200000), { dateiname:'rechnung.jpg' });
  p('ablegen klappt', r.erfolg, true);
  p('Groesse uebernommen', r.groesseBytes, 200000);
  p('keine Warnung', r.warnung, null);

  const g = await sp.holen('dok_1');
  p('wieder da', g.dateiname, 'rechnung.jpg');
  p('Mime aus der Datei', g.mime, 'image/jpeg');
  p('Inhalt erhalten', g.inhalt.size, 200000);

  p('unbekannte Kennung', await sp.holen('gibtsnicht'), null);
  p('entfernen', await sp.entfernen('dok_1'), true);
  p('danach weg', await sp.holen('dok_1'), null);
}

/* --- Prüfungen --- */
{
  const sp = await B.erzeuge({ indexedDB: null });
  p('ohne Kennung', (await sp.ablegen('', datei(100))).erfolg, false);
  p('ohne Datei', (await sp.ablegen('x', null)).erfolg, false);
  p('Begruendung vorhanden', typeof (await sp.ablegen('x', null)).fehler, 'string');

  const gross = await sp.ablegen('dok_gross', datei(B.WARNUNG_AB_BYTES + 1));
  p('grosse Datei wird abgelegt', gross.erfolg, true);
  p('aber mit Warnung', typeof gross.warnung, 'string');
  p('Warnung nennt Groesse', gross.warnung.indexOf('MB') !== -1, true);
}

/* --- Liste und Platzbedarf --- */
{
  const sp = await B.erzeuge({ indexedDB: null });
  await sp.ablegen('a', datei(100000), { dateiname:'a.jpg' });
  await sp.ablegen('b', datei(250000), { dateiname:'b.pdf', mime:'application/pdf' });

  const l = await sp.liste();
  p('zwei Eintraege', l.length, 2);
  p('Liste ohne Inhalt', l[0].inhalt, undefined);
  p('Dateiname in der Liste', l.map(x=>x.dateiname).sort(), ['a.jpg','b.pdf']);

  const b = await sp.belegt();
  p('Anzahl', b.anzahl, 2);
  p('Summe der Bytes', b.bytes, 350000);
}

/* --- Aufräumen verwaister Dateien --- */
{
  const sp = await B.erzeuge({ indexedDB: null });
  await sp.ablegen('bleibt', datei(1000));
  await sp.ablegen('verwaist1', datei(2000));
  await sp.ablegen('verwaist2', datei(3000));

  const r = await sp.aufraeumen(['bleibt']);
  p('zwei entfernt', r.entfernt, 2);
  p('Bytes gemeldet', r.bytes, 5000);
  p('richtige geblieben', (await sp.liste()).map(x=>x.id), ['bleibt']);

  p('nichts zu tun', (await sp.aufraeumen(['bleibt'])).entfernt, 0);
  p('leere Liste raeumt alles', (await sp.aufraeumen([])).entfernt, 1);
}

/* --- IndexedDB-Attrappe --- */
{
  function idbAttrappe(opts) {
    const o = opts || {};
    const lager = {};
    const db = {
      objectStoreNames: { contains: () => true },
      createObjectStore(){ return {}; },
      transaction(_, modus) {
        const t = {};
        setTimeout(() => {
          if (o.fehlerBeimSchreiben && modus === 'readwrite') {
            t.error = new Error('QuotaExceededError: storage full');
            if (t.onerror) t.onerror();
          } else if (t.oncomplete) t.oncomplete();
        }, 0);
        t.objectStore = () => ({
          put(e){ lager[e.id]=e; return {result:e}; },
          get(id){ return {result: lager[id]}; },
          delete(id){ delete lager[id]; return {result:true}; },
          getAll(){ return {result: Object.keys(lager).map(k=>lager[k])}; }
        });
        return t;
      }
    };
    return {
      open() {
        const a = {};
        setTimeout(() => {
          if (o.oeffnenFehler) { a.error = new Error('verboten'); if (a.onerror) a.onerror(); return; }
          a.result = db;
          if (a.onupgradeneeded) a.onupgradeneeded();
          if (a.onsuccess) a.onsuccess();
        }, 0);
        return a;
      }
    };
  }

  const sp = await B.erzeuge({ indexedDB: idbAttrappe() });
  p('IndexedDB erkannt', sp.zustand().art, 'indexeddb');
  p('dauerhaft', sp.zustand().dauerhaft, true);
  p('kein Hinweis noetig', sp.zustand().hinweis, null);

  p('ablegen ueber idb', (await sp.ablegen('x', datei(5000), {dateiname:'x.jpg'})).erfolg, true);
  p('lesen ueber idb', (await sp.holen('x')).dateiname, 'x.jpg');
  p('liste ueber idb', (await sp.liste()).length, 1);
  p('entfernen ueber idb', await sp.entfernen('x'), true);

  /* Fehler beim Öffnen -> stille Ausfallebene */
  const sp2 = await B.erzeuge({ indexedDB: idbAttrappe({oeffnenFehler:true}) });
  p('Oeffnungsfehler faellt weich', sp2.zustand().art, 'arbeitsspeicher');
  p('App laeuft weiter', (await sp2.ablegen('y', datei(10))).erfolg, true);

  /* Voller Speicher */
  const sp3 = await B.erzeuge({ indexedDB: idbAttrappe({fehlerBeimSchreiben:true}) });
  const r = await sp3.ablegen('z', datei(10));
  p('Quota gemeldet', r.erfolg, false);
  p('Quota-Text verstaendlich', r.fehler.indexOf('voll') !== -1, true);
  p('Zustand merkt sich den Fehler', sp3.zustand().letzterFehler !== null, true);
}


/* --- Zusammenspiel: Beschreibung im Objekt, Datei im Belegspeicher --- */
{
  const sp = await B.erzeuge({ indexedDB: null });

  /* So legt die Oberfläche einen Beleg an */
  const geraet = { id:'ger_1', dokumente: [] };
  const id = 'dok_test';
  const r = await sp.ablegen(id, datei(180000, 'image/jpeg'), { dateiname:'rechnung.jpg' });
  geraet.dokumente.push({ id, titel:'Rechnung', typ:'kaufbeleg',
    dateiname:'rechnung.jpg', mime:'image/jpeg', groesseBytes:180000,
    driveFileId:null, ocrText:'', erstellt:'2028-07-01' });

  p('Datei abgelegt', r.erfolg, true);
  p('Beschreibung im Objekt', geraet.dokumente.length, 1);
  p('Objekt enthaelt keine Datei',
    JSON.stringify(geraet).indexOf('inhalt') === -1, true);
  p('Objekt bleibt klein', JSON.stringify(geraet).length < 400, true);

  /* Löschen entfernt beides */
  geraet.dokumente = geraet.dokumente.filter(d => d.id !== id);
  await sp.entfernen(id);
  p('Beschreibung weg', geraet.dokumente.length, 0);
  p('Datei weg', await sp.holen(id), null);
}

/* --- Geraet geloescht: Dateien werden verwaist --- */
{
  const sp = await B.erzeuge({ indexedDB: null });
  await sp.ablegen('d1', datei(1000));
  await sp.ablegen('d2', datei(2000));
  await sp.ablegen('d3', datei(3000));

  /* Nach dem Löschen eines Geräts kennt das Objekt nur noch d3 */
  const nochBekannt = ['d3'];
  const auf = await sp.aufraeumen(nochBekannt);
  p('zwei verwaiste Dateien entfernt', auf.entfernt, 2);
  p('Platz zurueckgewonnen', auf.bytes, 3000);
  p('verbleibende Datei unberuehrt', (await sp.holen('d3')).groesseBytes, 3000);
}

console.log('\n'+ok+' bestanden, '+fehler+' fehlgeschlagen');
process.exit(fehler?1:0);
})();
