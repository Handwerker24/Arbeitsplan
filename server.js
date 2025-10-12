const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// CORS aktivieren
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    next();
});

// Statische Dateien servieren
app.use(express.static('.'));

// JSON-Parser für POST-Anfragen
app.use(express.json());

// Endpunkt zum Öffnen des Windows Explorers
app.post('/open-folder', (req, res) => {
    const folderPath = req.body.path;
    
    if (!folderPath) {
        return res.status(400).json({ error: 'Kein Pfad angegeben' });
    }

    // Überprüfe, ob der Pfad existiert
    if (!fs.existsSync(folderPath)) {
        return res.status(400).json({ error: 'Der angegebene Ordner existiert nicht' });
    }

    // Normalisiere den Pfad für Windows
    const normalizedPath = path.normalize(folderPath);
    
    // Öffne den Windows Explorer
    const command = `explorer "${normalizedPath}"`;
    console.log('Ausführe Befehl:', command);

    exec(command, (error, stdout, stderr) => {
        // Ignoriere den Fehler, da explorer immer einen Exit-Code zurückgibt
        // aber der Ordner trotzdem geöffnet wird
        console.log('Ordner erfolgreich geöffnet');
        res.json({ success: true });
    });
});

// Server starten
app.listen(port, '0.0.0.0', () => {
    console.log(`Server läuft auf http://localhost:${port}`);
}); 