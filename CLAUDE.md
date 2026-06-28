# Blutdruck – Projektkontext für Claude

Eine kleine Single-File-PWA zum Erfassen von Blutdruck-Werten. Alles steckt in
[index.html](index.html) (HTML + CSS + JavaScript), dazu `sw.js` (Offline) und
`manifest.webmanifest` (Installation). Kein Build, kein Framework, keine Abhängigkeiten.

## Sprache
- Mit dem Nutzer immer auf **Deutsch** kommunizieren

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
- **Backup:** „Backup speichern" (Download), „Backup teilen" (Teilen-Menü / Web Share API; klappt
  das Teilen nicht, fragt ein Dialog, ob stattdessen heruntergeladen werden soll),
  „Auto-Backup in Datei" (immer dieselbe Datei via File System Access API). Bei verknüpfter Datei
  werden **Name** (nur der Dateiname – Browser geben aus Sicherheitsgründen keinen vollständigen
  Pfad her und können Datei/Ordner nicht im Datei-Manager öffnen) und die Aktionen „Jetzt sichern",
  „Datei ändern", „Verknüpfung lösen" gezeigt.
  „Backup wiederherstellen" (JSON laden, mit Statistik „X neu, Y aktualisiert").
  „Als CSV exportieren (Excel)" für die Auswertung.
- **Menü:** als **klappbare Abschnitte** (Daten & Backup, Anzeige, Verwalten) plus „Anleitung".
  Das Menü-Fenster ist schmaler als der Bildschirm, hat eine eigene Hintergrundfarbe (`--menu-bg`)
  und lässt ringsum Rand zum Raustippen. **Keine Trennlinien** mehr – der aufgeklappte Abschnitt
  hebt sich als **weiße Karte** mit Schatten ab. Das Fenster hängt oben fest (kein „Springen" beim
  Auf-/Zuklappen) und schließt nur bei echtem Tippen auf die Backdrop-Fläche (`e.target===dialog`).
  Aus der Anleitung führt ein „‹ Zurück"-Button wieder ins Menü; Schließen-Buttons heißen „Menü schließen".
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
