NEONMIND DESKTOP CORE – WEBSITE EDITION VERSION 01
===================================================

START:
1. ZIP vollständig entpacken.
2. START-NEONMIND-DESKTOP.bat doppelklicken.
3. Microsoft Edge öffnet NeonMind als eigenes App-Fenster.
4. F11 schaltet zwischen Fenster und Vollbild um.

NEU IN BUILD 028:
- Core-Fenster wird als unterste normale Desktop-Ebene geführt. Programme,
  Dateien und Windows-Dialoge erscheinen dadurch zuverlässig darüber.
- Datei-, Ordner-, App- und Hintergrundauswahl erhalten zusätzlich einen
  unsichtbaren TopMost-Besitzer und können nicht mehr hinter dem Core landen.
- Linke Schnellleiste enthält nur die fünf Beispiele sowie frei hinzufügbare
  Ordner und Apps; feste Einträge für Desktop-Symbole und KI Chat entfallen.
- Schnellleiste und Reactor lassen sich über eigene Griffe frei verschieben;
  Reactor kann zusätzlich in der Größe verändert werden.
- Header-Navigation verwendet kompakte, beschriftete Symbolbuttons.
- Windows-Systemlautstärke wird exakt gelesen, gesetzt und laufend mit beiden
  NeonMind-Reglern synchronisiert.
- Neues Social-Widget für WhatsApp, Facebook Messenger, Instagram Direct und
  TikTok im persönlichen Standardbrowser.
- News heißt jetzt Weltnews.
- Musikplayer zeigt den eigenen Titel oder den erkannten aktiven Player an;
  die Playlist sitzt kompakt unter Musik- und Ordnerauswahl.

ENTHALTEN AUS BUILD 027:
- Geöffnete Programme erscheinen wieder vor dem NeonMind Desktop. Die
  Vollbildkorrektur verändert nur noch Größe und Position, nicht mehr die
  Windows-Fensterreihenfolge.
- Einheitlich große Desktop-Kacheln mit zweizeiliger, abgeschnittener
  Beschriftung verhindern unterschiedlich hohe Symbolrahmen.
- NeonMind-Startmenü mit Abmelden, Neustart und Herunterfahren.
- Frei belegbare Glass-Taskleiste für Explorer, Standardbrowser, Downloads
  und Einstellungen; Auswahl wird lokal gespeichert.
- Eigener Playlist-Player: Musikdateien oder komplette Musikordner hinzufügen,
  Titel auswählen, automatisch weiterschalten und Lautstärke regeln.
- Grafisches NeonMind-Installerpanel statt einer schlichten Startabfrage.

ENTHALTEN AUS BUILD 026:
- Per-Monitor-V2-DPI-Awareness verhindert, dass Windows eine 1920x1080-
  Anzeige intern nur als kleinere logische Arbeitsfläche meldet.
- Physische Monitorauflösung wird direkt über Windows ermittelt und an die
  Runtime übergeben; es gibt keine feste 1440x900-Vorgabe mehr.
- Der native Host kontrolliert Position und Größe des rahmenlosen Fensters
  fortlaufend und korrigiert nachträgliches Zurücksetzen der Runtime.

ENTHALTEN AUS BUILD 025:
- Fehleranfällige SetParent-Einbettung vollständig entfernt.
- Das eigentliche Runtime-Fenster wird direkt in ein rahmenloses
  WS_POPUP-Vollbildfenster auf exakte Monitorgröße umgewandelt.
- Schwarzer Controller bleibt unsichtbar und übernimmt nur noch Prozess-,
  Taskleisten- und Notfallüberwachung.
- Job-Objekt mit KILL_ON_JOB_CLOSE beendet die Runtime auch dann, wenn der
  Controller per Notfall-Hotkey oder durch einen Absturz beendet wird.
- Safe Window bleibt unverändert als normales verschiebbares Fenster erhalten.

ENTHALTEN AUS BUILD 024:
- Native Anwendung startet jetzt grundsätzlich im rahmenlosen Desktop-Modus,
  selbst wenn ein vorgeschalteter Starter das Modusargument verliert.
- Nur der ausdrücklich übergebene Parameter --safe aktiviert noch die normale
  Windows-Titelleiste.
- PowerShell-Host übergibt bei jedem Start eindeutig entweder --desktop oder
  --safe; ein unbestimmter Zwischenzustand ist ausgeschlossen.

ENTHALTEN AUS BUILD 023:
- Installer stellt vor einem Update zuerst die echte Windows-Taskleiste wieder
  her und beendet laufende NeonMind-Host- und Runtime-Prozesse.
- Gesperrte EXE- und DLL-Dateien werden vor dem Überschreiben freigegeben.
- Entpackfehler erzeugen ein UTF-8-Diagnoseprotokoll im Windows-Temp-Ordner;
  der genaue Pfad wird direkt in der Fehlermeldung angezeigt.
- Bereits vorhandene Einstellungen und desktop-config.json bleiben beim
  Update erhalten.

ENTHALTEN AUS BUILD 022:
- Runtime-Fenster wird auch dann zuverlässig gefunden, wenn Windows einen
  Owner oder eine abweichende Prozesszuordnung verwendet.
- Runtime wird geprüft in den nativen Vollbild-Host eingehängt und anschließend
  zwingend auf dessen vollständige Clientfläche skaliert.
- Offene Windows-Programme erscheinen direkt als echte Icon-Schaltflächen
  im NeonMind-Header.
- Linksklick aktiviert das Fenster. Rechtsklick bietet Aktivieren,
  Minimieren und „Fenster schließen“ über CloseMainWindow.
- NeonMind-eigene Host- und Runtime-Prozesse werden aus der App-Liste entfernt.

ENTHALTEN AUS BUILD 021:
- Der normale Eintrag „NeonMind Desktop Core“ startet jetzt standardmäßig
  rahmenlos im vollständigen Desktop-Modus.
- Windows-Titelleiste, grauer Client-Rand und erweiterte Runtime-Rahmenstile
  werden vollständig entfernt.
- Windows-Taskleiste wird im Standardmodus ausgeblendet; der NeonMind-Header
  übernimmt die sichtbare obere Desktop-Leiste.
- Separater „NeonMind Safe Window“-Start bleibt als Rettungsweg mit normaler
  Windows-Titelleiste verfügbar.

ENTHALTEN AUS BUILD 020:
- Windows-Fehler 87 beim Start der eingebetteten Runtime behoben.
- Runtime wird über ShellExecuteEx mit sauber getrenntem Dateipfad,
  Argumenten und Arbeitsordner gestartet.
- Prozesshandle und Prozess-ID bleiben für Einbettung, Größensteuerung und
  sauberes Beenden vollständig verfügbar.

ENTHALTEN AUS BUILD 019:
- Fehlende native webview.dll ergänzt. Sie war die Ursache dafür, dass
  NeonMindWebViewRuntime.exe in Build 018 nicht starten konnte.
- Startfehler zeigen nun Windows-Fehlercode, Systemmeldung und erwarteten Pfad.
- Windows-10/11-Kompatibilitätsmanifest für Hauptprogramm und Installer
  ergänzt; dadurch wird die irreführende PCA-Nachfrage vermieden.

ENTHALTEN AUS BUILD 018:
- Eigener nativer Prozess NeonMindDesktopCore.exe mit eingebetteter
  WebView-Oberfläche; kein sichtbares Microsoft-Edge-Browserfenster mehr.
- Sicherer Fenstermodus und separater NeonMind Desktop-Modus.
- Der Desktop-Modus blendet die Windows-Taskleiste nur während der Sitzung aus.
- Ein unabhängiger Wächter stellt die Taskleiste auch bei einem Absturz wieder
  her. Notausgang: Strg + Alt + Umschalt + F12.
- Installer-Auswahl für Installationsordner, Desktop-Verknüpfung,
  Startmenü-Eintrag, Desktop-Modus-Verknüpfung und Autostart.
- Eigene NeonMind-Programmdatei mit Icon, Versions- und Firmenmetadaten.

ENTHALTEN AUS BUILD 017:
- Windows-Ordnersymbole werden über die Shell-Ordnerattribute zuverlässig
  geladen und nicht mehr als cyanfarbener Platzhalter dargestellt.
- Desktop-Symbole besitzen dauerhaft einen dezenten NeonMind-Glasrahmen.
- Erster per-user Windows-Installer mit Deinstallation, Desktop- und
  Startmenü-Verknüpfung, NeonMind-Herausgebermetadaten und Homepage-Link.

ENTHALTEN AUS BUILD 016:
- Echte Windows-Dateisymbole und Bildvorschauen werden in Desktop,
  Schnellzugriff und NeonMind-Explorer korrekt dargestellt.
- Symbole erhalten einen dezenten blau-magenta NeonMind-Glasrahmen.
- Windows-artiger Auswahlrahmen: auf freier Desktopfläche mit gedrückter
  linker Maustaste mehrere Symbole markieren.
- Reactor-Video ist sauber kreisförmig maskiert; rechteckige Schattenfalten
  außerhalb des Rings wurden entfernt.
- Uhrzeit, Wochentag und Datum unten rechts sind größer und klarer lesbar.
- Rahmen, Glows und Flächen folgen nun durchgehend der elektrischen
  Blau-Violett-Magenta-Farbwelt des Reactors.

ENTHALTEN AUS BUILD 015:
- Rechtsklickmenüs vollständig im dunklen NeonMind-Glasdesign.
- Linke Ordner-Schnellzugriffe, Dieser PC und Papierkorb öffnen jetzt innerhalb
  des NeonMind-Explorers statt in einem separaten Windows-Fenster.
- Echte Windows-Datei-, Ordner- und Programmsymbole werden automatisch geladen.
- Bilder erscheinen als echte Miniaturansichten; alle Symbole erhalten einen
  dezenten Cyan-/Lila-Glow.
- Neues Wetter-Widget mit frei wählbarem und gespeichertem Ort sowie aktuellen
  Werten von Open-Meteo.
- Neues Nachrichten-Widget mit aktuellen Schlagzeilen aus dem offiziellen
  Tagesschau-RSS-Feed und Links zu den Originalartikeln.
- System-Widget besitzt Abmelden, Neustart und Herunterfahren. Jede Aktion
  benötigt vorher eine ausdrückliche Bestätigung.

ENTHALTEN AUS BUILD 014:
- KI Chat wurde aus dem Header entfernt und als fünfter Bereich direkt in den
  verschiebbaren und skalierbaren Widget Core integriert.
- Rechtsklick auf freie Desktopfläche: große, mittlere oder kleine Symbole,
  Sortierung nach Name, Typ oder Datum, automatische Anordnung, Raster,
  Symbole ein-/ausblenden und Aktualisieren.
- Rechtsklick auf freie Desktopfläche: Einfügen, neuer Ordner,
  Windows-Anzeigeeinstellungen und Personalisierung.
- Erweitertes Datei-Kontextmenü: Öffnen, im Windows-Explorer anzeigen,
  im Terminal öffnen, Öffnen mit, Drucken, Ausschneiden,
  Kopieren, Einfügen in Ordner, Verknüpfung, Umbenennen, Verschieben,
  Papierkorb und Eigenschaften.
- Unterstützte Bilder lassen sich per Rechtsklick direkt als
  NeonMind-Desktophintergrund festlegen.
- NeonMind-Zwischenablage für Kopieren/Ausschneiden und Einfügen.

ENTHALTEN AUS BUILD 013:
- Echte Windows-Desktop-Dateien liegen direkt als NeonMind-Symbole auf der
  Desktop-Fläche.
- Jedes Desktop-Symbol ist frei verschiebbar; seine Position bleibt gespeichert.
- Doppelklick öffnet, Rechtsklick bietet Öffnen, Umbenennen, Verschieben und
  Verschieben in den Papierkorb.
- Desktop-Symbole lassen sich ausblenden und in den Einstellungen neu anordnen.
- Neues NeonMind-KI-Widget: frei verschiebbar, skalierbar und maximierbar.
- Im Browser-Prototyp öffnet das Widget das persönliche ChatGPT-Konto im
  Standardbrowser – ohne mitgelieferten API-Schlüssel.
- Die Widget-Fläche ist für die spätere WebView2-Einbettung der EXE vorbereitet.

ENTHALTEN AUS BUILD 012:
- Der Website-Link unten links ist größer und deutlich besser lesbar.
- Alle Core- und Windows-Meldungen erscheinen mittig unter dem Header.
- Das Musik-Widget besitzt einen eigenen synchronisierten Lautstärkeregler.
- „Desktop-Dateien“ links zeigt echte sichtbare Dateien und Ordner des
  aktuellen Windows-Desktops und öffnet sie direkt.
- In den Einstellungen kann ein eigenes JPG-, PNG- oder WebP-Hintergrundbild
  ausgewählt und jederzeit zum NeonMind-Design zurückgewechselt werden.

ENTHALTEN AUS BUILD 011:
- © by NeonMind-AI.com unten links öffnet die Website im Standardbrowser.
- Das System-Widget lässt sich am Kopf frei verschieben und am Rand skalieren.
- Mit ◇ rastet das Widget wieder an seiner ursprünglichen Position ein.
- Der NeonMind-Explorer ist frei verschiebbar und skalierbar.
- Explorer kann minimiert, im Dock wiederhergestellt und maximiert werden.
- Explorer-Ansichten: große Symbole, Liste und Details.
- Explorer-Dateifunktionen per Rechtsklick: Öffnen, Umbenennen,
  Verschieben und sicher in den Windows-Papierkorb legen.
- Neue Ordner können direkt über ＋ in der Explorer-Leiste erstellt werden.
- Meldungszentrale lässt sich nach Core- und Windows-Meldungen filtern.
- Reactor-Ringe laufen mit konstanter GPU-Animation ohne Tempowechsel-Ruckler.

ENTHALTEN AUS BUILD 010:
- Rechte Widget-Zone mit System, Musik, Kalender und Core-Meldungen.
- Widget-Modus kann direkt oben im Widget gewechselt werden.
- In Einstellungen zusätzlich Werbeschrift, Widgets oder leere Fläche wählbar.
- System-Widget zeigt echte CPU-, RAM- und Laufwerkswerte.
- CPU/RAM unten oder im Widget öffnet den Windows-Task-Manager.
- Musik-Widget: Zurück, Play/Pause, Weiter und Stummschaltung.
- Apps im Header zeigt die Anzahl offener Fenster und pulsiert dezent.
- Apps öffnet eine Übersicht aller erkannten Windows-Fenster.
- Reaktor-Orbits laufen gleichmäßig und unabhängig von Lastspitzen.
- Erster echter NeonMind-Explorer:
  Laufwerke, Ordner, Dateien, Zurück, Hoch und Aktualisieren.
- Gallery öffnet den Bilderordner im NeonMind-Explorer.
- Benachrichtigungs-Widget zeigt die letzten Core-Aktivitäten.

WEITERHIN ENTHALTEN:
- Echte linke Schnellzugriffe.
- Ordner und Programme hinzufügen.
- Rechtsklick auf einen Schnellzugriff entfernt ihn.
- Echte Windows-Lautstärke und eigener Play/Pause-Knopf.
- Uhr unten rechts mit Wochentag.
- Einstellungen und Schnellzugriffe werden in desktop-config.json gespeichert.

SICHERHEIT:
- Keine Veränderung der Windows-Taskleiste.
- Keine Veränderung des Windows-Arbeitsbereichs.
- Keine ersetzten Windows-Systemdateien.
- Der Funktionshost ist nur über localhost mit zufälligem Sitzungsschlüssel
  erreichbar.
- STOP-NEONMIND-DESKTOP.bat beendet bei Bedarf nur den NeonMind-Host.
