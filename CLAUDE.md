# Blutdruck – Projektkontext für Claude

Eine kleine Single-File-PWA zum Erfassen von Blutdruck-Werten. Alles steckt in
[index.html](index.html) (HTML + CSS + JavaScript), dazu `sw.js` (Offline) und
`manifest.webmanifest` (Installation). Kein Build, kein Framework, keine Abhängigkeiten.

## Zusammenarbeit / Erklärstil
Der Nutzer ist **Programmier-Anfänger**. Deshalb:
- Erklärungen **einfach und verständlich** halten, nah am Anwender.
- **Fachbegriffe in Klammern** hinter die einfache Erklärung setzen, z. B. „Browser-Datenbank
  (IndexedDB)", damit der Nutzer die Fachsprache nebenbei mitlernt.
- Vor größeren Änderungen kurz Optionen/Plan zeigen statt sofort drauflos zu bauen.

## Commit-Ablauf (WICHTIG – ausdrücklicher Wunsch des Nutzers)
- Wenn ein abgeschlossener, getesteter Stand erreicht ist: **NICHT sofort** Commit-Texte erzeugen.
- **Zuerst fragen**, ob der Nutzer zum Committen bereit ist.
- **Erst nach seiner Bestätigung** zwei Texte liefern – jeweils in einem **eigenen Code-Block**
  (damit die Kopier-Funktion funktioniert):
  1. **Zusammenfassung** – eine kurze Betreffzeile.
  2. **Beschreibung** – Stichpunkte mit den Details der Änderung.
- Der Nutzer committet/pusht selbst über **GitHub Desktop**; Render deployt automatisch vom `main`-Branch.

## Aktueller Stand / bisherige Überarbeitungen
- **Speicher:** Messwerte liegen in der Browser-Datenbank (IndexedDB), mit `localStorage` als
  Spiegel/Fallback und einmaliger automatischer Migration. Beim Start wird dauerhafter Speicher
  angefordert (`navigator.storage.persist()`), Schutz gegen automatisches Löschen (Eviction/ITP).
- **Backup:** „Backup speichern" (Download), „Backup teilen" (Teilen-Menü / Web Share API),
  „Auto-Backup in Datei" (immer dieselbe Datei via File System Access API),
  „Backup wiederherstellen" (JSON laden, mit Statistik „X neu, Y aktualisiert").
  „Als CSV exportieren (Excel)" für die Auswertung.
- **Menü:** als **klappbare Abschnitte** (Daten & Backup, Anzeige, Verwalten) plus „Anleitung".
  Das Menü-Fenster ist schmaler als der Bildschirm, hat eine eigene Hintergrundfarbe (`--menu-bg`)
  und lässt ringsum Rand zum Raustippen.
- **Nicht unterstützte Funktionen** werden nicht versteckt, sondern **ausgegraut** mit kurzer
  Begründung (z. B. „Auf diesem Gerät nicht verfügbar").
- **Verwalten:** „Speicher-Status" (dauerhaft? wie viel belegt?) und „Alle Daten löschen"
  (mit Sicherheitsabfrage; die externe Backup-Datei bleibt dabei erhalten).
- **Anleitung:** kurzes, umgangssprachliches Hilfe-Pop-up für Anwender.
- **Fehler:** Wenn der Speicher voll ist (QuotaExceededError), erscheint ein Hinweis statt
  stillem Fehlschlag.

## Namens-Konvention (Backup vs. CSV)
„Backup …" = vollständige Sicherung/Wiederherstellung (Format JSON, originalgetreu).
„… CSV …" = für Excel/Auswertung (einseitig, nicht originalgetreu).

## Geparkte Aufgaben (noch zu besprechen)
- **Personalisierung:** Alter, Fitness-Level o. Ä. erfassen und daraus passende Ideal-/Zielwerte
  ableiten (statt fixer Standard-Schwellen).
- **Profile:** mehrere Profile (z. B. für Familienmitglieder), jeweils mit eigener, dediziert
  hinterlegter Backup-Datei pro Profil.
- **CSV-Import** ergänzen (Gegenstück zu „Als CSV exportieren") → Bezeichnung „Aus CSV importieren".
- **Einstellungen** ebenfalls in IndexedDB ablegen (aktuell nur in localStorage).
