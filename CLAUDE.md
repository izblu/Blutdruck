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
  `blutdruck-v10`). Reines Verschieben – keine Logik geändert. Weiterhin kein Build, kein Framework.
- **Speicher:** Messwerte liegen in der Browser-Datenbank (IndexedDB), mit `localStorage` als
  Spiegel/Fallback und einmaliger automatischer Migration. Beim Start wird dauerhafter Speicher
  angefordert (`navigator.storage.persist()`), Schutz gegen automatisches Löschen (Eviction/ITP).
- **Backup:** „Backup speichern" (Download), „Backup teilen" (Teilen-Menü / Web Share API; klappt
  das Teilen nicht, fragt ein Dialog, ob stattdessen heruntergeladen werden soll),
  „Auto-Backup in Datei" (immer dieselbe Datei via File System Access API). Bei verknüpfter Datei
  werden **Name** (nur der Dateiname – Browser geben aus Sicherheitsgründen keinen vollständigen
  Pfad her und können Datei/Ordner nicht im Datei-Manager öffnen) und die Aktionen „Jetzt sichern",
  „Datei ändern", „Verknüpfung lösen" gezeigt.
  „Backup wiederherstellen" (Backup-Datei laden – .txt oder ältere .json –, mit Statistik „X neu, Y aktualisiert").
  „Als CSV exportieren (Excel)" für die Auswertung.
- **Menü:** als **klappbare Abschnitte** (Daten & Backup, Anzeige, Verwalten) plus „Anleitung".
  Geöffnet über das **„Menü"-Icon unten rechts in der Tab-Bar** (Erfassen · Tabelle · Diagramm · Menü).
  Das Menü-Fenster ist schmaler als der Bildschirm, hat eine eigene Hintergrundfarbe (`--menu-bg`)
  und lässt ringsum Rand zum Raustippen. **Keine Trennlinien** mehr – der aufgeklappte Abschnitt
  hebt sich als **weiße Karte** mit Schatten ab; es ist **immer nur ein Abschnitt offen** (einen
  anderen öffnen schließt den vorigen). Das Fenster sitzt **unten am Bildschirmrand**
  (daumenfreundlich) und schließt nur bei echtem Tippen auf die Backdrop-Fläche (`e.target===dialog`).
  Aus der Anleitung führt ein „‹ Zurück"-Button wieder ins Menü; Schließen-Buttons heißen „Menü schließen".
- **Nicht unterstützte Funktionen** werden nicht versteckt, sondern **ausgegraut** mit kurzer
  Begründung (z. B. „Auf diesem Gerät nicht verfügbar").
- **Verwalten:** „Speicher-Status" (dauerhaft? wie viel belegt?) und „Alle Daten löschen"
  (mit Sicherheitsabfrage; die externe Backup-Datei bleibt dabei erhalten).
- **Anleitung:** kurzes, umgangssprachliches Hilfe-Pop-up für Anwender.
- **Fehler:** Wenn der Speicher voll ist (QuotaExceededError), erscheint ein Hinweis statt
  stillem Fehlschlag.
- **Meldungen (Toasts):** kurze Rückmeldungen unten als farbige Karte mit Icon in drei Kategorien –
  **Erfolg** (grün, Haken), **Hinweis** (gelb/amber, Dreieck) und **Fehler** (rot, Dreieck).
  4 s sichtbar, per **Wischen** zur Seite schließbar; helle Flächen → in Hell und Dunkel lesbar.
  Funktion `toast(msg, kind)` mit `kind ∈ success | notice | error` (Default `success`).

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

### Daten & Speicher
- **Einstellungen** ebenfalls in IndexedDB ablegen (aktuell nur in localStorage).

### Bedienung: Menü & Meldungen (Feinschliff)
- **Auto-Backup-Buttons überarbeiten:** Optik, Titel und Funktion der drei Buttons unter
  „Auto-Backup in Datei" („Jetzt sichern", „Datei ändern", „Verknüpfung lösen") genau prüfen und
  neu gestalten – der Nutzer ist mit dem aktuellen Stand noch nicht ganz zufrieden.
- **Menü-Fenster vergrößern:** Das Menü-Fenster ist nach Öffnen eines Abschnitts scrollbar, obwohl
  nach oben genügend Platz ist. Dadurch wird z. B. der Button „Menü schließen" abgeschnitten.
- **Menü-Position verfeinern (Layering):** Menü unten am Bildschirmrand, aber **oberhalb** der
  Toasts – die Toasts sollen **unter** dem Menü erscheinen, nicht davor/darüber.
- **Toasts prüfen:** Toasts, die über dem Menü eingeblendet werden, lassen sich nicht wegwischen.
  Überprüfung aller Toasts durchführen.

### Texte & Dokumentation
- **Anleitung (In-App-Hilfe) verbessern:** Die Erklärtexte sind noch nicht aussagekräftig genug
  und decken die wichtigsten Funktionen (z. B. die Backup-Lösung) nicht ab.
- **Vollständige App-Dokumentation erstellen** und die in dieser CLAUDE.md hinterlegten Einträge
  entsprechend übertragen.