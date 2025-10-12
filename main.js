const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'icon.ico')
    });

    mainWindow.loadFile('index.html');
    
    // Entferne das Menü
    mainWindow.setMenu(null);
    
    // Verhindere das Schließen der App durch Schließen des Fensters
    mainWindow.on('close', (event) => {
        event.preventDefault();
        mainWindow.hide();
    });
}

app.whenReady().then(createWindow);

// Beende die App, wenn alle Fenster geschlossen sind
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// IPC Handler für das Öffnen von Ordnern
ipcMain.handle('open-folder', async (event, { path }) => {
    try {
        if (!fs.existsSync(path)) {
            throw new Error('Der angegebene Ordner existiert nicht.');
        }
        
        const { shell } = require('electron');
        await shell.openPath(path);
        return { success: true };
    } catch (error) {
        console.error('Fehler beim Öffnen des Ordners:', error);
        return { error: error.message };
    }
}); 