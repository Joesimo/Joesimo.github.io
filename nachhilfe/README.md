# Nachhilfe Manager

Verwaltung für Nachhilfeunterricht: Schüler, Stunden, Noten und Honorare an einem Ort.
Läuft als statische Seite auf GitHub Pages, ist auf dem Handy installierbar und
speichert alles ausschließlich auf deinen eigenen Geräten – ohne Server und ohne Konto.

**Aufrufen:** <https://joesimo.github.io/nachhilfe/>

## Was drin ist

| Bereich | Inhalt |
|---|---|
| **Übersicht** | Stunden von heute, nächste Termine, Kennzahlen, zuletzt eingetragene Noten, Hinweise auf Schüler, die Aufmerksamkeit brauchen |
| **Schüler** | Akte je Schüler: Klasse, Schulform, Fächer, Kontakt der Eltern, Stundensatz, Ziel, Notizen, Status (aktiv/pausiert/beendet) – mit Historie aller Stunden und Noten |
| **Kalender** | Wochenansicht mit Wischgeste, Termin direkt am Tag anlegen, Wochenplan als Liste |
| **Stunden** | Alle Einheiten mit Thema, Hausaufgabe und Notizen; Ein-Klick auf „gehalten" und „bezahlt" |
| **Noten** | Note 1–6, Oberstufenpunkte 0–15 oder Prozent, mit Gewichtung; Durchschnitte je Fach und Schüler, Verlaufsdiagramm, Trendanzeige |
| **Finanzen** | Monatsumsatz, offene Beträge je Schüler, Auswertung über 12 Monate, CSV-Export |
| **Einstellungen** | Profil und Vorgaben, hell/dunkel, Datei-Synchronisation, Backup, Hinweise zum Datenschutz |

Dazu: Volltextsuche, Tastenkürzel (`n` neu, `/` suchen), Offline-Betrieb,
Backup als JSON, heller und dunkler Modus.

## Wie die Daten liegen

Ausschließlich lokal: Alles steht im `localStorage` des Browsers. Es gibt keinen
Server, kein Konto und keine Übertragung im Hintergrund.

Für den Abgleich zwischen Geräten dient eine **Datei** – siehe [SETUP.md](SETUP.md):

- **Am Rechner** (Chrome/Edge) verknüpft sich die App per File System Access API
  dauerhaft mit einer Datei und hält sie automatisch aktuell. Liegt die Datei in
  einem Ordner, den iCloud, Dropbox oder Nextcloud ohnehin abgleicht, sind mehrere
  Rechner ohne weiteres Zutun synchron.
- **Auf dem Handy** ist der Dateizugriff durch den Browser gesperrt; dort läuft der
  Austausch über das Teilen-Menü des Geräts und „Datei einlesen".

Zusammengeführt wird **pro Datensatz** über Zeitstempel, nicht pro Datei – zwei
Geräte, die parallel etwas eintragen, überschreiben sich also nicht gegenseitig.
Löschungen bleiben als Markierung erhalten, damit ein Gerät mit altem Stand sie nicht
rückgängig macht.

Optional lässt sich die Datei mit **AES-256-GCM** verschlüsseln (Schlüssel über
PBKDF2-SHA-256, 250 000 Runden). Empfehlenswert, sobald sie in einem Cloud-Ordner
liegt oder das Gerät verlässt.

## Aufbau

```
nachhilfe/
├── index.html              Gerüst
├── manifest.webmanifest    Installierbarkeit (PWA)
├── sw.js                   Service Worker für den Offline-Betrieb
├── css/app.css             Design-System (Farben, Komponenten, Responsive)
├── icons/                  App-Icons
└── js/
    ├── app.js              Routing, Layout, Suche, Auto-Sync
    ├── store.js            Datenmodell, CRUD, Merge-Logik, Notenrechnung
    ├── filesync.js         Datei-Verknüpfung, Export, Import
    ├── crypto.js           Ver- und Entschlüsselung
    ├── ui.js               Modal, Formulare, Toast
    ├── charts.js           SVG-Diagramme
    ├── icons.js            Icon-Set
    ├── theme.js            Hell/Dunkel
    ├── util.js             Datums-, Zahlen- und Formathelfer
    ├── actions.js          Dialoge zum Anlegen und Bearbeiten
    └── views/              Die sieben Ansichten
```

Kein Build-Schritt, keine Abhängigkeiten – reine ES-Module. Änderungen an den Dateien
sind nach dem Push direkt live.

## Lokal starten

```bash
npx serve .      # oder: python3 -m http.server
```

Dann `http://localhost:3000/nachhilfe/` öffnen. Für Verschlüsselung und
Dateizugriff ist HTTPS oder `localhost` nötig – über `file://` stehen die
nötigen Browser-Schnittstellen nicht bereit.
