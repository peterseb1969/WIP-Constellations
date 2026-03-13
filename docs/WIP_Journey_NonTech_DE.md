# Was wäre, wenn all deine persönlichen Daten an einem Ort leben würden?

*Ein Bericht vom ersten Tag eines Experiments mit KI-gebauter Software und persönlicher Datenhoheit.*

---

## Das Problem, von dem du nicht wusstest, dass du es hast

Du nutzt wahrscheinlich Dutzende Apps, die etwas über dich wissen. Deine Banking-App kennt deine Transaktionen. Dein Fitness-Tracker kennt deine Schritte. Dein Energieversorger kennt deinen Stromverbrauch. Die Kundenkarte deines Supermarkts weiss, was du isst. Dein Arbeitgeber weiss, was du verdienst.

Aber keine dieser Apps spricht mit den anderen.

Willst du wissen, wie viel deiner Lebensmittelausgaben für gesundes Essen und wie viel für Snacks draufgeht? Dann müsstest du deine Banktransaktionen mit deinen Supermarkt-Quittungen und einer Nährwertdatenbank abgleichen. Willst du wissen, was dein Auto-Pendeln wirklich kostet — inklusive Treibstoff, Versicherung, Wartung, Wertverlust und Parkgebühren — im Vergleich zu einem GA? Du bräuchtest Daten aus fünf verschiedenen Quellen, die kein gemeinsames Format haben.

Heute ist das einzige Werkzeug, das so etwas kann, eine Tabellenkalkulation. Und die Person, die sie bedient, bist du — manuell Zahlen zwischen Apps kopierend, hoffend dass die Formate passen, und von vorne anfangend, wenn sich etwas ändert.

**Was wäre, wenn es einen einzigen Ort gäbe, an dem all diese Daten leben könnten — strukturiert, verknüpft und abfragbar?**

Genau darum geht es in diesem Experiment.

---

## Was ist WIP?

**World In a Pie (WIP)** ist eine Software-Plattform — man kann sie sich als universellen Aktenschrank für strukturierte Daten vorstellen. WIP weiss nichts über Finanzen, Energie, Gesundheit oder Fahrzeuge. Stattdessen bietet es Bausteine:

- **Vokabulare**: Standardisierte Listen erlaubter Werte. Zum Beispiel eine Liste von Währungen (CHF, EUR, USD) oder eine Liste von Transaktionstypen (Debitkarte, Banküberweisung, Dauerauftrag). Diese stellen sicher, dass alle die gleiche Sprache sprechen.
- **Vorlagen**: Baupläne, die festlegen, wie ein Datensatz aussehen muss. Eine Vorlage für «Banktransaktion» sagt: Jede Transaktion muss ein Datum, einen Betrag, eine Währung (aus dem Währungsvokabular) und eine Kontoverbindung haben. Wenn du etwas speichern willst, das nicht zum Bauplan passt, lehnt das System es ab.
- **Dokumente**: Die eigentlichen Daten, validiert gegen eine Vorlage. Jeder Datensatz wird geprüft, versioniert (das System merkt sich jede Änderung) und mit verwandten Daten in anderen Vorlagen verknüpft.

WIP ist es egal, was du speicherst. Eine Rezeptsammlung, ein Briefmarken-Katalog, eine klinische Studiendatenbank — alles wird gleich behandelt. Die Stärke liegt darin, dass alles die gleiche Infrastruktur nutzt: die gleiche Validierung, die gleiche Versionierung, die gleiche Abfragesprache.

**WIP läuft auf einem Raspberry Pi** — einem kreditkartengrossen Computer für rund CHF 80. Deine Daten bleiben bei dir zuhause, in deinem Netzwerk, unter deiner Kontrolle. Kein Cloud-Abo. Kein Datenhandel. Keine Nutzungsbedingungen, die sich ohne Vorwarnung ändern.

---

## Die zwei grossen Ideen, die getestet werden

### Idee 1: Deine Daten sind vernetzt mehr wert

Eine einzelne App, die deine Banktransaktionen speichert, ist nützlich. Eine zweite App für deine Kassenzettel ist auch nützlich. Aber wenn beide Apps ihre Daten in WIP speichern, wird etwas Neues möglich: Du kannst Fragen stellen, die beide Datensätze übergreifen.

«Ich habe letzten Dienstag CHF 87.50 bei der Migros ausgegeben.» Das sagt die Banktransaktion. Aber der Kassenzettel verrät, dass CHF 12.90 Wein war, CHF 34.60 Lebensmittel und CHF 40 ein Haushaltsartikel. Mit beiden Quellen in WIP kannst du fragen: *«Wie viel gebe ich pro Monat für Alkohol aus?»* — eine Frage, die keine der beiden Apps allein beantworten könnte.

Nun stell dir vor, du fügst eine dritte App für deinen Energieverbrauch hinzu und eine vierte für dein Haus-Equipment. Plötzlich kannst du fragen: *«Ich habe letzten März die Fenster ausgewechselt. Wie hat sich das messbar auf meine Heizrechnung ausgewirkt?»* Diese Frage braucht Zählerstandsdaten, Finanzdaten, die Spezifikationen deiner Fenster und Wetterdaten — alles aus verschiedenen Apps, alles beantwortbar, weil die Daten am selben Ort liegen.

Das nennen wir den **Netzwerkeffekt auf persönliche Daten**: Jede neue App steigert nicht nur ihren eigenen Wert — sie erhöht den Wert jeder App, die bereits im System ist. Die Verbindungen zwischen den Datensätzen wachsen schneller als die Datensätze selbst.

**Niemand würde eine spezielle Integration zwischen seiner Weinsammlungs-App und dem Schulgeld-Tracker seiner Kinder bauen.** Aber wenn beide ihre Daten bereits in WIP speichern, ist die Verknüpfung einfach da — sie wartet nur darauf, gefragt zu werden.

### Idee 2: KI kann die Apps bauen — wenn man ihr Leitplanken gibt

Hier wird es richtig interessant. Eine universelle Datenplattform ist nur nützlich, wenn es Apps darauf gibt. Apps zu bauen braucht Zeit, Fachwissen und Geld. Was, wenn eine KI das könnte?

Nicht die Art von KI, die eine hübsche Demo generiert, die beim echten Einsatz zusammenfällt. Sondern eine, die funktionierende Software gegen eine echte Plattform baut, mit echter Datenvalidierung, echtem Fehler-Handling und echten Benutzeroberflächen.

Die entscheidende Erkenntnis: **Eine KI, die von Null anfängt, muss Hunderte von Entscheidungen treffen, und viele davon werden falsch sein.** Welche Datenbank? Wie Fehler behandeln? Wie Eingaben prüfen? Wie Versionierung umsetzen? Jede Entscheidung ist eine Gelegenheit für Inkonsistenz, Fehler und technische Schulden.

Aber eine KI, die auf WIP aufbaut, muss die meisten dieser Entscheidungen gar nicht treffen. WIP trifft sie:

- *«Soll ich die Daten validieren?»* — WIP validiert automatisch. Die KI kann keine ungültigen Daten speichern.
- *«Wie handle ich Versionierung?»* — WIP versioniert automatisch. Denselben Datensatz zweimal einreichen ergibt Version 2, kein Duplikat.
- *«Wie verknüpfe ich zusammengehörige Daten?»* — WIP löst Referenzen automatisch auf. Die KI sagt «dieser Kassenzettel gehört zu jener Transaktion» und WIP stellt sicher, dass die Verknüpfung gültig ist.
- *«Wie mache ich die Daten abfragbar?»* — WIP synchronisiert automatisch in eine SQL-Datenbank. Keine Pipeline nötig.

Der Entscheidungsspielraum der KI wird auf die Fragen reduziert, die wirklich zählen: Welche Daten braucht der Benutzer? Wie sollen die Bildschirme aussehen? Wie soll der Import-Prozess ablaufen? Das sind die Fragen, bei denen menschlicher Input wesentlich ist — und die KI kann sie stellen, Antworten bekommen und entsprechend bauen.

**WIP ist die Leitplanke, die KI-gebaute Software realistisch macht.** Nicht indem es einschränkt, was die KI tun kann, sondern indem es sicherstellt, dass die Infrastruktur-Entscheidungen bereits richtig getroffen sind.

---

## Was tatsächlich passiert ist (an einem Tag)

### Morgens: Die Vision entwerfen

Wir begannen damit, aufzuzeichnen, wie ein persönliches Daten-Ökosystem aussehen könnte. Nicht eine App — eine Konstellation von Apps:

**Persönliche Finanzen** (das Fundament): Eine App für Bankauszüge, eine für Kassenzettel, eine für wiederkehrende Kosten (Abos, Versicherungen), eine für Investitionen. Jede für sich nützlich, aber zusammen ergeben sie ein vollständiges Finanzbild — Nettovermögen, echte Sparquote, Ausgabenaufschlüsselung bis zum einzelnen Produkt.

**Energie & Nachhaltigkeit**: Apps, die deinen Strom- und Gasverbrauch erfassen, deine Solaranlage überwachen, das Raumklima messen. Kombiniert mit Wetterdaten und Energiepreisen beantworten sie: *«Ist meine Heizrechnung hoch, weil es kalt war, oder stimmt etwas nicht?»*

**Hausverwaltung**: Ein Equipment-Register (was du besitzt, wo die Anleitung ist, wann die Garantie abläuft), ein Wartungsprotokoll, ein Renovierungsplaner. Kombiniert mit Finanzdaten: *«Was hat mich mein Haus dieses Jahr insgesamt gekostet?»* Kombiniert mit Energiedaten: *«Hat die neue Isolation tatsächlich meine Heizrechnung gesenkt?»*

**Fahrzeug & Mobilität**: Tankbuch, Fahrtenkategorisierung, Servicehistorie. Kombiniert mit allem anderen: *«Was kostet mich das Pendeln mit dem Auto wirklich, alles eingerechnet — und ist ein GA günstiger?»*

Jede Konstellation wurde mit konkreten Datenmodellen, spezifischen Beispielen und — entscheidend — den Querverbindungen dokumentiert, die das Ganze mehr machen als die Summe seiner Teile.

### Nachmittags: Wirklich bauen

Dann begann eine KI (Claude, von Anthropic) mit dem Bau. Nach einem strukturierten Vier-Schritte-Prozess:

**Schritt 1 — Erkunden:** Die KI verband sich mit einer laufenden WIP-Instanz und inventarisierte, was bereits vorhanden war. Wie der erste Tag eines neuen Mitarbeiters — erst umschauen, bevor man etwas anfasst.

**Schritt 2 — Entwerfen:** Die KI schlug ein Datenmodell für den Statement Manager vor: welche Vokabulare gebraucht werden (Währungen, Kontotypen, Transaktionskategorien), welche Vorlagen (Konten, Transaktionen, Lohnabrechnungen), und entscheidend: was jeden Datensatz eindeutig macht (die IBAN für Konten, die Transaktionsnummer der Bank für Buchungen). Der Mensch prüfte und genehmigte. Kein Code wurde geschrieben, bevor das Design bestätigt war.

**Schritt 3 — Datenschicht umsetzen:** Die KI erstellte die Vokabulare und Vorlagen in WIP, dann testete sie mit echten Schweizer Bankdaten (UBS- und Yuh-Exporte, eine echte Lohnabrechnung). Sie überprüfte, dass der doppelte Import desselben Auszugs keine Duplikate erzeugt, dass ungültige Daten abgelehnt werden und dass Verknüpfungen zwischen Datensätzen funktionieren.

**Schritt 4 — Benutzeroberfläche bauen:** Die KI baute eine Web-Anwendung — ein echtes, interaktives Werkzeug mit Seiten für Konten, Transaktionen, Lohnabrechnungen und Datenimport. Mit einem vorgegebenen Set moderner Web-Technologien, einheitlichem Styling und ordentlichem Fehler-Handling.

Am Abend lief ein funktionierender Statement Manager. Kein Mockup. Eine echte App, die echte Finanzdaten in WIP speichert, mit validierten Schemata, versionierten Datensätzen und verknüpften Entitäten.

---

## Was schiefging (und warum das der Punkt ist)

Ein Experiment, das nur von Erfolgen berichtet, ist kein Experiment — es ist ein Verkaufsgespräch. Hier ist, was wirklich schiefging und was wir daraus gelernt haben:

### Die Dokumentation der KI war falsch

Eine Zwischenkomponente (der «MCP-Server» — eine Brücke, die der KI die Interaktion mit WIP ermöglicht) hatte drei falsche Feldnamen in ihrer Dokumentation. Die KI, die sie geschrieben hatte, verwendete Feldnamen aus dem Gedächtnis, anstatt das tatsächliche System zu prüfen. Zwei der drei Fehler waren von der gefährlichen Sorte: WIP hätte die Daten scheinbar akzeptiert, aber die Validierung stillschweigend übersprungen. Man hätte das Problem erst Wochen später entdeckt, wenn man seine Daten abfragt.

**Die Lösung:** Die Dokumentation wird jetzt automatisch aus demselben Quellcode generiert, der die Validierung erzwingt. Die Feldnamen können nicht auseinanderlaufen, weil sie vom selben Ort stammen.

**Die Lektion:** Wenn eine KI Dokumentation schreibt, prüfe sie gegen das System, das sie dokumentiert. Selbstsicherheit ist nicht dasselbe wie Korrektheit.

### Der KI ging der «Arbeitsspeicher» aus

KI-Assistenten haben ein begrenztes Arbeitsgedächtnis (das sogenannte «Kontextfenster»). Eine komplette Anwendung in einer einzigen Sitzung zu bauen, überschritt dieses Limit. Aller nicht gespeicherter Code ging verloren. Das Datenmodell (in WIP gespeichert) überlebte, aber die Benutzeroberfläche musste neu gebaut werden.

**Die Lösung:** Schrittweise bauen — ein Feature nach dem anderen, nach jedem speichern. Wenn das Gedächtnis der KI zurückgesetzt wird, macht sie beim letzten Speicherpunkt weiter, nicht bei Null.

**Die Lektion:** KI-Coding funktioniert am besten in fokussierten Sitzungen, nicht in Marathons. Genau wie bei menschlichen Entwicklern, eigentlich.

### Die KI fragte nie nach dem Benutzererlebnis

Die KI baute eine technisch korrekte App, ohne ein einziges Mal zu fragen: «Was soll der Hauptbildschirm zeigen? Wie soll die Navigation funktionieren? Was ist das wichtigste Feature?» Sie traf jede Designentscheidung stillschweigend, basierend auf vernünftigen Standardwerten.

**Die Lösung:** Ein obligatorischer Kontrollpunkt vor dem Bau der Oberfläche. Die KI muss ihren Plan beschreiben — Seiten, Navigation, Arbeitsabläufe — und auf die Freigabe des Menschen warten. Zehn Zeilen Beschreibung, die Hunderte Zeilen unnötigen Code verhindern.

**Die Lektion:** Man muss der KI sagen, dass sie fragen soll — nicht nur bauen. Das Datenmodell hatte einen Genehmigungsschritt; die Benutzeroberfläche nicht. Jetzt schon.

### Das Datenmodell wurde nicht in Dateien gesichert

Die KI erstellte die Datenstrukturen interaktiv in WIP — schnell und effizient. Aber diese Strukturen existierten nur im laufenden System. Wenn die SD-Karte des Raspberry Pi versagen würde, oder jemand das Experiment replizieren wollte, gäbe es keine Möglichkeit, das Datenmodell nachzubilden.

**Die Lösung:** Nach jeder Designphase exportiert die KI die Datenstrukturen in Dateien, die zusammen mit dem Code versioniert werden. Ein einzelner Befehl kann alles auf einem frischen System wiederherstellen.

**Die Lektion:** Das gleiche Prinzip, das jedes Software-Team kennt: Mach keine Änderungen an einem laufenden System und hoffe, dass sich jemand erinnert. Schreib es in eine Datei, die wiederholt werden kann.

---

## Warum das über die technische Leistung hinaus wichtig ist

### Persönliche Datenhoheit

Heute werden deine Daten von den Apps als Geiseln gehalten, die du nutzt. Deine Bankdaten sind in der App deiner Bank. Deine Gesundheitsdaten sind in Apple Health oder Google Fit. Deine Energiedaten sind im Portal deines Anbieters. Du kannst sie manchmal exportieren (als CSV-Datei, die du nie anschaust), aber du kannst sie nicht *nutzen* in Kombination mit anderen Daten — jedenfalls nicht ohne erhebliches technisches Know-how.

WIP ändert das. Deine Daten leben auf deiner Hardware, in deinem Zuhause, in einem strukturierten Format, das jede App lesen kann. Du musst keinem Cloud-Anbieter vertrauen, dass er deine Daten sicher aufbewahrt oder seine Bedingungen nicht ändert. Du musst nicht um eine API betteln. Du besitzt die Daten, du besitzt die Infrastruktur, und du kannst jede App darauf bauen (oder von einer KI bauen lassen), die du willst.

### Das Ende der «Walled Gardens»

Jede App heute ist ein abgeschotteter Garten. Dein Fitness-Tracker weiss nicht, was du isst. Deine Rezept-App weiss nicht, was du eingekauft hast. Dein Energiemonitor weiss nicht, was du bezahlt hast. Die Daten existieren, aber die Mauern zwischen den Apps verhindern, dass sie nützlich zusammenwirken.

Das Konstellationsmodell reisst die Mauern ein — nicht indem es Apps zwingt, miteinander zu reden (was endlose Integrationsarbeit erfordert), sondern indem sie von Anfang an eine gemeinsame Datenschicht teilen. Die «Integration» ist gratis, weil es nichts zu integrieren gibt. Die Daten sind bereits am selben Ort.

### KI als praktischer Werkzeugbauer

Die meisten KI-Demonstrationen zeigen beeindruckende, aber nutzlose Dinge: Chatbots, die clever sind, Bildgeneratoren, die schön sind, Code, der in der Demo funktioniert und in der Praxis auseinanderfällt. Dieses Experiment testet etwas anderes: Kann KI *praktische Werkzeuge* bauen, die eine echte Person jeden Tag nutzt, um ihr echtes Leben zu organisieren?

Die bisherige Antwort ist «ja, mit Leitplanken». Eine uneingeschränkte KI produziert inkonsistente, fragile Software. Eine KI, die auf einer strukturierten Plattform (WIP) aufbaut, einem strukturierten Prozess folgt (phasenweise Entwicklung mit Genehmigungsschritten) und strukturierte Werkzeuge nutzt (den MCP-Server und typisierte Bibliotheken), produziert funktionierende Software an einem Tag.

Wenn dieses Muster Bestand hat — wenn die zweite und dritte App genauso erfolgreich sind wie die erste — dann bedeutet das: Jeder mit einem Raspberry Pi und Zugang zu einem KI-Assistenten könnte sein eigenes persönliches Daten-Ökosystem aufbauen. Nicht «in der Zukunft». Jetzt.

### Der eigentliche Gewinn: Mit deinen eigenen Daten sprechen

Alles bisher Beschriebene — die Apps, das gemeinsame Backend, die Querverbindungen — war als technische Architektur gedacht. Apps bauen, Daten speichern, Abfragen ausführen. Nützlich, aber immer noch ein Werkzeug für technisch versierte Menschen.

Dann passierte etwas Unerwartetes. Eine Komponente, die wir für Entwicklungszwecke gebaut hatten — eine Brücke, die KI-Assistenten die direkte Interaktion mit WIP ermöglicht — stellte sich als weit mehr heraus als ein Entwicklerwerkzeug. Es ist eine universelle Schnittstelle, die **jedem KI-Assistenten erlaubt, alle deine Daten über alle Apps hinweg in normaler Sprache abzufragen.**

Das verändert das gesamte Bild.

Du musst keine Dashboards bauen. Du musst keine Abfragesprache lernen. Du musst nicht einmal eine App öffnen. Du fragst einfach:

*«Wie viel habe ich dieses Jahr fürs Auswärtsessen ausgegeben?»*

Die KI verbindet sich mit WIP, durchsucht deine Transaktionsdaten, filtert nach Kategorie und antwortet. Zwei Sekunden. Keine Tabellenkalkulation.

*«Meine Stromrechnung scheint hoch. Liegt es am Preis oder am Verbrauch?»*

Die KI fragt deine Zählerstände ab, deine Tarifhistorie und Wetterdaten. Sie sagt dir: «Dein Verbrauch ist gegenüber dem Vorjahr sogar um 5% gesunken, aber dein Tarif ist im Januar um 18% gestiegen. Die höhere Rechnung ist komplett ein Preiseffekt.»

*«Soll ich meine Fenster ersetzen?»*

Die KI prüft deine Energiedaten (wie viel Wärme du verlierst), dein Equipment-Register (wie alt die Fenster sind), Baukostendatenbanken (was neue Fenster in deiner Region kosten), staatliche Förderprogramme (welche Zuschüsse es gibt), deine Finanzunterlagen (ob du es dir leisten kannst) und Immobilienbewertungen (ob es den Wert deines Hauses steigert). Sie gibt dir eine fundierte Antwort, gestützt auf *deine* Daten.

Kein Berater. Kein Tabellenkalkulations-Wochenende. Eine Frage und eine Antwort.

**Das ist nur möglich, weil die Daten strukturiert sind.** Eine KI, die einen zufälligen Ordner mit Bank-PDFs und eingescannten Quittungen durchsucht, würde raten, halluzinieren und Fehler machen. Eine KI, die WIP abfragt, bekommt standardisierte Kategorien, validierte Daten, geprüfte Querverweise und Versionshistorie. Die Disziplin, die WIP bei der Dateneingabe erzwingt, ist genau das, was den Unterschied macht zwischen einer zuverlässigen Auskunft und einem Ratespiel.

Die Apps sind der Weg, wie Daten *hineinkommen* — strukturiert und validiert. WIP ist der Weg, wie Daten *verbunden bleiben* — über jeden Lebensbereich hinweg. Und die KI ist der Weg, wie Erkenntnisse *herauskommen* — in deiner Sprache, zu deinen Fragen, aus deinen Daten, auf deiner Hardware.

Das ist keine technische Errungenschaft für Entwickler. Das ist ein **persönlicher Datenassistent für alle.**

### Der Zinseszins-Effekt

Das macht den Zinseszins-Effekt noch kraftvoller als ursprünglich beschrieben. Wir haben eine App. Die Konstellationsthese sagt, die Magie beginnt bei drei oder mehr Apps, wenn die Querverbindungen zwischen den Datensätzen reich genug werden, um Fragen zu beantworten, die keine einzelne App beantworten könnte.

Stell dir eine Renovierungsentscheidung vor — soll ich meine alten Fenster ersetzen? — die auf folgende Quellen zurückgreift:

- Deine Energiezählerdaten (wie viel Heizenergie verschwendest du?)
- Deine Raumtemperatursensoren (welche Zimmer verlieren am schnellsten Wärme?)
- Dein Equipment-Register (wie alt sind die Fenster? Was ist ihr Wärmedämmwert?)
- Baukostendatenbanken (was kosten neue Fenster in deiner Region?)
- Staatliche Förderprogramme (welche Zuschüsse gibt es?)
- Deine Finanzunterlagen (kannst du es dir leisten? Wie lange dauert die Amortisation?)
- Immobilienbewertungen (steigert es den Wert deines Hauses?)

Sieben Datenquellen, drei Konstellationen, eine Frage. Heute erfordert die Beantwortung einen Berater oder ein Wochenende mit Tabellenkalkulationen. Mit einem ausgereiften Konstellations-Ökosystem auf WIP ist es eine Abfrage.

**Das ist der Gewinn.** Nicht nur Apps. Nicht nur Daten. Sondern die Fähigkeit, informierte Entscheidungen über dein Leben zu treffen, indem du Daten verbindest, die immer dir gehörten, aber nie gemeinsam zugänglich waren.

---

## Wo die Dinge stehen

Nach einem Tag:

- Eine funktionierende Statement-Manager-App, die auf einem Raspberry Pi läuft und echte Schweizer Banktransaktionen und Lohnabrechnungen verwaltet
- Ein strukturierter Prozess für KI-gestützte App-Entwicklung, getestet und verfeinert durch acht dokumentierte Lektionen
- Detaillierte Entwürfe für vier Konstellationen (Finanzen, Energie, Hausverwaltung, Fahrzeug), bereit zur Umsetzung
- Alles offen, dokumentiert und verfügbar für jeden, der darauf aufbauen oder dem Experiment folgen möchte

Nach einem Tag funktioniert die erste App. Die zweite App wird testen, ob vernetzte Daten wirklich wertvoller sind als isolierte Daten. Die dritte App wird testen, ob das Muster skaliert.

**Das Experiment ist öffentlich. Der Prozess ist dokumentiert. Die Einladung steht: zuschauen, kritisieren, selber bauen, oder auf Ergebnisse warten.**

*Aktueller Stand: eine App läuft, zehn Lektionen gelernt, null app-übergreifende Abfragen — aber die wichtigste Entdeckung war die letzte. Wir wollten Apps auf einem gemeinsamen Backend bauen. Am Ende haben wir die Grundlage für einen persönlichen Datenassistenten geschaffen. Ein System, bei dem du deine Daten nicht analysierst — du stellst ihnen einfach Fragen.*
