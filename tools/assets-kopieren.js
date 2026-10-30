/**
 * Kopiert public/ in den Assets-Ordner des Android-Projekts.
 *
 * Damit bleibt public/ die einzige Quelle. Wer direkt in den Assets
 * arbeitet, verliert seine Änderungen beim nächsten Lauf.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const quelle = path.join(__dirname, '..', 'public');
const ziel = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'assets');

function kopiere(von, nach) {
  fs.mkdirSync(nach, { recursive: true });
  for (const eintrag of fs.readdirSync(von, { withFileTypes: true })) {
    const a = path.join(von, eintrag.name);
    const b = path.join(nach, eintrag.name);
    if (eintrag.isDirectory()) kopiere(a, b);
    else { fs.copyFileSync(a, b); zahl += 1; }
  }
}

let zahl = 0;
if (!fs.existsSync(quelle)) {
  console.error('public/ nicht gefunden.');
  process.exit(1);
}
kopiere(quelle, ziel);
console.log(zahl + ' Dateien nach ' + path.relative(process.cwd(), ziel) + ' kopiert.');
