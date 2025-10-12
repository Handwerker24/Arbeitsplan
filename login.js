// Firebase Konfiguration
const firebaseConfig = {
    apiKey: "AIzaSyBhxf0A_Ks-QNWyn9BC_aFIpa-FNiRnL3E",
    authDomain: "arbeitsplan-f8b81.firebaseapp.com",
    databaseURL: "https://arbeitsplan-f8b81-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "arbeitsplan-f8b81",
    storageBucket: "arbeitsplan-f8b81.firebasestorage.app",
    messagingSenderId: "245771353059",
    appId: "1:245771353059:web:e8b61cac54ff600c5dbed6"
};

// Initialisiere Firebase
const app = firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Lade alle Benutzer aus Firebase
async function loadUsers() {
    try {
        const snapshot = await database.ref('users').once('value');
        if (snapshot.exists()) {
            const usersData = snapshot.val();
            // Konvertiere das Objekt in ein Array
            return Object.values(usersData);
        } else {
            console.log('Keine Benutzer in der Datenbank gefunden');
            return [];
        }
    } catch (error) {
        console.error('Fehler beim Laden der Benutzer:', error);
        return [];
    }
}

// Event Listener für das Login-Formular
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const submitButton = document.getElementById('loginButton');
    
    // Zeige Ladeindikator
    submitButton.disabled = true;
    submitButton.textContent = 'Anmelden...';
    errorMessage.style.display = 'none';
    
    try {
        // Lade Benutzer aus Firebase
        const users = await loadUsers();
        
        // Überprüfe die Anmeldedaten
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            // Speichere die Benutzerinformationen im localStorage
            localStorage.setItem('currentUser', JSON.stringify({
                username: user.username,
                role: user.role,
                name: user.name
            }));
            
            // Leite zur Hauptseite weiter
            window.location.href = 'index.html';
        } else {
            // Zeige Fehlermeldung
            errorMessage.textContent = 'Ungültiger Benutzername oder Passwort';
            errorMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Fehler beim Anmelden:', error);
        errorMessage.textContent = 'Fehler beim Anmelden. Bitte versuchen Sie es erneut.';
        errorMessage.style.display = 'block';
    } finally {
        // Reaktiviere den Button
        submitButton.disabled = false;
        submitButton.textContent = 'Anmelden';
    }
}); 