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
let firebaseDB = null; // Firebase Database Instanz

// Undo-Funktionalität
let undoStack = [];
const MAX_UNDO_STEPS = 10;

// Firebase Initialisierung
async function initializeFirebase() {
    try {
        // Verwende die globale Firebase-Instanz
        firebaseDB = window.firebaseDB;
        
        if (!firebaseDB) {
            throw new Error('Firebase nicht verfügbar');
        }
        
        // Lade alle Daten aus Firebase
        const data = await firebaseDB.loadAllData();
        employees = data.employees;
        assignments = data.assignments;
        employeeStartDates = data.employeeStartDates;
        employeeEndDates = data.employeeEndDates;
        cellNotes = data.cellNotes;
        cellLinks = data.cellLinks;
        cellAddresses = data.cellAddresses;
        
        console.log('Firebase erfolgreich initialisiert');
        return true;
    } catch (error) {
        console.error('Fehler bei Firebase-Initialisierung:', error);
        // Fallback zu localStorage wenn Firebase nicht verfügbar
        employees = JSON.parse(localStorage.getItem('employees')) || [];
        assignments = JSON.parse(localStorage.getItem('assignments')) || {};
        employeeStartDates = JSON.parse(localStorage.getItem('employeeStartDates')) || {};
        employeeEndDates = JSON.parse(localStorage.getItem('employeeEndDates')) || {};
        cellNotes = JSON.parse(localStorage.getItem('cellNotes')) || {};
        cellLinks = JSON.parse(localStorage.getItem('cellLinks')) || {};
        cellAddresses = JSON.parse(localStorage.getItem('cellAddresses')) || {};
        return false;
    }
}

// Speichere Daten in Firebase oder localStorage (Fallback)
async function saveData(key, data) {
    if (firebaseDB) {
        switch(key) {
            case 'employees':
                return await firebaseDB.saveEmployees(data);
            case 'assignments':
                return await firebaseDB.saveAssignments(data);
            case 'employeeStartDates':
                return await firebaseDB.saveEmployeeStartDates(data);
            case 'employeeEndDates':
                return await firebaseDB.saveEmployeeEndDates(data);
            case 'cellNotes':
                return await firebaseDB.saveCellNotes(data);
            case 'cellLinks':
                return await firebaseDB.saveCellLinks(data);
            case 'cellAddresses':
                return await firebaseDB.saveCellAddresses(data);
        }
    } else {
        // Fallback zu localStorage
        localStorage.setItem(key, JSON.stringify(data));
        return true;
    }
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
document.getElementById('logoutButton').addEventListener('click', function() {
    // Lösche die Benutzerinformationen aus dem localStorage
    localStorage.removeItem('currentUser');
    // Leite zur Login-Seite weiter
    window.location.href = 'login.html';
});

// DOM-Elemente
const yearGrid = document.getElementById('yearGrid');
const monthGrid = document.getElementById('monthGrid');
const calendarBody = document.getElementById('calendarBody');
const headerRow = document.getElementById('headerRow');
const employeeModal = document.getElementById('employeeModal');
const employeeNameInput = document.getElementById('employeeName');
const deleteEmployeeModal = document.getElementById('deleteEmployeeModal');
const employeeToDeleteSpan = document.getElementById('employeeToDelete');
const infoField = document.getElementById('infoField');
const infoText = document.getElementById('infoText');
const zoomOutButton = document.getElementById('zoomOut');
let currentEditingCell = null;

// Event Listener für das Modal
document.getElementById('addEmployee').addEventListener('click', () => {
    employeeModal.style.display = 'block';
    employeeNameInput.value = '';
    employeeNameInput.focus();
    // Verhindere, dass der Klick-Event weiter propagiert wird
    event.stopPropagation();
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

// Füge den Button neben dem "Mitarbeiter hinzufügen" Button ein
const addEmployeeButton = document.getElementById('addEmployee');
addEmployeeButton.parentNode.insertBefore(toggleViewButton, addEmployeeButton.nextSibling);

// Event Listener für Speichern
document.getElementById('saveEmployee').addEventListener('click', () => {
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
        
        updateCalendar();
        employeeModal.style.display = 'none';
    } else {
        alert('Bitte geben Sie einen gültigen Namen ein.');
        employeeNameInput.focus();
    }
});

// Event Listener für Abbrechen
document.getElementById('cancelEmployee').addEventListener('click', () => {
    employeeModal.style.display = 'none';
    employeeNameInput.value = '';
});

// Event Listener für Enter-Taste im Modal
employeeNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('saveEmployee').click();
    }
});

// Event Listener für Klick außerhalb des Modals
employeeModal.addEventListener('click', (e) => {
    if (e.target === employeeModal) {
        employeeModal.style.display = 'none';
        employeeNameInput.value = '';
    }
});

// Event Listener für Escape-Taste
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && employeeModal.style.display === 'block') {
        employeeModal.style.display = 'none';
        employeeNameInput.value = '';
    }
});

// Automatisches Speichern der Notizen
infoText.addEventListener('input', () => {
    if (currentEditingCell) {
        saveCellNote();
    }
});

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
    button.addEventListener('click', () => {
        const status = button.dataset.status;
        applyStatusToSelectedCells(status);
    });
});

// Event Listener für Tastaturkürzel
document.addEventListener('keydown', (e) => {
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
            const dayIndex = Array.from(row.children).indexOf(cell);
            const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${dayIndex}`;
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
            if (new Date(currentDate.getFullYear(), currentDate.getMonth(), dayIndex).getDay() === 0 || 
                new Date(currentDate.getFullYear(), currentDate.getMonth(), dayIndex).getDay() === 6) {
                cell.classList.add('weekend-cell');
            }
        });
        
        localStorage.setItem('cellNotes', JSON.stringify(cellNotes));
        localStorage.setItem('cellLinks', JSON.stringify(cellLinks));
        saveData('assignments', assignments);
    }
    
    // Strg+C
    if (e.ctrlKey && e.key === 'c' && selectedCells.size > 0) {
        const firstCell = Array.from(selectedCells)[0];
        const row = firstCell.parentElement;
        const employee = row.querySelector('td:first-child span').textContent;
        const dayIndex = Array.from(row.children).indexOf(firstCell);
        const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${dayIndex}`;
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
            const dayIndex = Array.from(row.children).indexOf(cell);
            const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${dayIndex}`;
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
            if (new Date(currentDate.getFullYear(), currentDate.getMonth(), dayIndex).getDay() === 0 || 
                new Date(currentDate.getFullYear(), currentDate.getMonth(), dayIndex).getDay() === 6) {
                cell.classList.add('weekend-cell');
            }
        });
        
        saveData('cellNotes', cellNotes);
        saveData('cellLinks', cellLinks);
        saveData('cellAddresses', cellAddresses);
        saveData('assignments', assignments);
    }
});

// Initialisierung
async function initializeApp() {
    await initializeFirebase();
    initializeYearGrid();
    initializeMonthGrid();
    updateCalendar();
}

// Starte die App
initializeApp();

function initializeYearGrid() {
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
    
    console.log('Update Calendar:', { year, month, isWeekView });
    
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
        const startDate = new Date(employeeStartDates[employee] || '2000-01-01');
        const endDate = employeeEndDates[employee] ? new Date(employeeEndDates[employee]) : new Date('2100-12-31');
        const currentMonthDate = new Date(currentDate);
        
        if (isDateInRange(currentMonthDate, startDate, endDate)) {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            
            const nameContainer = document.createElement('div');
            nameContainer.className = 'name-container';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = employee;
            nameContainer.appendChild(nameSpan);
            
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
    
    // Erstelle neue Tabelle
    const calendarContainer = document.querySelector('.calendar-container');
    calendarContainer.innerHTML = '';
    
    const calendar = document.createElement('table');
    calendar.className = 'calendar';
    
    // Erstelle Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Mitarbeiter</th>';
    
    // Füge Tage zum Header hinzu
    const daysInMonth = new Date(year, month + 1, 0).getDate();
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
    
    // Füge Mitarbeiter-Zeilen hinzu
    employees.forEach(employee => {
        const startDate = new Date(employeeStartDates[employee] || '2000-01-01');
        const endDate = employeeEndDates[employee] ? new Date(employeeEndDates[employee]) : new Date('2100-12-31');
        const currentMonthDate = new Date(year, month, 1);
        
        if (isDateInRange(currentMonthDate, startDate, endDate)) {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            
            const nameContainer = document.createElement('div');
            nameContainer.className = 'name-container';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = employee;
            nameContainer.appendChild(nameSpan);
            
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
                
                cell.addEventListener('dblclick', (e) => {
                    showInfoField(cell, employee, dateKey);
                });
                
                row.appendChild(cell);
            }
            
            tbody.appendChild(row);
        }
    });
    
    calendar.appendChild(tbody);
    calendarContainer.appendChild(calendar);
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
            
            cell.addEventListener('dblclick', (e) => {
                showInfoField(cell, employee, dateKey);
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

function applyStatusToSelectedCells(status) {
    if (selectedCells.size === 0) return;
    
    saveState(); // Speichere den aktuellen Zustand vor der Änderung
    
    const statusText = {
        'urlaub': 'Urlaub',
        'krank': 'Krankheit',
        'unbezahlt': 'Unbezahlter Urlaub',
        'schulung': 'Schule',
        'feiertag': 'Feiertag',
        'kurzarbeit': 'Kurzarbeit',
        'abgerechnet': 'Abgerechnet'
    }[status];

    const statusColors = {
        'urlaub': '#28a745',
        'krank': '#dc3545',
        'unbezahlt': '#ffc107',
        'schulung': '#6f42c1',
        'feiertag': '#17a2b8',
        'kurzarbeit': '#795548',
        'abgerechnet': '#e8f5e9'
    };

    selectedCells.forEach(cell => {
        const row = cell.parentElement;
        const employee = row.querySelector('td:first-child span').textContent;
        const dayIndex = Array.from(row.children).indexOf(cell);
        const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${dayIndex}`;
        
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
        } else {
            // Setze den neuen Status
            assignments[employee][dateKey] = {
                text: statusText,
                status: status
            };
            
            cell.textContent = statusText;
            cell.style.backgroundColor = statusColors[status];
            cell.style.color = 'black';
        }
        
        if (new Date(currentDate.getFullYear(), currentDate.getMonth(), dayIndex).getDay() === 0 || 
            new Date(currentDate.getFullYear(), currentDate.getMonth(), dayIndex).getDay() === 6) {
            cell.classList.add('weekend-cell');
        }
    });
    
    saveData('assignments', assignments);
    clearSelection();
}

function showInfoField(cell, employee, dateKey) {
    // Speichere vorherige Notiz, wenn vorhanden
    if (currentEditingCell) {
        saveCellNote();
    }
    
    currentEditingCell = cell;
    const noteKey = `${employee}-${dateKey}`;
    const linkKey = `${employee}-${dateKey}-link`;
    const addressKey = `${employee}-${dateKey}-address`;
    
    // Erstelle das Info-Feld mit Link-Eingabe und Button
    infoField.innerHTML = `
        <h3>Notizen</h3>
        <textarea id="infoText" placeholder="Notizen eingeben...">${cellNotes[noteKey] || ''}</textarea>
        <div class="link-input">
            <input type="text" id="linkInput" placeholder="Link eingeben..." value="${cellLinks[linkKey] || ''}">
            <button id="openLinkFolder" class="open-folder-btn">Ordner öffnen</button>
        </div>
        <div class="address-input">
            <input type="text" id="addressInput" placeholder="Adresse eingeben..." value="${cellAddresses[addressKey] || ''}">
            <button id="openMaps" class="maps-btn">Adresse in Maps öffnen</button>
        </div>
    `;
    
    // Event Listener für die Eingabefelder
    document.getElementById('infoText').addEventListener('input', () => {
        if (currentEditingCell) {
            saveCellNote();
        }
    });
    
    document.getElementById('linkInput').addEventListener('input', () => {
        if (currentEditingCell) {
            saveCellNote();
        }
    });

    document.getElementById('addressInput').addEventListener('input', () => {
        if (currentEditingCell) {
            saveCellNote();
        }
    });

    // Event Listener für den Ordner öffnen Button
    document.getElementById('openLinkFolder').addEventListener('click', () => {
        const linkPath = document.getElementById('linkInput').value.trim();
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
    });

    // Event Listener für den Maps Button
    document.getElementById('openMaps').addEventListener('click', () => {
        const address = document.getElementById('addressInput').value.trim();
        if (address) {
            const encodedAddress = encodeURIComponent(address);
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
            window.open(mapsUrl, '_blank');
        } else {
            alert('Bitte geben Sie eine gültige Adresse ein.');
        }
    });
    
    document.getElementById('infoText').focus();
}

function saveCellNote() {
    if (!currentEditingCell) return;
    
    const row = currentEditingCell.parentElement;
    const employee = row.querySelector('td:first-child span').textContent;
    const dayIndex = Array.from(row.children).indexOf(currentEditingCell);
    const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${dayIndex}`;
    const noteKey = `${employee}-${dateKey}`;
    const linkKey = `${employee}-${dateKey}-link`;
    const addressKey = `${employee}-${dateKey}-address`;
    
    // Speichere Notiz, Link und Adresse
    cellNotes[noteKey] = document.getElementById('infoText').value.trim();
    cellLinks[linkKey] = document.getElementById('linkInput').value.trim();
    cellAddresses[addressKey] = document.getElementById('addressInput').value.trim();
    
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
    
    localStorage.setItem('cellNotes', JSON.stringify(cellNotes));
    localStorage.setItem('cellLinks', JSON.stringify(cellLinks));
    localStorage.setItem('cellAddresses', JSON.stringify(cellAddresses));
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
    localStorage.setItem('employeeEndDates', JSON.stringify(employeeEndDates));
    hideDeleteEmployeeModal();
    updateCalendar();
}

// Event Listener für das Lösch-Modal
document.getElementById('confirmDelete').addEventListener('click', confirmDeleteEmployee);
document.getElementById('cancelDelete').addEventListener('click', hideDeleteEmployeeModal);

// Event Listener für Klick außerhalb des Lösch-Modals
deleteEmployeeModal.addEventListener('click', (e) => {
    if (e.target === deleteEmployeeModal) {
        hideDeleteEmployeeModal();
    }
});

// Event Listener für Escape-Taste im Lösch-Modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && deleteEmployeeModal.style.display === 'block') {
        hideDeleteEmployeeModal();
    }
});

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
    const data = {
        employees: employees,
        assignments: assignments,
        employeeStartDates: employeeStartDates,
        employeeEndDates: employeeEndDates,
        cellNotes: cellNotes,
        cellLinks: cellLinks,
        cellAddresses: cellAddresses
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

// Funktion zum Importieren der Daten
function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
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

            // Speichere die Daten in Firebase
            employees = data.employees;
            assignments = data.assignments;
            employeeStartDates = data.employeeStartDates;
            employeeEndDates = data.employeeEndDates;
            cellNotes = data.cellNotes;
            cellLinks = data.cellLinks;
            cellAddresses = data.cellAddresses;
            
            // Speichere in Firebase
            saveData('employees', employees);
            saveData('assignments', assignments);
            saveData('employeeStartDates', employeeStartDates);
            saveData('employeeEndDates', employeeEndDates);
            saveData('cellNotes', cellNotes);
            saveData('cellLinks', cellLinks);
            saveData('cellAddresses', cellAddresses);

            // Aktualisiere die globalen Variablen (bereits oben gesetzt)
            
            // Aktualisiere die Anzeige
            updateCalendar();
            alert('Daten wurden erfolgreich importiert!');
        } catch (error) {
            console.error('Fehler beim Importieren:', error);
            alert('Fehler beim Importieren der Daten: ' + error.message);
        }
    };
    reader.onerror = function() {
        alert('Fehler beim Lesen der Datei. Bitte versuchen Sie es erneut.');
    };
    reader.readAsText(file);
}

// Event Listener für Import
document.getElementById('importDataBtn').addEventListener('click', () => {
    document.getElementById('importData').click();
});

document.getElementById('importData').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        importData(e.target.files[0]);
    }
});

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
            'abgerechnet': '#e8f5e9'
        };

        // Setze die Hintergrundfarbe
        cell.style.backgroundColor = statusColors[assignment.status];
        
        // Setze die Textfarbe immer auf schwarz
        cell.style.color = 'black';
        
        // Setze den Text nur, wenn es kein "Abgerechnet" Status ist und keine Notiz vorhanden ist
        if (assignment.status !== 'abgerechnet' && !cellNotes[noteKey]) {
            const cellText = cell.querySelector('.cell-text');
            if (cellText) {
                cellText.textContent = assignment.text;
            } else {
                cell.textContent = assignment.text;
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
        const startDate = new Date(employeeStartDates[employee] || '2000-01-01');
        const endDate = employeeEndDates[employee] ? new Date(employeeEndDates[employee]) : new Date('2100-12-31');
        const currentMonthDate = new Date(currentDate);
        
        if (isDateInRange(currentMonthDate, startDate, endDate)) {
            const row = document.createElement('tr');
            const nameCell = document.createElement('td');
            
            const nameContainer = document.createElement('div');
            nameContainer.className = 'name-container';
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = employee;
            nameContainer.appendChild(nameSpan);
            
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

// Füge den neuen Abgerechnet-Button hinzu
const statusButtons = document.querySelector('.status-buttons');
const abgerechnetButton = document.createElement('button');
abgerechnetButton.className = 'status-button';
abgerechnetButton.dataset.status = 'abgerechnet';
abgerechnetButton.textContent = 'Abgerechnet';
abgerechnetButton.style.backgroundColor = '#e8f5e9';
abgerechnetButton.style.color = 'black';
statusButtons.appendChild(abgerechnetButton);

// Event Listener für den neuen Button
abgerechnetButton.addEventListener('click', () => {
    applyStatusToSelectedCells('abgerechnet');
});

// Event Listener für den "Auswahl löschen" Button
document.getElementById('clearSelection').addEventListener('click', () => {
    if (selectedCells.size > 0) {
        saveState(); // Speichere den aktuellen Zustand vor dem Löschen
        
        selectedCells.forEach(cell => {
            const row = cell.parentElement;
            const employee = row.querySelector('td:first-child span').textContent;
            const dayIndex = Array.from(row.children).indexOf(cell);
            const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${dayIndex}`;
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
            
            if (new Date(currentDate.getFullYear(), currentDate.getMonth(), dayIndex).getDay() === 0 || 
                new Date(currentDate.getFullYear(), currentDate.getMonth(), dayIndex).getDay() === 6) {
                cell.classList.add('weekend-cell');
            }
        });
        
        // Speichere die Änderungen im localStorage
        saveData('assignments', assignments);
        saveData('cellNotes', cellNotes);
        saveData('cellLinks', cellLinks);
        saveData('cellAddresses', cellAddresses);
        
        // Lösche die Auswahl
        clearSelection();
    }
}); 