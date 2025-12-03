// Firebase-Konfiguration (nur einmal deklarieren)
if (typeof firebaseConfig === 'undefined') {
    var firebaseConfig = {
        apiKey: "AIzaSyBhxf0A_Ks-QNWyn9BC_aFIpa-FNiRnL3E",
        authDomain: "arbeitsplan-f8b81.firebaseapp.com",
        databaseURL: "https://arbeitsplan-f8b81-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "arbeitsplan-f8b81",
        storageBucket: "arbeitsplan-f8b81.firebasestorage.app",
        messagingSenderId: "245771353059",
        appId: "1:245771353059:web:e8b61cac54ff600c5dbed6"
    };
}

// Firebase initialisieren (nur einmal)
let firebaseApp, database, auth;
try {
    if (typeof firebase !== 'undefined') {
        // Prüfe, ob Firebase bereits initialisiert wurde
        try {
            firebaseApp = firebase.app();
            console.log('Firebase bereits initialisiert');
        } catch (e) {
            // Firebase noch nicht initialisiert, initialisiere es
            firebaseApp = firebase.initializeApp(firebaseConfig);
            console.log('Firebase erfolgreich initialisiert');
        }
        database = firebase.database();
        auth = firebase.auth();
    } else {
        console.error('Firebase SDK nicht geladen');
    }
} catch (error) {
    console.error('Fehler bei Firebase-Initialisierung:', error);
}

// FirebaseDB Klasse
class FirebaseDB {
    constructor() {
        this.db = database;
    }

    // Daten aus Firebase laden
    async loadData(key) {
        if (!this.db) {
            console.warn('Firebase nicht verfügbar, verwende localStorage');
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        }

        try {
            const snapshot = await this.db.ref(key).once('value');
            const data = snapshot.val();
            if (data === null) {
                console.log(`Keine Daten gefunden für: ${key}`);
                return null;
            }
            return data;
        } catch (error) {
            console.error(`Fehler beim Laden: ${error.message}`);
            // Fallback zu localStorage
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        }
    }

    // Daten in Firebase speichern
    async saveData(key, data) {
        if (!this.db) {
            console.warn('[FirebaseDB.saveData] Firebase nicht verfügbar, verwende localStorage');
            localStorage.setItem(key, JSON.stringify(data));
            return;
        }

        try {
            console.log(`[FirebaseDB.saveData] Versuche ${key} in Firebase zu schreiben...`);
            await this.db.ref(key).set(data);
            console.log(`[FirebaseDB.saveData] ${key} erfolgreich in Firebase gespeichert`);
        } catch (error) {
            console.error(`[FirebaseDB.saveData] Fehler beim Speichern von ${key}:`, error);
            console.error(`[FirebaseDB.saveData] Fehler-Details:`, error.code, error.message);
            // Fallback zu localStorage
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`[FirebaseDB.saveData] ${key} in localStorage gespeichert (Fallback)`);
        }
    }

    // Alle Daten laden
    async loadAllData() {
        const data = {
            employees: await this.loadData('employees') || [],
            assignments: await this.loadData('assignments') || {},
            employeeStartDates: await this.loadData('employeeStartDates') || {},
            employeeEndDates: await this.loadData('employeeEndDates') || {},
            cellNotes: await this.loadData('cellNotes') || {},
            cellLinks: await this.loadData('cellLinks') || {},
            cellAddresses: await this.loadData('cellAddresses') || {},
            cellHighlights: await this.loadData('cellHighlights') || {},
            mergedCells: await this.loadData('mergedCells') || {}
        };
        return data;
    }

    // Benutzer aus Firebase laden
    async loadUsers() {
        return await this.loadData('users') || {};
    }

    // Benutzer in Firebase speichern
    async saveUsers(users) {
        await this.saveData('users', users);
    }
}

// Globale Instanz erstellen
let firebaseDB = null;

// Warte bis DOM bereit ist, dann initialisiere
function initFirebaseDB() {
    if (database) {
        firebaseDB = new FirebaseDB();
        window.firebaseDB = firebaseDB;
        console.log('FirebaseDB Instanz erstellt und in window.firebaseDB gespeichert');
    } else {
        console.warn('FirebaseDB konnte nicht initialisiert werden - database ist null');
    }
}

// Initialisiere sofort, wenn möglich
if (typeof firebase !== 'undefined' && database) {
    initFirebaseDB();
} else {
    // Warte bis alles geladen ist
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFirebaseDB);
    } else {
        // DOM ist bereits bereit, warte kurz auf Firebase
        setTimeout(() => {
            if (typeof firebase !== 'undefined' && database) {
                initFirebaseDB();
            } else {
                console.warn('Firebase oder database nicht verfügbar nach Timeout');
            }
        }, 100);
    }
}