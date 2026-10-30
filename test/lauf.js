/**
 * Testläufer – startet jede Suite in einem eigenen Prozess.
 *
 * Getrennte Prozesse, damit sich die Suiten nicht gegenseitig
 * beeinflussen und ein Absturz nicht den ganzen Lauf mitnimmt.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testOrdner = __dirname;
const dateien = fs.readdirSync(testOrdner)
  .filter(n => n.endsWith('.test.js'))
  .sort();

let bestanden = 0, fehlgeschlagen = 0, suitenFehler = 0;
const nurEine = process.argv[2];

const gewaehlt = nurEine ? dateien.filter(d => d.indexOf(nurEine) !== -1) : dateien;
if (!gewaehlt.length) {
  /* Ohne diesen Abbruch würde ein Tippfehler im Filter als
     erfolgreicher Lauf mit null Tests durchgehen. */
  console.error(nurEine
    ? `\nKeine Suite passt auf "${nurEine}". Vorhanden: ` +
      dateien.map(d => d.replace('.test.js', '')).join(', ')
    : '\nKeine Testdateien in test/ gefunden.');
  process.exit(1);
}

console.log('');

for (const datei of gewaehlt) {
  const name = datei.replace('.test.js', '');
  let ausgabe = '', code = 0;

  try {
    ausgabe = execFileSync(process.execPath, [path.join(testOrdner, datei)], { encoding: 'utf8' });
  } catch (e) {
    ausgabe = (e.stdout || '') + (e.stderr || '');
    code = e.status === undefined ? 1 : e.status;
  }

  const treffer = /(\d+) bestanden, (\d+) fehlgeschlagen/.exec(ausgabe);
  if (treffer) {
    bestanden += Number(treffer[1]);
    fehlgeschlagen += Number(treffer[2]);
  } else {
    suitenFehler += 1;
  }

  const zeilen = ausgabe.split('\n').filter(z => z.indexOf('FEHLER') === 0 || z.startsWith('  '));
  const marke = code === 0 && treffer ? 'ok  ' : 'FEHL';
  console.log(`${marke}  ${name.padEnd(14)} ${treffer ? treffer[1] + ' bestanden' : 'Suite abgebrochen'}` +
              `${treffer && Number(treffer[2]) ? ', ' + treffer[2] + ' fehlgeschlagen' : ''}`);
  if (zeilen.length) console.log(zeilen.map(z => '      ' + z.trim()).join('\n'));
}

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen` +
            (suitenFehler ? `, ${suitenFehler} Suite(n) abgebrochen` : ''));

process.exit(fehlgeschlagen || suitenFehler ? 1 : 0);
