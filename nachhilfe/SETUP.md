# Daten zwischen PC und Handy abgleichen

Die App speichert alles **auf deinem Gerät**. Kein Server, kein Konto, keine
Übertragung im Hintergrund. Damit PC und Handy denselben Stand haben, gibt es
zwei Wege – am besten kombinierst du beide.

---

## Am Rechner: Datei einmal verknüpfen (läuft danach von allein)

Funktioniert in **Chrome und Edge** auf Windows, macOS und Linux.

1. **Einstellungen → Datei-Synchronisation → Neue Datei anlegen**
2. Speicherort wählen, z. B. `Dokumente/nachhilfe-daten.json`
3. Fertig.

Ab jetzt schreibt die App jede Änderung von selbst in diese Datei und liest beim
Öffnen, was inzwischen darin steht. Du musst nichts mehr anklicken.

Nach einem Neustart des Browsers fragt er einmal nach Bestätigung – dann steht in
der App *„Zugriff bestätigen"*, ein Klick genügt. Installierst du die App über das
Symbol in der Adressleiste, entfällt diese Rückfrage meistens.

### Zwei Rechner koppeln

Lege die Datei in einen Ordner, den ohnehin schon etwas abgleicht:
**iCloud Drive**, **Dropbox**, **OneDrive**, **Google Drive** oder **Nextcloud**.
Auf dem zweiten Rechner dann *Vorhandene Datei wählen* statt *Neue Datei anlegen*.
Damit sind beide dauerhaft synchron, ganz ohne dass die App je einen Server anspricht.

> Sobald die Datei in einem Cloud-Ordner liegt, verlässt sie dein Gerät. Schalte
> dann **Datei verschlüsseln** ein (gleicher Abschnitt in den Einstellungen). Der
> Anbieter sieht danach nur unlesbaren Zeichensalat. Merk dir das Passwort – ohne
> es kommt niemand mehr an die Daten, ich auch nicht.

---

## Handy: Daten hin- und herschicken

Handy-Browser dürfen aus Sicherheitsgründen **nicht** dauerhaft auf Dateien
zugreifen – das gilt für iPhone und Android gleichermaßen. Dort läuft es so:

**Vom Handy zum PC:**
Einstellungen → **Daten senden**. Es öffnet sich das Teilen-Menü deines Handys –
per AirDrop, Mail oder in die Dateien-App. Am PC dann Einstellungen →
**Datei einlesen** → *Zusammenführen*.

**Vom PC zum Handy:**
Am PC **Backup speichern**, die Datei aufs Handy schicken, dort **Datei einlesen**.

### Warum dabei nichts kaputtgeht

Beim Einlesen wird **zusammengeführt, nicht überschrieben**. Jeder Schüler, jede
Stunde und jede Note trägt einen Zeitstempel; bei Unterschieden gewinnt die
neuere Fassung. Du kannst also unterwegs auf dem Handy etwas eintragen und
abends am PC – beim nächsten Abgleich ist beides da.

Gelöschtes bleibt gelöscht: Löschungen werden vermerkt und nicht durch ein Gerät
mit altem Stand wiederbelebt.

*Ersetzen* verwirft dagegen alles Lokale. Das brauchst du nur, wenn du ein Gerät
bewusst zurücksetzen willst.

---

## Ein realistischer Ablauf

- **PC ist die Zentrale.** Dort die Datei verknüpfen, am besten in einem Cloud-Ordner.
- **Handy für unterwegs.** Nach der Nachhilfe schnell die Stunde abhaken.
- **Einmal pro Woche** vom Handy „Daten senden" und am PC einlesen. Zwei Minuten.

Wenn dir das auf Dauer zu umständlich wird, sag Bescheid – dann bauen wir doch
einen automatischen Abgleich ein. Der braucht zwingend eine Zwischenstation
(z. B. ein privates Repo oder eine kleine Datenbank), lässt sich aber so bauen,
dass diese Stelle nur verschlüsselte Daten sieht.

---

## App installieren

- **iPhone/iPad:** in **Safari** öffnen → Teilen-Symbol → *Zum Home-Bildschirm*
- **Android:** Chrome → Menü → *App installieren*
- **Desktop:** Chrome/Edge → Installationssymbol rechts in der Adressleiste

Danach startet die App im Vollbild, mit eigenem Icon, und funktioniert auch ohne
Internet.

---

## Backups

**Einstellungen → Backup speichern** legt eine vollständige Sicherung als
JSON-Datei an. Bewahre sie an einem zweiten Ort auf – geht das Gerät verloren
oder löschst du die Browserdaten, sind die Einträge sonst weg.

Ist die Verschlüsselung aktiv, ist auch das Backup verschlüsselt und lässt sich
nur mit deinem Passwort wieder einlesen.
