'use strict';

/**
 * Prüft den Browser-Adapter gegen eine Attrappe von Google Identity
 * Services und eine Attrappe der Drive-REST-Schnittstelle.
 */

const path = require('path');
const DW = require(path.join(__dirname, '..', 'public', 'js', 'drive-web.js'));

let ok = 0, fehler = 0;
const p = (n, i, s) => { if (JSON.stringify(i) === JSON.stringify(s)) ok++;
  else { fehler++; console.log('FEHLER: ' + n + '\n  ist:  ' + JSON.stringify(i) + '\n  soll: ' + JSON.stringify(s)); } };
async function wirft(n, fn, teil) {
  try { await fn(); fehler++; console.log('FEHLER: ' + n + ' hätte ablehnen müssen'); }
  catch (e) { if (teil && e.message.indexOf(teil) === -1) { fehler++; console.log('FEHLER: ' + n + ' Text: ' + e.message); } else ok++; }
}

/* Google Identity Services */
function gisAttrappe(opts) {
  const o = opts || {};
  let zaehler = 0;
  return {
    rufe: [],
    accounts: {
      oauth2: {
        initTokenClient(k) {
          const self = this;
          return {
            requestAccessToken() {
              zaehler++;
              setTimeout(() => {
                if (o.fehler) { k.callback({ error: o.fehler }); return; }
                if (o.scopeAbgelehnt) { k.callback({ access_token: 't' + zaehler }); return; }
                k.callback({ access_token: 't' + zaehler });
              }, 0);
            }
          };
        },
        hasGrantedAllScopes() { return !o.scopeAbgelehnt; },
        revoke(t, cb) { cb && cb(); }
      }
    },
    _anzahl: () => zaehler
  };
}

/* Drive-REST */
function driveAttrappe(opts) {
  const o = opts || {};
  const zustand = { datei: o.datei || null, inhalt: o.inhalt || null, uploads: 0, rufe: [] };
  const antwort = (status, koerper) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => koerper,
    text: async () => (typeof koerper === 'string' ? koerper : JSON.stringify(koerper))
  });

  let ersteAbgelaufen = o.einmal401 || false;

  zustand.fetch = async (url, e) => {
    zustand.rufe.push({ url, methode: (e && e.method) || 'GET',
      token: e && e.headers && e.headers.Authorization });

    if (url.indexOf('oauth2/v3/userinfo') !== -1) {
      return antwort(200, { email: 'Dennis@Example.DE' });
    }
    if (ersteAbgelaufen) { ersteAbgelaufen = false; return antwort(401, { error: {} }); }
    if (o.statusFehler) return antwort(o.statusFehler, { error: { errors: [{ reason: o.grund || '' }] } });

    if (url.indexOf('/drive/v3/files?q=') === 0 || url.indexOf('files?q=') !== -1) {
      return antwort(200, { files: zustand.datei ? [zustand.datei] : [] });
    }
    if (url.indexOf('alt=media') !== -1) {
      return antwort(200, zustand.inhalt === null ? '' : JSON.stringify(zustand.inhalt));
    }
    if (url.indexOf('/upload/drive/v3/files') !== -1) {
      zustand.uploads++;
      zustand.datei = zustand.datei || { id: 'neu1' };
      return antwort(200, { id: zustand.datei.id });
    }
    return antwort(404, {});
  };
  return zustand;
}

function sitzungAttrappe() {
  const d = {};
  return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); },
    removeItem: k => { delete d[k]; }, _d: d };
}

function bau(gisOpt, driveOpt) {
  const gis = gisAttrappe(gisOpt);
  const dr = driveAttrappe(driveOpt);
  const s = sitzungAttrappe();
  const a = DW.erzeuge({ clientId: 'abc.apps.googleusercontent.com', google: gis,
    fetchFn: dr.fetch, sitzung: s, jetzt: () => 1750000000000 });
  return { a, gis, dr, s };
}

(async () => {

/* --- Verfügbarkeit --- */
{
  const { a } = bau();
  p('vorhanden mit Client-ID', a.vorhanden(), true);
  const ohne = DW.erzeuge({ clientId: '', google: null, fetchFn: null });
  p('ohne alles nicht vorhanden', ohne.vorhanden(), false);
  p('Status meldet den Grund', ohne.status().fehler !== null, true);
  await wirft('laden ohne GIS', () => ohne.laden(), 'nicht geladen');
}

/* --- Anmeldung --- */
{
  const { a, s } = bau();
  p('vorher nicht angemeldet', a.status().angemeldet, false);
  p('anmelden klappt', await a.anmelden(), true);
  p('danach angemeldet', a.status().angemeldet, true);
  p('Konto kleingeschrieben', a.status().konto, 'dennis@example.de');
  p('Token in der Sitzung', s._d.homeiq_token !== undefined, true);

  await a.abmelden();
  p('nach Abmelden leer', a.status().angemeldet, false);
  p('Token entfernt', s._d.homeiq_token, undefined);
}

/* --- Fehlendes Drive-Häkchen --- */
{
  const { a } = bau({ scopeAbgelehnt: true });
  await wirft('Scope abgelehnt', () => a.anmelden(), 'nicht erlaubt');
}
{
  const { a } = bau({ fehler: 'access_denied' });
  await wirft('Anmeldung abgebrochen', () => a.anmelden(), 'access_denied');
}

/* --- Laden --- */
{
  const { a } = bau({}, { datei: null });
  p('leeres Drive ergibt null', await a.laden(), null);
}
{
  const { a } = bau({}, {
    datei: { id: 'd1', appProperties: { stand: '1700000000000' }, modifiedTime: '2026-01-01T00:00:00Z' },
    inhalt: { name: 'Haus', geraete: [] }
  });
  p('Objekt geladen', (await a.laden()).name, 'Haus');
  p('Stand ohne Herunterladen', await a.stand(), 1700000000000);
}
{
  /* Ältere Datei ohne appProperties: Änderungszeit zählt */
  const { a } = bau({}, { datei: { id: 'd1', modifiedTime: '2026-01-01T00:00:00Z' }, inhalt: {} });
  p('Rückfall auf modifiedTime', await a.stand(), Date.parse('2026-01-01T00:00:00Z'));
}
{
  /* Beschädigte Datei in Drive: muss abgelehnt werden, nicht als
     "noch nichts da" durchgehen. Der eigene fetch muss beim Erzeugen
     übergeben werden – später getauscht greift er nicht mehr. */
  const kaputterFetch = async (url) => url.indexOf('alt=media') !== -1
    ? { ok: true, status: 200, text: async () => '{kaputt', json: async () => null }
    : { ok: true, status: 200, json: async () => ({ files: [{ id: 'd1' }] }) };
  const a = DW.erzeuge({ clientId: 'abc', google: gisAttrappe(),
    fetchFn: kaputterFetch, sitzung: sitzungAttrappe() });
  await wirft('kaputtes JSON abgelehnt', () => a.laden(), 'kein gültiges JSON');

  /* Leere Datei ist dagegen legitim: angelegt, noch nichts drin */
  const leererFetch = async (url) => url.indexOf('alt=media') !== -1
    ? { ok: true, status: 200, text: async () => '', json: async () => null }
    : { ok: true, status: 200, json: async () => ({ files: [{ id: 'd1' }] }) };
  const b = DW.erzeuge({ clientId: 'abc', google: gisAttrappe(),
    fetchFn: leererFetch, sitzung: sitzungAttrappe() });
  p('leere Datei ergibt null', await b.laden(), null);
}

/* --- Sichern --- */
{
  const { a, dr } = bau({}, { datei: null });
  p('erster Upload', await a.sichern({ name: 'Neu', geaendert: '2026-05-01T10:00:00Z' }), true);
  p('einmal hochgeladen', dr.uploads, 1);
  p('als POST angelegt', dr.rufe.some(r => r.methode === 'POST'), true);
}
{
  const { a, dr } = bau({}, { datei: { id: 'd1', appProperties: { stand: '1000' } } });
  await a.sichern({ name: 'Neuer', geaendert: '2026-05-01T10:00:00Z' });
  p('bestehende Datei geändert', dr.rufe.some(r => r.methode === 'PATCH'), true);
}
{
  /* Drive ist neuer: nicht überschreiben */
  const spaeter = Date.parse('2027-01-01T00:00:00Z');
  const { a, dr } = bau({}, { datei: { id: 'd1', appProperties: { stand: String(spaeter) } } });
  await wirft('neuerer Stand geschützt',
    () => a.sichern({ name: 'Alt', geaendert: '2026-05-01T10:00:00Z' }), 'neuerer Stand');
  p('nichts hochgeladen', dr.uploads, 0);
}
{
  const { a } = bau();
  const zirkel = {}; zirkel.selbst = zirkel;
  await wirft('Zirkelbezug abgelehnt', () => a.sichern(zirkel), 'JSON');
}

/* --- Abgelaufenes Token --- */
{
  const { a, gis, dr } = bau({}, { einmal401: true, datei: null });
  await a.anmelden();
  const vorher = gis._anzahl();
  p('Anfrage nach Erneuerung erfolgreich', await a.laden(), null);
  p('genau einmal erneuert', gis._anzahl() - vorher, 1);
}

/* --- Fehlerarten --- */
{
  const { a } = bau();
  p('Speicher voll', a.fehlerArt({ status: 403, grund: 'storageQuotaExceeded' }), 'speicher');
  p('Berechtigung', a.fehlerArt({ status: 403, grund: '' }), 'berechtigung');
  p('Drosselung ist kein Rechteproblem', a.fehlerArt({ status: 403, grund: 'rateLimitExceeded' }), 'unbekannt');
  p('Netzfehler', a.fehlerArt(new TypeError('failed to fetch')), 'netz');
  p('nichts übergeben', a.fehlerArt(null), 'unbekannt');
}

/* --- Dieselbe Schnittstelle wie der Android-Adapter --- */
{
  const DA = require(path.join(__dirname, '..', 'public', 'js', 'drive.js'));
  const android = DA.erzeuge({ bruecke: null });
  const { a } = bau();
  for (const name of ['laden', 'sichern', 'status', 'vorhanden']) {
    p('beide bieten ' + name, [typeof android[name], typeof a[name]], ['function', 'function']);
  }
}

console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
process.exit(fehler ? 1 : 0);
})();
