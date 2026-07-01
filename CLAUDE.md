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
- **Code-Struktur (Umbau Stufe 1, erledigt):** Aufgeteilt in `index.html` (Struktur, ~285 Z.),
  `styles.css` (~290 Z.) und `app.js` (~790 Z.); eingebunden per `<link rel="stylesheet">` und
  `<script src="./app.js" defer></script>`. `sw.js` cacht alle Dateien offline (Cache
  `blutdruck-v13`). Reines Verschieben – keine Logik geändert. Weiterhin kein Build, kein Framework.
- **Speicher:** Messwerte **und Einstellungen** liegen in der Browser-Datenbank (IndexedDB), mit
  `localStorage` als Spiegel/Fallback und einmaliger automatischer Migration. Einstellungen liegen
  im `meta`-Store unter dem Schlüssel `'settings'` (`idbGetMeta`/`idbSetMeta`); nach dem Laden aus
  IndexedDB wird der `localStorage`-Spiegel sofort wieder aufgefüllt (kein Theme-Aufblitzen beim
  nächsten Start). Speichern ist zweigeteilt: `persistSettings()` (nur ablegen) vs. `saveSettings()`
  (ablegen **+** Auto-Backup-Datei planen) – interne Buchhaltung (`markDirty`/`markBackedUp`/Snooze)
  nutzt bewusst `persistSettings()`, sonst entstünde beim automatischen Schreiben eine
  Endlosschleife. Beim Start wird dauerhafter Speicher angefordert
  (`navigator.storage.persist()`), Schutz gegen automatisches Löschen (Eviction/ITP).
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
  - **Backup-Format (v2):** Die Datei enthält jetzt `{app, version, exportedAt, entries, settings}`
    statt nur eines reinen `entries`-Arrays (`backupData()`/`backupSettings()`). Gesichert werden nur
    die **Vorlieben** (`colorDots`, `guideLines`, `theme`, `reminderDays`, `thr`) – geräte-interne
    Erinnerungs-Merker (`firstDirtyAt`, `snoozeUntil`) nicht. Ältere Backups (reines Array) bleiben
    les- und wiederherstellbar; `mergeEntriesFromData` erkennt beide Formen.
  - **Einstellungen-Rückfrage beim Wiederherstellen** (`#restoreDlg`, eigenes Fenster statt
    Browser-`confirm`, da Knopf-Texte sonst nicht anpassbar sind): Enthält ein eingelesenes Backup
    auch Einstellungen, erscheint „Werte und Einstellungen übernehmen" (primärer Knopf) /
    „Nur die Werte übernehmen" (Text-Knopf); Raustippen/Esc = nur Werte (sichere Vorgabe). Ausgelöst
    von `offerSettingsRestore()`, geteilt von „Wiederherstellen" (`importJSON`) und
    „Auswählen"/„Ändern" (`pickBackupFile`). Messwerte werden in jedem Fall zusammengeführt.
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
- **Daten** (Abschnitt, vormals „Verwalten"): „Als CSV exportieren (Excel)" (für die Auswertung),
  „Alle Daten löschen" (mit Sicherheitsabfrage; die externe Backup-
  Datei bleibt dabei erhalten) und – darunter – eine Info-Zeile mit der **Speicherbelegung**
  (belegt von Kapazität · Prozent, sofern der Browser eine Quota liefert).
  Der frühere Persistenz-Status/„Aktivieren"-Link entfiel (dauerhafter Speicher wird beim Start
  automatisch angefordert).
- **Anleitung:** umgangssprachliches Hilfe-Pop-up (`helpDlg`) mit 10 Abschnitten, inkl.
  Automatischem Backup, Statistik-Hinweis und App-Installation.
- **Fehler:** Wenn der Speicher voll ist (QuotaExceededError), erscheint ein Hinweis statt
  stillem Fehlschlag.
- **Meldungen (Toasts):** kurze Rückmeldungen unten als farbige Karte mit Icon in drei Kategorien –
  **Erfolg** (grün, Haken), **Hinweis** (gelb/amber, Dreieck) und **Fehler** (rot, Dreieck).
  4 s sichtbar, per **Wischen** zur Seite schließbar; helle Flächen → in Hell und Dunkel lesbar.
  Funktion `toast(msg, kind)` mit `kind ∈ success | notice | error` (Default `success`). Bei offenem
  Fenster (Dialog) wird der Toast **in das Fenster gerendert**, damit er über dem Menü sichtbar **und**
  wischbar bleibt (ein modales Fenster macht alles außerhalb „unberührbar"/inert); beim Schließen des
  Fensters wandert eine noch sichtbare Meldung zurück in den Body.
- **Bestätigen-Dialoge (`askConfirm`):** Die drei früheren Browser-`confirm()`-Popups sind durch
  **einen** eigenen, gestaltbaren Dialog (`#confirmDlg`) ersetzt – einheitlicher Look in Hell/Dunkel,
  mit Symbol-Kreis im Kopf. Zentrale Funktion `askConfirm(opts)` (Promise → `true`/`false`). Optionen:
  `icon` (`trash`/`info`) + `tone` (`danger` = rot / `notice` = amber), `title`, `message` **oder**
  `messageHTML` (für Fettdruck, nur App-eigene Texte), `confirmLabel`/`cancelLabel`, `danger` (roter
  Füll-Knopf `.btn-fill-danger` statt blauem `.btn-fill`), `previewHTML` (zentrierte Vorschau-Karte),
  `detailsText` (ausklappbares `<details>` „Technische Details"), `noteText` (Hinweiszeile mit
  Info-Symbol) und `requireCheck` (Pflicht-Häkchen – hält den Bestätigen-Knopf deaktiviert, bis
  angekreuzt; eigenes Kästchen: rot umrandet, gerundet, ohne Füllung). Der Meldungstext ist bewusst
  **gedämpft** (`--muted`), hervorgehobene Teile via `<b>` in `--text`. Drei Aufrufstellen:
  **Eintrag löschen** (`#edDelete`) mit Eintrags-Vorschau (Datum + Werte in `--c-sys/-dia/-pulse`) und
  rotem „Löschen"; **Teilen-Fallback** in `shareBackup()` (amber, blaues „Speichern", Diagnose-Info in
  „Technische Details" verstaut); **Alle Daten löschen** (`clearAllData()`) mit fetter Anzahl,
  Info-Zeile zur erhaltenen Backup-Datei und Bestätigungs-Häkchen. Aufräumen des Zusatz-Blocks
  (`#confirmExtra`) passiert beim **Aufbau**, nicht im `close`-Handler (sonst könnte ein verzögertes
  Schließen-Ereignis frischen Inhalt leeren). `#confirmDlg` steht im HTML **nach** `editDlg`/`menuDlg`
  (Toast-im-Dialog-Mechanismus). Die bestehenden Erfolgs-Toasts nach der Aktion bleiben erhalten.

## Namens-Konvention (Backup vs. CSV)
„Backup …" = vollständige Sicherung/Wiederherstellung (Dateiendung **.txt**, Inhalt JSON, originalgetreu;
.txt wegen Android-Teilen-Kompatibilität – Wiederherstellen akzeptiert .txt **und** ältere .json).
„… CSV …" = für Excel/Auswertung (einseitig, nicht originalgetreu).

## Geparkte Aufgaben

Stand 2026-07-01 gegen die Codebase geprüft und neu nach Priorität geordnet.
*Legende — Aufwand: klein / mittel / groß · Machbarkeit: problemlos / mit Hürde / heikel.*

### 1. UI/UX-Modernisierung (zusammenhängender Block)
*Design zuerst als Grundlage, dann die Komponenten gleich im neuen Look – nicht zweimal anfassen.*
- **Design/Look modernisieren** — mittel · problemlos. Farben & Farbverläufe, Schrift(größen),
  Icons/Bilder, Buttons. Läuft größtenteils über die zentralen CSS-Variablen (`:root` in
  [styles.css](styles.css)), inkl. Dark Mode.
- **Diagramm + Schwellenwert-Darstellung entschlacken** — mittel · problemlos. **Dringend.** Heute
  zeichnet `renderChart` bis zu 7 Linien in eine Grafik (3 Messwerte + 4 gestrichelte Schwellen) →
  unübersichtlich. Mögliche Richtungen: Schwellen als farbige Hintergrund-Zonen statt Linien;
  Sys/Dia und Puls in getrennte Diagramme. Konkrete Richtung später am echten Bild (Vorschau)
  entscheiden. Verzahnt mit dem 4-Zahlen-Schwellenwert-Editor, der dadurch evtl. schlanker wird.
- **Statistik-Bereich zu „Dashboard" ausbauen & modernisieren** — mittel · problemlos. `renderStats`
  + CSS aufwerten und zur Übersicht erweitern: letzter Wert mit Ampel-Status, Trend 7/30 Tage
  (vs. Vorperiode), Verteilung grün/gelb/rot, Backup-Status. (Vereint „Statistik modernisieren"
  und „Dashboard".)
- **Filter für Tabelle und Diagramm vereinheitlichen** — mittel · mit Hürde. Heute hat die Tabelle
  das volle Filterpanel, das Diagramm nur Zeitraum-Chips. Logik ist schon geteilt (`filters`,
  `getFiltered`), aber `syncFilterInputs` greift feste IDs (`#f_*`) → für zwei Panels einen
  geteilten Filter bzw. Klassen statt doppelter IDs nötig.

### 2. Weitere Features
- **Arzt-Report (Druck/PDF)** — mittel–groß · problemlos. Aufbereiteter, druck-/teilbarer Bericht:
  Mittelwerte (idealerweise morgens/abends getrennt), Min/Max, Anteil über Zielwert, Verlaufsgrafik,
  Werteliste – via `window.print` + Druck-CSS (build-frei). Reine Datenaufbereitung, **keine
  Diagnose/Bewertung**. Geht über den CSV-Export (Rohdaten) hinaus.
- **Auto-Wiederherstellung** — mittel · mit Hürde. Beim Start, wenn App leer **und** Datei verknüpft
  (`idbGetMeta('backupHandle')`): Berechtigung prüfen → bei `granted` lesen + `mergeEntriesFromData`.
  *Hürde:* Datei-Berechtigung erlischt oft nach Browser-Neustart und braucht eine Nutzer-Geste →
  Fallback-Knopf nötig.
  *Voraussetzung – Lösch-Protokoll (Tombstones):* Schon heute kann der Merge gelöschte Einträge
  zurückbringen; beim automatischen Start-Merge wäre das besonders störend. Daher gelöschte IDs
  protokollieren, damit sie beim Zusammenführen nicht wieder auftauchen.
- **Vollständige App-Dokumentation** — mittel · problemlos. Quelle ist die **gesamte Codebase**
  ([index.html](index.html), [styles.css](styles.css), [app.js](app.js), `sw.js`,
  `manifest.webmanifest`). Zwei Teile:
  - *Anwender-Teil:* alle Funktionen aus Nutzersicht + Tipps/Best Practices.
  - *Technischer Teil:* nur die **wichtigsten, miteinander verknüpften** Funktionen, sodass
    Abhängigkeiten und Prozessflows erkennbar werden (z. B. `saveEntries → idbWriteAll →
    scheduleAutoBackup → autoBackupIfLinked → writeToHandle`; geteilter Merge-Kern
    `mergeEntriesFromData`; Start-Sequenz `init → requestPersistence → initStorage`).
  - *Visualisierung:* Flows als **Grafiken** (build-frei, z. B. Mermaid in Markdown; Alternative SVG).
  Danach kann diese CLAUDE.md auf reinen Projektkontext verschlankt werden.

### 3. Zurückgestellt (niedrige Priorität)
- **Umbau Stufe 2 – JS in Module** (`storage.js`/`backup.js`/`chart.js`/`ui.js`, eingebunden per
  `<script type="module">`) — mittel · problemlos (kein Logikwechsel, aber Sorgfalt wegen vieler
  gegenseitiger Abhängigkeiten, allen voran Backup/Auto-Backup und Einstellungen/Theme, die quer
  durch mehrere künftige Module greifen würden). War bisher an Profile gekoppelt, damit Speicher/
  Backup nicht zweimal umgebaut werden – dieser Grund entfällt, da Profile gestrichen ist. Bleibt
  für sich genommen sinnvoll: `app.js` ist mit ~790 Zeilen noch überschaubar, würde aber mit jeder
  weiteren Funktion unübersichtlicher, und eine Aufteilung nach Zuständigkeit passt zum bisherigen
  Vorgehen (siehe Stufe 1). Keine neue technische Hürde durch `type="module"`: Die App verlangt als
  PWA ohnehin einen http(s)/localhost-Kontext (wegen des Service Workers), das sonst übliche
  `file://`-CORS-Problem von ES-Modulen entsteht also nicht zusätzlich; `sw.js` müsste nur um die
  neuen Modul-Dateien ergänzt werden. Ohne Team aber ohne Zeitdruck – zurückstellen, bis entweder
  `app.js` spürbar unhandlich wird oder ohnehin größere Eingriffe an Speicher/Backup anstehen.
  (Stufe 1 – CSS & JS auslagern – ist erledigt, siehe „Aktueller Stand".)

### 4. Gestrichen (geprüft 2026-06-30)
- **CSV-Import** — redundant zu „Backup → Wiederherstellen"; CSV hat keine `id` → Dubletten,
  fehleranfälliges Datums-Parsen. (CSV-**Export** bleibt, ist fertig.)
- **Personalisierung (Alter/Fitness → Zielwerte)** — manueller Schwellenwert-Editor (`settings.thr`)
  deckt den Bedarf ab; automatische Ableitung medizinisch heikel.
- **Backup-teilen-Logik prüfen** — erledigt: „teilen", „speichern" und Auto-Backup bauen ihre Datei
  **immer frisch aus `entries`** (`backupBlob`); keine Mehrdeutigkeit zwischen mehreren Dateien.
- **Profile** (mehrere Personen, eigene Backup-Datei je Profil) — Grundsatzentscheidung getroffen
  (2026-07-01): wird nicht umgesetzt. War nie über die Doku hinaus begonnen, kein Code betroffen.
  „Umbau Stufe 2" war an dieses Vorhaben gekoppelt und ist oben entsprechend angepasst.