# Dashboard – Datenspezifikation

Stand: 2026-07-02. Diese Datei beschreibt **was** das Dashboard rechnet und anzeigt –
nicht wie es aussieht.

- **Fix (Logik/Daten):** Kennzahlen, Berechnung, Zeitfenster, Ampel-Regeln, Leerzustände.
  Das ist hier festgelegt, damit kein Entwurf an den Datenregeln vorbeigeht.
- **Offen (Aussehen → Claude Design):** Anordnung/Hierarchie, Farben, Schrift, Kachel- und
  Diagramm-Gestaltung, Tabellen-Darstellung, genaue Text-Formulierungen.

---

## 0. Grundlagen (gelten für alle Kennzahlen)

- **Datengrundlage:** jede Messung hat Zeitpunkt (`ts`), `sys`, `dia`, `pulse`.
  Das Datenmodell bleibt **unverändert** – keine Neu-Erfassung, keine Migration.
- **Zeitfenster sind rollierend ab jetzt:**
  „letzte 7 Tage" = Messungen der letzten 168 Stunden, „letzte 30 Tage" = letzten 720 Stunden.
- **Durchschnitt** = einfacher Mittelwert über **alle Messungen** im Fenster
  (nicht pro Tag gewichtet). *Option für später: pro Tag mitteln, dann die Tage – fairer, wenn
  an manchen Tagen viel öfter gemessen wird. Für den Start bewusst einfach gehalten.*
- **Rundung:** alle angezeigten Zahlen gerundet – Blutdruck/Puls auf ganze Zahlen,
  Prozente auf ganze Prozent.

---

## 1. Kennzahlen

### 1.1 Letzte Messung (Kopfelement)
- **Zweck:** „Wie stehe ich gerade?"
- **Inhalt:** Sys/Dia, Puls, Zeitpunkt, **Gesamt-Ampelfarbe** (`category()`).
- **Fenster:** die jüngste einzelne Messung (kein Zeitfenster).
- **Zeitangabe:** absolut (Datum/Uhrzeit) *und* relativ („vor 3 Std.") beide verfügbar –
  welche gezeigt wird, entscheidet Design.
- **Leerzustand:** „Noch keine Messung erfasst."

### 1.2 Ø Sys/Dia (7 Tage) + Trend
- **Zweck:** geglätteter aktueller Stand + Richtung.
- **Berechnung:** Mittelwert von `sys` und `dia` im 7-Tage-Fenster.
  Trend = Ø(letzte 7 Tage) − Ø(die 7 Tage davor), **je Wert**, in mmHg.
- **Vorzeichen:** − = gesunken (↓), + = gestiegen (↑), ~0 = gleich (→).
  Pfeil **neutral** halten (keine Wertung gut/schlecht – die Farbe trägt die Gesamt-Ampel).
- **Fenster:** 0–7 Tage; Vergleichszeitraum 7–14 Tage.
- **Leerzustand:** keine Werte in 7 Tagen → „—". Trend nur zeigen, wenn **beide** Fenster
  mindestens 1 Messung haben (sonst kein Trend). Braucht praktisch ~14 Tage Daten.
- **Darstellung (Empfehlung, Design entscheidet):** Trend **an der Durchschnitts-Kachel**
  statt als eigene, bezuglose Kachel – z. B. groß `132/82`, klein `↓ 4 / ↓ 2 vs. Vorwoche`.

### 1.3 Ø Puls (7 Tage) + Trend
- Wie 1.2, aber für `pulse`. **Keine Ampel** (Puls hat keine Schwellenwerte).

### 1.4 Ampel-Verteilung (30 Tage) + Anzahl
- **Zweck:** Gesamtbild „wie oft im grünen/gelben/roten Bereich".
- **Berechnung:** für jede Messung im Fenster `category()` bestimmen, je Farbe zählen → Prozent.
  Zusätzlich die **Anzahl** der Messungen im Fenster ausweisen (ordnet die Prozente ein:
  8 % von 24 heißt etwas, 8 % von 3 nicht).
- **Rundung:** Prozente ganzzahlig, so runden, dass die Summe **100 %** ergibt.
- **Fenster:** rollierende 30 Tage.
- **Leerzustand:** 0 Messungen → „Noch keine Daten in den letzten 30 Tagen."
- **Darstellung (Design):** z. B. gestapelter Balken; Anzahl daneben („aus 24 Messungen").

---

## 2. Ampel-Logik (geteilt mit Diagramm & Tabelle)

- **Gesamt-Ampel** (`category()`, bleibt wie heute):
  rot, wenn `sys ≥ sysR` **oder** `dia ≥ diaR`; sonst gelb, wenn `sys ≥ sysY` **oder**
  `dia ≥ diaY`; sonst grün. Kurz: „der schlechtere von beiden".
- **Ampel pro Einzelwert** (neu, kleine Ergänzung): eine Funktion `catVal(wert, gelb, rot)`
  → grün/gelb/rot. Sys mit `sysY/sysR`, Dia mit `diaY/diaR`. **Puls: keine** (keine Schwellen).
- **Konsistenz:** die Gesamt-Ampel ist der schlechtere der beiden Einzel-Ampeln – beide Sichten
  passen zusammen.
- **Schwellen** bleiben bei **zwei je Wert** (grün/gelb/rot), weiter editierbar (`settings.thr`).

---

## 3. Konsequenz fürs Diagramm (Variante A – farbige Punkte)

- Sys- und Dia-Punkt je in ihrer **eigenen** Ampelfarbe (über `catVal`) → dürfen sich
  unterscheiden (z. B. Sys rot, Dia grün).
- **Keine** gestrichelten Schwellen-Linien mehr im Diagramm (ersetzt durch die Punktfarbe).
- Puls als **schmales eigenes Feld** (andere Einheit), ohne Ampel.
- Tabellen-Darstellung der Einzel-Ampeln: **offen, mit Claude Design** (zwei Punkte? gefärbte
  Zahlen? Punkt + Gesamt-Ampel daneben?). Logik liefere ich, Aussehen macht ihr.

---

## 4. Bewusst (noch) nicht im Dashboard

- **Morgens/abends getrennt** – später möglich (die Uhrzeit steckt in `ts`), aktuell nicht nötig.
- **Zielwert-Abgleich** (Schnitt gegen `settings.thr`) – optional, später entscheidbar.
- **Keine Bewertung/Diagnose** – nur beschreiben, nicht einordnen.

---

## 5. Trennung Logik ↔ Design (Zusammenfassung)

| Fix (bei mir / im Code) | Offen (mit Claude Design) |
|---|---|
| Welche Kennzahlen | Anordnung, Hierarchie, was groß/klein |
| Berechnung + Zeitfenster | Farben, Schrift, Kachel-Layout |
| Ampel-Regeln (gesamt + pro Wert) | Diagramm-Feinschliff, Tabellen-Darstellung |
| Leerzustände (Regeln) | genaue Text-Formulierungen |
