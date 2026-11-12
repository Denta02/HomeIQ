'use strict';

/**
 * Löst echte Klicks aus, statt nur das erzeugte HTML anzusehen.
 *
 * Die bisherigen Prüfungen sahen nur, DASS ein Knopf da ist. Ein Knopf,
 * der seinen Zustand setzt, aber nirgends gezeichnet wird, blieb
 * dadurch unentdeckt – genau so war das Plus beim Handbuch kaputt.
 */

const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'public') + '/';
const B = require('./beispiel.js');

let ok = 0, fehler = 0;
const p = (n, i, s) => { if (JSON.stringify(i) === JSON.stringify(s)) ok++;
  else { fehler++; console.log('FEHLER: ' + n + '\n  ist:  ' + JSON.stringify(i) + '\n  soll: ' + JSON.stringify(s)); } };

function seitenSkript(h) {
  return [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
}

function bau(modus, anpassen) {
  const objekt = JSON.parse(JSON.stringify(B.OBJEKT));
  objekt.schemaVersion = 1;
  if (anpassen) anpassen(objekt);

  const lager = {
    'homeiq:objekt': JSON.stringify(objekt),
    'homeiq:einstellungen': JSON.stringify({ ansicht: modus, schemaVersion: 1 })
  };
  const knoten = [], statisch = ['huelle', 'ladefehler'], horcher = {};

  function mach(id) {
    const hu = knoten.find(x => x._id === 'huelle');
    const da = statisch.indexOf(id) !== -1 || (hu && hu.innerHTML.indexOf('id="' + id + '"') !== -1);
    if (!da) return null;
    let k = knoten.find(x => x._id === id);
    if (!k) {
      k = { _id: id, innerHTML: '', value: '', addEventListener() {}, setAttribute() {},
        getAttribute() { return null; }, querySelectorAll() { return []; },
        querySelector() { return null; }, closest() { return null; }, focus() {},
        files: [], style: {}, open: false };
      knoten.push(k);
    }
    return k;
  }

  const win = {
    localStorage: {
      getItem: k => (k in lager ? lager[k] : null),
      setItem: (k, v) => { lager[k] = String(v); },
      removeItem: k => { delete lager[k]; }
    },
    location: { search: '', reload() {}, href: '' },
    setTimeout, clearTimeout
  };
  win.document = { readyState: 'complete', getElementById: mach,
    querySelectorAll: () => [], querySelector: () => null,
    addEventListener(art, fn) { (horcher[art] = horcher[art] || []).push(fn); } };

  ['fristen', 'hersteller', 'selbsthilfe', 'intervalle', 'brennstoff', 'objekt',
   'speicher', 'sync', 'drive', 'drive-web', 'belege', 'app']
    .forEach(m => new Function('window', 'module', 'document',
      fs.readFileSync(P + 'js/' + m + '.js', 'utf8'))(win, { exports: {} }, win.document));

  new Function('window', 'document',
    seitenSkript(fs.readFileSync(P + 'geraeteakte.html', 'utf8')))(win, win.document);

  /* Klick auf ein Element, das bestimmte data-Attribute trägt.
     `weitere` bildet die zusätzlichen Attribute nach, etwa data-id –
     ohne sie findet der Code das gemeinte Element nicht. */
  function klick(attr, wert, weitere) {
    const alle = Object.assign({}, weitere || {});
    alle[attr] = wert;
    const ziel = {
      getAttribute: a => (a in alle ? alle[a] : null),
      closest: sel => (sel === '[' + attr + ']' || sel === '[' + attr + '="' + wert + '"]') ? ziel : null
    };
    (horcher.click || []).forEach(fn => fn({ target: ziel, preventDefault() {} }));
  }

  return { win, klick, html: () => mach('huelle').innerHTML, lager };
}

const warte = () => new Promise(r => setTimeout(r, 40));

(async () => {

for (const modus of ['einfach', 'alles']) {

  /* Plus bei den Dokumenten */
  {
    const u = bau(modus);
    await warte();
    p(modus + ': Plus für Belege da', /data-beleg-neu="rechnung"/.test(u.html()), true);
    u.klick('data-beleg-neu', 'rechnung');
    await warte();
    p(modus + ': Belegformular erscheint', /id="bl_datei"/.test(u.html()), true);
    p(modus + ': Art vorbelegt', /value="kaufbeleg" selected/.test(u.html()), true);

    u.klick('data-beleg-abbrechen', '1');
    await warte();
    p(modus + ': Abbrechen schließt', /id="bl_datei"/.test(u.html()), false);
  }

  /* Plus beim Handbuch */
  {
    const u = bau(modus);
    await warte();
    p(modus + ': Plus fürs Handbuch da', /data-beleg-neu="handbuch"/.test(u.html()), true);
    u.klick('data-beleg-neu', 'handbuch');
    await warte();
    p(modus + ': Handbuchformular erscheint', /id="bl_datei"/.test(u.html()), true);
    p(modus + ': Art Handbuch vorbelegt', /value="handbuch" selected/.test(u.html()), true);
  }

  /* Dokumente mit Datei lassen sich öffnen und löschen */
  {
    const u = bau(modus, o => {
      o.geraete[0].dokumente.push({ id: 'dok_pdf', titel: 'Anleitung', typ: 'handbuch',
        dateiname: 'x.pdf', mime: 'application/pdf', erstellt: '2026-08-20', ocrText: '' });
    });
    await warte();
    p(modus + ': Datei öffnen angeboten', /data-beleg-oeffnen="dok_pdf"/.test(u.html()), true);
    p(modus + ': Löschen angeboten', /data-loeschen-frage="beleg"/.test(u.html()), true);

    u.klick('data-loeschen-frage', 'beleg', { 'data-id': 'dok_pdf' });
    await warte();
    p(modus + ': erst Rückfrage', /data-loeschen-ja/.test(u.html()), true);
  }

  /* Ansicht umschalten */
  {
    const u = bau(modus);
    await warte();
    const anderer = modus === 'einfach' ? 'alles' : 'einfach';
    u.klick('data-ansicht', anderer);
    await warte();
    p(modus + ': Umschalten wirkt',
      new RegExp('data-ansicht="' + anderer + '"[^>]*>').test(u.html()), true);
    p(modus + ': Wahl gemerkt',
      JSON.parse(u.lager['homeiq:einstellungen']).ansicht, anderer);
  }

  /* Gerät löschen fragt nach, statt sofort zu löschen */
  {
    const u = bau(modus);
    await warte();
    const ersteId = B.OBJEKT.geraete[0].id;
    u.klick('data-loeschen-frage', 'geraet', { 'data-id': ersteId });
    await warte();
    p(modus + ': Löschen fragt nach', /data-loeschen-ja/.test(u.html()), true);
    p(modus + ': Gerät noch da', JSON.parse(u.lager['homeiq:objekt']).geraete.length, 2);
  }
}

console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
})();
