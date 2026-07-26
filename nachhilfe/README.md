# Nachhilfe Manager

Verwaltung für Nachhilfeunterricht: Schüler, Stunden, Noten und Honorare an einem Ort.
Läuft als statische Seite auf GitHub Pages, ist auf dem Handy installierbar und
synchronisiert auf Wunsch Ende-zu-Ende-verschlüsselt zwischen allen Geräten.

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
| **Einstellungen** | Profil und Vorgaben, hell/dunkel, Synchronisation, Backup, Datenschutz-Hinweise |

Dazu: Volltextsuche, Tastenkürzel (`n` neu, `/` suchen), Offline-Betrieb,
Backup als JSON, heller und dunkler Modus.

## Wie die Daten liegen

Local-first: Alles steht im `localStorage` des Browsers, die App funktioniert ohne
Konto und ohne Internet. Wer synchronisieren möchte, verbindet ein kostenloses
Supabase-Projekt – siehe [SETUP.md](SETUP.md).

Vor jedem Upload werden die Daten auf dem Gerät mit **AES-256-GCM** verschlüsselt
(Schlüssel über PBKDF2-SHA-256, 250 000 Runden, aus einem Passwort, das das Gerät
nie verlässt). Der Server speichert ausschließlich Chiffretext.

Zusammengeführt wird **pro Datensatz** über Zeitstempel, nicht pro Datei – zwei
Geräte, die parallel etwas eintragen, überschreiben sich also nicht gegenseitig.
Löschungen bleiben als Markierung erhalten, damit ein Gerät mit altem Stand sie nicht
rückgängig macht.

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
    ├── sync.js             Supabase-REST-Anbindung
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

Dann `http://localhost:3000/nachhilfe/` öffnen. Für die Synchronisation ist HTTPS
oder `localhost` nötig, weil die Web-Crypto-API sonst nicht bereitsteht.
