# Synchronisation einrichten (ca. 10 Minuten)

Die App funktioniert **ohne** diesen Schritt vollständig – dann liegen die Daten aber nur
im Browser des jeweiligen Geräts. Wer Handy, Tablet und Laptop auf demselben Stand halten
will, verbindet einmalig einen kostenlosen Supabase-Account.

Wichtig: Deine Daten werden **auf dem Gerät verschlüsselt**, bevor sie hochgeladen werden.
Supabase speichert nur unlesbaren Chiffretext und kennt den Schlüssel nicht.

---

## 1. Projekt anlegen

1. Auf [supabase.com](https://supabase.com) registrieren (Free-Tier reicht dauerhaft aus).
2. **New project** anlegen. Region: Frankfurt (EU) – dann bleiben die Daten in der EU,
   was für die DSGVO die einfachste Variante ist.
3. Ein Datenbank-Passwort vergeben und notieren.

## 2. Tabelle anlegen

Im Projekt links auf **SQL Editor → New query**, das Folgende einfügen und **Run** drücken:

```sql
create table if not exists public.vault (
  user_id    uuid primary key references auth.users on delete cascade,
  cipher     text        not null,
  iv         text        not null,
  salt       text        not null,
  alg        text,
  iter       int,
  stamp      int8        default 0,
  updated_at timestamptz default now()
);

alter table public.vault enable row level security;

-- Jeder Account sieht und schreibt ausschließlich die eigene Zeile.
create policy "vault ist privat"
  on public.vault
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

## 3. Zugangsdaten in die App eintragen

1. In Supabase: **Project Settings → API**.
2. Dort stehen **Project URL** (`https://xxxx.supabase.co`) und der **anon public** Key.
3. In der App: **Einstellungen → Synchronisation → Synchronisation einrichten**,
   beides eintragen und speichern.

Der `anon`-Key ist bewusst öffentlich – er allein gibt keinen Zugriff. Geschützt wird
über die Anmeldung und die Row-Level-Security-Regel aus Schritt 2.

## 4. Konto anlegen und Sync-Passwort setzen

1. **Konto anlegen** – E-Mail und Passwort. Bei aktivierter E-Mail-Bestätigung
   (Standard) zuerst den Link im Postfach anklicken, danach anmelden.
2. Danach fragt die App nach einem **Sync-Passwort**. Es wird ein sicherer
   Vorschlag erzeugt. Dieses Passwort:
   - verschlüsselt die Daten (AES-256-GCM, Schlüssel via PBKDF2-SHA-256, 250 000 Runden),
   - verlässt niemals dein Gerät,
   - **kann nicht zurückgesetzt werden.** Notiere es dir.

## 5. Zweites Gerät verbinden

Auf dem Handy dieselbe Adresse öffnen, in den Einstellungen dieselbe Projekt-URL und
denselben anon-Key eintragen, mit demselben Konto anmelden und **dasselbe Sync-Passwort**
eingeben. Ab dann gleichen sich beide Geräte automatisch ab: beim Start, beim Wechsel in
die App, nach jeder Änderung und alle zwei Minuten.

---

## Wie der Abgleich funktioniert

Zusammengeführt wird **pro Datensatz**, nicht pro Datei: Jeder Schüler, jede Stunde und
jede Note trägt einen Zeitstempel; bei Konflikten gewinnt die jüngere Fassung. Gelöschtes
bleibt als Markierung erhalten, damit ein Gerät mit altem Stand es nicht wieder auferstehen
lässt. Wer offline arbeitet, synchronisiert automatisch nach, sobald wieder Netz da ist.

## Als App installieren

- **iPhone/iPad:** Safari → Teilen → *Zum Home-Bildschirm*
- **Android:** Chrome → Menü → *App installieren*
- **Desktop:** Chrome/Edge → Installations-Symbol in der Adressleiste

Danach startet die App im Vollbild und funktioniert auch ohne Internet; Änderungen werden
beim nächsten Verbindungsaufbau übertragen.

## Backups

**Einstellungen → Backup exportieren** legt eine JSON-Datei mit allem an. Empfehlenswert
vor größeren Änderungen und als Absicherung, falls das Sync-Passwort verloren geht.
Beim Einlesen kann zwischen *Zusammenführen* und *Ersetzen* gewählt werden.

## Datenschutz in Kürze

- Ohne eingerichtete Synchronisation verlassen die Daten das Gerät nie.
- Mit Synchronisation liegt beim Anbieter ausschließlich Chiffretext.
- Server in der EU wählen, nur wirklich benötigte Daten erfassen und Akten löschen,
  wenn die Nachhilfe endet.
