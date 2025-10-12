# Arbeitsplan App

Eine Electron-basierte Arbeitsplan-Verwaltungsanwendung mit Firebase-Integration.

## 🚀 Installation und Setup

### 1. Abhängigkeiten installieren
```bash
npm install
```

### 2. Firebase Setup
Die App ist bereits für Firebase konfiguriert. Die Firebase-Konfiguration befindet sich in `firebase-config.js`.

### 3. App starten
```bash
npm start
```

## 📊 Features

- **Mitarbeiterverwaltung**: Hinzufügen und Entfernen von Mitarbeitern
- **Kalenderansicht**: Monats- und Wochenansicht
- **Statusverwaltung**: Urlaub, Krankheit, Schulung, etc.
- **Notizen und Links**: Zusätzliche Informationen zu Terminen
- **Export/Import**: JSON und Excel-Export
- **Firebase-Integration**: Zentrale Datenspeicherung

## 🔧 Technische Details

### Datenbank
- **Firebase Realtime Database**: Zentrale Datenspeicherung
- **Fallback**: localStorage bei Firebase-Problemen

### Datenstruktur
```javascript
{
  employees: [],           // Mitarbeiterliste
  assignments: {},         // Zuweisungen
  employeeStartDates: {},  // Startdaten
  employeeEndDates: {},   // Enddaten
  cellNotes: {},          // Zell-Notizen
  cellLinks: {},          // Zell-Links
  cellAddresses: {}       // Zell-Adressen
}
```

## 📁 Projektstruktur

```
├── main.js              # Electron Hauptprozess
├── script.js            # Frontend JavaScript
├── firebase-config.js   # Firebase Konfiguration
├── index.html           # Haupt-HTML
├── login.html           # Login-Seite
├── styles.css           # CSS-Styles
├── package.json         # NPM Konfiguration
└── README.md            # Diese Datei
```

## 🛠️ Build

### Entwicklung
```bash
npm start
```

### Build für Distribution
```bash
npm run build
```

### Nur packen (ohne Installer)
```bash
npm run pack
```

## 🔐 Firebase Sicherheit

Die Firebase-Konfiguration ist in der `firebase-config.js` Datei. Für Produktionsumgebungen sollten die Firebase-Regeln entsprechend angepasst werden.

## 📝 Lizenz

ISC
