/**
 * HomeIQ – Server
 * ------------------------------------------------------------------
 * Liefert public/ aus und stellt die Endpunkte bereit, die nicht im
 * Browser laufen dürfen: alles, wofür ein Schlüssel nötig ist.
 *
 * Läuft als Container auf Cloud Run. Der Port kommt aus der Umgebung,
 * Cloud Run setzt PORT – ein fest verdrahteter Port führt dort dazu,
 * dass der Dienst nie als bereit gilt.
 *
 * Geheimnisse stehen ausschließlich in Umgebungsvariablen, nie im
 * Quelltext und nie in public/.
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT) || 8080;

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function antwortJson(antwort, status, daten) {
  const text = JSON.stringify(daten);
  antwort.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text)
  });
  antwort.end(text);
}

/* ================================================================
 * Endpunkte
 * ================================================================ */

/**
 * Cloud Run prüft hiermit, ob der Dienst lebt. Muss ohne jede
 * Abhängigkeit antworten – auch wenn Firestore gerade klemmt.
 */
function gesundheit(antwort) {
  antwortJson(antwort, 200, {
    dienst: 'homeiq',
    stand: 'läuft',
    zeit: new Date().toISOString()
  });
}

/**
 * Sagt dem Browser, was der Server kann. Die Oberfläche richtet sich
 * danach, statt Endpunkte zu raten, die es nicht gibt.
 */
function faehigkeiten(antwort) {
  antwortJson(antwort, 200, {
    ki: Boolean(process.env.GROQ_API_KEY),
    pro: Boolean(process.env.FIRESTORE_AKTIV),
    version: process.env.K_REVISION || 'lokal'
  });
}

const ENDPUNKTE = {
  '/api/gesundheit': gesundheit,
  '/api/faehigkeiten': faehigkeiten
};

/* ================================================================
 * Dateien
 * ================================================================ */

function dateiAusliefern(pfad, antwort) {
  /* Erst auflösen, dann prüfen: sonst käme man mit ../ aus public
     heraus. */
  const datei = path.resolve(WURZEL, '.' + pfad);
  if (!datei.startsWith(WURZEL)) {
    antwort.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    antwort.end('Verboten');
    return;
  }

  fs.readFile(datei, (fehler, inhalt) => {
    if (fehler) {
      antwort.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      antwort.end('Nicht gefunden: ' + pfad);
      return;
    }
    const endung = path.extname(datei).toLowerCase();
    const istSeite = endung === '.html' || endung === '.js';
    antwort.writeHead(200, {
      'Content-Type': TYPEN[endung] || 'application/octet-stream',
      /* Seiten und Module nicht zwischenspeichern, sonst sehen
         Nutzer nach einem Deploy noch den alten Stand. */
      'Cache-Control': istSeite ? 'no-cache, must-revalidate' : 'public, max-age=31536000',
      'X-Content-Type-Options': 'nosniff'
    });
    antwort.end(inhalt);
  });
}

/* ================================================================
 * Server
 * ================================================================ */

const server = http.createServer((anfrage, antwort) => {
  let pfad;
  try {
    pfad = decodeURIComponent((anfrage.url || '/').split('?')[0]);
  } catch (e) {
    antwort.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    antwort.end('Ungültige Adresse');
    return;
  }

  const endpunkt = ENDPUNKTE[pfad];
  if (endpunkt) { endpunkt(antwort, anfrage); return; }

  if (pfad.startsWith('/api/')) {
    antwortJson(antwort, 404, { fehler: 'Unbekannter Endpunkt: ' + pfad });
    return;
  }

  dateiAusliefern(pfad === '/' ? '/index.html' : pfad, antwort);
});

/* Cloud Run beendet Container mit SIGTERM. Ohne sauberes Herunterfahren
   werden laufende Anfragen mitten im Satz abgeschnitten. */
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log('HomeIQ hört auf Port ' + PORT);
  });
}

module.exports = { server, WURZEL };
