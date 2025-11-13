// Globale Variablen
let currentDate = new Date();
let employees = [];
let assignments = {};
let employeeStartDates = {};
let employeeEndDates = {};
let selectedCells = new Set();
let isSelecting = false;
let lastSelectedCell = null;
let cellNotes = {};
let cellLinks = {};
let copiedContent = null; // Speichert den kopierten Inhalt
let isZoomedOut = false;
let cellAddresses = {};
let isWeekView = false; // Neue Variable für den Ansichtsmodus
// firebaseDB wird in firebase-simple.js deklariert

// Undo-Funktionalität
let undoStack = [];
const MAX_UNDO_STEPS = 10;

// Protokoll-Funktionalität
let auditLog = JSON.parse(localStorage.getItem('auditLog')) || [];

// Firebase-Initialisierung
async function initializeFirebase() {
    console.log('Starte Firebase-Initialisierung...');
    console.log('Firebase verfügbar:', typeof firebase !== 'undefined');
    console.log('window.firebaseDB verfügbar:', !!window.firebaseDB);
    
    // Warte bis Firebase geladen ist
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK nicht geladen - verwende localStorage');
        loadDataFromLocalStorage();
        return;
    }
    
    // Prüfe, ob der Benutzer authentifiziert ist
    if (firebase.auth) {
        const currentUser = firebase.auth().currentUser;
        if (!currentUser) {
            console.warn('Benutzer nicht authentifiziert - Firebase-Daten können nicht geladen werden');
            // Versuche trotzdem zu laden (falls Rules es erlauben)
        } else {
            console.log('Benutzer authentifiziert:', currentUser.email);
        }
    }

    // Warte bis firebaseDB verfügbar ist (maximal 10 Sekunden)
    let attempts = 0;
    const maxAttempts = 100;
    while (!window.firebaseDB && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        if (attempts % 10 === 0) {
            console.log(`Warte auf FirebaseDB... (${attempts}/${maxAttempts})`);
        }
    }

    if (window.firebaseDB) {
        console.log('Firebase DB Instanz gefunden, lade Daten...');
        
        // Lade alle Daten aus Firebase
        try {
            const data = await window.firebaseDB.loadAllData();
            console.log('Rohdaten aus Firebase:', data);
            
            // Überschreibe IMMER mit Daten aus Firebase (auch wenn leer)
            // Firebase hat Vorrang vor localStorage
            employees = data.employees || [];
            assignments = data.assignments || {};
            employeeStartDates = data.employeeStartDates || {};
            employeeEndDates = data.employeeEndDates || {};
            cellNotes = data.cellNotes || {};
            cellLinks = data.cellLinks || {};
            cellAddresses = data.cellAddresses || {};
            
            console.log('Daten aus Firebase geladen (Firebase hat Vorrang):', { 
                employees: employees.length, 
                assignments: Object.keys(assignments).length,
                employeeStartDates: Object.keys(employeeStartDates).length,
                employeeEndDates: Object.keys(employeeEndDates).length,
                cellNotes: Object.keys(cellNotes).length,
                cellLinks: Object.keys(cellLinks).length,
                cellAddresses: Object.keys(cellAddresses).length
            });
            
            // Wenn Firebase leer ist, migriere Daten aus localStorage zu Firebase
            if (employees.length === 0 && Object.keys(assignments).length === 0) {
                console.log('Firebase ist leer, prüfe localStorage für Migration...');
                const localEmployees = JSON.parse(localStorage.getItem('employees')) || [];
                const localAssignments = JSON.parse(localStorage.getItem('assignments')) || {};
                
                if (localEmployees.length > 0 || Object.keys(localAssignments).length > 0) {
                    console.log('Daten in localStorage gefunden, migriere zu Firebase...');
                    // Lade aus localStorage
                    loadDataFromLocalStorage();
                    // Speichere dann in Firebase
                    saveData('employees', employees);
                    saveData('assignments', assignments);
                    saveData('employeeStartDates', employeeStartDates);
                    saveData('employeeEndDates', employeeEndDates);
                    saveData('cellNotes', cellNotes);
                    saveData('cellLinks', cellLinks);
                    saveData('cellAddresses', cellAddresses);
                    console.log('Daten von localStorage zu Firebase migriert');
                } else {
                    console.log('Auch localStorage ist leer, starte mit leeren Daten');
                }
            }
        } catch (error) {
            console.error('Fehler beim Laden aus Firebase:', error);
            console.log('Verwende localStorage als Fallback');
            loadDataFromLocalStorage();
        }
    } else {
        console.warn('FirebaseDB nach', maxAttempts, 'Versuchen nicht verfügbar, verwende localStorage');
        loadDataFromLocalStorage();
    }
}

// Fallback: Daten aus localStorage laden
function loadDataFromLocalStorage() {
    employees = JSON.parse(localStorage.getItem('employees')) || [];
    assignments = JSON.parse(localStorage.getItem('assignments')) || {};
    employeeStartDates = JSON.parse(localStorage.getItem('employeeStartDates')) || {};
    employeeEndDates = JSON.parse(localStorage.getItem('employeeEndDates')) || {};
    cellNotes = JSON.parse(localStorage.getItem('cellNotes')) || {};
    cellLinks = JSON.parse(localStorage.getItem('cellLinks')) || {};
    cellAddresses = JSON.parse(localStorage.getItem('cellAddresses')) || {};
    console.log('Daten aus localStorage geladen');
}

// Daten speichern (Firebase oder localStorage)
async function saveData(key, data) {
    const db = window.firebaseDB || firebaseDB;
    if (db) {
        try {
            await db.saveData(key, data);
        } catch (error) {
            console.error(`Fehler beim Speichern in Firebase (${key}):`, error);
            // Fallback zu localStorage
            localStorage.setItem(key, JSON.stringify(data));
        }
    } else {
        // Fallback zu localStorage
        localStorage.setItem(key, JSON.stringify(data));
    }
}

function addToAuditLog(action, details) {
    const currentUser = JSON.parse(localStorage.getItem('currentUser')) || { username: 'Unbekannt', name: 'Unbekannt' };
    const username = currentUser.name || currentUser.username || 'Unbekannt';
    const logEntry = {
        timestamp: new Date().toISOString(),
        user: username,
        action: action,
        details: details
    };
    auditLog.push(logEntry);
    // Behalte nur die letzten 1000 Einträge
    if (auditLog.length > 1000) {
        auditLog = auditLog.slice(-1000);
    }
    localStorage.setItem('auditLog', JSON.stringify(auditLog));
    console.log('Audit Log:', logEntry);
}

function showAuditLog() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'auditLogModal';
    modal.style.display = 'block';
    
    const logEntries = JSON.parse(localStorage.getItem('auditLog')) || [];
    const logHTML = logEntries.slice().reverse().map(entry => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleString('de-DE');
        return `
            <div class="audit-log-entry">
                <div class="audit-log-time">${dateStr}</div>
                <div class="audit-log-user">${entry.user}</div>
                <div class="audit-log-action">${entry.action}</div>
                <div class="audit-log-details">${JSON.stringify(entry.details)}</div>
            </div>
        `;
    }).join('');
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 80vh; overflow-y: auto;">
            <h2>Änderungsprotokoll</h2>
            <div class="audit-log-container">
                ${logEntries.length === 0 ? '<p>Keine Einträge vorhanden.</p>' : logHTML}
            </div>
            <button id="closeAuditLog" style="margin-top: 20px;">Schließen</button>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    const closeBtn = document.getElementById('closeAuditLog');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function saveState() {
    const state = {
        assignments: JSON.parse(JSON.stringify(assignments)),
        cellNotes: JSON.parse(JSON.stringify(cellNotes)),
        cellLinks: JSON.parse(JSON.stringify(cellLinks)),
        cellAddresses: JSON.parse(JSON.stringify(cellAddresses))
    };
    
    undoStack.push(state);
    if (undoStack.length > MAX_UNDO_STEPS) {
        undoStack.shift();
    }
}

function undo() {
    if (undoStack.length > 0) {
        const previousState = undoStack.pop();
        assignments = previousState.assignments;
        cellNotes = previousState.cellNotes;
        cellLinks = previousState.cellLinks;
        cellAddresses = previousState.cellAddresses;
        
        saveData('assignments', assignments);
        saveData('cellNotes', cellNotes);
        saveData('cellLinks', cellLinks);
        saveData('cellAddresses', cellAddresses);
        
        updateCalendar();
    }
}

// Logout-Funktionalität
document.getElementById('logoutButton').addEventListener('click', async function() {
    // Firebase Auth Sign Out
    if (typeof firebase !== 'undefined' && firebase.auth) {
        try {
            await firebase.auth().signOut();
            console.log('Erfolgreich ausgeloggt');
        } catch (error) {
            console.error('Fehler beim Ausloggen:', error);
        }
    }
    
    // Lösche die Benutzerinformationen aus dem localStorage
    localStorage.removeItem('currentUser');
    // Leite zur Login-Seite weiter
    window.location.href = 'login.html';
});

// DOM-Elemente (werden beim Initialisieren gesetzt)
let yearGrid, monthGrid, calendarBody, headerRow, employeeModal, employeeNameInput;
let deleteEmployeeModal, employeeToDeleteSpan, infoField, infoText, zoomOutButton;
let currentEditingCell = null;

// Event Listener für das Modal
document.getElementById('addEmployee')?.addEventListener('click', () => {
    if (employeeModal && employeeNameInput) {
        employeeModal.style.display = 'block';
        employeeNameInput.value = '';
        employeeNameInput.focus();
    }
});

// Füge den Toggle-Button für die Ansicht hinzu
const toggleViewButton = document.createElement('button');
toggleViewButton.id = 'toggleView';
toggleViewButton.className = 'action-button';
toggleViewButton.textContent = 'Wochenansicht';
toggleViewButton.addEventListener('click', () => {
    isWeekView = !isWeekView;
    toggleViewButton.textContent = isWeekView ? 'Monatsansicht' : 'Wochenansicht';
    updateCalendar();
});

// Event Listener Setup (wird nach Initialisierung aufgerufen)
function setupToggleViewButton() {
    // Füge den Toggle-Button neben dem "Mitarbeiter hinzufügen" Button ein
    const addEmployeeButton = document.getElementById('addEmployee');
    if (addEmployeeButton && addEmployeeButton.parentNode) {
        addEmployeeButton.parentNode.insertBefore(toggleViewButton, addEmployeeButton.nextSibling);
    }
}

// Event Listener Setup (wird nach Initialisierung aufgerufen)
function setupEventListeners() {
    // Event Listener für Speichern
    const saveEmployeeBtn = document.getElementById('saveEmployee');
    if (saveEmployeeBtn && employeeNameInput) {
        saveEmployeeBtn.addEventListener('click', () => {
            let name = employeeNameInput.value.trim();
            if (name) {
                // Wenn der Name bereits existiert, füge eine Nummer hinzu
                if (employees.includes(name)) {
                    name = name + ' 2';
                }
                
                employees.push(name);
                // Setze das Startdatum auf den ersten Tag des ausgewählten Monats
                const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 2);
                console.log('Startdatum:', startDate);
                employeeStartDates[name] = startDate.toISOString().split('T')[0];
                
                // Setze das Enddatum auf ein weit entferntes Datum
                const endDate = new Date('2100-12-31');
                employeeEndDates[name] = endDate.toISOString().split('T')[0];
                
                saveData('employees', employees);
                saveData('employeeStartDates', employeeStartDates);
                saveData('employeeEndDates', employeeEndDates);
                
                addToAuditLog('Mitarbeiter hinzugefügt', { employee: name });
                
                updateCalendar();
                if (employeeModal) employeeModal.style.display = 'none';
            } else {
                alert('Bitte geben Sie einen gültigen Namen ein.');
                if (employeeNameInput) employeeNameInput.focus();
            }
        });
    }
    
    // Event Listener für Abbrechen
    const cancelEmployeeBtn = document.getElementById('cancelEmployee');
    if (cancelEmployeeBtn) {
        cancelEmployeeBtn.addEventListener('click', () => {
            if (employeeModal && employeeNameInput) {
                employeeModal.style.display = 'none';
                employeeNameInput.value = '';
            }
        });
    }

    // Event Listener für Enter-Taste im Modal
    if (employeeNameInput) {
        employeeNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const saveBtn = document.getElementById('saveEmployee');
                if (saveBtn) saveBtn.click();
            }
        });
    }

    // Event Listener für Klick außerhalb des Modals
    if (employeeModal && employeeNameInput) {
        employeeModal.addEventListener('click', (e) => {
            if (e.target === employeeModal) {
                employeeModal.style.display = 'none';
                employeeNameInput.value = '';
            }
        });
    }

    // Event Listener für Escape-Taste
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && employeeModal && employeeModal.style.display === 'block') {
            employeeModal.style.display = 'none';
            if (employeeNameInput) employeeNameInput.value = '';
        }
    });

    // Automatisches Speichern der Notizen
    if (infoText) {
        infoText.addEventListener('input', () => {
            if (currentEditingCell) {
                saveCellNote();
            }
        });
    }
    
    // Event Listener für das Lösch-Modal
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDeleteEmployee);
    }
    
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', hideDeleteEmployeeModal);
    }
    
    // Event Listener für Klick außerhalb des Lösch-Modals
    if (deleteEmployeeModal) {
        deleteEmployeeModal.addEventListener('click', (e) => {
            if (e.target === deleteEmployeeModal) {
                hideDeleteEmployeeModal();
            }
        });
    }
    
    // Event Listener für Escape-Taste im Lösch-Modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && deleteEmployeeModal && deleteEmployeeModal.style.display === 'block') {
            hideDeleteEmployeeModal();
        }
    });
}

// Event Listener für das Ende der Auswahl
document.addEventListener('mouseup', () => {
    isSelecting = false;
});

// Event Listener für Klick außerhalb der markierten Felder
document.addEventListener('click', (e) => {
    // Prüfe, ob der Klick außerhalb der markierten Zellen war
    if (!e.target.closest('.calendar-container')) {
        clearSelection();
    }
});

// Status-Button Event Listener
document.querySelectorAll('.status-button').forEach(button => {
    button.addEventListener('click', async () => {
        const status = button.dataset.status;
        await applyStatusToSelectedCells(status);
    });
});

// Event Listener für Tastaturkürzel
document.addEventListener('keydown', async (e) => {
    // Strg+Z für Undo
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
    }
    
    // Entf-Taste
    if (e.key === 'Delete' && selectedCells.size > 0) {
        selectedCells.forEach(cell => {
            const row = cell.parentElement;
            const employee = row.querySelector('td:first-child span').textContent;
            const dateKey = getDateKeyFromCell(cell);
            if (!dateKey) return;
            
            const noteKey = `${employee}-${dateKey}`;
            const linkKey = `${employee}-${dateKey}-link`;
            
            // Lösche Notiz und Link
            delete cellNotes[noteKey];
            delete cellLinks[linkKey];
            cell.removeAttribute('data-info');
            
            // Lösche Zuweisung
            if (assignments[employee]) {
                delete assignments[employee][dateKey];
            }
            
            // Setze Zelleninhalt zurück
            cell.innerHTML = '<div class="cell-content"><div class="cell-text"></div></div>';
            cell.className = 'calendar-cell';
            
            // Prüfe Wochenende basierend auf dem tatsächlichen Datum
            const [year, month, day] = dateKey.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (date.getDay() === 0 || date.getDay() === 6) {
                cell.classList.add('weekend-cell');
            }
        });
        
        await saveData('cellNotes', cellNotes);
        await saveData('cellLinks', cellLinks);
        await saveData('assignments', assignments);
    }
    
    // Strg+C
    if (e.ctrlKey && e.key === 'c' && selectedCells.size > 0) {
        const firstCell = Array.from(selectedCells)[0];
        const row = firstCell.parentElement;
        const employee = row.querySelector('td:first-child span').textContent;
        const dateKey = getDateKeyFromCell(firstCell);
        if (!dateKey) return;
        
        const noteKey = `${employee}-${dateKey}`;
        const linkKey = `${employee}-${dateKey}-link`;
        const addressKey = `${employee}-${dateKey}-address`;

        copiedContent = {
            text: firstCell.querySelector('.cell-text')?.textContent || '',
            status: Array.from(firstCell.classList).find(cls => cls.startsWith('status-')),
            note: cellNotes[noteKey] || '',
            link: cellLinks[linkKey] || '',
            address: cellAddresses[addressKey] || ''
        };
    }
    
    // Strg+V
    if (e.ctrlKey && e.key === 'v' && copiedContent && selectedCells.size > 0) {
        saveState(); // Speichere den aktuellen Zustand vor dem Einfügen
        selectedCells.forEach(cell => {
            const row = cell.parentElement;
            const employee = row.querySelector('td:first-child span').textContent;
            const dateKey = getDateKeyFromCell(cell);
            if (!dateKey) return;
            
            const noteKey = `${employee}-${dateKey}`;
            const linkKey = `${employee}-${dateKey}-link`;
            const addressKey = `${employee}-${dateKey}-address`;
            
            // Setze Text und Status
            if (copiedContent.text) {
                if (!assignments[employee]) {
                    assignments[employee] = {};
                }
                assignments[employee][dateKey] = {
                    text: copiedContent.text,
                    status: copiedContent.status
                };
                cell.className = 'calendar-cell';
                if (copiedContent.status) {
                    cell.classList.add(copiedContent.status);
                }
            }
            
            // Setze Notiz, Link und Adresse
            if (copiedContent.note || copiedContent.link || copiedContent.address) {
                cellNotes[noteKey] = copiedContent.note;
                cellLinks[linkKey] = copiedContent.link;
                cellAddresses[addressKey] = copiedContent.address;
                cell.setAttribute('data-info', copiedContent.note);
                
                // Aktualisiere die Anzeige
                cell.innerHTML = `
                    <div class="cell-content">
                        <div class="cell-text">${copiedContent.note || ''}</div>
                        <div class="cell-icons">
                            ${copiedContent.link ? '<div class="folder-icon">📁</div>' : ''}
                            ${copiedContent.address ? '<div class="map-icon">🗺️</div>' : ''}
                        </div>
                    </div>
                `;
            } else {
                delete cellNotes[noteKey];
                delete cellLinks[linkKey];
                delete cellAddresses[addressKey];
                cell.removeAttribute('data-info');
            }
            
            // Setze die Hintergrundfarbe und Textfarbe basierend auf dem Status
            const statusColors = {
                'urlaub': '#28a745',
                'krank': '#dc3545',
                'unbezahlt': '#ffc107',
                'schulung': '#6f42c1',
                'feiertag': '#17a2b8',
                'kurzarbeit': '#795548',
                'abgerechnet': '#e8f5e9'
            };

            if (copiedContent.status) {
                const bgColor = statusColors[copiedContent.status];
                cell.style.backgroundColor = bgColor;
                // Setze die Textfarbe basierend auf der Hintergrundfarbe
                if (bgColor === '#e8f5e9' || bgColor === '#ffc107' || bgColor === '') {
                    cell.style.color = 'black';
                } else {
                    cell.style.color = 'white';
                }
            } else {
                cell.style.backgroundColor = '';
                cell.style.color = 'black';
            }
            
            // Füge weekend-cell Klasse hinzu, wenn nötig
            const [year, month, day] = dateKey.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (date.getDay() === 0 || date.getDay() === 6) {
                cell.classList.add('weekend-cell');
            }
        });
        
        await saveData('cellNotes', cellNotes);
        await saveData('cellLinks', cellLinks);
        await saveData('cellAddresses', cellAddresses);
        await saveData('assignments', assignments);
    }
});

// Initialisierung
async function initializeApp() {
    console.log('Initialisiere App...');
    
    // Initialisiere Firebase zuerst
    await initializeFirebase();
    
    // Setze DOM-Elemente
    yearGrid = document.getElementById('yearGrid');
    monthGrid = document.getElementById('monthGrid');
    calendarBody = document.getElementById('calendarBody');
    headerRow = document.getElementById('headerRow');
    employeeModal = document.getElementById('employeeModal');
    employeeNameInput = document.getElementById('employeeName');
    deleteEmployeeModal = document.getElementById('deleteEmployeeModal');
    employeeToDeleteSpan = document.getElementById('employeeToDelete');
    infoField = document.getElementById('infoField');
    infoText = document.getElementById('infoText');
    zoomOutButton = document.getElementById('zoomOut');
    
    console.log('Mitarbeiter:', employees);
    console.log('DOM-Elemente:', { yearGrid: !!yearGrid, monthGrid: !!monthGrid });
    
    if (yearGrid && monthGrid) {
        initializeYearGrid();
        initializeMonthGrid();
        setupToggleViewButton();
        updateCalendar();
        setupInfoFieldListeners();
        setupEventListeners();
        console.log('App initialisiert');
    } else {
        console.error('DOM-Elemente nicht gefunden!');
        // Versuche es nochmal nach kurzer Verzögerung
        setTimeout(initializeApp, 100);
    }
}

// Starte Initialisierung wenn alles geladen ist
window.addEventListener('load', function() {
    // Warte kurz, damit alle Scripts geladen sind
    setTimeout(initializeApp, 100);
});

function initializeYearGrid() {
    if (!yearGrid) {
        console.error('yearGrid nicht gefunden!');
        return;
    }
    const currentYear = currentDate.getFullYear();
    yearGrid.innerHTML = '';
    
    for (let year = 2025; year <= 2036; year++) {
        const button = document.createElement('button');
        button.className = 'year-button';
        button.textContent = year;
        if (year === currentYear) button.classList.add('selected');
        
        button.addEventListener('click', () => {
            currentDate.setFullYear(year);
            document.querySelectorAll('.year-button').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            updateCalendar();
        });
        
        yearGrid.appendChild(button);
    }
}

function initializeMonthGrid() {
    if (!monthGrid) {
        console.error('monthGrid nicht gefunden!');
        return;
    }
    const months = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    
    monthGrid.innerHTML = '';
    
    months.forEach((month, index) => {
        const button = document.createElement('button');
        button.className = 'month-button';
        button.textContent = month;
        if (index === currentDate.getMonth()) button.classList.add('selected');
        
        button.addEventListener('click', () => {
            currentDate.setMonth(index);
            document.querySelectorAll('.month-button').forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            updateCalendar();
        });
        
        monthGrid.appendChild(button);
    });
}

function getWeekdayName(date) {
    const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return weekdays[date.getDay()];
}

function updateCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    console.log('Update Calendar:', { year, month, isWeekView, employeesCount: employees.length });
    console.log('Mitarbeiter Liste:', employees);
    
    if (!yearGrid || !monthGrid) {
        console.error('DOM-Elemente nicht verfügbar für updateCalendar');
        return;
    }
    
    if (window.innerWidth <= 768) {
        setupMobileWeekView();
        return;
    }
    
    if (isWeekView) {
        setupDesktopWeekView();
    } else {
        setupDesktopMonthView();
    }
}

function setupDesktopWeekView() {
    const calendarContainer = document.querySelector('.calendar-container');
    
    // Erstelle Wochen-Navigation
    const weekNav = document.createElement('div');
    weekNav.className = 'week-navigation';
    
    const prevWeekBtn = document.createElement('button');
    prevWeekBtn.className = 'week-nav-button';
    prevWeekBtn.textContent = '←';
    prevWeekBtn.addEventListener('click', () => {
        navigateWeek(-1);
        setupDesktopWeekView();
    });
    
    const nextWeekBtn = document.createElement('button');
    nextWeekBtn.className = 'week-nav-button';
    nextWeekBtn.textContent = '→';
    nextWeekBtn.addEventListener('click', () => {
        navigateWeek(1);
        setupDesktopWeekView();
    });
    
    const currentWeekSpan = document.createElement('span');
    currentWeekSpan.className = 'current-week';
    updateCurrentWeekDisplay(currentWeekSpan);
    
    weekNav.appendChild(prevWeekBtn);
    weekNav.appendChild(currentWeekSpan);
    weekNav.appendChild(nextWeekBtn);
    
    // Erstelle die Wochenansicht
    const weekView = document.createElement('div');
    weekView.className = 'week-view';
    
    // Erstelle eine neue Tabelle für die Wochenansicht
    const weekTable = document.createElement('table');
    weekTable.className = 'calendar';
    
    // Erstelle den Tabellenkopf
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Mitarbeiter</th>';
    thead.appendChild(headerRow);
    weekTable.appendChild(thead);
    
    // Erstelle den Tabellenkörper
    const tbody = document.createElement('tbody');
    weekTable.appendChild(tbody);
    
    // Füge nur aktive Mitarbeiter hinzu
    employees.forEach(employee => {
        // Wenn keine Start-/Enddaten vorhanden sind, zeige den Mitarbeiter immer an
        let shouldShow = true;
        
        if (employeeStartDates[employee] || employeeEndDates[employee]) {
            const startDate = new Date(employeeStartDates[employee] || '2000-01-01');
            const endDate = employeeEndDates[employee] ? new Date(employeeEndDates[employee]) : new Date('2100-12-31');
            const currentMonthDate = new Date(currentDate);
            shouldShow = isDateInRange(currentMonthDate, startDate, endDate);
        }
        
        if (shouldShow) {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            
            const nameContainer = document.createElement('div');
            nameContainer.className = 'name-container';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = employee;
            nameContainer.appendChild(nameSpan);
            
            // Verschiebe-Buttons
            const moveUpButton = document.createElement('button');
            moveUpButton.className = 'move-employee';
            moveUpButton.textContent = '↑';
            moveUpButton.title = 'Nach oben verschieben';
            moveUpButton.style.cssText = 'margin: 0 2px; padding: 2px 6px; font-size: 12px;';
            moveUpButton.addEventListener('click', (e) => {
                e.stopPropagation();
                moveEmployee(employee, 'up');
            });
            nameContainer.appendChild(moveUpButton);
            
            const moveDownButton = document.createElement('button');
            moveDownButton.className = 'move-employee';
            moveDownButton.textContent = '↓';
            moveDownButton.title = 'Nach unten verschieben';
            moveDownButton.style.cssText = 'margin: 0 2px; padding: 2px 6px; font-size: 12px;';
            moveDownButton.addEventListener('click', (e) => {
                e.stopPropagation();
                moveEmployee(employee, 'down');
            });
            nameContainer.appendChild(moveDownButton);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-employee';
            deleteButton.textContent = '×';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteEmployeeModal(employee);
            });
            nameContainer.appendChild(deleteButton);
            
            nameCell.appendChild(nameContainer);
            row.appendChild(nameCell);
            tbody.appendChild(row);
        }
    });
    
    weekView.appendChild(weekNav);
    weekView.appendChild(weekTable);
    
    // Aktualisiere den Container
    calendarContainer.innerHTML = '';
    calendarContainer.appendChild(weekView);
    
    // Zeige die aktuelle Woche
    showCurrentWeek();
}

function setupDesktopMonthView() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    console.log('setupDesktopMonthView:', { year, month, employeesCount: employees.length });
    
    // Erstelle neue Tabelle
    const calendarContainer = document.querySelector('.calendar-container');
    if (!calendarContainer) {
        console.error('calendar-container nicht gefunden!');
        return;
    }
    calendarContainer.innerHTML = '';
    
    const calendar = document.createElement('table');
    calendar.className = 'calendar';
    
    // Erstelle Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Mitarbeiter</th>';
    
    // Füge Tage zum Header hinzu
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    console.log('Tage im Monat:', daysInMonth);
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const th = document.createElement('th');
        
        const weekdaySpan = document.createElement('span');
        weekdaySpan.className = 'weekday-header';
        weekdaySpan.textContent = getWeekdayName(date);
        
        const daySpan = document.createElement('span');
        daySpan.textContent = day;
        
        th.appendChild(weekdaySpan);
        th.appendChild(daySpan);
        
        if (isWeekend) th.classList.add('weekend');
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    calendar.appendChild(thead);
    
    // Erstelle Body
    const tbody = document.createElement('tbody');
    
    console.log('Verarbeite Mitarbeiter:', employees.length);
    
    // Füge Mitarbeiter-Zeilen hinzu
    employees.forEach((employee, index) => {
        // Wenn keine Start-/Enddaten vorhanden sind, zeige den Mitarbeiter immer an
        let shouldShow = true;
        
        if (employeeStartDates[employee] || employeeEndDates[employee]) {
            const startDate = new Date(employeeStartDates[employee] || '2000-01-01');
            const endDate = employeeEndDates[employee] ? new Date(employeeEndDates[employee]) : new Date('2100-12-31');
            const currentMonthDate = new Date(year, month, 1);
            shouldShow = isDateInRange(currentMonthDate, startDate, endDate);
            console.log(`Mitarbeiter ${employee} (${index}):`, { 
                shouldShow, 
                startDate: startDate.toISOString(), 
                endDate: endDate.toISOString(),
                currentMonth: currentMonthDate.toISOString()
            });
        } else {
            console.log(`Mitarbeiter ${employee} (${index}): Keine Start-/Enddaten, zeige immer an`);
        }
        
        if (shouldShow) {
            console.log(`Füge Mitarbeiter hinzu: ${employee}`);
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            
            const nameContainer = document.createElement('div');
            nameContainer.className = 'name-container';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = employee;
            nameContainer.appendChild(nameSpan);
            
            // Verschiebe-Buttons
            const moveUpButton = document.createElement('button');
            moveUpButton.className = 'move-employee';
            moveUpButton.textContent = '↑';
            moveUpButton.title = 'Nach oben verschieben';
            moveUpButton.style.cssText = 'margin: 0 2px; padding: 2px 6px; font-size: 12px;';
            moveUpButton.addEventListener('click', (e) => {
                e.stopPropagation();
                moveEmployee(employee, 'up');
            });
            nameContainer.appendChild(moveUpButton);
            
            const moveDownButton = document.createElement('button');
            moveDownButton.className = 'move-employee';
            moveDownButton.textContent = '↓';
            moveDownButton.title = 'Nach unten verschieben';
            moveDownButton.style.cssText = 'margin: 0 2px; padding: 2px 6px; font-size: 12px;';
            moveDownButton.addEventListener('click', (e) => {
                e.stopPropagation();
                moveEmployee(employee, 'down');
            });
            nameContainer.appendChild(moveDownButton);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-employee';
            deleteButton.textContent = '×';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteEmployeeModal(employee);
            });
            nameContainer.appendChild(deleteButton);
            
            nameCell.appendChild(nameContainer);
            row.appendChild(nameCell);
            
            for (let day = 1; day <= daysInMonth; day++) {
                const cell = document.createElement('td');
                cell.className = 'calendar-cell';
                const date = new Date(year, month, day);
                const dateKey = `${year}-${month + 1}-${day}`;
                
                if (date.getDay() === 0 || date.getDay() === 6) {
                    cell.classList.add('weekend-cell');
                }
                
                const noteKey = `${employee}-${dateKey}`;
                const linkKey = `${employee}-${dateKey}-link`;
                const addressKey = `${employee}-${dateKey}-address`;
                
                // Erstelle zuerst die Zellenstruktur
                const cellContent = document.createElement('div');
                cellContent.className = 'cell-content';
                
                const cellText = document.createElement('div');
                cellText.className = 'cell-text';
                cellText.textContent = cellNotes[noteKey] || '';
                cellContent.appendChild(cellText);
                
                const cellIcons = document.createElement('div');
                cellIcons.className = 'cell-icons';
                cellContent.appendChild(cellIcons);
                
                cell.appendChild(cellContent);
                
                // Setze dann die Notizen und Icons
                if (cellNotes[noteKey] || cellLinks[linkKey] || cellAddresses[addressKey]) {
                    cell.setAttribute('data-info', cellNotes[noteKey] || '');
                    cellText.textContent = cellNotes[noteKey] || '';
                    
                    if (cellLinks[linkKey]) {
                        const folderIcon = document.createElement('div');
                        folderIcon.className = 'folder-icon';
                        folderIcon.textContent = '📁';
                        cellIcons.appendChild(folderIcon);
                    }
                    
                    if (cellAddresses[addressKey]) {
                        const mapIcon = document.createElement('div');
                        mapIcon.className = 'map-icon';
                        mapIcon.textContent = '🗺️';
                        cellIcons.appendChild(mapIcon);
                    }
                }
                
                // Aktualisiere zuletzt den Status und die Farben
                updateCell(cell, employee, dateKey);
                
                // Event Listener für Zellenauswahl
                cell.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    if (!isSelecting) {
                        clearSelection();
                    }
                    isSelecting = true;
                    lastSelectedCell = cell;
                    toggleCellSelection(cell);
                });
                
                cell.addEventListener('mouseover', (e) => {
                    if (isSelecting && lastSelectedCell) {
                        selectCellsBetween(lastSelectedCell, cell);
                    }
                });
                
                // Einfacher Klick öffnet das Notizfeld (nur anzeigen)
                let clickTimeout;
                // Einfacher Klick schließt nur das alte Notizfeld, wenn es eine andere Zelle ist
                cell.addEventListener('click', (e) => {
                    clearTimeout(clickTimeout);
                    clickTimeout = setTimeout(() => {
                        // Schließe das alte Notizfeld, wenn es eine andere Zelle ist
                        if (currentEditingCell && currentEditingCell !== cell) {
                            closeInfoField();
                        }
                        // Öffne das Popup NICHT bei einfachem Klick
                    }, 200); // Warte auf möglichen Doppelklick
                });
                
                // Doppelklick öffnet das Notizfeld zum Schreiben
                cell.addEventListener('dblclick', (e) => {
                    clearTimeout(clickTimeout);
                    e.preventDefault();
                    showInfoField(cell, employee, dateKey, true);
                });
                
                row.appendChild(cell);
            }
            
            tbody.appendChild(row);
        }
    });
    
    // Wenn keine Mitarbeiter vorhanden sind, zeige eine Meldung
    if (tbody.children.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = daysInMonth + 1;
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '20px';
        emptyCell.style.color = '#666';
        emptyCell.textContent = 'Keine Mitarbeiter vorhanden. Klicken Sie auf "Mitarbeiter hinzufügen" um zu beginnen.';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
        console.warn('WARNUNG: Keine Mitarbeiter-Zeilen erstellt!');
        console.warn('Mitarbeiter-Array:', employees);
        console.warn('Mitarbeiter Startdaten:', employeeStartDates);
        console.warn('Mitarbeiter Enddaten:', employeeEndDates);
    }
    
    calendar.appendChild(tbody);
    calendarContainer.appendChild(calendar);
    
    console.log(`Kalender erstellt: ${tbody.children.length} Zeilen, ${daysInMonth} Tage`);
}

function showCurrentWeek() {
    const weekContainer = document.querySelector('.week-container') || document.querySelector('.week-view');
    const calendar = weekContainer.querySelector('.calendar');
    
    // Berechne Montag der aktuellen Woche
    const monday = getCurrentWeek();
    
    // Aktualisiere die Anzeige
    updateCurrentWeekDisplay(document.querySelector('.current-week'));
    
    // Erstelle neue Header-Zeile
    const headerRow = calendar.querySelector('thead tr');
    headerRow.innerHTML = '<th>Mitarbeiter</th>';
    
    // Füge die Tage von Montag bis Sonntag hinzu
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        
        const th = document.createElement('th');
        const weekdaySpan = document.createElement('span');
        weekdaySpan.className = 'weekday-header';
        weekdaySpan.textContent = getWeekdayName(date);
        
        const daySpan = document.createElement('span');
        daySpan.textContent = date.getDate();
        
        th.appendChild(weekdaySpan);
        th.appendChild(daySpan);
        
        if (date.getDay() === 0 || date.getDay() === 6) {
            th.classList.add('weekend');
        }
        
        headerRow.appendChild(th);
    }
    
    // Aktualisiere die Mitarbeiter-Zeilen
    const tbody = calendar.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        const employee = cells[0].querySelector('span').textContent;
        
        // Lösche alle Zellen außer der ersten (Mitarbeiter-Name)
        while (cells.length > 1) {
            row.removeChild(cells[1]);
        }
        
        // Füge neue Zellen für die Woche hinzu
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            
            const cell = document.createElement('td');
            cell.className = 'calendar-cell';
            
            if (date.getDay() === 0 || date.getDay() === 6) {
                cell.classList.add('weekend-cell');
            }
            
            const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            const noteKey = `${employee}-${dateKey}`;
            const linkKey = `${employee}-${dateKey}-link`;
            const addressKey = `${employee}-${dateKey}-address`;
            
            if (cellNotes[noteKey] || cellLinks[linkKey] || cellAddresses[addressKey]) {
                cell.setAttribute('data-info', cellNotes[noteKey] || '');
                
                const cellContent = document.createElement('div');
                cellContent.className = 'cell-content';
                
                const cellText = document.createElement('div');
                cellText.className = 'cell-text';
                cellText.textContent = cellNotes[noteKey] || '';
                cellContent.appendChild(cellText);
                
                const cellIcons = document.createElement('div');
                cellIcons.className = 'cell-icons';
                
                if (cellLinks[linkKey]) {
                    const folderIcon = document.createElement('div');
                    folderIcon.className = 'folder-icon';
                    folderIcon.textContent = '📁';
                    cellIcons.appendChild(folderIcon);
                }
                
                if (cellAddresses[addressKey]) {
                    const mapIcon = document.createElement('div');
                    mapIcon.className = 'map-icon';
                    mapIcon.textContent = '🗺️';
                    cellIcons.appendChild(mapIcon);
                }
                
                cellContent.appendChild(cellIcons);
                cell.appendChild(cellContent);
            }
            
            // Status und Farben anwenden
            updateCell(cell, employee, dateKey);
            
            // Event Listener für Zellenauswahl
            cell.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (!isSelecting) {
                    clearSelection();
                }
                isSelecting = true;
                lastSelectedCell = cell;
                toggleCellSelection(cell);
            });
            
            cell.addEventListener('mouseover', (e) => {
                if (isSelecting && lastSelectedCell) {
                    selectCellsBetween(lastSelectedCell, cell);
                }
            });
            
            // Einfacher Klick öffnet das Notizfeld (nur anzeigen)
            let clickTimeout;
            // Einfacher Klick schließt nur das alte Notizfeld, wenn es eine andere Zelle ist
            cell.addEventListener('click', (e) => {
                clearTimeout(clickTimeout);
                clickTimeout = setTimeout(() => {
                    // Schließe das alte Notizfeld, wenn es eine andere Zelle ist
                    if (currentEditingCell && currentEditingCell !== cell) {
                        closeInfoField();
                    }
                    // Öffne das Popup NICHT bei einfachem Klick
                }, 200); // Warte auf möglichen Doppelklick
            });
            
            // Doppelklick öffnet das Notizfeld zum Schreiben
            cell.addEventListener('dblclick', (e) => {
                clearTimeout(clickTimeout);
                e.preventDefault();
                showInfoField(cell, employee, dateKey, true);
            });
            
            row.appendChild(cell);
        }
    });
}

function navigateWeek(direction) {
    const monday = getCurrentWeek();
    monday.setDate(monday.getDate() + (direction * 7));
    currentDate = new Date(monday);
}

function getCurrentWeek() {
    const date = new Date(currentDate);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Anpassung für Montag als ersten Tag
    const monday = new Date(date.setDate(diff));
    return monday;
}

// Hilfsfunktion zum Ermitteln des dateKey aus einer Zelle
// Berücksichtigt sowohl Monats- als auch Wochenansicht
function getDateKeyFromCell(cell) {
    if (!cell || !cell.parentElement) return null;
    
    const row = cell.parentElement;
    const dayIndex = Array.from(row.children).indexOf(cell);
    
    if (dayIndex <= 0) return null; // Index 0 ist der Mitarbeitername
    
    const calendar = row.closest('.calendar');
    if (!calendar) return null;
    
    const headerRow = calendar.querySelector('thead tr');
    if (!headerRow) return null;
    
    const headerCells = headerRow.querySelectorAll('th');
    if (dayIndex >= headerCells.length) return null;
    
    const headerCell = headerCells[dayIndex];
    if (!headerCell) return null;
    
    // Prüfe, ob es eine Wochenansicht ist: Wochenansicht hat genau 8 Header-Zellen (1 Mitarbeiter + 7 Tage)
    // Monatsansicht hat mehr als 8 Header-Zellen
    const isWeekView = headerCells.length === 8;
    
    if (isWeekView) {
        // Wochenansicht: Berechne Datum aus Montag + Tag-Offset
        const monday = getCurrentWeek();
        const cellDate = new Date(monday);
        cellDate.setDate(monday.getDate() + (dayIndex - 1)); // -1 weil Index 0 = Mitarbeitername
        return `${cellDate.getFullYear()}-${cellDate.getMonth() + 1}-${cellDate.getDate()}`;
    } else {
        // Monatsansicht: dayIndex entspricht direkt dem Tag
        return `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${dayIndex}`;
    }
}

function updateCurrentWeekDisplay(element) {
    const monday = getCurrentWeek();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const monthNames = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    
    let displayText = '';
    if (monday.getMonth() === sunday.getMonth()) {
        displayText = `${monthNames[monday.getMonth()]} ${monday.getDate()}. - ${sunday.getDate()}.`;
    } else {
        displayText = `${monday.getDate()}. ${monthNames[monday.getMonth()]} - ${sunday.getDate()}. ${monthNames[sunday.getMonth()]}`;
    }
    
    element.textContent = displayText;
}

// Event Listener für Fenstergrößenänderung
window.addEventListener('resize', () => {
    updateCalendar();
});

function selectCellsBetween(startCell, endCell) {
    if (!startCell || !endCell) return;
    
    const startRow = startCell.parentElement;
    const endRow = endCell.parentElement;
    const startIndex = Array.from(startRow.children).indexOf(startCell);
    const endIndex = Array.from(endRow.children).indexOf(endCell);
    
    const rows = Array.from(document.querySelector('.calendar tbody').children);
    const startRowIndex = rows.indexOf(startRow);
    const endRowIndex = rows.indexOf(endRow);
    
    const minRow = Math.min(startRowIndex, endRowIndex);
    const maxRow = Math.max(startRowIndex, endRowIndex);
    const minCol = Math.min(startIndex, endIndex);
    const maxCol = Math.max(startIndex, endIndex);
    
    // Markiere dann die neuen Zellen
    for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
            const cell = rows[row].children[col];
            if (cell && !cell.classList.contains('name-cell')) {
                cell.classList.add('selected');
                selectedCells.add(cell);
            }
        }
    }
}

function toggleCellSelection(cell) {
    if (!cell) return;
    
    if (cell.classList.contains('selected')) {
        cell.classList.remove('selected');
        selectedCells.delete(cell);
    } else {
        cell.classList.add('selected');
        selectedCells.add(cell);
    }
}

function clearSelection() {
    selectedCells.forEach(cell => {
        if (cell) {
            cell.classList.remove('selected');
        }
    });
    selectedCells.clear();
    lastSelectedCell = null;
}

async function applyStatusToSelectedCells(status) {
    if (selectedCells.size === 0) return;
    
    saveState(); // Speichere den aktuellen Zustand vor der Änderung
    
    const statusText = {
        'urlaub': 'Urlaub',
        'krank': 'Krankheit',
        'unbezahlt': 'Unbezahlter Urlaub',
        'schulung': 'Schule',
        'feiertag': 'Feiertag',
        'kurzarbeit': 'Kurzarbeit',
        'abgerechnet': 'Abgerechnet',
        'ueberstunden': 'Überstunden frei'
    }[status];

    const statusColors = {
        'urlaub': '#28a745',
        'krank': '#dc3545',
        'unbezahlt': '#ffc107',
        'schulung': '#6f42c1',
        'feiertag': '#17a2b8',
        'kurzarbeit': '#795548',
        'abgerechnet': '#e8f5e9',
        'ueberstunden': '#20c997'
    };

    selectedCells.forEach(cell => {
        const row = cell.parentElement;
        const employee = row.querySelector('td:first-child span').textContent;
        const dateKey = getDateKeyFromCell(cell);
        if (!dateKey) return;
        
        if (!assignments[employee]) {
            assignments[employee] = {};
        }

        // Prüfe, ob die Zelle bereits den gleichen Status hat
        const currentAssignment = assignments[employee][dateKey];
        if (status === 'abgerechnet' && currentAssignment && currentAssignment.status === 'abgerechnet') {
            // Wenn die Zelle bereits als "Abgerechnet" markiert ist, entferne die Markierung
            delete assignments[employee][dateKey];
            cell.style.backgroundColor = '';
            cell.style.color = 'black';
            // Entferne Haken
            const checkmark = cell.querySelector('.checkmark');
            if (checkmark) checkmark.remove();
            // Stelle ursprünglichen Inhalt wieder her
            updateCell(cell, employee, dateKey);
        } else {
            // Stelle sicher, dass der ursprüngliche Inhalt sichtbar ist
            const cellText = cell.querySelector('.cell-text');
            const originalText = cellText ? cellText.textContent.trim() : '';
            
            // Für "abgerechnet": Text sichtbar lassen, nur leicht grün hinterlegen und Haken hinzufügen
            if (status === 'abgerechnet') {
                // Setze den neuen Status - nur wenn Text vorhanden ist, sonst leer lassen
                assignments[employee][dateKey] = {
                    text: originalText || '', // Leere Felder bleiben leer
                    status: status
                };
                
                // Leicht grüne Hintergrundfarbe
                cell.style.backgroundColor = '#d4edda';
                cell.style.color = 'black';
                
                // Erstelle Zelleninhalt mit Haken oben rechts
                if (!cell.querySelector('.checkmark')) {
                    const checkmark = document.createElement('div');
                    checkmark.className = 'checkmark';
                    checkmark.textContent = '✓';
                    checkmark.style.cssText = 'position: absolute; top: 2px; right: 2px; color: #28a745; font-weight: bold; font-size: 14px; z-index: 10;';
                    cell.style.position = 'relative';
                    cell.appendChild(checkmark);
                }
                
                // Text bleibt sichtbar (nur wenn vorhanden, sonst leer)
                if (cellText) {
                    cellText.textContent = originalText; // Kein statusText für leere Felder
                }
            } else {
                // Für andere Status: Normal verhalten
                // Stelle sicher, dass assignments gesetzt wird
                if (!assignments[employee][dateKey]) {
                    assignments[employee][dateKey] = {};
                }
                assignments[employee][dateKey].text = statusText;
                assignments[employee][dateKey].status = status;
            }
            
            // Aktualisiere die Zelle mit updateCell für konsistente Anzeige
            updateCell(cell, employee, dateKey);
        }
        
        // Prüfe Wochenende basierend auf dem tatsächlichen Datum
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        if (date.getDay() === 0 || date.getDay() === 6) {
            cell.classList.add('weekend-cell');
        }
    });
    
    // Warte auf das Speichern, damit die Daten sicher gespeichert sind
    await saveData('assignments', assignments);
    
    // Protokolliere Status-Änderungen
    selectedCells.forEach(cell => {
        const row = cell.parentElement;
        const employee = row.querySelector('td:first-child span').textContent;
        const dateKey = getDateKeyFromCell(cell);
        if (!dateKey) return;
        
        addToAuditLog('Status geändert', { 
            employee: employee, 
            date: dateKey, 
            status: status,
            statusText: statusText
        });
    });
    
    clearSelection();
}

// Funktion zum Schließen des Notizfeldes
async function closeInfoField() {
    if (currentEditingCell) {
        await saveCellNote();
        currentEditingCell = null;
    }
    // Schließe das Modal
    if (infoField) {
        infoField.style.display = 'none';
    } else {
        const modal = document.getElementById('infoField');
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

function showInfoField(cell, employee, dateKey, editable = true) {
    // Schließe das vorherige Notizfeld, wenn vorhanden
    if (currentEditingCell && currentEditingCell !== cell) {
        closeInfoField();
    }
    
    currentEditingCell = cell;
    const noteKey = `${employee}-${dateKey}`;
    const linkKey = `${employee}-${dateKey}-link`;
    const addressKey = `${employee}-${dateKey}-address`;
    
    // Setze die Werte in die bereits vorhandenen Felder
    const infoText = document.getElementById('infoText');
    const linkInput = document.getElementById('linkInput');
    const addressInput = document.getElementById('addressInput');
    
    if (infoText) {
        infoText.value = cellNotes[noteKey] || '';
        infoText.disabled = !editable;
        if (editable) infoText.readOnly = false;
        else infoText.readOnly = true;
    }
    if (linkInput) {
        linkInput.value = cellLinks[linkKey] || '';
        linkInput.disabled = !editable;
        if (editable) linkInput.readOnly = false;
        else linkInput.readOnly = true;
    }
    if (addressInput) {
        addressInput.value = cellAddresses[addressKey] || '';
        addressInput.disabled = !editable;
        if (editable) addressInput.readOnly = false;
        else addressInput.readOnly = true;
    }
    
    // Öffne das Modal
    const modal = infoField || document.getElementById('infoField');
    if (modal) {
        modal.style.display = 'block';
    }
    
    if (editable && infoText) {
        infoText.focus();
    }
}

// Event Listener für Notizfeld (einmalig beim Laden)
let infoFieldListenersSetup = false;
function setupInfoFieldListeners() {
    if (infoFieldListenersSetup) return;
    infoFieldListenersSetup = true;
    
    // Event Listener für Eingabefelder (verwende Event Delegation)
    document.addEventListener('input', (e) => {
        if (e.target.id === 'infoText' || e.target.id === 'linkInput' || e.target.id === 'addressInput') {
            if (currentEditingCell) {
                saveCellNote();
            }
        }
    });
    
    // Event Listener für Schließen-Button
    document.addEventListener('click', (e) => {
        if (e.target.id === 'closeInfoField') {
            closeInfoField();
        }
    });
    
    // Event Listener für Ordner öffnen Button
    document.addEventListener('click', (e) => {
        if (e.target.id === 'openLinkFolder') {
            const linkPath = document.getElementById('linkInput')?.value.trim();
            if (linkPath) {
                try {
                    // Prüfe, ob wir in einer Electron-Umgebung sind
                    if (window.require) {
                        // Desktop-Version: Verwende Electron shell
                        const { shell } = require('electron');
                        shell.openPath(linkPath).then(() => {
                            console.log('Ordner wurde erfolgreich geöffnet');
                        }).catch(err => {
                            console.error('Fehler beim Öffnen des Ordners:', err);
                            alert('Fehler beim Öffnen des Ordners. Bitte überprüfen Sie den Pfad.');
                        });
                    } else {
                        // Web-Version: Zeige Pfad an und gib Anleitung
                        alert(`In der Web-Version können Ordner nicht direkt geöffnet werden.\n\nPfad: ${linkPath}\n\nBitte kopieren Sie den Pfad und öffnen Sie ihn manuell im Windows Explorer.`);
                    }
                } catch (error) {
                    console.error('Fehler beim Öffnen des Ordners:', error);
                    alert('Fehler beim Öffnen des Ordners. Bitte überprüfen Sie den Pfad.');
                }
            } else {
                alert('Bitte geben Sie einen gültigen Ordnerpfad ein.');
            }
        }
    });
    
    // Event Listener für den Maps Button
    document.addEventListener('click', (e) => {
        if (e.target.id === 'openMaps') {
            const address = document.getElementById('addressInput')?.value.trim();
            if (address) {
                const encodedAddress = encodeURIComponent(address);
                const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
                window.open(mapsUrl, '_blank');
            } else {
                alert('Bitte geben Sie eine gültige Adresse ein.');
            }
        }
    });
    
    // Schließe Modal beim Klick außerhalb
    const infoFieldModal = document.getElementById('infoField');
    if (infoFieldModal) {
        infoFieldModal.addEventListener('click', (e) => {
            if (e.target === infoFieldModal) {
                closeInfoField();
            }
        });
    }
}

async function saveCellNote() {
    if (!currentEditingCell) return;
    
    // Prüfe, ob die Eingabefelder noch aktiv sind
    const infoText = document.getElementById('infoText');
    if (infoText && infoText.disabled) {
        return; // Eingabefeld ist deaktiviert, nicht speichern
    }
    
    const row = currentEditingCell.parentElement;
    const employee = row.querySelector('td:first-child span').textContent;
    const dateKey = getDateKeyFromCell(currentEditingCell);
    if (!dateKey) return;
    
    const noteKey = `${employee}-${dateKey}`;
    const linkKey = `${employee}-${dateKey}-link`;
    const addressKey = `${employee}-${dateKey}-address`;
    
    // Speichere Notiz, Link und Adresse
    cellNotes[noteKey] = infoText ? infoText.value.trim() : '';
    const linkInput = document.getElementById('linkInput');
    const addressInput = document.getElementById('addressInput');
    cellLinks[linkKey] = linkInput ? linkInput.value.trim() : '';
    cellAddresses[addressKey] = addressInput ? addressInput.value.trim() : '';
    
    // Aktualisiere die Anzeige
    let displayText = cellNotes[noteKey];
    if (cellLinks[linkKey] || cellAddresses[addressKey]) {
        currentEditingCell.innerHTML = `
            <div class="cell-content">
                <div class="cell-text">${displayText || ''}</div>
                <div class="cell-icons">
                    ${cellLinks[linkKey] ? '<div class="folder-icon">📁</div>' : ''}
                    ${cellAddresses[addressKey] ? '<div class="map-icon">🗺️</div>' : ''}
                </div>
            </div>
        `;
    } else {
        currentEditingCell.innerHTML = `<div class="cell-content"><div class="cell-text">${displayText || ''}</div></div>`;
    }
    
    currentEditingCell.setAttribute('data-info', displayText);
    
    // Aktualisiere den Text im Feld
    if (!displayText && !cellLinks[linkKey] && !cellAddresses[addressKey]) {
        // Wenn keine Notiz, kein Link und keine Adresse vorhanden ist, zeige den ursprünglichen Text an
        if (assignments[employee] && assignments[employee][dateKey]) {
            currentEditingCell.innerHTML = `<div class="cell-content"><div class="cell-text">${assignments[employee][dateKey].text}</div></div>`;
        } else {
            currentEditingCell.innerHTML = '<div class="cell-content"><div class="cell-text"></div></div>';
        }
    }
    
    // Warte auf das Speichern, damit die Daten sicher gespeichert sind
    await saveData('cellNotes', cellNotes);
    await saveData('cellLinks', cellLinks);
    await saveData('cellAddresses', cellAddresses);
    
    // Protokolliere Notizen-Änderungen
    addToAuditLog('Notiz geändert', {
        employee: employee,
        date: dateKey,
        note: cellNotes[noteKey] || '',
        link: cellLinks[linkKey] || '',
        address: cellAddresses[addressKey] || ''
    });
}

function showDeleteEmployeeModal(employee) {
    employeeToDeleteSpan.textContent = employee;
    deleteEmployeeModal.style.display = 'block';
    deleteEmployeeModal.dataset.employee = employee;
}

function hideDeleteEmployeeModal() {
    deleteEmployeeModal.style.display = 'none';
}

function confirmDeleteEmployee() {
    const employee = deleteEmployeeModal.dataset.employee;
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    employeeEndDates[employee] = endDate.toISOString().split('T')[0];
    saveData('employeeEndDates', employeeEndDates);
    addToAuditLog('Mitarbeiter entfernt', { employee: employee });
    hideDeleteEmployeeModal();
    updateCalendar();
}

// Funktion zum Verschieben von Mitarbeitern
function moveEmployee(employeeName, direction) {
    const index = employees.indexOf(employeeName);
    if (index === -1) return;
    
    if (direction === 'up' && index > 0) {
        // Verschiebe nach oben
        [employees[index], employees[index - 1]] = [employees[index - 1], employees[index]];
        addToAuditLog('Mitarbeiter verschoben', { employee: employeeName, direction: 'nach oben', newPosition: index - 1 });
    } else if (direction === 'down' && index < employees.length - 1) {
        // Verschiebe nach unten
        [employees[index], employees[index + 1]] = [employees[index + 1], employees[index]];
        addToAuditLog('Mitarbeiter verschoben', { employee: employeeName, direction: 'nach unten', newPosition: index + 1 });
    }
    
    saveData('employees', employees);
    updateCalendar();
}

// Event Listener für das Lösch-Modal werden in setupEventListeners() gesetzt

function determineStatus(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('urlaub')) return 'status-urlaub';
    if (lowerText.includes('krank')) return 'status-krank';
    if (lowerText.includes('schulung')) return 'status-schulung';
    if (lowerText.includes('unbezahlt')) return 'status-unbezahlt';
    if (lowerText.includes('feiertag')) return 'status-feiertag';
    return '';
}

function toggleZoom() {
    isZoomedOut = !isZoomedOut;
    const calendarContainer = document.querySelector('.calendar-container');
    
    if (isZoomedOut) {
        calendarContainer.classList.add('zoomed-out');
        zoomOutButton.textContent = 'Normalansicht';
    } else {
        calendarContainer.classList.remove('zoomed-out');
        zoomOutButton.textContent = 'Ganzen Monat anzeigen';
    }
}

// Hilfsfunktion für Datumsvergleiche
function isDateInRange(date, startDate, endDate) {
    // Vergleiche nur Jahr und Monat
    const year = date.getFullYear();
    const month = date.getMonth();
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const endYear = endDate.getFullYear();
    const endMonth = endDate.getMonth();

    // Wenn das Jahr kleiner als das Startjahr ist, ist das Datum nicht im Bereich
    if (year < startYear) {
        return false;
    }

    // Wenn das Jahr gleich dem Startjahr ist und der Monat kleiner als der Startmonat ist
    if (year === startYear && month < startMonth) {
        return false;
    }

    // Wenn das Jahr größer als das Endjahr ist, ist das Datum nicht im Bereich
    if (year > endYear) {
        return false;
    }

    // Wenn das Jahr gleich dem Endjahr ist und der Monat größer als der Endmonat ist
    if (year === endYear && month > endMonth) {
        return false;
    }

    // In allen anderen Fällen ist das Datum im Bereich
    return true;
}

// Event Listener für das Modal
document.getElementById('cancelEmployee').addEventListener('click', () => {
    hideEmployeeModal();
});

// Event Listener für Klick außerhalb des Modals
document.addEventListener('click', (e) => {
    if (employeeModal && e.target === employeeModal) {
        hideEmployeeModal();
    }
});

// Funktion zum Exportieren der Daten
function exportData() {
    document.getElementById('exportModal').style.display = 'block';
}

// Event Listener für Export
document.getElementById('exportData').addEventListener('click', () => {
    document.getElementById('exportModal').style.display = 'block';
});

// Event Listener für Export-Modal
document.getElementById('cancelExport').addEventListener('click', () => {
    document.getElementById('exportModal').style.display = 'none';
});

document.getElementById('confirmExport').addEventListener('click', () => {
    const exportRange = document.querySelector('input[name="exportRange"]:checked').value;
    const exportFormats = Array.from(document.querySelectorAll('input[name="exportFormat"]:checked')).map(input => input.value);
    
    if (exportFormats.length === 0) {
        alert('Bitte wählen Sie mindestens ein Dateiformat aus.');
        return;
    }
    
    try {
        if (exportFormats.includes('json')) {
            exportJSON(exportRange);
        }
        
        if (exportFormats.includes('excel')) {
            exportExcel(exportRange);
        }
        
        document.getElementById('exportModal').style.display = 'none';
    } catch (error) {
        console.error('Fehler beim Export:', error);
        alert('Fehler beim Exportieren der Daten. Bitte versuchen Sie es erneut.');
    }
});

function exportJSON(range) {
    // Verwende die globalen Variablen, die aus Firebase geladen wurden (nicht localStorage)
    const data = {
        employees: employees || [],
        assignments: assignments || {},
        employeeStartDates: employeeStartDates || {},
        employeeEndDates: employeeEndDates || {},
        cellNotes: cellNotes || {},
        cellLinks: cellLinks || {},
        cellAddresses: cellAddresses || {}
    };

    // Wenn nur aktueller Monat exportiert werden soll
    if (range === 'currentMonth') {
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear = currentDate.getFullYear();
        
        // Filtere die Daten für den aktuellen Monat
        Object.keys(data.assignments).forEach(employee => {
            data.assignments[employee] = Object.fromEntries(
                Object.entries(data.assignments[employee]).filter(([key]) => {
                    const [year, month] = key.split('-');
                    return parseInt(year) === currentYear && parseInt(month) === currentMonth;
                })
            );
        });
        
        // Filtere Notizen, Links und Adressen
        ['cellNotes', 'cellLinks', 'cellAddresses'].forEach(key => {
            data[key] = Object.fromEntries(
                Object.entries(data[key]).filter(([key]) => {
                    const [employee, year, month] = key.split('-');
                    return parseInt(year) === currentYear && parseInt(month) === currentMonth;
                })
            );
        });
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arbeitsplan_${range === 'currentMonth' ? 
        `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}` : 
        'backup'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportExcel(range) {
    const months = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    
    try {
        console.log('Starte Excel-Export...');
        
        // Erstelle Arbeitsmappe
        const wb = XLSX.utils.book_new();
        console.log('Arbeitsmappe erstellt');
        
        if (range === 'currentMonth') {
            console.log('Exportiere aktuellen Monat:', months[currentDate.getMonth()]);
            // Exportiere nur aktuellen Monat
            const ws = createWorksheetForMonth(currentDate.getFullYear(), currentDate.getMonth());
            XLSX.utils.book_append_sheet(wb, ws, `Arbeitsplan ${months[currentDate.getMonth()]}`);
        } else {
            console.log('Exportiere alle Monate');
            // Exportiere alle Monate
            for (let month = 0; month < 12; month++) {
                const ws = createWorksheetForMonth(currentDate.getFullYear(), month);
                XLSX.utils.book_append_sheet(wb, ws, months[month]);
            }
        }
        
        // Exportiere Excel-Datei
        const fileName = `arbeitsplan_${range === 'currentMonth' ? 
            `${months[currentDate.getMonth()]}_${currentDate.getFullYear()}` : 
            'komplett'}.xlsx`;
            
        console.log('Erstelle Excel-Datei:', fileName);

        // Konvertiere die Arbeitsmappe in einen Blob
        const wbout = XLSX.write(wb, { 
            bookType: 'xlsx', 
            type: 'binary',
            bookSST: true
        });
        console.log('Arbeitsmappe konvertiert');

        // Konvertiere binary string in Blob
        const s2ab = (s) => {
            const buf = new ArrayBuffer(s.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
            return buf;
        };

        const blob = new Blob([s2ab(wbout)], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        console.log('Blob erstellt');

        // Erstelle einen Download-Link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        
        // Füge den Link zum Dokument hinzu und klicke ihn
        document.body.appendChild(a);
        console.log('Download-Link erstellt');
        
        // Verzögerung vor dem Klick
        setTimeout(() => {
            a.click();
            console.log('Download gestartet');
            
            // Aufräumen
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            console.log('Aufräumen abgeschlossen');
        }, 100);
        
    } catch (error) {
        console.error('Detaillierter Fehler beim Excel-Export:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        alert('Fehler beim Erstellen der Excel-Datei. Bitte versuchen Sie es erneut.');
    }
}

function createWorksheetForMonth(year, month) {
    try {
        console.log(`Erstelle Worksheet für ${year}-${month + 1}`);
        
        const months = [
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
            'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
        ];
        
        // Erstelle Daten für Excel
        const table = document.querySelector('.calendar');
        if (!table) {
            throw new Error('Kalender-Tabelle nicht gefunden');
        }
        
        const rows = Array.from(table.rows);
        if (rows.length === 0) {
            throw new Error('Keine Daten in der Tabelle gefunden');
        }
        
        // Erstelle Header-Zeile
        const headerRow = ['Mitarbeiter'];
        const firstRow = rows[0];
        for (let i = 1; i < firstRow.cells.length; i++) {
            const cell = firstRow.cells[i];
            const day = cell.querySelector('span:last-child')?.textContent || '';
            const weekday = cell.querySelector('span:first-child')?.textContent || '';
            headerRow.push(`${day} ${weekday}`);
        }
        
        // Erstelle Daten-Zeilen
        const dataRows = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const employeeName = row.cells[0].querySelector('span')?.textContent || '';
            const rowData = [employeeName];
            
            for (let j = 1; j < row.cells.length; j++) {
                const cell = row.cells[j];
                const cellText = cell.querySelector('.cell-text')?.textContent || '';
                rowData.push(cellText);
            }
            
            dataRows.push(rowData);
        }
        
        // Erstelle das Worksheet
        const data = [
            [`Arbeitsplan ${months[month]} ${year}`],
            [''],
            headerRow,
            ...dataRows
        ];
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Setze Spaltenbreiten
        ws['!cols'] = [
            { wch: 20 },
            ...Array(headerRow.length - 1).fill({ wch: 15 })
        ];
        
        return ws;
    } catch (error) {
        console.error('Fehler beim Erstellen des Worksheets:', error);
        throw error;
    }
}

// Backup-Daten für Undo-Funktion
let importBackup = null;

// Funktion zum Importieren der Daten
function importData(file) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Überprüfe, ob die Daten die erforderliche Struktur haben
            if (!data || typeof data !== 'object') {
                throw new Error('Ungültiges Datenformat: Keine gültigen JSON-Daten');
            }

            // Überprüfe die erforderlichen Felder
            const requiredFields = ['employees', 'assignments', 'employeeStartDates', 'employeeEndDates', 'cellNotes', 'cellLinks', 'cellAddresses'];
            const missingFields = requiredFields.filter(field => !(field in data));
            
            if (missingFields.length > 0) {
                throw new Error(`Ungültiges Datenformat: Fehlende Felder: ${missingFields.join(', ')}`);
            }

            // Erstelle Backup der aktuellen Daten (aus Firebase/globalen Variablen)
            importBackup = {
                employees: JSON.parse(JSON.stringify(employees)),
                assignments: JSON.parse(JSON.stringify(assignments)),
                employeeStartDates: JSON.parse(JSON.stringify(employeeStartDates)),
                employeeEndDates: JSON.parse(JSON.stringify(employeeEndDates)),
                cellNotes: JSON.parse(JSON.stringify(cellNotes)),
                cellLinks: JSON.parse(JSON.stringify(cellLinks)),
                cellAddresses: JSON.parse(JSON.stringify(cellAddresses))
            };
            console.log('Backup erstellt vor Import');

            // Speichere die neuen Daten in Firebase
            await saveData('employees', data.employees);
            await saveData('assignments', data.assignments);
            await saveData('employeeStartDates', data.employeeStartDates);
            await saveData('employeeEndDates', data.employeeEndDates);
            await saveData('cellNotes', data.cellNotes);
            await saveData('cellLinks', data.cellLinks);
            await saveData('cellAddresses', data.cellAddresses);

            // Aktualisiere die globalen Variablen
            employees = data.employees;
            assignments = data.assignments;
            employeeStartDates = data.employeeStartDates;
            employeeEndDates = data.employeeEndDates;
            cellNotes = data.cellNotes;
            cellLinks = data.cellLinks;
            cellAddresses = data.cellAddresses;
            
            // Aktualisiere die Anzeige
            updateCalendar();
            
            // Zeige Undo-Option
            const undo = confirm('Daten wurden erfolgreich importiert!\n\nMöchten Sie die Änderung rückgängig machen?');
            if (undo) {
                await undoImport();
            } else {
                importBackup = null; // Backup löschen, wenn nicht rückgängig gemacht
            }
        } catch (error) {
            console.error('Fehler beim Importieren:', error);
            alert('Fehler beim Importieren der Daten: ' + error.message);
            importBackup = null;
        }
    };
    reader.onerror = function() {
        alert('Fehler beim Lesen der Datei. Bitte versuchen Sie es erneut.');
    };
    reader.readAsText(file);
}

// Funktion zum Rückgängig machen des Imports
async function undoImport() {
    if (!importBackup) {
        alert('Kein Backup verfügbar. Rückgängig machen nicht möglich.');
        return;
    }
    
    try {
        // Stelle die Backup-Daten wieder her
        await saveData('employees', importBackup.employees);
        await saveData('assignments', importBackup.assignments);
        await saveData('employeeStartDates', importBackup.employeeStartDates);
        await saveData('employeeEndDates', importBackup.employeeEndDates);
        await saveData('cellNotes', importBackup.cellNotes);
        await saveData('cellLinks', importBackup.cellLinks);
        await saveData('cellAddresses', importBackup.cellAddresses);

        // Aktualisiere die globalen Variablen
        employees = importBackup.employees;
        assignments = importBackup.assignments;
        employeeStartDates = importBackup.employeeStartDates;
        employeeEndDates = importBackup.employeeEndDates;
        cellNotes = importBackup.cellNotes;
        cellLinks = importBackup.cellLinks;
        cellAddresses = importBackup.cellAddresses;
        
        // Aktualisiere die Anzeige
        updateCalendar();
        
        // Protokolliere die Aktion
        addToAuditLog('Import rückgängig gemacht', {});
        
        alert('Import wurde erfolgreich rückgängig gemacht!');
        importBackup = null;
    } catch (error) {
        console.error('Fehler beim Rückgängig machen:', error);
        alert('Fehler beim Rückgängig machen: ' + error.message);
    }
}

// Event Listener für Import
document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importData').click();
});

// Event Listener für Protokoll
document.getElementById('showAuditLog').addEventListener('click', () => {
    showAuditLog();
});

document.getElementById('importData').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importData(e.target.files[0]);
    }
});

// Funktion zum Erstrecken von Text über mehrere Zellen
function extendTextOverCells(cell, employee, dateKey) {
    if (!cell || !cell.parentElement) {
        console.warn('extendTextOverCells: Zelle oder parentElement ist null');
        return;
    }
    const row = cell.parentElement;
    if (!row || !row.children) {
        console.warn('extendTextOverCells: row oder row.children ist null');
        return;
    }
    const dayIndex = Array.from(row.children).indexOf(cell);
    if (dayIndex === -1) {
        console.warn('extendTextOverCells: Zelle nicht in row.children gefunden');
        return;
    }
    
    const cellText = cell.querySelector('.cell-text');
    if (!cellText || !cellText.textContent || !cellText.textContent.trim()) {
        // Wenn kein Text, entferne colspan
        cell.removeAttribute('colspan');
        cell.style.width = '';
        return;
    }
    
    // Prüfe, ob die nächste Zelle leer ist
    let spanCount = 1;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    
    // Erstrecke über leere Zellen nach rechts
    if (!row.children || row.children.length === 0) {
        console.warn('extendTextOverCells: row.children ist leer');
        return;
    }
    
    for (let i = dayIndex + 1; i < row.children.length; i++) {
        const nextCell = row.children[i];
        if (!nextCell || nextCell === row.children[0]) break;
        
        const nextDay = i; // Tag-Index
        const nextDateKey = `${year}-${month}-${nextDay}`;
        const nextNoteKey = `${employee}-${nextDateKey}`;
        const nextAssignment = assignments[employee]?.[nextDateKey];
        
        // Wenn die nächste Zelle leer ist (keine Notiz, keine Zuweisung, keine Links/Adressen)
        if (!cellNotes[nextNoteKey] && !nextAssignment && 
            !cellLinks[`${employee}-${nextDateKey}-link`] && 
            !cellAddresses[`${employee}-${nextDateKey}-address`]) {
            spanCount++;
        } else {
            break;
        }
    }
    
    // Setze colspan, wenn mehr als eine Zelle
    if (spanCount > 1) {
        cell.setAttribute('colspan', spanCount);
        cell.style.position = 'relative';
        cell.style.zIndex = '1';
    } else {
        cell.removeAttribute('colspan');
    }
}

function updateCell(cell, employee, dateKey) {
    const assignment = assignments[employee]?.[dateKey];
    const noteKey = `${employee}-${dateKey}`;
    const linkKey = `${employee}-${dateKey}-link`;
    const addressKey = `${employee}-${dateKey}-address`;
    
    if (assignment) {
        const statusColors = {
            'urlaub': '#28a745',
            'krank': '#dc3545',
            'unbezahlt': '#ffc107',
            'schulung': '#6f42c1',
            'feiertag': '#17a2b8',
            'kurzarbeit': '#795548',
            'abgerechnet': '#e8f5e9',
            'ueberstunden': '#20c997'
        };

        // Für "abgerechnet": Leicht grün hinterlegen, Text sichtbar lassen, Haken hinzufügen
        if (assignment.status === 'abgerechnet') {
            cell.style.backgroundColor = '#d4edda';
            cell.style.color = 'black';
            cell.style.position = 'relative';
            
            // Stelle sicher, dass der Text sichtbar ist (nur wenn vorhanden)
            const cellText = cell.querySelector('.cell-text');
            const textToShow = assignment.text ? assignment.text.trim() : '';
            
            if (cellText) {
                cellText.textContent = textToShow; // Leere Felder bleiben leer
            } else if (textToShow) {
                // Erstelle cell-text nur wenn Text vorhanden ist
                const textDiv = document.createElement('div');
                textDiv.className = 'cell-text';
                textDiv.textContent = textToShow;
                if (cell.querySelector('.cell-content')) {
                    cell.querySelector('.cell-content').appendChild(textDiv);
                } else {
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'cell-content';
                    contentDiv.appendChild(textDiv);
                    cell.appendChild(contentDiv);
                }
            }
            
            // Füge Haken hinzu, falls nicht vorhanden
            if (!cell.querySelector('.checkmark')) {
                const checkmark = document.createElement('div');
                checkmark.className = 'checkmark';
                checkmark.textContent = '✓';
                checkmark.style.cssText = 'position: absolute; top: 2px; right: 2px; color: #28a745; font-weight: bold; font-size: 14px; z-index: 10;';
                cell.appendChild(checkmark);
            }
        } else {
            // Für andere Status: Normal verhalten
            cell.style.backgroundColor = statusColors[assignment.status];
            cell.style.color = 'black';
            
            // Entferne Haken falls vorhanden
            const checkmark = cell.querySelector('.checkmark');
            if (checkmark) checkmark.remove();
            
            // Setze den Text nur, wenn keine Notiz vorhanden ist
            if (!cellNotes[noteKey]) {
                const cellText = cell.querySelector('.cell-text');
                if (cellText) {
                    cellText.textContent = assignment.text;
                } else {
                    cell.textContent = assignment.text;
                }
            }
        }
    } else {
        // Wenn keine Zuweisung vorhanden ist, setze Standardwerte
        cell.style.backgroundColor = '';
        cell.style.color = 'black';
        
        // Wenn keine Notiz vorhanden ist, setze den Text zurück
        if (!cellNotes[noteKey]) {
            const cellText = cell.querySelector('.cell-text');
            if (cellText) {
                cellText.textContent = '';
            }
        }
    }
    
    // Setze die Notiz, wenn vorhanden
    if (cellNotes[noteKey]) {
        const cellText = cell.querySelector('.cell-text');
        if (cellText) {
            cellText.textContent = cellNotes[noteKey];
        }
        cell.setAttribute('data-info', cellNotes[noteKey]);
    }
    
    // Erstrecke Text über mehrere Zellen, wenn möglich
    // Prüfe, ob die Zelle noch im DOM ist
    if (cell && cell.parentElement && cell.parentElement.children) {
        extendTextOverCells(cell, employee, dateKey);
    }
}

function setupMobileWeekView() {
    const calendarContainer = document.querySelector('.calendar-container');
    
    // Entferne alte Wochenansicht, falls vorhanden
    const oldWeekView = document.querySelector('.week-view');
    if (oldWeekView) {
        oldWeekView.remove();
    }
    
    // Erstelle neue Wochenansicht
    const weekView = document.createElement('div');
    weekView.className = 'week-view';
    
    // Erstelle Wochen-Navigation
    const weekNav = document.createElement('div');
    weekNav.className = 'week-navigation';
    
    const prevWeekBtn = document.createElement('button');
    prevWeekBtn.className = 'week-nav-button';
    prevWeekBtn.textContent = '←';
    prevWeekBtn.addEventListener('click', () => {
        navigateWeek(-1);
        setupMobileWeekView();
    });
    
    const nextWeekBtn = document.createElement('button');
    nextWeekBtn.className = 'week-nav-button';
    nextWeekBtn.textContent = '→';
    nextWeekBtn.addEventListener('click', () => {
        navigateWeek(1);
        setupMobileWeekView();
    });
    
    const currentWeekSpan = document.createElement('span');
    currentWeekSpan.className = 'current-week';
    updateCurrentWeekDisplay(currentWeekSpan);
    
    weekNav.appendChild(prevWeekBtn);
    weekNav.appendChild(currentWeekSpan);
    weekNav.appendChild(nextWeekBtn);
    
    // Erstelle Wochen-Container
    const weekContainer = document.createElement('div');
    weekContainer.className = 'week-container';
    
    // Erstelle eine neue Tabelle für die Wochenansicht
    const weekTable = document.createElement('table');
    weekTable.className = 'calendar';
    
    // Erstelle den Tabellenkopf
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Mitarbeiter</th>';
    thead.appendChild(headerRow);
    weekTable.appendChild(thead);
    
    // Erstelle den Tabellenkörper
    const tbody = document.createElement('tbody');
    weekTable.appendChild(tbody);
    
    // Füge nur aktive Mitarbeiter hinzu
    employees.forEach(employee => {
        // Wenn keine Start-/Enddaten vorhanden sind, zeige den Mitarbeiter immer an
        let shouldShow = true;
        
        if (employeeStartDates[employee] || employeeEndDates[employee]) {
            const startDate = new Date(employeeStartDates[employee] || '2000-01-01');
            const endDate = employeeEndDates[employee] ? new Date(employeeEndDates[employee]) : new Date('2100-12-31');
            const currentMonthDate = new Date(currentDate);
            shouldShow = isDateInRange(currentMonthDate, startDate, endDate);
        }
        
        if (shouldShow) {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            
            const nameContainer = document.createElement('div');
            nameContainer.className = 'name-container';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = employee;
            nameContainer.appendChild(nameSpan);
            
            // Verschiebe-Buttons
            const moveUpButton = document.createElement('button');
            moveUpButton.className = 'move-employee';
            moveUpButton.textContent = '↑';
            moveUpButton.title = 'Nach oben verschieben';
            moveUpButton.style.cssText = 'margin: 0 2px; padding: 2px 6px; font-size: 12px;';
            moveUpButton.addEventListener('click', (e) => {
                e.stopPropagation();
                moveEmployee(employee, 'up');
            });
            nameContainer.appendChild(moveUpButton);
            
            const moveDownButton = document.createElement('button');
            moveDownButton.className = 'move-employee';
            moveDownButton.textContent = '↓';
            moveDownButton.title = 'Nach unten verschieben';
            moveDownButton.style.cssText = 'margin: 0 2px; padding: 2px 6px; font-size: 12px;';
            moveDownButton.addEventListener('click', (e) => {
                e.stopPropagation();
                moveEmployee(employee, 'down');
            });
            nameContainer.appendChild(moveDownButton);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-employee';
            deleteButton.textContent = '×';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteEmployeeModal(employee);
            });
            nameContainer.appendChild(deleteButton);
            
            nameCell.appendChild(nameContainer);
            row.appendChild(nameCell);
            tbody.appendChild(row);
        }
    });
    
    weekContainer.appendChild(weekTable);
    
    // Füge alles zusammen
    weekView.appendChild(weekNav);
    weekView.appendChild(weekContainer);
    calendarContainer.innerHTML = '';
    calendarContainer.appendChild(weekView);
    
    // Zeige die aktuelle Woche
    showCurrentWeek();
}

// Füge den "Überstunden frei" Button hinzu (vor Abgerechnet)
const statusButtons = document.querySelector('.status-buttons');
const ueberstundenButton = document.createElement('button');
ueberstundenButton.className = 'status-button';
ueberstundenButton.dataset.status = 'ueberstunden';
ueberstundenButton.textContent = 'Überstunden frei';
ueberstundenButton.style.backgroundColor = '#20c997';
ueberstundenButton.style.color = 'white';

// Füge den Abgerechnet-Button hinzu (nach Überstunden frei)
const abgerechnetButton = document.createElement('button');
abgerechnetButton.className = 'status-button';
abgerechnetButton.dataset.status = 'abgerechnet';
abgerechnetButton.textContent = 'Abgerechnet';
abgerechnetButton.style.backgroundColor = '#e8f5e9';
abgerechnetButton.style.color = 'black';

// Hole den "Auswahl löschen" Button
const clearSelectionButton = document.getElementById('clearSelection');

// Füge Buttons in der richtigen Reihenfolge ein
if (clearSelectionButton) {
    // Füge vor "Auswahl löschen" ein
    statusButtons.insertBefore(ueberstundenButton, clearSelectionButton);
    statusButtons.insertBefore(abgerechnetButton, clearSelectionButton);
} else {
    // Falls "Auswahl löschen" nicht gefunden, füge am Ende hinzu
    statusButtons.appendChild(ueberstundenButton);
    statusButtons.appendChild(abgerechnetButton);
}

// Event Listener für den Überstunden-Button
ueberstundenButton.addEventListener('click', async () => {
    await applyStatusToSelectedCells('ueberstunden');
});

// Event Listener für den Abgerechnet-Button
abgerechnetButton.addEventListener('click', async () => {
    await applyStatusToSelectedCells('abgerechnet');
});

// Event Listener für den "Auswahl löschen" Button
document.getElementById('clearSelection').addEventListener('click', async () => {
    if (selectedCells.size > 0) {
        saveState(); // Speichere den aktuellen Zustand vor dem Löschen
        
        selectedCells.forEach(cell => {
            const row = cell.parentElement;
            const employee = row.querySelector('td:first-child span').textContent;
            const dateKey = getDateKeyFromCell(cell);
            if (!dateKey) return;
            
            const noteKey = `${employee}-${dateKey}`;
            const linkKey = `${employee}-${dateKey}-link`;
            const addressKey = `${employee}-${dateKey}-address`;
            
            // Lösche alle Daten
            if (assignments[employee]) {
                delete assignments[employee][dateKey];
            }
            delete cellNotes[noteKey];
            delete cellLinks[linkKey];
            delete cellAddresses[addressKey];
            
            // Setze Zelle zurück
            cell.innerHTML = '<div class="cell-content"><div class="cell-text"></div></div>';
            cell.style.backgroundColor = '';
            cell.style.color = 'black';
            cell.removeAttribute('data-info');
            cell.className = 'calendar-cell';
            
            // Prüfe Wochenende basierend auf dem tatsächlichen Datum
            const [year, month, day] = dateKey.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (date.getDay() === 0 || date.getDay() === 6) {
                cell.classList.add('weekend-cell');
            }
        });
        
        // Speichere die Änderungen in Firebase
        await saveData('assignments', assignments);
        await saveData('cellNotes', cellNotes);
        await saveData('cellLinks', cellLinks);
        await saveData('cellAddresses', cellAddresses);
        
        // Lösche die Auswahl
        clearSelection();
    }
}); 