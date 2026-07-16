# Arzt-Report – Datenspezifikation

Stand: 2026-07-13. Diese Datei beschreibt **was** der Arzt-Report rechnet und anzeigt –
nicht wie er aussieht. Gleiche Aufteilung wie die [dashboard-spezifikation.md](dashboard-spezifikation.md):

- **Fix (Logik/Daten):** Kennzahlen, Berechnung, Zeitfenster, Ampel-Regeln, Leerzustände.
  Das ist hier festgelegt, damit kein Entwurf an den Datenregeln vorbeigeht.
- **Offen (Aussehen → Claude Design):** Anordnung/Hierarchie, Farben, Schrift, Kachel- und
  Tabellen-Gestaltung, Grafik-Größe, genaue Text-Formulierungen, Seitenaufteilung.

**Zweck:** ein aufbereiteter, **druckbarer** Bericht (A4) für den Arztbesuch – lesefertig für Menschen,
im Gegensatz zum CSV-Export (Rohdaten). **Keine Diagnose, keine Bewertung** – nur beschreiben.

---

## 0. Grundlagen (gelten für alle Kennzahlen)

- **Datengrundlage:** jede Messung hat Zeitpunkt (`ts`), `sys`, `dia`, `pulse`, optional `note`.
  Das Datenmodell bleibt **unverändert** – keine Neu-Erfassung, keine Migration.
- **Durchschnitt** = einfacher Mittelwert über **alle Messungen** im Zeitraum (nicht pro Tag gewichtet).
- **Rundung:** alle angezeigten Zahlen gerundet – Blutdruck/Puls auf ganze Zahlen, Prozente auf ganze Prozent.
- **Format:** A4-Hochformat, gedacht für **Schwarz auf Weiß** (Ausdruck). Der Report sieht in Hell- und
  Dunkelmodus der App **gleich hell/weiß** aus.

---

## 1. Zeitraum (eigener Wähler im Report)

- Der Report hat einen **eigenen Von–Bis-Wähler**, unabhängig von Verlauf/Diagramm.
- **Standard:** die letzten 30 Tage.
- Der Kopf des Reports zeigt den gewählten **Zeitraum** (Von–Bis) und die **Anzahl** der Messungen darin.

---

## 2. Kennzahlen

### 2.1 Kopf / Übersicht
- App-Name / Titel „Blutdruck-Bericht" (o. ä.), Zeitraum, Anzahl Messungen, Erstellungsdatum.
- **Optional (Design entscheidet):** ein leeres **Namensfeld** zum handschriftlichen Ausfüllen
  (der Report kennt keinen Namen – die App speichert keinen).

### 2.2 Durchschnitt gesamt
- Ø `sys`, Ø `dia`, Ø `pulse` über alle Messungen im Zeitraum.
- Blutdruck mit **Gesamt-Ampelfarbe** einordnen (grün/gelb/rot über `category()` auf den Ø-Werten);
  Puls **ohne** Ampel (keine Schwellenwerte).

### 2.3 Durchschnitt nach Tageszeit
- Drei Fenster (wie in der App über `todOf`): **morgens** (`< 11 Uhr`), **tagsüber** (`11–17 Uhr`),
  **abends** (`≥ 17 Uhr`).
- Je Fenster: Ø `sys` / Ø `dia` (+ optional Ø `pulse`) und die Anzahl der Messungen darin.
- Medizinisch klassisch ist **morgens/abends** – „tagsüber" darf im Entwurf dezenter stehen oder,
  falls leer, entfallen.
- **Leerzustand je Fenster:** keine Messung → „—".

### 2.4 Min / Max
- Höchster und niedrigster Wert je `sys`, `dia`, `pulse` im Zeitraum.

### 2.5 Ampel-Verteilung
- Für jede Messung die **Gesamt-Ampel** (`category()`) bestimmen, je Farbe zählen → Anzahl **und** Prozent.
- Prozente ganzzahlig, so gerundet, dass die Summe **genau 100 %** ergibt.

### 2.6 Anteil über Zielwert
- Prozent der Messungen, die **nicht grün** sind (also „erhöht" **oder** „zu hoch").
- Rein beschreibend, keine Wertung.

### 2.7 Angewendete Schwellenwerte (Fußnote)
- Die im Report zugrunde gelegten Grenzen (`settings.thr`) ausweisen, z. B.
  „Erhöht ab 130/85, zu hoch ab 140/90 mmHg" – damit der Arzt weiß, worauf die Ampel beruht.
- Diese Werte sind vom Nutzer einstellbar; der Report zeigt die **aktuell** gültigen.

---

## 3. Verlaufsgrafik

- Sys- und Dia-Punkte über die Zeit, je in ihrer **eigenen** Ampelfarbe (`catVal`), plus
  gestrichelte **Ø-Linie** – dieselbe Logik wie im App-Diagramm (Variante A), aber
  **druck-optimiert**: hellere Flächen, größer, gut lesbar auf Papier.
- **Keine** Diagnose/Bewertung in der Grafik.
- Puls ist optional (schmales eigenes Feld, andere Einheit) – Design entscheidet, ob er in den
  Report gehört.

---

## 4. Werteliste (Tabelle)

- **Chronologisch** (Design entscheidet: neueste oder älteste zuerst; für Ärzte oft aufsteigend).
- Spalten: **Datum, Uhrzeit, Systolisch, Diastolisch, Puls, Notiz**.
- Sys/Dia dürfen je nach Wert in Ampelfarbe stehen (wie im Verlauf), müssen aber **auch in
  Schwarz-Weiß** eindeutig lesbar bleiben.
- Bei vielen Messungen darf die Tabelle über **mehrere Seiten** laufen (saubere Seitenumbrüche).

---

## 5. Leerzustände

- **Keine Messung im gewählten Zeitraum:** freundlicher Hinweis statt eines leeren Reports
  (z. B. „Für den gewählten Zeitraum liegen keine Messungen vor.").
- Einzelne leere Tageszeit-Fenster: „—" (siehe 2.3).

---

## 6. Bewusst NICHT im Report

- **Keine Bewertung/Diagnose**, keine Empfehlungen – nur Zahlen und beschreibende Sätze.
- Kein Name/keine Personendaten aus der App (die App speichert keine) – höchstens ein leeres
  Feld zum Ausfüllen.

---

## 7. Trennung Logik ↔ Design (Zusammenfassung)

| Fix (im Code) | Offen (mit Claude Design) |
|---|---|
| Welche Kennzahlen + Berechnung | Anordnung, Hierarchie, was groß/klein |
| Zeitfenster + eigener Von–Bis-Wähler | Kachel-/Tabellen-Layout, Grafikgröße |
| Ampel-Regeln (gesamt + pro Wert) | Farben/Schrift im Rahmen der Tokens (siehe 8) |
| Leerzustände (Regeln) | genaue Text-Formulierungen |
| A4-Druck, Schwarz auf Weiß | Kopfbereich, Namensfeld ja/nein, Seitenaufteilung |

---

## 8. Design-Tokens (helle Palette – für den Ausdruck)

Damit der Entwurf zum App-Look passt. Der Report ist **immer hell** (Druck auf Weiß).

- **Struktur:** Text `--ink:#131a26`, Nebentext `--muted:#68717f`, Fläche/Karte `--surf:#ffffff`,
  zarte Kachel `--surf2:#f2f5f9`, Linien `--line:#e5e9f0`, Seiten-Hintergrund `--bg:#eef1f6`.
- **Akzent (Standard „Kobalt"):** `#1E5FE0`, Schrift darauf weiß.
- **Ampel:** grün Fläche `#e7f6ec` / Balken `#16a34a` / Text `#15803d`;
  gelb `#fdf6ea` / `#e08600` / `#b26a00`; rot `#fdeaea` / `#dc2626` / `#c0261f`.
- **Puls:** Balken `#e11d68`, Text `#be185d`.
- **Schrift:** „Hanken Grotesk" (Gewichte 400–800). Zahlen tabellarisch (`tabular-nums`).
- **Form:** Karten-Radius ~22 px, ruhige, klinisch-kühle Anmutung wie der Rest der App.
