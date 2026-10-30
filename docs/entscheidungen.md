# Getroffene Entscheidungen

Kurz notiert, damit später nachvollziehbar ist, warum etwas so ist.

## Daten

**Datum als String, nie als Date-Objekt.** `new Date("2026-03-01")` wird
als UTC gelesen und kann in westlichen Zeitzonen als 28.02. zurückkommen.
Monats- und Jahresarithmetik läuft deshalb rein ganzzahlig.

**Monatsklammerung auf den Monatsletzten.** 31.01. plus ein Monat ergibt
den 28.02. Das deckt sich mit § 188 Abs. 3 BGB.

**Geld in Cent, Mengen in Hundertsteln.** Keine Fließkommafehler in Summen.

**Berechnetes wird nicht gespeichert.** Fälligkeiten und Fristenden werden
bei jeder Anzeige neu gerechnet. Gespeicherte Werte laufen beim Abgleich
zwischen Geräten auseinander.

## Fristen

**Ansprüche sind eine Liste, kein Feld.** Nach einer Reparatur laufen
mehrere Ansprüche parallel, mit verschiedenen Fristen und verschiedenen
Ansprechpartnern.

**Jeder Herleitungsschritt trägt einen stabilen `key`.** Die Oberfläche
hängt Erklärtexte daran. Formulierungen dürfen sich ändern, Schlüssel nicht.

**`intervallBasis`:** `erledigung` zählt ab der letzten Erledigung,
`plan` hält ein festes Raster ab dem Ankerdatum. Ohne diese Unterscheidung
wandert eine jährliche Pflichtprüfung mit jeder Verspätung weiter nach hinten.

## Recht

**Geltungsbereich gehört an jeden Katalogeintrag.** Die zweijährliche
Feuerlöscherprüfung ist eine Arbeitsstättenregel, im Privathaushalt keine
Pflicht. § 60b GEG gilt erst ab sechs Einheiten. Ein Katalog ohne diese
Unterscheidung erzeugt erfundene Pflichten.

**`geprueft: false` bleibt sichtbar.** Nicht verifizierte Angaben werden
angezeigt, aber als vorläufig gekennzeichnet.

## Sicherheit

**Die Selbsthilfe-Sperre steht im Code, nicht im Prompt.** Prompts lassen
sich umformulieren, eine Fallunterscheidung nicht. Gas, feste Elektrik,
Kältemittel und Druckbehälter sind gesperrt.

**Notfallstichworte schlagen die Kategorie.** Bewusst grob: ein Fehlalarm
ist harmlos, ein übersehener Gasaustritt nicht.

## Speichern

**Lokal zuerst, Drive danach.** localStorage kann nicht am Netz scheitern.
Der lokale Stand darf nie hinter Drive liegen.

**Offener Vermerk überlebt den Neustart.** Sonst überschreibt ein älterer
Drive-Stand beim nächsten Start die lokalen Änderungen.

**Löschen braucht `geloescht: true`.** Ein entfernter Eintrag und ein auf
dem anderen Gerät neu angelegter sind für den Abgleich nicht unterscheidbar.

**Beschädigte Daten werden beiseitegelegt, nicht überschrieben.**

**Die Speicher-Schnittstelle arbeitet mit Promises**, obwohl localStorage
synchron ist. Belege und Typenschildfotos werden in IndexedDB landen, und
das geht nur asynchron. Die Schnittstelle nimmt den Wechsel vorweg, damit
er später nur `speicher.js` betrifft und nicht jeden Aufrufer.

**Zugriffe auf denselben Schlüssel laufen nacheinander.** Zwei rasch
aufeinanderfolgende Änderungen könnten sich sonst überholen.

**Geplant wird der Drive-Upload, bevor auf das lokale Schreiben gewartet
wird.** Sonst hinge die Bündelung an einer Mikrotask-Reihenfolge. Die Regel
„lokal führt" bleibt gewahrt, weil der lokale Schreibvorgang bereits
angestoßen ist.

**Binärdaten gehören nie in das synchronisierte JSON.** Sonst lädt jede
Änderung an einer Wartungsaufgabe sämtliche Belege erneut nach Drive.
Vorgesehen sind zwei getrennte Speicher: Metadaten als ein Dokument,
Dokumente einzeln in IndexedDB, verknüpft über `id` und `driveFileId`.

**Der Abgleich lässt sich abschalten**, der Schalter wird lokal gemerkt
und nicht nach Drive übertragen. Beim Wiedereinschalten wird NICHT
automatisch zusammengeführt: während der Pause können beide Seiten
auseinandergelaufen sein, und welche gelten soll, kann nur der Mensch
entscheiden. Angeboten werden drei Wege – lokal behalten, Drive
übernehmen, zusammenführen. Der dritte ist nicht verlangt, aber meist
der richtige: wer auf dem Telefon eine Lieferung und am Rechner eine
Wartung eingetragen hat, verliert sonst eines von beidem.

**Der überschriebene Stand wird gesichert** und lässt sich zurückholen,
und das Zurückholen ist selbst umkehrbar. Aus VehicleIQ übernommen: eine
Entscheidung zwischen zwei Ständen trifft man selten in voller Kenntnis,
und ohne Rückholmöglichkeit ist ein Fehlgriff endgültig.

**Android bleibt ein schlanker Transport**, die Abgleichslogik liegt
einmal in `sync.js`. VehicleIQ macht es umgekehrt: dort besitzt Kotlin
den Abgleich und das Web-JS tritt zurück. Der Preis unserer Variante
ist, dass ohne laufenden WebView nicht synchronisiert wird. Der Gewinn:
eine Implementierung, eine Testbasis, identisches Verhalten auf beiden
Seiten.

**Der Stand liegt zusätzlich in `appProperties` der Drive-Datei**, nicht
nur im Inhalt. Aus VehicleIQ übernommen: so lässt sich vergleichen, ohne
die Datei herunterzuladen.

## Drive

**Scope `drive.appdata` oder `drive.file`**, beide von Google als
"Recommended, Non-sensitive" eingestuft: keine Verifizierung, kein
CASA-Assessment. `appdata` ist versteckt und app-eigen, wird aber gelöscht,
wenn der Nutzer die App aus seinem Drive entfernt. `drive.file` bleibt
sichtbar und damit als Sicherung robuster. Noch offen.
