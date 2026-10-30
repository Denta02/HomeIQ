# Repo und Veröffentlichung

Aufbau wie bei VehicleIQ: Node-Server im Container auf Cloud Run,
Auslieferung über einen Cloud-Build-Trigger aus GitHub.

```
public/      alles, was der Browser bekommt
server.js    liefert public/ aus und stellt /api/* bereit
Dockerfile   Abbild für Cloud Run
cloudbuild.yaml  Tests, bauen, ausrollen
```

## Einmalig: Repo

```bash
cd homeiq
git init -b main
git add .
git commit -m "HomeIQ: Module, Prototypen, Tests, Server"
```

Auf GitHub ein **privates** Repo `HomeIQ` anlegen, dann:

```bash
git remote add origin git@github.com:<dein-konto>/HomeIQ.git
git push -u origin main
```

Zunächst privat, weil in `intervalle.js` vier Einträge auf
`geprueft: false` stehen. Solange die nicht gegengelesen sind, sollte
niemand Fremdes die App als Auskunft über seine Pflichten nehmen.

## Einmalig: Cloud Run

Projekt wählen – eigenes Projekt oder dasselbe wie VehicleIQ, siehe
unten. Dann:

```bash
gcloud artifacts repositories create homeiq \
  --repository-format=docker --location=europe-west1

gcloud run deploy homeiq \
  --source . --region europe-west1 --allow-unauthenticated
```

Der erste Aufruf baut aus dem Dockerfile und rollt aus. Die Adresse
steht danach in der Ausgabe und sieht aus wie
`https://homeiq-<nummer>.europe-west1.run.app`.

## Einmalig: Trigger

In der Cloud Console unter *Cloud Build → Trigger* einen Trigger auf
das GitHub-Repo anlegen, Zweig `main`, Konfiguration
`cloudbuild.yaml`. Danach löst jeder Push den Bau aus.

Das Dienstkonto von Cloud Build braucht die Rollen
*Cloud Run-Administrator*, *Artifact Registry Writer* und
*Dienstkontonutzer*.

## Geheimnisse

Niemals im Quelltext, niemals in `public/`. Als Umgebungsvariablen am
Dienst, so wie bei VehicleIQ `GROQ_API_KEY` und `ADMIN_SECRET`:

```bash
gcloud run services update homeiq --region europe-west1 \
  --set-env-vars GROQ_API_KEY=...
```

Besser noch über Secret Manager, dann steht der Wert nicht in der
Dienstbeschreibung:

```bash
gcloud run services update homeiq --region europe-west1 \
  --set-secrets GROQ_API_KEY=groq-api-key:latest
```

`/api/faehigkeiten` meldet dem Browser, was gesetzt ist – die
Oberfläche muss Endpunkte nicht raten.

## Danach: OAuth-Client

In der Cloud Console unter *APIs & Dienste → Anmeldedaten* einen
OAuth-Client vom Typ **Web** anlegen, als autorisierten
JavaScript-Origin die Cloud-Run-Adresse eintragen, für die lokale
Arbeit zusätzlich `http://localhost:8080`.

Die Client-ID landet sichtbar im Quelltext – bei Web-OAuth normal.
Ein Client-**Secret** gehört nur auf den Server, nie nach `public/`.

Mit einem eigenen Server gibt es eine Möglichkeit, die reines
Hosting nicht hätte: Der Austausch des Codes gegen ein Token kann
serverseitig laufen. Dann gibt es ein Refresh-Token, und die
Anmeldung hält länger als eine Stunde.

## Eigenes Projekt oder das von VehicleIQ?

Dasselbe Projekt ist bequemer: ein Abrechnungskonto, eine
Artifact Registry, vorhandene Dienstkonten. Getrennte Projekte sind
sauberer: ein Fehler in HomeIQ kann VehicleIQ nicht beeinträchtigen,
und Kosten lassen sich zuordnen.

Für die Firestore-Sammlung `proUsers` gilt dasselbe. Liegen beide
Apps im selben Projekt, braucht der Eintrag ein Feld, das die App
unterscheidet – `produkt: "vehicleiq_pro"` gibt es schon, `homeiq_pro`
käme daneben.

## Lokal

```bash
npm start       # http://localhost:8080
npm test
```
