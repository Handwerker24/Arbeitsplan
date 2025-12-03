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
let cellHighlights = {}; // Nur visuelle Farbmarkierungen pro Feld
let isWeekView = false; // Neue Variable für den Ansichtsmodus
let mergedCells = {}; // Speichert Zusammenführungen: { "employee-dateKey": { mergedCells: [...], removedCells: [...] } }
// Globale Referenzen / Einstellungen für Farbmarkierung (werden gespeichert)
let selectedHighlightColor = '#fff176'; // Standard-Hervorhebungsfarbe
let selectedHighlightOpacity = 0.4;     // Standard-Deckkraft
// Auto-Refresh / Bearbeitungsstatus
let autoRefreshInterval = null;
let isUserEditing = false;
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
            console.log('[initializeFirebase] Rohdaten aus Firebase:', data);
            
            // Lade Daten aus Firebase
            const fbEmployees = data.employees || [];
            const fbAssignments = data.assignments || {};
            const fbStartDates = data.employeeStartDates || {};
            const fbEndDates = data.employeeEndDates || {};
            const fbNotes = data.cellNotes || {};
            const fbLinks = data.cellLinks || {};
            const fbAddresses = data.cellAddresses || {};
            const fbHighlights = data.cellHighlights || {};
            const fbMerged = data.mergedCells || {};
            
            // Lade Daten aus localStorage (als Backup)
            const lsEmployees = JSON.parse(localStorage.getItem('employees') || 'null');
            const lsAssignments = JSON.parse(localStorage.getItem('assignments') || 'null');
            const lsStartDates = JSON.parse(localStorage.getItem('employeeStartDates') || 'null');
            const lsEndDates = JSON.parse(localStorage.getItem('employeeEndDates') || 'null');
            const lsNotes = JSON.parse(localStorage.getItem('cellNotes') || 'null');
            const lsLinks = JSON.parse(localStorage.getItem('cellLinks') || 'null');
            const lsAddresses = JSON.parse(localStorage.getItem('cellAddresses') || 'null');
            const lsHighlights = JSON.parse(localStorage.getItem('cellHighlights') || 'null');
            const lsMerged = JSON.parse(localStorage.getItem('mergedCells') || 'null');
            
            // Verwende Firebase-Daten, FALLS vorhanden, sonst localStorage
            // Wenn Firebase leer ist, aber localStorage Daten hat, verwende localStorage
            employees = (fbEmployees && fbEmployees.length > 0) ? fbEmployees : (lsEmployees || []);
            assignments = (fbAssignments && Object.keys(fbAssignments).length > 0) ? fbAssignments : (lsAssignments || {});
            employeeStartDates = (fbStartDates && Object.keys(fbStartDates).length > 0) ? fbStartDates : (lsStartDates || {});
            employeeEndDates = (fbEndDates && Object.keys(fbEndDates).length > 0) ? fbEndDates : (lsEndDates || {});
            cellNotes = (fbNotes && Object.keys(fbNotes).length > 0) ? fbNotes : (lsNotes || {});
            cellLinks = (fbLinks && Object.keys(fbLinks).length > 0) ? fbLinks : (lsLinks || {});
            cellAddresses = (fbAddresses && Object.keys(fbAddresses).length > 0) ? fbAddresses : (lsAddresses || {});
            cellHighlights = (fbHighlights && Object.keys(fbHighlights).length > 0) ? fbHighlights : (lsHighlights || {});
            mergedCells = (fbMerged && Object.keys(fbMerged).length > 0) ? fbMerged : (lsMerged || {});
            
            console.log('[initializeFirebase] Finale Daten geladen:', { 
                employees: employees.length, 
                assignments: Object.keys(assignments).length,
                employeeStartDates: Object.keys(employeeStartDates).length,
                employeeEndDates: Object.keys(employeeEndDates).length,
                cellNotes: Object.keys(cellNotes).length,
                cellLinks: Object.keys(cellLinks).length,
                cellAddresses: Object.keys(cellAddresses).length,
                cellHighlights: Object.keys(cellHighlights).length
            });
            
            // Wenn Firebase leer ist, aber localStorage Daten hat, versuche diese zu Firebase zu migrieren
            if ((fbEmployees.length === 0 && Object.keys(fbAssignments).length === 0) && 
                ((lsEmployees && lsEmployees.length > 0) || (lsAssignments && Object.keys(lsAssignments).length > 0))) {
                console.log('[initializeFirebase] Firebase leer, aber localStorage hat Daten - versuche Migration zu Firebase...');
                // Speichere die geladenen Daten (aus localStorage) in Firebase
                await saveData('employees', employees);
                await saveData('assignments', assignments);
                await saveData('employeeStartDates', employeeStartDates);
                await saveData('employeeEndDates', employeeEndDates);
                await saveData('cellNotes', cellNotes);
                await saveData('cellLinks', cellLinks);
                await saveData('cellAddresses', cellAddresses);
                await saveData('cellHighlights', cellHighlights);
                await saveData('mergedCells', mergedCells);
                console.log('[initializeFirebase] Migration zu Firebase abgeschlossen');
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
    cellHighlights = JSON.parse(localStorage.getItem('cellHighlights')) || {};
    mergedCells = JSON.parse(localStorage.getItem('mergedCells')) || {};
    console.log('Daten aus localStorage geladen');
}

// Daten speichern (Firebase oder localStorage)
async function saveData(key, data) {
    console.log(`[saveData] Starte Speichern von ${key}...`);
    // Setze Flag, dass Benutzer gerade bearbeitet
    isUserEditing = true;
    
    // IMMER zuerst in localStorage speichern (als Backup)
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`[saveData] ${key} in localStorage gespeichert`);
    } catch (lsError) {
        console.error(`[saveData] Fehler beim Speichern in localStorage:`, lsError);
    }
    
    // Dann versuchen, in Firebase zu speichern
    try {
        const db = window.firebaseDB || firebaseDB;
        if (db) {
            console.log(`[saveData] Versuche ${key} in Firebase zu speichern...`);
            await db.saveData(key, data);
            console.log(`[saveData] ${key} erfolgreich in Firebase gespeichert`);
        } else {
            console.warn(`[saveData] Firebase DB nicht verfügbar, nur localStorage verwendet`);
        }
        
        // Setze Flag nach 2 Sekunden zurück
        setTimeout(() => {
            isUserEditing = false;
        }, 2000);
    } catch (error) {
        console.error(`[saveData] Fehler beim Speichern von ${key} in Firebase:`, error);
        console.log(`[saveData] ${key} wurde in localStorage gespeichert (Fallback)`);
        isUserEditing = false;
        // localStorage wurde bereits oben gespeichert
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
        cellAddresses: JSON.parse(JSON.stringify(cellAddresses)),
        cellHighlights: JSON.parse(JSON.stringify(cellHighlights))
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
            const addressKey = `${employee}-${dateKey}-address`;
            const highlightKey = `${employee}-${dateKey}`;
            
            // Merke aktuellen Text für das Audit-Log, bevor wir Daten löschen
            const deletedText =
                cellNotes[noteKey] ||
                cellAddresses[addressKey] ||
                assignments[employee]?.[dateKey]?.text ||
                '';

            // Lösche Notiz, Link, Adresse und Farbmarkierung
            delete cellNotes[noteKey];
            delete cellLinks[linkKey];
            delete cellAddresses[addressKey];
            delete cellHighlights[highlightKey];
            cell.removeAttribute('data-info');
            
            // Lösche Zuweisung
            if (assignments[employee]) {
                delete assignments[employee][dateKey];
            }
            
            // Setze Zelleninhalt zurück und entferne ALLE Styles und Klassen
            cell.innerHTML = '<div class="cell-content"><div class="cell-text"></div></div>';
            cell.className = 'calendar-cell';
            cell.style.backgroundColor = '';
            cell.style.color = '';
            cell.classList.remove(
                'status-urlaub',
                'status-krank',
                'status-unbezahlt',
                'status-schulung',
                'status-feiertag',
                'status-kurzarbeit',
                'status-abgerechnet',
                'status-ueberstunden'
            );
            
            // Prüfe Wochenende basierend auf dem tatsächlichen Datum
            const [year, month, day] = dateKey.split('-').map(Number);
            const date = new Date(year, month - 1, day);
            if (date.getDay() === 0 || date.getDay() === 6) {
                cell.classList.add('weekend-cell');
            }
            
            // Logge die Löschung
            const deletedTextForLog = deletedText;
            addToAuditLog('Eintrag gelöscht', { 
                employee: employee, 
                date: dateKey,
                deletedText: deletedTextForLog
            });
        });
        
        await saveData('cellNotes', cellNotes);
        await saveData('cellLinks', cellLinks);
        await saveData('cellAddresses', cellAddresses);
        await saveData('cellHighlights', cellHighlights);
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

        // Extrahiere Status korrekt: zuerst aus assignments, dann aus CSS-Klassen
        const assignment = assignments[employee]?.[dateKey];
        let status = assignment?.status || null;
        
        // Falls kein Status in assignments, prüfe CSS-Klassen
        if (!status) {
            const statusClass = Array.from(firstCell.classList).find(cls => cls.startsWith('status-'));
            if (statusClass) {
                status = statusClass.replace('status-', '');
            }
        }

        copiedContent = {
            text: firstCell.querySelector('.cell-text')?.textContent || '',
            status: status, // Kann null sein, aber nie undefined
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
            
            // Entferne colspan sofort, bevor wir etwas setzen
            cell.removeAttribute('colspan');
            cell.style.width = '';
            cell.style.position = '';
            cell.style.zIndex = '';
            
            // Setze Text und Status
            if (copiedContent.text || copiedContent.status) {
                if (!assignments[employee]) {
                    assignments[employee] = {};
                }
                // Nur speichern, wenn Status vorhanden ist (nicht undefined/null)
                if (copiedContent.status) {
                    assignments[employee][dateKey] = {
                        text: copiedContent.text || '',
                        status: copiedContent.status
                    };
                } else {
                    // Wenn kein Status, speichere nur Text
                    assignments[employee][dateKey] = {
                        text: copiedContent.text || ''
                    };
                }
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
            
            // Aktualisiere die Zelle mit updateCell
            // WICHTIG: Wenn ein Status vorhanden ist, darf NICHT erstreckt werden
            updateCell(cell, employee, dateKey);
            
            // Stelle sicher, dass colspan entfernt ist, wenn ein Status vorhanden ist
            // (updateCell sollte das schon machen, aber zur Sicherheit nochmal prüfen)
            const finalAssignment = assignments[employee]?.[dateKey];
            if (finalAssignment?.status) {
                cell.removeAttribute('colspan');
                cell.style.width = '';
                cell.style.position = '';
                cell.style.zIndex = '';
            }
        });
        
        await saveData('cellNotes', cellNotes);
        await saveData('cellLinks', cellLinks);
        await saveData('cellAddresses', cellAddresses);
        await saveData('assignments', assignments);
    }
    
    // Strg+X für Feld-Zusammenführung
    // Prüfe, ob mindestens 2 Zellen markiert sind ODER ob ein zusammengeführtes Feld markiert ist
    const hasMergedCell = selectedCells.size > 0 && Array.from(selectedCells).some(cell => 
        cell.hasAttribute('data-merged') || cell.hasAttribute('data-merged-into')
    );
    
    if (e.ctrlKey && e.key === 'x' && (selectedCells.size > 1 || hasMergedCell)) {
        e.preventDefault();
        await mergeSelectedCells();
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

    // Elemente für Farbmarkierung (Palette)
    const applyHighlightButton = document.getElementById('applyHighlight');
    const clearHighlightButton = document.getElementById('clearHighlight');
    const colorSwatches = document.querySelectorAll('.highlight-color-swatch');
    const highlightOpacityInput = document.getElementById('highlightOpacity');
    const highlightOpacityValue = document.getElementById('highlightOpacityValue');
    
    console.log('Mitarbeiter:', employees);
    console.log('DOM-Elemente:', { yearGrid: !!yearGrid, monthGrid: !!monthGrid });
    
    if (yearGrid && monthGrid) {
        initializeYearGrid();
        initializeMonthGrid();
        setupToggleViewButton();
        updateCalendar();
        setupInfoFieldListeners();
        setupEventListeners();

        // Event Listener für Farbmarkierung
        if (applyHighlightButton) {
            applyHighlightButton.addEventListener('click', () => {
                applyHighlightToSelectedCells();
            });
        }
        if (clearHighlightButton) {
            clearHighlightButton.addEventListener('click', () => {
                clearHighlightsFromSelectedCells();
            });
        }

        // Deckkraft-Regler initialisieren
        if (highlightOpacityInput && highlightOpacityValue) {
            // Startwert aus Input übernehmen
            const startVal = parseInt(highlightOpacityInput.value || '40', 10);
            selectedHighlightOpacity = Math.max(0.1, Math.min(1, startVal / 100));
            highlightOpacityValue.textContent = `${startVal}%`;

            highlightOpacityInput.addEventListener('input', () => {
                const val = parseInt(highlightOpacityInput.value || '40', 10);
                selectedHighlightOpacity = Math.max(0.1, Math.min(1, val / 100));
                highlightOpacityValue.textContent = `${val}%`;
            });
        }

        // Farbpalette initialisieren
        if (colorSwatches && colorSwatches.length > 0) {
            colorSwatches.forEach((swatch, index) => {
                const color = swatch.getAttribute('data-color');
                if (color) {
                    swatch.style.backgroundColor = color;
                }

                // Erste Farbe als Standard markieren
                if (index === 0 && color) {
                    selectedHighlightColor = color;
                    swatch.classList.add('selected');
                }

                swatch.addEventListener('click', () => {
                    // Auswahl-Zustand visuell aktualisieren
                    colorSwatches.forEach(s => s.classList.remove('selected'));
                    swatch.classList.add('selected');

                    // Aktive Farbe setzen
                    if (color) {
                        selectedHighlightColor = color;
                    }
                });
            });
        }
        
        // Starte Auto-Refresh
        startAutoRefresh();
        
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
        // restoreMergedCells() wird bereits in showCurrentWeek() aufgerufen
        return;
    }
    
    if (isWeekView) {
        setupDesktopWeekView();
        // restoreMergedCells() wird bereits in showCurrentWeek() aufgerufen
    } else {
        setupDesktopMonthView();
        // Stelle zusammengeführte Zellen wieder her
        setTimeout(() => restoreMergedCells(), 200);
    }
}

// Funktion zum Wiederherstellen der Zusammenführungen nach updateCalendar
function restoreMergedCells() {
    if (!mergedCells || Object.keys(mergedCells).length === 0) {
        console.log('restoreMergedCells: Keine mergedCells gefunden');
        return;
    }
    
    console.log('restoreMergedCells: Starte Wiederherstellung, mergedCells:', mergedCells);
    
    Object.keys(mergedCells).forEach(mergeKey => {
        const parts = mergeKey.split('-');
        if (parts.length < 4) {
            console.warn('Ungültiger mergeKey:', mergeKey);
            return;
        }
        
        // mergeKey Format: "employee-year-month-day"
        const employee = parts[0];
        const firstDateKey = parts.slice(1).join('-'); // Rest ist das Datum
        const mergeData = mergedCells[mergeKey];
        
        console.log('Wiederherstelle Merge:', { employee, firstDateKey, mergeData });
        
        // Finde die Zeile des Mitarbeiters
        const rows = document.querySelectorAll('tbody tr');
        let targetRow = null;
        for (const row of rows) {
            const nameCell = row.querySelector('td:first-child span');
            if (nameCell && nameCell.textContent === employee) {
                targetRow = row;
                break;
            }
        }
        
        if (!targetRow) {
            console.warn('Zeile für Mitarbeiter nicht gefunden:', employee);
            return;
        }
        
        // Finde die erste Zelle über data-date Attribut
        const allCells = Array.from(targetRow.children);
        const firstCell = allCells.find(c => {
            const cellDateKey = c.getAttribute('data-date');
            return cellDateKey === firstDateKey;
        });
        
        if (!firstCell) {
            console.warn('Erste Zelle nicht gefunden für dateKey:', firstDateKey);
            return;
        }
        
        console.log('Erste Zelle gefunden, stelle Zusammenführung wieder her');
        
        // Stelle die Zusammenführung wieder her mit CSS-Positionierung
        const spanCount = mergeData.mergedCells ? mergeData.mergedCells.length : 1;
        
        // Warte kurz, damit die Zellen gerendert sind
        setTimeout(() => {
            // Berechne die Gesamtbreite aus allen zusammengeführten Zellen
            let totalWidth = 0;
            const cellsToMeasure = [firstCell];
            
            // Finde alle zusammengeführten Zellen
            if (mergeData.mergedCells && mergeData.mergedCells.length > 1) {
                for (let i = 1; i < mergeData.mergedCells.length; i++) {
                    const dateKey = mergeData.mergedCells[i];
                    const hiddenCell = allCells.find(c => {
                        const cellDateKey = c.getAttribute('data-date');
                        return cellDateKey === dateKey;
                    });
                    if (hiddenCell) {
                        cellsToMeasure.push(hiddenCell);
                    }
                }
            }
            
            // Berechne Gesamtbreite
            cellsToMeasure.forEach(cell => {
                const rect = cell.getBoundingClientRect();
                if (rect.width > 0) {
                    totalWidth += rect.width;
                } else {
                    totalWidth += cell.offsetWidth || 100;
                }
            });
            
            if (totalWidth === 0) {
                totalWidth = 100 * spanCount; // Fallback
            }
            
            // Stelle die Zusammenführung wieder her mit colspan
            const spanCount = mergeData.mergedCells ? mergeData.mergedCells.length : 1;
            
            console.log('Wiederherstelle Zusammenführung:', { spanCount });
            
            // Entferne vorhandene Zellen, die Teil der Zusammenführung sein sollten
            const cellsToRemove = [];
            if (mergeData.mergedCells && mergeData.mergedCells.length > 1) {
                for (let i = 1; i < mergeData.mergedCells.length; i++) {
                    const dateKey = mergeData.mergedCells[i];
                    const cellToRemove = allCells.find(c => {
                        const cellDateKey = c.getAttribute('data-date');
                        return cellDateKey === dateKey && !c.hasAttribute('data-merged');
                    });
                    if (cellToRemove) {
                        cellsToRemove.push(cellToRemove);
                    }
                }
            }
            
            // Entferne die Zellen
            cellsToRemove.forEach(cell => cell.remove());
            
            // Setze colspan auf die erste Zelle
            firstCell.setAttribute('colspan', spanCount);
            firstCell.setAttribute('data-merged', 'true');
            firstCell.setAttribute('data-merged-cells', JSON.stringify(mergeData.mergedCells || []));
            
            // Aktualisiere die erste Zelle (aber behalte colspan)
            const savedColspan = firstCell.getAttribute('colspan') || spanCount;
            updateCell(firstCell, employee, firstDateKey);
            
            // Stelle sicher, dass colspan erhalten bleibt
            if (firstCell.hasAttribute('data-merged')) {
                firstCell.setAttribute('colspan', savedColspan);
            }
        }, 100);
        
        console.log('Zusammenführung wiederhergestellt für:', mergeKey);
    });
    
    console.log('restoreMergedCells: Abgeschlossen');
}

// Farbmarkierung für ausgewählte Zellen (speichert dauerhaft)
function applyHighlightToSelectedCells() {
    if (selectedCells.size === 0) return;
    
    const hexColor = selectedHighlightColor || '#fff176';
    const alpha = Math.max(0.1, Math.min(1, selectedHighlightOpacity));

    // Hex nach RGB umwandeln
    const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
    if (!match) return;

    const r = parseInt(match[1], 16);
    const g = parseInt(match[2], 16);
    const b = parseInt(match[3], 16);
    const rgbaColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;

    selectedCells.forEach(cell => {
        if (!cell) return;
        const employee = cell.getAttribute('data-employee');
        const dateKey = cell.getAttribute('data-date');
        if (!employee || !dateKey) return;

        const highlightKey = `${employee}-${dateKey}`;

        // Im Speicher (Firebase/localStorage) ablegen
        cellHighlights[highlightKey] = {
            color: rgbaColor,
            hex: hexColor,
            opacity: alpha
        };

        // Im DOM anwenden
        cell.style.backgroundColor = rgbaColor;
        // Textfarbe für gute Lesbarkeit anpassen
        cell.style.color = alpha > 0.6 ? '#000' : (cell.style.color || '#000');
    });

    // Persistieren
    saveData('cellHighlights', cellHighlights);
}

// Nur Farbmarkierungen der ausgewählten Zellen löschen (Inhalt/Status bleiben erhalten)
async function clearHighlightsFromSelectedCells() {
    if (selectedCells.size === 0) return;

    selectedCells.forEach(cell => {
        if (!cell) return;
        const employee = cell.getAttribute('data-employee');
        const dateKey = cell.getAttribute('data-date');
        if (!employee || !dateKey) return;

        const highlightKey = `${employee}-${dateKey}`;
        delete cellHighlights[highlightKey];

        // Hintergrund zurück auf Status-/Standardfarbe setzen
        const assignment = assignments[employee]?.[dateKey];
        if (assignment && assignment.status) {
            // Status-Farben wie in updateCell
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
            const bg = assignment.status === 'abgerechnet' ? '#d4edda' : statusColors[assignment.status] || '';
            cell.style.backgroundColor = bg;
            cell.style.color = bg === '#e8f5e9' || bg === '#ffc107' || bg === '' ? 'black' : 'white';
        } else {
            // Kein Status: Standard-Hintergrund
            cell.style.backgroundColor = '#f3f3f3';
            cell.style.color = '#111111';
        }
    });

    await saveData('cellHighlights', cellHighlights);
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
            
            // Container für Aktionen (rechtsbündig)
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'name-actions';
            
            // Verschiebe-Buttons
            const moveUpButton = document.createElement('button');
            moveUpButton.className = 'move-employee';
            moveUpButton.textContent = '↑';
            moveUpButton.title = 'Nach oben verschieben';
            moveUpButton.addEventListener('click', (e) => {
                e.stopPropagation();
                moveEmployee(employee, 'up');
            });
            actionsContainer.appendChild(moveUpButton);
            
            const moveDownButton = document.createElement('button');
            moveDownButton.className = 'move-employee';
            moveDownButton.textContent = '↓';
            moveDownButton.title = 'Nach unten verschieben';
            moveDownButton.addEventListener('click', (e) => {
                e.stopPropagation();
                moveEmployee(employee, 'down');
            });
            actionsContainer.appendChild(moveDownButton);
            
            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-employee';
            deleteButton.textContent = '×';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                showDeleteEmployeeModal(employee);
            });
            actionsContainer.appendChild(deleteButton);

            nameContainer.appendChild(actionsContainer);
            
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
                
                // Setze data-date Attribut für einfachere Identifikation
                cell.setAttribute('data-date', dateKey);
                cell.setAttribute('data-employee', employee);
                
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
                
                // Mobile Touch-Events: Long-Press und Touch-Drag
                let longPressTimer = null;
                let touchStartCell = null;
                let touchMoved = false;
                
                cell.addEventListener('touchstart', (e) => {
                    touchStartCell = cell;
                    touchMoved = false;
                    longPressTimer = setTimeout(() => {
                        if (!touchMoved) {
                            e.preventDefault();
                            showMobileContextMenu(cell, employee, dateKey, e.touches[0]);
                        }
                    }, 500); // 500ms für Long-Press
                });
                
                cell.addEventListener('touchmove', (e) => {
                    touchMoved = true;
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    
                    // Touch-Drag für Mehrfachauswahl
                    if (touchStartCell && isSelecting) {
                        const touch = e.touches[0];
                        const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                        const targetCell = elementBelow?.closest('.calendar-cell');
                        if (targetCell && targetCell !== touchStartCell) {
                            selectCellsBetween(touchStartCell, targetCell);
                        }
                    }
                });
                
                cell.addEventListener('touchend', (e) => {
                    if (longPressTimer) {
                        clearTimeout(longPressTimer);
                        longPressTimer = null;
                    }
                    
                    if (!touchMoved && !isSelecting) {
                        // Einfacher Touch: Toggle Auswahl
                        toggleCellSelection(cell);
                    }
                    
                    touchStartCell = null;
                    touchMoved = false;
                });
                
                // Setze data-date Attribut für einfachere Identifikation
                cell.setAttribute('data-date', dateKey);
                cell.setAttribute('data-employee', employee);
                
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
            
            // Setze data-date Attribut für einfachere Identifikation
            cell.setAttribute('data-date', dateKey);
            cell.setAttribute('data-employee', employee);
            
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
            
            // Mobile Touch-Events: Long-Press und Touch-Drag
            let longPressTimer = null;
            let touchStartCell = null;
            let touchMoved = false;
            
            cell.addEventListener('touchstart', (e) => {
                touchStartCell = cell;
                touchMoved = false;
                longPressTimer = setTimeout(() => {
                    if (!touchMoved) {
                        e.preventDefault();
                        showMobileContextMenu(cell, employee, dateKey, e.touches[0]);
                    }
                }, 500); // 500ms für Long-Press
            });
            
            cell.addEventListener('touchmove', (e) => {
                touchMoved = true;
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                
                // Touch-Drag für Mehrfachauswahl
                if (touchStartCell && isSelecting) {
                    const touch = e.touches[0];
                    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                    const targetCell = elementBelow?.closest('.calendar-cell');
                    if (targetCell && targetCell !== touchStartCell) {
                        selectCellsBetween(touchStartCell, targetCell);
                    }
                }
            });
            
            cell.addEventListener('touchend', (e) => {
                if (longPressTimer) {
                    clearTimeout(longPressTimer);
                    longPressTimer = null;
                }
                
                if (!touchMoved && touchStartCell) {
                    // Einfacher Touch = Toggle-Auswahl
                    toggleCellSelection(cell);
                }
                
                touchStartCell = null;
                touchMoved = false;
            });
            
            row.appendChild(cell);
        }
    });
    
    // Stelle zusammengeführte Zellen wieder her (nachdem alle Zellen erstellt wurden)
    setTimeout(() => restoreMergedCells(), 200);
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
    
    // Prüfe zuerst, ob die Zelle ein data-date Attribut hat (schneller und zuverlässiger)
    const dataDate = cell.getAttribute('data-date');
    if (dataDate) {
        return dataDate;
    }
    
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
            
            // Entferne colspan IMMER, wenn ein Status-Button gesetzt wird
            // (muss VOR updateCell passieren)
            cell.removeAttribute('colspan');
            
            // Logge die Button-Markierung
            addToAuditLog('Button markiert', {
                employee: employee,
                date: dateKey,
                status: status,
                statusText: statusText
            });
            cell.style.width = '';
            cell.style.position = '';
            cell.style.zIndex = '';
            
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
    
    // Bei Status "abgerechnet" Kalender neu aufbauen,
    // damit zusammengeführte Felder sofort wieder korrekt dargestellt werden
    if (status === 'abgerechnet') {
        updateCalendar();
    }
    
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

// Event Listener für Export-Bereich Änderung
document.querySelectorAll('input[name="exportRange"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const yearSelection = document.getElementById('yearSelection');
        if (e.target.value === 'all') {
            yearSelection.style.display = 'block';
            // Fülle Jahr-Auswahl mit verfügbaren Jahren
            const yearSelect = document.getElementById('exportYear');
            yearSelect.innerHTML = '';
            const currentYear = currentDate.getFullYear();
            for (let year = 2025; year <= currentYear + 5; year++) {
                const option = document.createElement('option');
                option.value = year;
                option.textContent = year;
                if (year === currentYear) option.selected = true;
                yearSelect.appendChild(option);
            }
        } else {
            yearSelection.style.display = 'none';
        }
    });
});

document.getElementById('confirmExport').addEventListener('click', () => {
    const exportRange = document.querySelector('input[name="exportRange"]:checked').value;
    const exportFormats = Array.from(document.querySelectorAll('input[name="exportFormat"]:checked')).map(input => input.value);
    
    if (exportFormats.length === 0) {
        alert('Bitte wählen Sie mindestens ein Dateiformat aus.');
        return;
    }
    
    try {
        let exportYear = currentDate.getFullYear();
        if (exportRange === 'all') {
            exportYear = parseInt(document.getElementById('exportYear').value);
        }
        
        if (exportFormats.includes('json')) {
            exportJSON(exportRange, exportYear);
        }
        
        if (exportFormats.includes('excel')) {
            exportExcel(exportRange, exportYear);
        }
        
        document.getElementById('exportModal').style.display = 'none';
    } catch (error) {
        console.error('Fehler beim Export:', error);
        alert('Fehler beim Exportieren der Daten. Bitte versuchen Sie es erneut.');
    }
});

function exportJSON(range, year = null) {
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
    } else if (range === 'all' && year) {
        // Filtere die Daten für das gewählte Jahr
        Object.keys(data.assignments).forEach(employee => {
            data.assignments[employee] = Object.fromEntries(
                Object.entries(data.assignments[employee]).filter(([key]) => {
                    const [y] = key.split('-');
                    return parseInt(y) === year;
                })
            );
        });
        
        // Filtere Notizen, Links und Adressen
        ['cellNotes', 'cellLinks', 'cellAddresses'].forEach(key => {
            data[key] = Object.fromEntries(
                Object.entries(data[key]).filter(([key]) => {
                    const parts = key.split('-');
                    if (parts.length >= 2) {
                        const y = parseInt(parts[1]);
                        return y === year;
                    }
                    return false;
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
        year ? `${year}` : 'backup'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportExcel(range, year = null) {
    const months = [
        'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
        'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    
    try {
        console.log('Starte Excel-Export...');
        
        // Erstelle Arbeitsmappe
        const wb = XLSX.utils.book_new();
        console.log('Arbeitsmappe erstellt');
        
        const exportYear = year || currentDate.getFullYear();
        
        if (range === 'currentMonth') {
            console.log('Exportiere aktuellen Monat:', months[currentDate.getMonth()]);
            // Exportiere nur aktuellen Monat
            const ws = createWorksheetForMonth(currentDate.getFullYear(), currentDate.getMonth());
            XLSX.utils.book_append_sheet(wb, ws, `Arbeitsplan ${months[currentDate.getMonth()]}`);
        } else {
            console.log(`Exportiere alle Monate für Jahr ${exportYear}`);
            // Exportiere alle Monate für das gewählte Jahr
            for (let month = 0; month < 12; month++) {
                const ws = createWorksheetForMonth(exportYear, month);
                XLSX.utils.book_append_sheet(wb, ws, months[month]);
            }
        }
        
        // Exportiere Excel-Datei
        const fileName = `arbeitsplan_${range === 'currentMonth' ? 
            `${months[currentDate.getMonth()]}_${currentDate.getFullYear()}` : 
            `komplett_${exportYear}`}.xlsx`;
            
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
        
        // Berechne die Anzahl der Tage im Monat
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Erstelle Header-Zeile
        const headerRow = ['Mitarbeiter'];
        const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const weekday = weekdays[date.getDay()];
            headerRow.push(`${day} ${weekday}`);
        }
        
        // Erstelle Daten-Zeilen aus assignments und cellNotes
        const dataRows = [];
        
        // Filtere Mitarbeiter, die in diesem Monat aktiv sind
        const activeEmployees = employees.filter(employee => {
            if (!employeeStartDates[employee] && !employeeEndDates[employee]) {
                return true; // Keine Start-/Enddaten = immer aktiv
            }
            const startDate = new Date(employeeStartDates[employee] || '2000-01-01');
            const endDate = employeeEndDates[employee] ? new Date(employeeEndDates[employee]) : new Date('2100-12-31');
            const monthStart = new Date(year, month, 1);
            return isDateInRange(monthStart, startDate, endDate);
        });
        
        activeEmployees.forEach(employee => {
            const rowData = [employee];
            
            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = `${year}-${month + 1}-${day}`;
                const noteKey = `${employee}-${dateKey}`;
                
                // Prüfe zuerst assignments (Status-Buttons)
                const assignment = assignments[employee]?.[dateKey];
                let cellText = '';
                
                if (assignment) {
                    // Wenn ein Status vorhanden ist, zeige den Status-Text
                    // AUSNAHME: Bei "abgerechnet" zeige nur den Text, nicht "Abgerechnet"
                    if (assignment.status && assignment.status !== 'abgerechnet') {
                        const statusTexts = {
                            'urlaub': 'Urlaub',
                            'krank': 'Krankheit',
                            'unbezahlt': 'Unbezahlter Urlaub',
                            'schulung': 'Schule',
                            'feiertag': 'Feiertag',
                            'kurzarbeit': 'Kurzarbeit',
                            'ueberstunden': 'Überstunden frei'
                        };
                        cellText = statusTexts[assignment.status] || assignment.text || '';
                    } else {
                        // Bei "abgerechnet" oder keinem Status: zeige nur den Text
                        cellText = assignment.text || '';
                    }
                }
                
                // Wenn eine Notiz vorhanden ist, füge sie hinzu
                if (cellNotes[noteKey] && cellNotes[noteKey].trim()) {
                    if (cellText) {
                        cellText += ' - ' + cellNotes[noteKey];
                    } else {
                        cellText = cellNotes[noteKey];
                    }
                }
                
                rowData.push(cellText);
            }
            
            dataRows.push(rowData);
        });
        
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
            
            // Zeige Undo-Option mit Ja/Nein Modal
            const undoModal = document.getElementById('undoImportModal');
            if (undoModal) {
                undoModal.style.display = 'block';
                
                const confirmBtn = document.getElementById('confirmUndo');
                const cancelBtn = document.getElementById('cancelUndo');
                
                // Entferne alte Event Listener (falls vorhanden)
                const newConfirmBtn = confirmBtn.cloneNode(true);
                const newCancelBtn = cancelBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
                cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
                
                const handleConfirm = async () => {
                    undoModal.style.display = 'none';
                    await undoImport();
                };
                
                const handleCancel = () => {
                    undoModal.style.display = 'none';
                    importBackup = null; // Backup löschen, wenn nicht rückgängig gemacht
                };
                
                newConfirmBtn.addEventListener('click', handleConfirm);
                newCancelBtn.addEventListener('click', handleCancel);
                
                // Schließe Modal beim Klick außerhalb
                const handleModalClick = (e) => {
                    if (e.target === undoModal) {
                        handleCancel();
                        undoModal.removeEventListener('click', handleModalClick);
                    }
                };
                undoModal.addEventListener('click', handleModalClick);
            } else {
                // Fallback zu confirm, falls Modal nicht gefunden
                const undo = window.confirm('Daten wurden erfolgreich importiert!\n\nMöchten Sie die Änderung rückgängig machen?');
                if (undo) {
                    await undoImport();
                } else {
                    importBackup = null;
                }
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

// Event Listener für Auswertung
document.getElementById('showEvaluation').addEventListener('click', () => {
    const modal = document.getElementById('evaluationModal');
    const yearSelect = document.getElementById('evaluationYear');
    
    // Fülle Jahr-Auswahl
    yearSelect.innerHTML = '';
    const currentYear = currentDate.getFullYear();
    for (let year = 2025; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) option.selected = true;
        yearSelect.appendChild(option);
    }
    
    modal.style.display = 'block';
});

document.getElementById('closeEvaluation').addEventListener('click', () => {
    document.getElementById('evaluationModal').style.display = 'none';
});

document.getElementById('generateEvaluation').addEventListener('click', () => {
    const year = parseInt(document.getElementById('evaluationYear').value);
    generateEvaluation(year);
});

// Schließe Modal beim Klick außerhalb
document.getElementById('evaluationModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('evaluationModal')) {
        document.getElementById('evaluationModal').style.display = 'none';
    }
});

document.getElementById('importData').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importData(e.target.files[0]);
    }
});

// Funktion zum Erstrecken von Text über mehrere Zellen
// DEAKTIVIERT: Jedes Feld bleibt in seiner eigenen Zelle
function extendTextOverCells(cell, employee, dateKey) {
    // Funktion deaktiviert - jedes Feld bleibt in seiner eigenen Zelle
    // Entferne immer colspan, falls vorhanden
    if (cell) {
        cell.removeAttribute('colspan');
        cell.style.width = '';
        cell.style.position = '';
        cell.style.zIndex = '';
    }
}

function updateCell(cell, employee, dateKey) {
    const assignment = assignments[employee]?.[dateKey];
    const noteKey = `${employee}-${dateKey}`;
    const linkKey = `${employee}-${dateKey}-link`;
    const addressKey = `${employee}-${dateKey}-address`;
    const highlightKey = `${employee}-${dateKey}`;
    
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

    // Wende ggf. gespeicherte Farbmarkierung an (überschreibt Status-Farbe nur visuell)
    const highlight = cellHighlights[highlightKey];
    if (highlight && highlight.color) {
        cell.style.backgroundColor = highlight.color;
        // Lesbarkeit sicherstellen
        cell.style.color = highlight.opacity && highlight.opacity > 0.6 ? '#000' : (cell.style.color || '#000');
    }
    
    // Setze die Notiz, wenn vorhanden
    if (cellNotes[noteKey]) {
        const cellText = cell.querySelector('.cell-text');
        if (cellText) {
            cellText.textContent = cellNotes[noteKey];
        }
        cell.setAttribute('data-info', cellNotes[noteKey]);
    }
    
    // Stelle sicher, dass jedes Feld in seiner eigenen Zelle bleibt
    // Entferne immer colspan, damit sich keine Felder erstrecken
    // AUSNAHME: Wenn die Zelle Teil einer Zusammenführung ist, behalte die Styles
    if (cell) {
        const isMerged = cell.hasAttribute('data-merged');
        if (!isMerged) {
            cell.removeAttribute('colspan');
            cell.style.width = '';
            cell.style.position = '';
            cell.style.zIndex = '';
        }
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
    // restoreMergedCells() wird bereits in showCurrentWeek() aufgerufen
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

// Funktion zur Generierung der Auswertung
function generateEvaluation(year) {
    const statusButtons = ['urlaub', 'krank', 'unbezahlt', 'schulung', 'feiertag', 'kurzarbeit', 'abgerechnet', 'ueberstunden'];
    const statusLabels = {
        'urlaub': 'Urlaub',
        'krank': 'Krankheit',
        'unbezahlt': 'Unbezahlter Urlaub',
        'schulung': 'Schule',
        'feiertag': 'Feiertag',
        'kurzarbeit': 'Kurzarbeit',
        'abgerechnet': 'Abgerechnet',
        'ueberstunden': 'Überstunden frei'
    };
    
    // Filtere Mitarbeiter, die im gewählten Jahr aktiv waren
    const activeEmployees = employees.filter(employee => {
        if (!employeeStartDates[employee] && !employeeEndDates[employee]) {
            return true;
        }
        const startDate = new Date(employeeStartDates[employee] || '2000-01-01');
        const endDate = employeeEndDates[employee] ? new Date(employeeEndDates[employee]) : new Date('2100-12-31');
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        return (startDate <= yearEnd && endDate >= yearStart);
    });
    
    // Berechne Statistik für jeden Mitarbeiter
    const stats = {};
    activeEmployees.forEach(employee => {
        stats[employee] = {};
        statusButtons.forEach(status => {
            stats[employee][status] = 0;
        });
        
        // Zähle Tage für jeden Status im Jahr
        for (let month = 0; month < 12; month++) {
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                const dateKey = `${year}-${month + 1}-${day}`;
                const assignment = assignments[employee]?.[dateKey];
                if (assignment && assignment.status) {
                    if (stats[employee][assignment.status] !== undefined) {
                        stats[employee][assignment.status]++;
                    }
                }
            }
        }
    });
    
    // Erstelle HTML-Tabelle
    const tableDiv = document.getElementById('evaluationTable');
    let html = '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">';
    html += '<thead><tr>';
    html += '<th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;">Mitarbeiter</th>';
    statusButtons.forEach(status => {
        html += `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: center;">${statusLabels[status]}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    activeEmployees.forEach(employee => {
        html += '<tr>';
        html += `<td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${employee}</td>`;
        statusButtons.forEach(status => {
            const count = stats[employee][status] || 0;
            html += `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${count}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    tableDiv.innerHTML = html;
}

// Funktion zum Auflösen markierter zusammengeführter Felder
async function unmergeSelectedCells() {
    if (selectedCells.size === 0) return;
    
    saveState();
    
    const cellsToUnmerge = new Set();
    
    // Sammle alle zusammengeführten Zellen, die aufgelöst werden sollen
    selectedCells.forEach(cell => {
        if (cell.hasAttribute('data-merged')) {
            cellsToUnmerge.add(cell);
        } else if (cell.hasAttribute('data-merged-into')) {
            // Finde die Hauptzelle
            const mergedIntoDateKey = cell.getAttribute('data-merged-into');
            const row = cell.parentElement;
            const mainCell = Array.from(row.children).find(c => {
                const cellDateKey = c.getAttribute('data-date');
                return cellDateKey === mergedIntoDateKey && c.hasAttribute('data-merged');
            });
            if (mainCell) {
                cellsToUnmerge.add(mainCell);
            }
        }
    });
    
    if (cellsToUnmerge.size === 0) {
        console.log('Keine zusammengeführten Felder zum Auflösen gefunden');
        return;
    }
    
    console.log('Löse zusammengeführte Felder auf:', cellsToUnmerge.size);
    
    // Löse jede zusammengeführte Zelle auf
    for (const cell of cellsToUnmerge) {
        const row = cell.parentElement;
        const employee = row.querySelector('td:first-child span')?.textContent;
        const firstDateKey = getDateKeyFromCell(cell) || cell.getAttribute('data-date');
        
        if (!employee || !firstDateKey) continue;
        
        // Hole die zusammengeführten dateKeys
        const mergedCellsStr = cell.getAttribute('data-merged-cells');
        if (!mergedCellsStr) continue;
        
        try {
            const mergedCellIds = JSON.parse(mergedCellsStr);
            
            // Entferne colspan und Attribute
            cell.removeAttribute('colspan');
            cell.removeAttribute('data-merged');
            cell.removeAttribute('data-merged-cells');
            cell.removeAttribute('data-merged-hidden-cells');
            
            // Erstelle die entfernten Zellen wieder
            const firstCellIndex = Array.from(row.children).indexOf(cell);
            
            for (let i = 1; i < mergedCellIds.length; i++) {
                const dateKey = mergedCellIds[i];
                
                // Prüfe, ob die Zelle bereits existiert (z.B. als Platzhalter)
                const existingCell = Array.from(row.children).find(c => {
                    const cellDateKey = c.getAttribute('data-date');
                    return cellDateKey === dateKey;
                });
                
                if (existingCell) {
                    // Entferne Platzhalter-Attribute, falls vorhanden
                    existingCell.removeAttribute('data-merged-placeholder');
                    existingCell.removeAttribute('data-merged-into');
                    existingCell.removeAttribute('data-merged-datekey');
                    existingCell.style.display = '';
                } else {
                    // Erstelle eine neue Zelle
                    const newCell = document.createElement('td');
                    newCell.className = 'calendar-cell';
                    newCell.setAttribute('data-date', dateKey);
                    newCell.setAttribute('data-employee', employee);
                    
                    // Prüfe Wochenende
                    const [year, month, day] = dateKey.split('-').map(Number);
                    const date = new Date(year, month - 1, day);
                    if (date.getDay() === 0 || date.getDay() === 6) {
                        newCell.classList.add('weekend-cell');
                    }
                    
                    // Erstelle Zellenstruktur
                    const cellContent = document.createElement('div');
                    cellContent.className = 'cell-content';
                    
                    const cellText = document.createElement('div');
                    cellText.className = 'cell-text';
                    cellContent.appendChild(cellText);
                    
                    const cellIcons = document.createElement('div');
                    cellIcons.className = 'cell-icons';
                    cellContent.appendChild(cellIcons);
                    
                    newCell.appendChild(cellContent);
                    
                    // Füge Event-Listener hinzu (wie in setupDesktopMonthView)
                    newCell.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        if (!isSelecting) {
                            clearSelection();
                        }
                        isSelecting = true;
                        lastSelectedCell = newCell;
                        toggleCellSelection(newCell);
                    });
                    
                    newCell.addEventListener('mouseover', (e) => {
                        if (isSelecting && lastSelectedCell) {
                            selectCellsBetween(lastSelectedCell, newCell);
                        }
                    });
                    
                    let clickTimeout;
                    newCell.addEventListener('click', (e) => {
                        clearTimeout(clickTimeout);
                        clickTimeout = setTimeout(() => {
                            if (currentEditingCell && currentEditingCell !== newCell) {
                                closeInfoField();
                            }
                        }, 200);
                    });
                    
                    newCell.addEventListener('dblclick', (e) => {
                        clearTimeout(clickTimeout);
                        e.preventDefault();
                        showInfoField(newCell, employee, dateKey, true);
                    });
                    
                    // Füge die Zelle ein
                    if (row.children[firstCellIndex + i]) {
                        row.insertBefore(newCell, row.children[firstCellIndex + i]);
                    } else {
                        row.appendChild(newCell);
                    }
                    
                    // Aktualisiere die Zelle
                    updateCell(newCell, employee, dateKey);
                }
            }
            
            // Entferne den Eintrag aus mergedCells
            const mergeKey = `${employee}-${firstDateKey}`;
            delete mergedCells[mergeKey];
            
            // Aktualisiere die erste Zelle
            updateCell(cell, employee, firstDateKey);
            
        } catch (e) {
            console.error('Fehler beim Auflösen der Zusammenführung:', e);
        }
    }
    
    // Speichere die Änderungen
    await saveData('mergedCells', mergedCells);
    
    // Aktualisiere den Kalender
    updateCalendar();
    
    clearSelection();
    
    console.log('Zusammengeführte Felder aufgelöst');
}

// Funktion zum Zusammenführen mehrerer markierter Felder
async function mergeSelectedCells() {
    // Prüfe, ob mindestens 2 Zellen markiert sind ODER ob ein zusammengeführtes Feld markiert ist
    // Wenn ein zusammengeführtes Feld markiert ist, kann es auch nur 1 Zelle im DOM sein
    const hasMergedCell = Array.from(selectedCells).some(cell => 
        cell.hasAttribute('data-merged') || cell.hasAttribute('data-merged-into')
    );
    
    // Prüfe, ob NUR zusammengeführte Felder markiert sind (ohne weitere normale Felder)
    const allMergedCells = Array.from(selectedCells).every(cell => 
        cell.hasAttribute('data-merged') || cell.hasAttribute('data-merged-into')
    );
    
    // Wenn nur zusammengeführte Felder markiert sind, löse sie auf
    if (allMergedCells && selectedCells.size > 0) {
        console.log('Nur zusammengeführte Felder markiert, löse sie auf');
        await unmergeSelectedCells();
        return;
    }
    
    if (selectedCells.size < 2 && !hasMergedCell) {
        console.log('Nicht genug Zellen markiert:', selectedCells.size);
        return;
    }
    
    saveState();
    
    // Erweitere selectedCells um alle zusammengeführten Zellen
    // WICHTIG: Sammle auch die dateKeys von bereits entfernten Zellen
    const expandedCells = new Set();
    const expandedDateKeys = new Set(); // Speichere dateKeys für bereits entfernte Zellen
    
    selectedCells.forEach(cell => {
        expandedCells.add(cell);
        
        // Füge dateKey hinzu, falls vorhanden
        const dateKey = getDateKeyFromCell(cell);
        if (dateKey) {
            expandedDateKeys.add(dateKey);
        }
        
        // Wenn diese Zelle Teil einer Zusammenführung ist, füge alle zusammengeführten Zellen hinzu
        if (cell.hasAttribute('data-merged')) {
            const mergedCellsStr = cell.getAttribute('data-merged-cells');
            if (mergedCellsStr) {
                try {
                    const mergedCellIds = JSON.parse(mergedCellsStr);
                    const row = cell.parentElement;
                    
                    // Füge alle dateKeys zur erweiterten Liste hinzu
                    mergedCellIds.forEach(dateKey => {
                        expandedDateKeys.add(dateKey);
                        
                        // Versuche, die Zelle im DOM zu finden
                        const mergedCell = Array.from(row.children).find(c => {
                            const cellDateKey = c.getAttribute('data-date');
                            return cellDateKey === dateKey;
                        });
                        if (mergedCell) {
                            expandedCells.add(mergedCell);
                        }
                    });
                } catch (e) {
                    console.error('Fehler beim Parsen von merged-cells:', e);
                }
            }
        }
        
        // Wenn diese Zelle in eine Zusammenführung eingefügt ist, füge die Hauptzelle hinzu
        if (cell.hasAttribute('data-merged-into')) {
            const mergedIntoDateKey = cell.getAttribute('data-merged-into');
            const row = cell.parentElement;
            const mainCell = Array.from(row.children).find(c => {
                const cellDateKey = c.getAttribute('data-date');
                return cellDateKey === mergedIntoDateKey && c.hasAttribute('data-merged');
            });
            if (mainCell) {
                expandedCells.add(mainCell);
                expandedDateKeys.add(mergedIntoDateKey);
                
                // Füge auch alle anderen zusammengeführten Zellen hinzu
                const mergedCellsStr = mainCell.getAttribute('data-merged-cells');
                if (mergedCellsStr) {
                    try {
                        const mergedCellIds = JSON.parse(mergedCellsStr);
                        mergedCellIds.forEach(dateKey => {
                            expandedDateKeys.add(dateKey);
                            
                            const mergedCell = Array.from(row.children).find(c => {
                                const cellDateKey = c.getAttribute('data-date');
                                return cellDateKey === dateKey;
                            });
                            if (mergedCell) {
                                expandedCells.add(mergedCell);
                            }
                        });
                    } catch (e) {
                        console.error('Fehler beim Parsen von merged-cells:', e);
                    }
                }
            }
        }
    });
    
    // Finde alle Zellen im DOM, die zu den erweiterten dateKeys gehören
    // Dies ist wichtig, um auch Zellen zu finden, die noch nicht zusammengeführt wurden
    const allRows = document.querySelectorAll('tbody tr');
    allRows.forEach(row => {
        const employee = row.querySelector('td:first-child span')?.textContent;
        if (!employee) return;
        
        expandedDateKeys.forEach(dateKey => {
            // Prüfe, ob diese Zelle bereits in expandedCells ist
            const alreadyIncluded = Array.from(expandedCells).some(cell => {
                const cellDateKey = getDateKeyFromCell(cell);
                return cellDateKey === dateKey;
            });
            
            if (!alreadyIncluded) {
                // Suche nach der Zelle im DOM
                const cell = Array.from(row.children).find(c => {
                    const cellDateKey = c.getAttribute('data-date');
                    return cellDateKey === dateKey;
                });
                if (cell && !cell.hasAttribute('data-merged-placeholder')) {
                    expandedCells.add(cell);
                }
            }
        });
    });
    
    // Sortiere Zellen nach Position (von links nach rechts)
    const sortedCells = Array.from(expandedCells).sort((a, b) => {
        const rowA = a.parentElement;
        const rowB = b.parentElement;
        if (rowA !== rowB) return 0; // Nur Zellen in derselben Zeile zusammenführen
        const indexA = Array.from(rowA.children).indexOf(a);
        const indexB = Array.from(rowB.children).indexOf(b);
        return indexA - indexB;
    });
    
    // Prüfe, ob alle Zellen zum selben Mitarbeiter gehören
    // WICHTIG: Wenn zusammengeführte Zellen beteiligt sind, können einige Zellen bereits entfernt sein
    // Prüfe daher basierend auf dem Mitarbeiter, nicht nur auf der Zeile
    if (sortedCells.length === 0) {
        alert('Keine Zellen zum Zusammenführen gefunden.');
        return;
    }
    
    // Finde den Mitarbeiter der ersten Zelle
    const firstRow = sortedCells[0].parentElement;
    const employee = firstRow.querySelector('td:first-child span')?.textContent;
    
    if (!employee) {
        alert('Mitarbeiter nicht gefunden.');
        return;
    }
    
    // Prüfe, ob alle vorhandenen Zellen zum selben Mitarbeiter gehören
    // WICHTIG: Wenn zusammengeführte Zellen beteiligt sind, können einige Zellen bereits entfernt sein
    // Prüfe daher hauptsächlich basierend auf expandedDateKeys und employee
    // Vereinfachte Prüfung: Wenn alle dateKeys zum selben Mitarbeiter gehören, ist es OK
    let allSameEmployee = true;
    if (sortedCells.length > 0) {
        allSameEmployee = sortedCells.every(cell => {
            const cellRow = cell.parentElement;
            const cellEmployee = cellRow.querySelector('td:first-child span')?.textContent;
            return cellEmployee === employee;
        });
    }
    
    // Wenn nicht alle Zellen zum selben Mitarbeiter gehören, prüfe ob es zusammengeführte Zellen sind
    if (!allSameEmployee && sortedCells.length > 0) {
        // Prüfe, ob es sich um zusammengeführte Zellen handelt
        const hasMergedCells = sortedCells.some(cell => cell.hasAttribute('data-merged') || cell.hasAttribute('data-merged-into'));
        
        if (!hasMergedCells) {
            // Wenn keine zusammengeführten Zellen beteiligt sind, muss die Prüfung strenger sein
            console.log('Prüfung fehlgeschlagen:', { sortedCells: sortedCells.length, employee, allSameEmployee });
            alert('Felder können nur innerhalb derselben Zeile zusammengeführt werden.');
            return;
        } else {
            // Wenn zusammengeführte Zellen beteiligt sind, ist es OK
            console.log('Zusammengeführte Zellen erkannt, Prüfung übersprungen');
        }
    }
    
    // Finde die Zeile des Mitarbeiters (wird später benötigt)
    let referenceRow = firstRow;
    // allRows wurde bereits oben deklariert, verwende es hier
    for (const row of allRows) {
        const rowEmployee = row.querySelector('td:first-child span')?.textContent;
        if (rowEmployee === employee) {
            // Prüfe, ob mindestens einer der dateKeys in dieser Zeile ist
            const hasAnyDateKey = Array.from(expandedDateKeys).some(dateKey => {
                const cell = Array.from(row.children).find(c => {
                    const cellDateKey = c.getAttribute('data-date');
                    return cellDateKey === dateKey;
                });
                return cell !== undefined;
            });
            if (hasAnyDateKey) {
                referenceRow = row;
                break;
            }
        }
    }
    
    console.log('Zusammenführung erlaubt:', { employee, expandedDateKeys: Array.from(expandedDateKeys), sortedCells: sortedCells.length });
    
    // Entferne Duplikate und sortiere nach dateKey (nicht nach DOM-Position)
    // WICHTIG: Verwende expandedDateKeys, um auch entfernte Zellen zu berücksichtigen
    const uniqueCells = [];
    const seenDateKeys = new Set();
    
    // Sortiere dateKeys chronologisch
    const sortedDateKeys = Array.from(expandedDateKeys).sort((a, b) => {
        const [yearA, monthA, dayA] = a.split('-').map(Number);
        const [yearB, monthB, dayB] = b.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB;
    });
    
    // Finde für jeden dateKey die entsprechende Zelle im DOM
    sortedDateKeys.forEach(dateKey => {
        if (seenDateKeys.has(dateKey)) return;
        seenDateKeys.add(dateKey);
        
        // Suche die Zelle im DOM
        const cell = sortedCells.find(c => {
            const cellDateKey = getDateKeyFromCell(c);
            return cellDateKey === dateKey;
        });
        
        if (cell) {
            uniqueCells.push(cell);
        } else {
            // Zelle ist nicht im DOM (wurde bereits entfernt)
            // Das ist OK, wir verwenden nur die Zellen, die noch im DOM sind
            // Die dateKeys werden trotzdem in mergedCellIds gespeichert
        }
    });
    
    // Wenn keine Zellen gefunden wurden, verwende sortedCells als Fallback
    if (uniqueCells.length === 0) {
        sortedCells.forEach(cell => {
            const dateKey = getDateKeyFromCell(cell);
            if (dateKey && !seenDateKeys.has(dateKey)) {
                seenDateKeys.add(dateKey);
                uniqueCells.push(cell);
            }
        });
    }
    
    // Nimm die erste Zelle als Basis
    // Wenn uniqueCells leer ist, verwende die erste Zelle aus sortedCells
    let firstCell = uniqueCells.length > 0 ? uniqueCells[0] : sortedCells[0];
    if (!firstCell) {
        alert('Keine Zelle zum Zusammenführen gefunden.');
        return;
    }
    
    const row = firstCell.parentElement;
    // employee wurde bereits oben deklariert, verwende es hier
    if (!employee) {
        alert('Mitarbeiter nicht gefunden.');
        return;
    }
    
    // Wenn firstCell kein dateKey hat, versuche es aus expandedDateKeys zu holen
    let firstDateKey = getDateKeyFromCell(firstCell);
    if (!firstDateKey && expandedDateKeys.size > 0) {
        firstDateKey = Array.from(expandedDateKeys).sort((a, b) => {
            const [yearA, monthA, dayA] = a.split('-').map(Number);
            const [yearB, monthB, dayB] = b.split('-').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateA - dateB;
        })[0];
        
        // Versuche, die Zelle im DOM zu finden
        const foundCell = Array.from(row.children).find(c => {
            const cellDateKey = c.getAttribute('data-date');
            return cellDateKey === firstDateKey;
        });
        if (foundCell) {
            firstCell = foundCell;
        }
    }
    
    if (!firstDateKey) {
        alert('Datum nicht gefunden.');
        return;
    }
    
    // Hole Inhalt aus der ersten Zelle
    const firstNoteKey = `${employee}-${firstDateKey}`;
    const firstLinkKey = `${employee}-${firstDateKey}-link`;
    const firstAddressKey = `${employee}-${firstDateKey}-address`;
    const firstAssignment = assignments[employee]?.[firstDateKey];
    
    let mergedText = cellNotes[firstNoteKey] || firstAssignment?.text || '';
    let mergedStatus = firstAssignment?.status || null;
    let mergedNote = cellNotes[firstNoteKey] || '';
    let mergedLink = cellLinks[firstLinkKey] || '';
    let mergedAddress = cellAddresses[firstAddressKey] || '';
    
    // Speichere Referenzen zu allen zusammengeführten Zellen
    // Verwende expandedDateKeys, um auch bereits entfernte Zellen zu berücksichtigen
    let mergedCellIds = Array.from(expandedDateKeys).sort((a, b) => {
        const [yearA, monthA, dayA] = a.split('-').map(Number);
        const [yearB, monthB, dayB] = b.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA - dateB;
    });
    
    // Stelle sicher, dass die erste Zelle die erste in mergedCellIds ist
    if (mergedCellIds.length > 0 && mergedCellIds[0] !== firstDateKey) {
        const firstIndex = mergedCellIds.indexOf(firstDateKey);
        if (firstIndex > 0) {
            mergedCellIds.splice(firstIndex, 1);
            mergedCellIds.unshift(firstDateKey);
        } else if (firstIndex === -1) {
            // firstDateKey ist nicht in mergedCellIds, füge es am Anfang hinzu
            mergedCellIds.unshift(firstDateKey);
        }
    } else if (mergedCellIds.length === 0) {
        // Fallback: Verwende firstDateKey
        mergedCellIds = [firstDateKey];
    }
    
    console.log('mergedCellIds vor Zusammenführung:', mergedCellIds, 'firstDateKey:', firstDateKey);
    
    // Verwende CSS-Positionierung statt colspan, um Tabellenstruktur zu erhalten
    // spanCount basiert auf der Anzahl der dateKeys, nicht der Zellen im DOM
    const spanCount = mergedCellIds.length;
    
    // Stelle sicher, dass spanCount mindestens 2 ist (sonst macht Zusammenführung keinen Sinn)
    if (spanCount < 2) {
        console.warn('spanCount ist kleiner als 2, Zusammenführung wird übersprungen:', { 
            spanCount, 
            mergedCellIds,
            expandedDateKeys: Array.from(expandedDateKeys),
            selectedCells: selectedCells.size
        });
        return;
    }
    
    // Prüfe, ob sich die Zusammenführung geändert hat
    // Wenn ein zusammengeführtes Feld markiert ist, prüfe ob es erweitert/verkleinert werden soll
    const existingMergeKey = `${employee}-${firstDateKey}`;
    const existingMerge = mergedCells[existingMergeKey];
    if (existingMerge && existingMerge.mergedCells) {
        const existingMergedCells = existingMerge.mergedCells;
        const existingCount = existingMergedCells.length;
        
        // Sortiere beide Arrays für Vergleich
        const sortedExisting = [...existingMergedCells].sort();
        const sortedNew = [...mergedCellIds].sort();
        
        // Prüfe, ob die dateKeys unterschiedlich sind
        const dateKeysChanged = JSON.stringify(sortedNew) !== JSON.stringify(sortedExisting);
        
        // Prüfe, ob sich die Anzahl geändert hat
        const countChanged = spanCount !== existingCount;
        
        if (!dateKeysChanged && !countChanged) {
            console.log('Zusammenführung unverändert, überspringe:', { 
                spanCount, 
                existingCount,
                mergedCellIds: sortedNew,
                existingMergedCells: sortedExisting
            });
            return;
        }
        
        console.log('Zusammenführung wird geändert:', { 
            spanCount, 
            existingCount,
            dateKeysChanged,
            countChanged,
            mergedCellIds: sortedNew,
            existingMergedCells: sortedExisting,
            expandedDateKeys: Array.from(expandedDateKeys)
        });
    } else {
        console.log('Neue Zusammenführung wird erstellt:', { 
            spanCount,
            mergedCellIds,
            expandedDateKeys: Array.from(expandedDateKeys)
        });
    }
    
    // Berechne die Gesamtbreite (alle Zellen zusammen)
    // Warte kurz, damit die Zellen gerendert sind
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Berechne die Gesamtbreite aus allen Zellen
    // Verwende die erste Zelle als Basis und multipliziere mit spanCount
    // Das ist wichtig, da zusammengeführte Zellen bereits entfernt sein können
    let totalWidth = 0;
    if (firstCell && uniqueCells.length > 0) {
        // Versuche, die Breite aus der ersten Zelle zu berechnen
        const rect = firstCell.getBoundingClientRect();
        const singleCellWidth = rect.width > 0 ? rect.width : (firstCell.offsetWidth || 100);
        totalWidth = singleCellWidth * spanCount;
    } else if (firstCell) {
        // Fallback: Verwende offsetWidth der ersten Zelle
        const singleCellWidth = firstCell.offsetWidth || 100;
        totalWidth = singleCellWidth * spanCount;
    } else {
        // Fallback: Verwende Standardbreite
        totalWidth = 100 * spanCount;
    }
    
    console.log('Zusammenführung:', { 
        spanCount, 
        totalWidth, 
        uniqueCells: uniqueCells.length, 
        mergedCellIds: mergedCellIds.length,
        expandedDateKeys: expandedDateKeys.size,
        firstDateKey 
    });
    
    // Verwende colspan - das ist das einzige, was in HTML-Tabellen funktioniert
    // WICHTIG: colspan verschiebt die nachfolgenden Zellen, das ist das normale Verhalten
    // Um die Wochenstruktur zu erhalten, müssen wir die Header-Zellen anpassen
    firstCell.setAttribute('colspan', spanCount);
    firstCell.setAttribute('data-merged', 'true');
    firstCell.setAttribute('data-merged-cells', JSON.stringify(mergedCellIds));
    
    // Entferne die anderen Zellen aus dem DOM
    // WICHTIG: Entferne alle Zellen, die in mergedCellIds sind, außer der ersten
    const removedCells = [];
    for (let i = 1; i < mergedCellIds.length; i++) {
        const dateKey = mergedCellIds[i];
        
        // Finde die Zelle im DOM
        const cell = Array.from(row.children).find(c => {
            const cellDateKey = c.getAttribute('data-date');
            return cellDateKey === dateKey && !c.hasAttribute('data-merged');
        });
        
        if (cell) {
            // Entferne alle Daten aus den anderen Zellen
            const noteKey = `${employee}-${dateKey}`;
            const linkKey = `${employee}-${dateKey}-link`;
            const addressKey = `${employee}-${dateKey}-address`;
            
            delete cellNotes[noteKey];
            delete cellLinks[linkKey];
            delete cellAddresses[addressKey];
            if (assignments[employee]) {
                delete assignments[employee][dateKey];
            }
            
            removedCells.push({ dateKey, cell });
            cell.remove();
        } else {
            // Zelle wurde bereits entfernt (z.B. bei vorheriger Zusammenführung)
            // Füge sie trotzdem zu removedCells hinzu
            removedCells.push({ dateKey, cell: null });
        }
    }
    
    // Speichere die entfernten Zellen
    firstCell.setAttribute('data-merged-hidden-cells', JSON.stringify(removedCells.map(c => c.dateKey)));
    
    // Speichere die Zusammenführung in mergedCells
    const mergeKey = `${employee}-${firstDateKey}`;
    mergedCells[mergeKey] = {
        mergedCells: mergedCellIds,
        removedCells: removedCells.map(c => c.dateKey)
    };
    console.log('mergedCells gespeichert:', mergedCells, 'mergeKey:', mergeKey);
    await saveData('mergedCells', mergedCells);
    
    // Setze den Inhalt nur in der ersten Zelle
    if (mergedStatus) {
        if (!assignments[employee]) {
            assignments[employee] = {};
        }
        assignments[employee][firstDateKey] = {
            text: mergedText,
            status: mergedStatus
        };
    } else if (mergedText) {
        if (!assignments[employee]) {
            assignments[employee] = {};
        }
        assignments[employee][firstDateKey] = {
            text: mergedText
        };
    }
    
    if (mergedNote || mergedLink || mergedAddress) {
        cellNotes[firstNoteKey] = mergedNote;
        cellLinks[firstLinkKey] = mergedLink;
        cellAddresses[firstAddressKey] = mergedAddress;
    }
    
    // Aktualisiere die erste Zelle (aber behalte colspan)
    const savedColspan = firstCell.getAttribute('colspan');
    updateCell(firstCell, employee, firstDateKey);
    
    // Stelle sicher, dass colspan erhalten bleibt
    if (firstCell.hasAttribute('data-merged') && savedColspan) {
        firstCell.setAttribute('colspan', savedColspan);
    }
    
    await saveData('assignments', assignments);
    await saveData('cellNotes', cellNotes);
    await saveData('cellLinks', cellLinks);
    await saveData('cellAddresses', cellAddresses);
    
    clearSelection();
}

// Funktion zum Hinzufügen von Event-Listenern für Platzhalter-Zellen
function setupPlaceholderEventListeners(placeholder, employee, dateKey) {
    // Klick-Event für Platzhalter
    placeholder.addEventListener('click', (e) => {
        const mergedIntoDateKey = placeholder.getAttribute('data-merged-into');
        if (mergedIntoDateKey) {
            const row = placeholder.parentElement;
            const allCells = Array.from(row.children);
            const firstCell = allCells.find(c => {
                const cellDateKey = getDateKeyFromCell(c);
                return cellDateKey === mergedIntoDateKey && c.hasAttribute('data-merged');
            });
            if (firstCell) {
                unmergeCellIfNeeded(firstCell, employee, dateKey);
            }
        }
    });
    
    // Doppelklick-Event
    placeholder.addEventListener('dblclick', (e) => {
        e.preventDefault();
        const mergedIntoDateKey = placeholder.getAttribute('data-merged-into');
        if (mergedIntoDateKey) {
            const row = placeholder.parentElement;
            const allCells = Array.from(row.children);
            const firstCell = allCells.find(c => {
                const cellDateKey = getDateKeyFromCell(c);
                return cellDateKey === mergedIntoDateKey && c.hasAttribute('data-merged');
            });
            if (firstCell) {
                unmergeCellIfNeeded(firstCell, employee, dateKey);
                setTimeout(() => {
                    const foundCell = allCells.find(c => {
                        const cellDateKey = getDateKeyFromCell(c);
                        return cellDateKey === dateKey;
                    });
                    if (foundCell) {
                        showInfoField(foundCell, employee, dateKey);
                    }
                }, 100);
            }
        }
    });
    
    // Mousedown für Auswahl
    placeholder.addEventListener('mousedown', (e) => {
        e.preventDefault();
        if (!isSelecting) {
            clearSelection();
        }
        isSelecting = true;
        lastSelectedCell = placeholder;
        toggleCellSelection(placeholder);
    });
    
    // Mouseover für Drag-Auswahl
    placeholder.addEventListener('mouseover', (e) => {
        if (isSelecting && lastSelectedCell) {
            selectCellsBetween(lastSelectedCell, placeholder);
        }
    });
}

// Funktion zum Auflösen der Zusammenführung bei Bearbeitung
function unmergeCellIfNeeded(cell, employee, dateKey) {
    // Prüfe, ob diese Zelle Teil einer Zusammenführung ist
    if (cell.hasAttribute('data-merged-into')) {
        const mergedIntoDateKey = cell.getAttribute('data-merged-into');
        const row = cell.parentElement;
        const allCells = Array.from(row.children);
        const firstCell = allCells.find(c => {
            const cellDateKey = getDateKeyFromCell(c);
            return cellDateKey === mergedIntoDateKey && c.hasAttribute('data-merged');
        });
        
        if (firstCell) {
            const mergedCellsStr = firstCell.getAttribute('data-merged-cells');
            if (mergedCellsStr) {
                try {
                    const mergedCellIds = JSON.parse(mergedCellsStr);
                    const currentIndex = mergedCellIds.indexOf(dateKey);
                    
                    if (currentIndex > 0) {
                        // Reduziere die Zusammenführung: nur noch bis zur aktuellen Zelle
                        if (currentIndex > 1) {
                            const newMergedCells = mergedCellIds.slice(0, currentIndex);
                            firstCell.setAttribute('colspan', currentIndex);
                            firstCell.setAttribute('data-merged-cells', JSON.stringify(newMergedCells));
                            
                            // Mache die Platzhalter-Zellen ab currentIndex wieder sichtbar
                            const hiddenCellsStr = firstCell.getAttribute('data-merged-hidden-cells');
                            if (hiddenCellsStr) {
                                try {
                                    const hiddenCells = JSON.parse(hiddenCellsStr);
                                    const cellsToShow = hiddenCells.slice(currentIndex - 1);
                                    
                                    cellsToShow.forEach((dateKey) => {
                                        const placeholder = allCells.find(c => 
                                            c.getAttribute('data-merged-datekey') === dateKey && 
                                            c.hasAttribute('data-merged-placeholder')
                                        );
                                        if (placeholder) {
                                            placeholder.style.display = '';
                                            placeholder.removeAttribute('data-merged-placeholder');
                                            placeholder.removeAttribute('data-merged-into');
                                            placeholder.removeAttribute('data-merged-datekey');
                                        }
                                    });
                                    
                                    firstCell.setAttribute('data-merged-hidden-cells', JSON.stringify(hiddenCells.slice(0, currentIndex - 1)));
                                    
                                    const mergeKey = `${employee}-${mergedIntoDateKey}`;
                                    if (mergedCells[mergeKey]) {
                                        mergedCells[mergeKey].mergedCells = newMergedCells;
                                        mergedCells[mergeKey].removedCells = hiddenCells.slice(0, currentIndex - 1);
                                        saveData('mergedCells', mergedCells);
                                    }
                                } catch (e) {
                                    console.error('Fehler beim Wiederherstellen der Zellen:', e);
                                }
                            }
                            
                            const savedColspan = firstCell.getAttribute('colspan');
                            updateCell(firstCell, employee, mergedIntoDateKey);
                            if (savedColspan) {
                                firstCell.setAttribute('colspan', savedColspan);
                            }
                        } else {
                            // Nur noch eine Zelle, Zusammenführung komplett auflösen
                            firstCell.removeAttribute('colspan');
                            firstCell.removeAttribute('data-merged');
                            firstCell.removeAttribute('data-merged-cells');
                            
                            const mergeKey = `${employee}-${mergedIntoDateKey}`;
                            delete mergedCells[mergeKey];
                            saveData('mergedCells', mergedCells);
                            
                            // Mache alle Platzhalter-Zellen wieder sichtbar
                            const hiddenCellsStr = firstCell.getAttribute('data-merged-hidden-cells');
                            if (hiddenCellsStr) {
                                try {
                                    const hiddenCells = JSON.parse(hiddenCellsStr);
                                    
                                    hiddenCells.forEach((dateKey) => {
                                        const placeholder = allCells.find(c => 
                                            c.getAttribute('data-merged-datekey') === dateKey && 
                                            c.hasAttribute('data-merged-placeholder')
                                        );
                                        if (placeholder) {
                                            placeholder.style.display = '';
                                            placeholder.removeAttribute('data-merged-placeholder');
                                            placeholder.removeAttribute('data-merged-into');
                                            placeholder.removeAttribute('data-merged-datekey');
                                        }
                                    });
                                    
                                    firstCell.removeAttribute('data-merged-hidden-cells');
                                } catch (e) {
                                    console.error('Fehler beim Wiederherstellen der Zellen:', e);
                                }
                            }
                            
                            updateCell(firstCell, employee, mergedIntoDateKey);
                        }
                    }
                } catch (err) {
                    console.error('Fehler beim Auflösen der Zusammenführung:', err);
                }
            }
        }
    }
}

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

// Mobile Kontextmenü für Long-Press
function showMobileContextMenu(cell, employee, dateKey, touchEvent) {
    // Entferne vorhandenes Kontextmenü
    const existingMenu = document.getElementById('mobileContextMenu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    // Erstelle Kontextmenü
    const menu = document.createElement('div');
    menu.id = 'mobileContextMenu';
    menu.style.cssText = `
        position: fixed;
        left: ${touchEvent.clientX}px;
        top: ${touchEvent.clientY}px;
        background: white;
        border: 2px solid #333;
        border-radius: 5px;
        padding: 10px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;
    
    // Kopieren-Button
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Kopieren';
    copyBtn.style.cssText = 'display: block; width: 100%; padding: 10px; margin: 5px 0; background: #007bff; color: white; border: none; border-radius: 3px;';
    copyBtn.addEventListener('click', () => {
        const noteKey = `${employee}-${dateKey}`;
        const linkKey = `${employee}-${dateKey}-link`;
        const addressKey = `${employee}-${dateKey}-address`;
        const assignment = assignments[employee]?.[dateKey];
        
        let status = assignment?.status || null;
        if (!status) {
            const statusClass = Array.from(cell.classList).find(cls => cls.startsWith('status-'));
            if (statusClass) {
                status = statusClass.replace('status-', '');
            }
        }
        
        copiedContent = {
            text: cell.querySelector('.cell-text')?.textContent || '',
            status: status,
            note: cellNotes[noteKey] || '',
            link: cellLinks[linkKey] || '',
            address: cellAddresses[addressKey] || ''
        };
        menu.remove();
    });
    
    // Einfügen-Button
    const pasteBtn = document.createElement('button');
    pasteBtn.textContent = 'Einfügen';
    pasteBtn.style.cssText = 'display: block; width: 100%; padding: 10px; margin: 5px 0; background: #28a745; color: white; border: none; border-radius: 3px;';
    pasteBtn.disabled = !copiedContent;
    if (!copiedContent) {
        pasteBtn.style.opacity = '0.5';
    }
    pasteBtn.addEventListener('click', async () => {
        if (copiedContent) {
            await pasteContentToCell(cell, employee, dateKey);
        }
        menu.remove();
    });
    
    // Schließen-Button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Schließen';
    closeBtn.style.cssText = 'display: block; width: 100%; padding: 10px; margin: 5px 0; background: #6c757d; color: white; border: none; border-radius: 3px;';
    closeBtn.addEventListener('click', () => {
        menu.remove();
    });
    
    menu.appendChild(copyBtn);
    menu.appendChild(pasteBtn);
    
    // Prüfe, ob mehrere Zellen markiert sind oder ein zusammengeführtes Feld
    const hasMergedCell = selectedCells.size > 0 && Array.from(selectedCells).some(c => 
        c.hasAttribute('data-merged') || c.hasAttribute('data-merged-into')
    );
    const allMergedCells = selectedCells.size > 0 && Array.from(selectedCells).every(c => 
        c.hasAttribute('data-merged') || c.hasAttribute('data-merged-into')
    );
    
    // Zusammenführen-Button (wenn mehrere Zellen markiert sind ODER ein zusammengeführtes Feld + weitere Zellen)
    if (selectedCells.size > 1 || (hasMergedCell && !allMergedCells)) {
        const mergeBtn = document.createElement('button');
        mergeBtn.textContent = 'Zusammenführen';
        mergeBtn.style.cssText = 'display: block; width: 100%; padding: 10px; margin: 5px 0; background: #28a745; color: white; border: none; border-radius: 3px;';
        mergeBtn.addEventListener('click', async () => {
            await mergeSelectedCells();
            menu.remove();
        });
        menu.appendChild(mergeBtn);
    }
    
    // Aufteilen-Button (wenn nur zusammengeführte Felder markiert sind)
    if (allMergedCells && selectedCells.size > 0) {
        const unmergeBtn = document.createElement('button');
        unmergeBtn.textContent = 'Aufteilen';
        unmergeBtn.style.cssText = 'display: block; width: 100%; padding: 10px; margin: 5px 0; background: #dc3545; color: white; border: none; border-radius: 3px;';
        unmergeBtn.addEventListener('click', async () => {
            await unmergeSelectedCells();
            menu.remove();
        });
        menu.appendChild(unmergeBtn);
    }
    
    menu.appendChild(closeBtn);
    
    document.body.appendChild(menu);
    
    // Schließe beim Klick außerhalb
    setTimeout(() => {
        const closeOnClick = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeOnClick);
                document.removeEventListener('touchstart', closeOnClick);
            }
        };
        document.addEventListener('click', closeOnClick);
        document.addEventListener('touchstart', closeOnClick);
    }, 100);
}

// Funktion zum Einfügen von Inhalt in eine Zelle (für Mobile)
async function pasteContentToCell(cell, employee, dateKey) {
    if (!copiedContent) return;
    
    saveState();
    
    const noteKey = `${employee}-${dateKey}`;
    const linkKey = `${employee}-${dateKey}-link`;
    const addressKey = `${employee}-${dateKey}-address`;
    
    // Entferne colspan sofort
    cell.removeAttribute('colspan');
    cell.style.width = '';
    cell.style.position = '';
    cell.style.zIndex = '';
    
    // Setze Text und Status
    if (copiedContent.text || copiedContent.status) {
        if (!assignments[employee]) {
            assignments[employee] = {};
        }
        if (copiedContent.status) {
            assignments[employee][dateKey] = {
                text: copiedContent.text || '',
                status: copiedContent.status
            };
        } else {
            assignments[employee][dateKey] = {
                text: copiedContent.text || ''
            };
        }
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
    } else {
        delete cellNotes[noteKey];
        delete cellLinks[linkKey];
        delete cellAddresses[addressKey];
        cell.removeAttribute('data-info');
    }
    
    // Setze Hintergrundfarbe
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
        if (bgColor === '#e8f5e9' || bgColor === '#ffc107' || bgColor === '') {
            cell.style.color = 'black';
        } else {
            cell.style.color = 'white';
        }
    } else {
        cell.style.backgroundColor = '';
        cell.style.color = 'black';
    }
    
    updateCell(cell, employee, dateKey);
    
    await saveData('assignments', assignments);
    await saveData('cellNotes', cellNotes);
    await saveData('cellLinks', cellLinks);
    await saveData('cellAddresses', cellAddresses);
}

function startAutoRefresh() {
    if (autoRefreshInterval) return; // Bereits aktiv
    
    autoRefreshInterval = setInterval(async () => {
        if (!isUserEditing && window.firebaseDB) {
            try {
                const data = await window.firebaseDB.loadAllData();
                if (data) {
                    // Aktualisiere nur, wenn sich Daten geändert haben
                    const currentDataHash = JSON.stringify({
                        employees: employees,
                        assignments: assignments,
                        cellNotes: cellNotes
                    });
                    const newDataHash = JSON.stringify({
                        employees: data.employees,
                        assignments: data.assignments,
                        cellNotes: data.cellNotes
                    });
                    
                    if (currentDataHash !== newDataHash) {
                        employees = data.employees || employees;
                        assignments = data.assignments || assignments;
                        employeeStartDates = data.employeeStartDates || employeeStartDates;
                        employeeEndDates = data.employeeEndDates || employeeEndDates;
                        cellNotes = data.cellNotes || cellNotes;
                        cellLinks = data.cellLinks || cellLinks;
                        cellAddresses = data.cellAddresses || cellAddresses;
                        mergedCells = data.mergedCells || mergedCells;
                        
                        updateCalendar();
                    }
                }
            } catch (error) {
                console.error('Fehler beim Auto-Refresh:', error);
            }
        }
    }, 10000); // Alle 10 Sekunden
}

function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
} 