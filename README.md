# HomeIQ

Haushalts- und Geräteverwaltung: Wartungsfristen, Gewährleistung und
Garantie, Störungen, Dokumente und Brennstoffverbrauch.

Die Oberfläche ist reines HTML/JS ohne Build-Schritt und läuft in einem
Android-WebView. Die Module sind so geschrieben, dass sie sowohl unter
Node (für die Tests) als auch im Browser funktionieren.

## Struktur

```
public/         Alles, was der Browser und das WebView bekommen
  index.html    Übersicht über das Objekt (Startseite)
  geraeteakte.html   Detailansicht eines Geräts
  js/           Module, ohne Abhängigkeiten untereinander außer den
                explizit hereingereichten
  css/          noch leer, Stile liegen vorerst in den HTML-Dateien
server.js       Liefert public/ aus, stellt /api/* bereit
Dockerfile      Abbild für Cloud Run
cloudbuild.yaml Tests, bauen, ausrollen
test/           Eine Suite je Modul, dazu lauf.js als Läufer
tools/          Entwicklungsserver und Asset-Abgleich
android/        Android-Studio-Projekt
docs/           Notizen, Entscheidungen, Rechtsgrundlagen,
                Anleitung zum Veröffentlichen
.github/        Tests bei jedem Push, Deploy aus main
```

## Veröffentlichen

Node-Server im Container auf Cloud Run, ausgelöst durch einen
Cloud-Build-Trigger bei jedem Push auf `main`. Erst Tests, dann bauen,
dann ausrollen – schlägt ein Test fehl, entsteht kein Abbild.

Die Schritte stehen in `docs/veroeffentlichen.md`.

## Befehle

```
npm test              alle Suiten
npm test fristen      nur eine Suite
npm start             Server auf :8080
npm run assets        public/ nach android/app/src/main/assets kopieren
```

Keine Abhängigkeiten, kein `npm install` nötig. Node ab Version 18.

## Module

| Datei | Aufgabe |
|---|---|
| `fristen.js` | Datumsarithmetik, Ansprüche, Fälligkeiten, Folgen einer Reparatur |
| `hersteller.js` | Nummernschemata je Hersteller, Prompt für den Typenschild-Scan |
| `selbsthilfe.js` | Sicherheitsgatter: worüber die KI beraten darf und worüber nicht |
| `intervalle.js` | Wartungskatalog mit Rechtsgrundlage und Geltungsbereich |
| `brennstoff.js` | Lieferungen, Preise, Verbrauch |
| `objekt.js` | Aggregation aller Fristen eines Gebäudes |
| `speicher.js` | localStorage hinter einer Promise-Schnittstelle, mit Migration und Beschädigungsschutz |
| `sync.js` | lokal sofort, Drive gebündelt, Wiederholung, offener Stand, Abgleich ein- und ausschaltbar |
| `drive.js` | Adapter auf die Android-Brücke |
| `drive-web.js` | Adapter für den Browser über Google Identity Services |
| `belege.js` | Belegdateien in IndexedDB, getrennt vom synchronisierten JSON |
| `app.js` | Startschicht: verbindet Speicher, Abgleich, Belege und Brücke |
| `demodaten.js` | Beispieldaten, Anfangsbestand beim ersten Start |

## Regeln, die überall gelten

- Datum als `"YYYY-MM-DD"`-String, nie als `Date` serialisiert
- Geld als ganzzahlige Cent, Mengen als ganzzahlige Hundertstel
- Berechnete Werte werden nie gespeichert, sondern immer neu gerechnet
- Jede berechnete Frist trägt eine `herleitung` mit stabilen Schlüsseln
- Rechtliche Angaben tragen `geprueft: true|false` und eine Grundlage
- Module werfen nur bei Programmierfehlern; erwartbare Fehler kommen
  als Ergebnisobjekt zurück
- Speicherzugriffe liefern Promises, auch wo der Unterbau synchron ist
- Geheimnisse stehen in Umgebungsvariablen, nie im Quelltext und nie
  in `public/`

## Ausprobieren

```
npm run serve     ->  http://localhost:8123
```

Beim ersten Start werden die Demodaten in den localStorage übernommen.
Ab da bleiben Änderungen erhalten: eine Erledigung eintragen, neu laden,
sie ist noch da. Der Knopf "Demodaten zurücksetzen" in der Kopfzeile
stellt den Anfangsbestand wieder her.

Belege kommen über das **+** bei den Rechnungen hinzu: Datei oder Foto
wählen, Titel, Art, Datum. Die Datei landet in IndexedDB, die
Beschreibung im Objekt. Die Datei wird noch nicht nach Drive
übertragen – das kommt mit dem Drive-Adapter.

Jeder Eintrag lässt sich löschen und bearbeiten: Lieferungen, Ansprüche
und Wartungsaufgaben. Ansprüche und Aufgaben lassen sich auch neu anlegen.
Beim Bearbeiten zeigt eine Vorschau das berechnete Ergebnis, bevor
gespeichert wird.

Geräte lassen sich anlegen, bearbeiten und löschen, ebenso die Daten
des Objekts selbst. Die Nummernfelder im Geräteformular richten sich
nach dem eingetragenen Hersteller, und die Kategorie zeigt sofort, ob
die Selbsthilfe für dieses Gerät gesperrt wäre.
Gelöscht wird nie auf einen Klick: der erste stellt die Frage, der
zweite führt sie aus.

Oben lässt sich zwischen **Einfach** und **Alles** umschalten. Die
einfache Ansicht zeigt nur Gerät, Kaufangaben, die laufende
Gewährleistung und die Rechnungen – Fristen,
Wartung, Störungen und Brennstoff bleiben draußen. Die Wahl wird lokal
gemerkt und nicht nach Drive übertragen, weil sie zu diesem Gerät
gehört und nicht zum Haushalt.

Die Kopfzeile sagt auch, woran man ist: "lokal gespeichert" oder
"nur im Arbeitsspeicher", dazu der Drive-Zustand. Ohne Android-Brücke
steht dort "Drive nicht verbunden" – das ist im Browser der Normalfall.

## Stand

676 Tests. Für den Abgleich im Browser muss in beiden HTML-Dateien
`window.HOMEIQ_CLIENT_ID` auf die Client-ID aus der Cloud Console
gesetzt werden. Leer bedeutet: nur lokal.

Was fehlt: die Android-Seite mit der Brücke aus `docs/android-bruecke.md`,
die Übertragung der Belegdateien nach Drive, und mehrere Objekte
nebeneinander.

Rechtliche Einträge in `intervalle.js` und `fristen.js` sind teilweise
noch nicht an einer belastbaren Quelle verifiziert. `Intervalle.ungeprueft()`
listet die offenen Punkte auf.
