// Firebase Database Helper Functions
class FirebaseDB {
    constructor() {
        this.db = null;
        this.initialized = false;
    }

    // Initialisiere Firebase
    init() {
        if (typeof firebase !== 'undefined' && !this.initialized) {
            try {
                const firebaseConfig = {
                    apiKey: "AIzaSyBhxf0A_Ks-QNWyn9BC_aFIpa-FNiRnL3E",
                    authDomain: "arbeitsplan-f8b81.firebaseapp.com",
                    databaseURL: "https://arbeitsplan-f8b81-default-rtdb.europe-west1.firebasedatabase.app",
                    projectId: "arbeitsplan-f8b81",
                    storageBucket: "arbeitsplan-f8b81.firebasestorage.app",
                    messagingSenderId: "245771353059",
                    appId: "1:245771353059:web:e8b61cac54ff600c5dbed6"
                };

                const app = firebase.initializeApp(firebaseConfig);
                this.db = firebase.database();
                this.initialized = true;
                console.log('Firebase erfolgreich initialisiert');
                return true;
            } catch (error) {
                console.error('Fehler bei Firebase-Initialisierung:', error);
                return false;
            }
        }
        return this.initialized;
    }

    // Speichere Daten in Firebase
    async saveData(path, data) {
        if (!this.init()) {
            throw new Error('Firebase nicht verfügbar');
        }

        try {
            await this.db.ref(path).set(data);
            console.log('Daten erfolgreich gespeichert:', path);
            return true;
        } catch (error) {
            console.error('Fehler beim Speichern:', error);
            throw error;
        }
    }

    // Lade Daten aus Firebase
    async loadData(path) {
        if (!this.init()) {
            throw new Error('Firebase nicht verfügbar');
        }

        try {
            const snapshot = await this.db.ref(path).once('value');
            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                console.log('Keine Daten gefunden für:', path);
                return null;
            }
        } catch (error) {
            console.error('Fehler beim Laden:', error);
            throw error;
        }
    }

    // Lösche Daten aus Firebase
    async deleteData(path) {
        if (!this.init()) {
            throw new Error('Firebase nicht verfügbar');
        }

        try {
            await this.db.ref(path).remove();
            console.log('Daten erfolgreich gelöscht:', path);
            return true;
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
            throw error;
        }
    }

    // Speichere Mitarbeiter
    async saveEmployees(employees) {
        return await this.saveData('employees', employees);
    }

    // Lade Mitarbeiter
    async loadEmployees() {
        const data = await this.loadData('employees');
        return data || [];
    }

    // Speichere Zuweisungen
    async saveAssignments(assignments) {
        return await this.saveData('assignments', assignments);
    }

    // Lade Zuweisungen
    async loadAssignments() {
        const data = await this.loadData('assignments');
        return data || {};
    }

    // Speichere Mitarbeiter Startdaten
    async saveEmployeeStartDates(dates) {
        return await this.saveData('employeeStartDates', dates);
    }

    // Lade Mitarbeiter Startdaten
    async loadEmployeeStartDates() {
        const data = await this.loadData('employeeStartDates');
        return data || {};
    }

    // Speichere Mitarbeiter Enddaten
    async saveEmployeeEndDates(dates) {
        return await this.saveData('employeeEndDates', dates);
    }

    // Lade Mitarbeiter Enddaten
    async loadEmployeeEndDates() {
        const data = await this.loadData('employeeEndDates');
        return data || {};
    }

    // Speichere Zell-Notizen
    async saveCellNotes(notes) {
        return await this.saveData('cellNotes', notes);
    }

    // Lade Zell-Notizen
    async loadCellNotes() {
        const data = await this.loadData('cellNotes');
        return data || {};
    }

    // Speichere Zell-Links
    async saveCellLinks(links) {
        return await this.saveData('cellLinks', links);
    }

    // Lade Zell-Links
    async loadCellLinks() {
        const data = await this.loadData('cellLinks');
        return data || {};
    }

    // Speichere Zell-Adressen
    async saveCellAddresses(addresses) {
        return await this.saveData('cellAddresses', addresses);
    }

    // Lade Zell-Adressen
    async loadCellAddresses() {
        const data = await this.loadData('cellAddresses');
        return data || {};
    }

    // Lade alle Daten
    async loadAllData() {
        try {
            const [employees, assignments, employeeStartDates, employeeEndDates, cellNotes, cellLinks, cellAddresses] = await Promise.all([
                this.loadEmployees(),
                this.loadAssignments(),
                this.loadEmployeeStartDates(),
                this.loadEmployeeEndDates(),
                this.loadCellNotes(),
                this.loadCellLinks(),
                this.loadCellAddresses()
            ]);

            return {
                employees,
                assignments,
                employeeStartDates,
                employeeEndDates,
                cellNotes,
                cellLinks,
                cellAddresses
            };
        } catch (error) {
            console.error('Fehler beim Laden aller Daten:', error);
            return {
                employees: [],
                assignments: {},
                employeeStartDates: {},
                employeeEndDates: {},
                cellNotes: {},
                cellLinks: {},
                cellAddresses: {}
            };
        }
    }

    // Speichere alle Daten
    async saveAllData(data) {
        try {
            await Promise.all([
                this.saveEmployees(data.employees),
                this.saveAssignments(data.assignments),
                this.saveEmployeeStartDates(data.employeeStartDates),
                this.saveEmployeeEndDates(data.employeeEndDates),
                this.saveCellNotes(data.cellNotes),
                this.saveCellLinks(data.cellLinks),
                this.saveCellAddresses(data.cellAddresses)
            ]);
            return true;
        } catch (error) {
            console.error('Fehler beim Speichern aller Daten:', error);
            return false;
        }
    }
}

// Erstelle eine globale Instanz
window.firebaseDB = new FirebaseDB();
