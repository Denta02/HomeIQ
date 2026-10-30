'use strict';

/**
 * Startet den Server auf einem freien Port und fragt ihn ab.
 * Prüft nicht nur, dass er antwortet, sondern auch, dass er
 * Ausbruchsversuche aus public/ abweist.
 */

const http = require('http');
const { server } = require('../server.js');

let ok = 0, fehler = 0;
const p = (n, i, s) => { if (JSON.stringify(i) === JSON.stringify(s)) ok++;
  else { fehler++; console.log('FEHLER: ' + n + '\n  ist:  ' + JSON.stringify(i) + '\n  soll: ' + JSON.stringify(s)); } };

function hole(port, pfad) {
  return new Promise((aufloesen, ablehnen) => {
    http.get({ host: '127.0.0.1', port, path: pfad }, (a) => {
      let text = '';
      a.on('data', (s) => { text += s; });
      a.on('end', () => aufloesen({ status: a.statusCode, kopf: a.headers, text }));
    }).on('error', ablehnen);
  });
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  /* Startseite */
  const start = await hole(port, '/');
  p('Startseite ausgeliefert', start.status, 200);
  p('als HTML', start.kopf['content-type'].indexOf('text/html') === 0, true);
  p('nicht zwischengespeichert', start.kopf['cache-control'].indexOf('no-cache') === 0, true);
  p('Inhalt ist die Übersicht', start.text.indexOf('HomeIQ') !== -1, true);

  /* Module */
  const modul = await hole(port, '/js/fristen.js');
  p('Modul ausgeliefert', modul.status, 200);
  p('als JavaScript', modul.kopf['content-type'].indexOf('text/javascript') === 0, true);
  p('kein Raten des Typs', modul.kopf['x-content-type-options'], 'nosniff');

  const akte = await hole(port, '/geraeteakte.html');
  p('zweite Seite erreichbar', akte.status, 200);

  /* Endpunkte */
  const g = await hole(port, '/api/gesundheit');
  p('Gesundheit antwortet', g.status, 200);
  p('nennt den Dienst', JSON.parse(g.text).dienst, 'homeiq');
  p('nennt den Stand', JSON.parse(g.text).stand, 'läuft');

  const f = await hole(port, '/api/faehigkeiten');
  p('Fähigkeiten antworten', f.status, 200);
  p('KI ohne Schlüssel aus', JSON.parse(f.text).ki, false);
  p('Version gemeldet', typeof JSON.parse(f.text).version, 'string');

  const unbekannt = await hole(port, '/api/gibtsnicht');
  p('unbekannter Endpunkt', unbekannt.status, 404);
  p('als JSON, nicht als HTML', unbekannt.kopf['content-type'].indexOf('application/json') === 0, true);

  /* Nicht vorhandene Datei */
  const weg = await hole(port, '/gibtsnicht.html');
  p('fehlende Datei', weg.status, 404);

  /* Ausbruch aus public/ */
  for (const versuch of ['/../package.json', '/../../etc/passwd', '/%2e%2e/package.json']) {
    const r = await hole(port, versuch);
    p('Ausbruch abgewehrt: ' + versuch, r.status === 403 || r.status === 404, true);
    p('kein Inhalt verraten: ' + versuch, /homeiq|root:/.test(r.text) && r.status === 200, false);
  }

  /* Ungültige Prozentkodierung darf nicht abstürzen */
  const kaputt = await hole(port, '/%ZZ');
  p('ungültige Adresse', kaputt.status, 400);

  await new Promise((r) => server.close(r));
  console.log('\n' + ok + ' bestanden, ' + fehler + ' fehlgeschlagen');
  process.exit(fehler ? 1 : 0);
})();
