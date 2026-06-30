# Blutdruck – Projektkontext für Claude

Eine kleine PWA zum Erfassen von Blutdruck-Werten. Aufgeteilt in [index.html](index.html)
(HTML-Struktur), [styles.css](styles.css) (Gestaltung/CSS) und [app.js](app.js)
(Logik/JavaScript), dazu `sw.js` (Offline) und `manifest.webmanifest` (Installation).
Kein Build, kein Framework, keine Abhängigkeiten.

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
- Der Nutzer committet/pusht selbst über **GitHub Desktop**

## Aktueller Stand / bisherige Überarbeitungen
- **Code-Struktur (Umbau Stufe 1, erledigt):** Aufgeteilt in `index.html` (Struktur, ~265 Z.),
  `styles.css` (~270 Z.) und `app.js` (~709 Z.); eingebunden per `<link rel="stylesheet">` und
  `<script src="./app.js" defer></script>`. `sw.js` cacht alle Dateien offline (Cache
  `blutdruck-v11`). Reines Verschieben – keine Logik geändert. Weiterhin kein Build, kein Framework.
- **Speicher:** Messwerte liegen in der Browser-Datenbank (IndexedDB), mit `localStorage` als
  Spiegel/Fallback und einmaliger automatischer Migration. Beim Start wird dauerhafter Speicher
  angefordert (`navigator.storage.persist()`), Schutz gegen automatisches Löschen (Eviction/ITP).
- **Backup** (Menü-Abschnitt; zwei Gruppen als abgesetzte Karten `.grp-card`, darunter „Backup teilen"):
  - **Automatisches Backup** (immer dieselbe Datei via File System Access API; nur Chromium, sonst
    ausgegraut). Zustandstext **grün** „Verknüpft: ‹Dateiname›" bzw. **rot** „Keine Datei verknüpft"
    (nur der Dateiname – Browser geben aus Sicherheitsgründen keinen vollständigen Pfad her und
    können Datei/Ordner nicht im Datei-Manager öffnen). Zwei Knöpfe **nebeneinander, einzeilig**
    (links Status setzen, rechts bestehende Datei): nicht verknüpft → **„Neu anlegen"** (Speichern-
    Dialog `showSaveFilePicker`, legt an + verknüpft sofort) / **„Auswählen"**; verknüpft →
    **„Lösen"** / **„Ändern"**. „Auswählen"/„Ändern" nutzen den **Öffnen-Dialog** (`showOpenFilePicker`,
    keine „Ersetzen?"-Frage, keine „(1)"-Dubletten) und **führen** den Datei-Inhalt mit den App-Daten
    **zusammen** (datensicher – eine reichere Datei verliert nichts; Nebeneffekt: ohne Lösch-
    Protokoll könnte ein gelöschter, in der Datei noch vorhandener Eintrag zurückkommen), bevor
    verknüpft und zurückgeschrieben wird. Danach schreibt jede Änderung automatisch in die Datei
    (`scheduleAutoBackup`/`autoBackupIfLinked`). „Jetzt sichern" entfällt (durch die Automatik
    überflüssig).
  - **Manuelles Backup:** zwei Knöpfe nebeneinander **„Speichern"** (Download) / **„Wiederherstellen"**
    (Datei laden – .txt oder ältere .json –, Statistik „X neu, Y aktualisiert"; Merge-Kern
    `mergeEntriesFromData`, geteilt mit „Auswählen") plus **„Erinnerung"** (erinnert nach X Tagen
    ungesicherter Änderungen ans Backup).
  - **„Backup teilen"** (Web Share API; klappt das Teilen nicht, fragt ein Dialog, ob stattdessen
    heruntergeladen wird) als breiter Knopf **unter** beiden Karten – übergreifend für beide Methoden.
- **Menü:** als **klappbare Abschnitte** in fester Reihenfolge **Backup · Daten · Anzeige** plus
  „Anleitung". Geöffnet über das **„Menü"-Icon unten rechts in der Tab-Bar** (Erfassen · Tabelle ·
  Diagramm · Menü). Im Abschnitt „Backup" stehen die zwei Gruppen (Automatisches/Manuelles Backup)
  als **abgesetzte Karten** (`.grp-card`, Überschrift `.grp-head`). Das Menü-Fenster ist schmaler als der
  Bildschirm, hat eine eigene Hintergrundfarbe (`--menu-bg`) und lässt ringsum Rand zum Raustippen.
  Beim Öffnen eines Abschnitts ist nur der **Inhalt scrollbar** – Kopf- und Fußleiste bleiben fest
  (offenes Fenster als senkrechter Flex-Container, `dialog[open]`), sodass „Menü schließen" nie
  abgeschnitten wird. **Keine Trennlinien** – der aufgeklappte Abschnitt hebt sich als **weiße Karte**
  mit Schatten ab; **immer nur ein Abschnitt offen** (einen anderen öffnen schließt den vorigen). Das
  Fenster sitzt **unten am Bildschirmrand** (daumenfreundlich) und schließt nur bei echtem Tippen auf
  die Backdrop-Fläche (`e.target===dialog`). Aus der Anleitung führt ein „‹ Zurück"-Button wieder ins
  Menü; Schließen-Buttons heißen „Menü schließen".
- **Nicht unterstützte Funktionen** werden nicht versteckt, sondern **ausgegraut** mit kurzer
  Begründung (z. B. „Auf diesem Gerät nicht verfügbar").
- **Daten** (Abschnitt, vormals „Verwalten"): „Als CSV exportieren (Excel)" (für die Auswertung;
  später ergänzt um CSV-Import), „Alle Daten löschen" (mit Sicherheitsabfrage; die externe Backup-
  Datei bleibt dabei erhalten) und – darunter – eine Info-Zeile mit der **Speicherbelegung**
  (belegt von Kapazität · Prozent, sofern der Browser eine Quota liefert).
  Der frühere Persistenz-Status/„Aktivieren"-Link entfiel (dauerhafter Speicher wird beim Start
  automatisch angefordert).
- **Anleitung:** kurzes, umgangssprachliches Hilfe-Pop-up für Anwender.
- **Fehler:** Wenn der Speicher voll ist (QuotaExceededError), erscheint ein Hinweis statt
  stillem Fehlschlag.
- **Meldungen (Toasts):** kurze Rückmeldungen unten als farbige Karte mit Icon in drei Kategorien –
  **Erfolg** (grün, Haken), **Hinweis** (gelb/amber, Dreieck) und **Fehler** (rot, Dreieck).
  4 s sichtbar, per **Wischen** zur Seite schließbar; helle Flächen → in Hell und Dunkel lesbar.
  Funktion `toast(msg, kind)` mit `kind ∈ success | notice | error` (Default `success`). Bei offenem
  Fenster (Dialog) wird der Toast **in das Fenster gerendert**, damit er über dem Menü sichtbar **und**
  wischbar bleibt (ein modales Fenster macht alles außerhalb „unberührbar"/inert); beim Schließen des
  Fensters wandert eine noch sichtbare Meldung zurück in den Body.

## Namens-Konvention (Backup vs. CSV)
„Backup …" = vollständige Sicherung/Wiederherstellung (Dateiendung **.txt**, Inhalt JSON, originalgetreu;
.txt wegen Android-Teilen-Kompatibilität – Wiederherstellen akzeptiert .txt **und** ältere .json).
„… CSV …" = für Excel/Auswertung (einseitig, nicht originalgetreu).

## Geparkte Aufgaben (noch zu besprechen)

Gruppiert nach Themen. Reihenfolge innerhalb einer Gruppe ≈ grobe Priorität.

### Code-Struktur (Architektur)
Hintergrund: Analyse ergab – die Einzeldatei war für den Start richtig, stößt aber mit den
wachsenden Features (v. a. „Profile") an Grenzen. Empfohlen: **build-frei** aufteilen (kein
Framework, kein Build-System), in zwei Stufen. Geschwindigkeit ist hier kein Faktor; Gewinn liegt
in Wartbarkeit, sauberen Git-Diffs, feinerem Cache und kleineren, isoliert verständlichen Einheiten.
**Stufe 1 (CSS & JS auslagern) ist erledigt** (siehe „Aktueller Stand"). Offen ist nur noch Stufe 2:
- **Umbau Stufe 2 – JS in Module aufteilen (später, wenn die großen Features kommen):**
  `app.js` in thematische ES-Module zerlegen, z. B. `storage.js`, `backup.js`, `chart.js`,
  `ui.js`; Einbindung per `<script type="module">`. ES-Module laufen problemlos, weil die App
  als PWA ohnehin über http(s) (nicht `file://`) betrieben wird.

### Neue Funktionen
- **Personalisierung:** Alter, Fitness-Level o. Ä. erfassen und daraus passende Ideal-/Zielwerte
  ableiten (statt fixer Standard-Schwellen).
- **Profile:** mehrere Profile (z. B. für Familienmitglieder), jeweils mit eigener, dediziert
  hinterlegter Backup-Datei pro Profil. (Strukturell der größte Brocken – Haupttreiber für Stufe 2.)
- **CSV-Import** ergänzen (Gegenstück zu „Als CSV exportieren") → Bezeichnung „Aus CSV importieren".
- **Auto-Wiederherstellung:** verknüpfte Auto-Backup-Datei beim Start automatisch einlesen, wenn die
  App leer ist (Gegenstück zum automatischen Schreiben in die Datei).

### Daten & Speicher
- **Einstellungen** ebenfalls in IndexedDB ablegen (aktuell nur in localStorage).

### Texte & Dokumentation
- **Anleitung (In-App-Hilfe) verbessern:** Die Erklärtexte sind noch nicht aussagekräftig genug
  und decken die wichtigsten Funktionen (z. B. die Backup-Lösung) nicht ab.
- **Vollständige App-Dokumentation erstellen** und die in dieser CLAUDE.md hinterlegten Einträge
  entsprechend übertragen.