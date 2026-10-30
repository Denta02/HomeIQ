# Vertrag zwischen WebView und Android

`www/js/drive.js` erwartet auf der Android-Seite ein Objekt, das unter
dem Namen `HomeIQBruecke` in den WebView eingehängt wird.

## Was Android anbieten muss

```kotlin
@JavascriptInterface fun driveLaden(kennung: String)
@JavascriptInterface fun driveSichern(kennung: String, jsonText: String)
@JavascriptInterface fun driveAnmelden(kennung: String)
@JavascriptInterface fun driveStatus(): String
```

`driveStatus()` antwortet synchron mit JSON:

```json
{ "angemeldet": true, "konto": "name@example.com", "fehler": null }
```

Die drei anderen kehren sofort zurück und melden das Ergebnis später.

## Rückweg ins WebView

```kotlin
webView.evaluateJavascript(
    "window.HomeIQ.driveAntwort($kennungJson,$inhaltJson,$fehlerJson)", null)
```

Alle drei Werte müssen als JSON-Literale eingesetzt werden, nicht als
rohe Zeichenketten. `inhalt` ist bei `driveSichern` und `driveAnmelden`
`null`, bei `driveLaden` der Dateiinhalt oder `null`, wenn in Drive noch
nichts liegt.

Ein Fehler wird als Text in `fehler` übergeben. Dann ignoriert der
Adapter `inhalt`.

## Was der Adapter dabei annimmt

- Antworten dürfen in beliebiger Reihenfolge kommen, die Kennung ordnet zu
- Eine Antwort auf eine unbekannte Kennung wird still verworfen
- Ohne Antwort greift nach 30 Sekunden eine Zeitüberschreitung
- Kaputtes JSON aus Drive gilt als Fehler, nicht als leerer Stand

## Offen

- Scope: `drive.appdata` oder `drive.file`
- Anmeldung: Credential Manager oder der ältere Weg
- Wo der Zugriff auf Drive selbst läuft: in Kotlin oder im WebView
