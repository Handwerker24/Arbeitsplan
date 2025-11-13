// Firebase wird bereits in firebase-simple.js initialisiert
// Verwende die globale Firebase-Instanz direkt

// Stelle sicher, dass der Benutzer authentifiziert ist (für Security Rules)
async function ensureAuthenticated() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase Auth nicht verfügbar');
        return false;
    }
    
    try {
        // Prüfe, ob bereits authentifiziert
        const currentUser = firebase.auth().currentUser;
        if (currentUser) {
            console.log('Bereits authentifiziert');
            return true;
        }
        
        // Versuche anonyme Authentifizierung
        console.log('Versuche anonyme Authentifizierung...');
        try {
            await firebase.auth().signInAnonymously();
            console.log('Anonyme Authentifizierung erfolgreich');
            return true;
        } catch (authError) {
            // Wenn anonyme Auth nicht aktiviert ist, zeige Fehlermeldung
            if (authError.code === 'auth/operation-not-allowed' || authError.code === 'auth/internal-error') {
                console.error('FEHLER: Anonyme Authentifizierung ist nicht aktiviert!');
                console.error('Bitte aktivieren Sie die anonyme Authentifizierung in Firebase:');
                console.error('1. Öffnen Sie: https://console.firebase.google.com/');
                console.error('2. Wählen Sie Projekt: arbeitsplan-f8b81');
                console.error('3. Gehen Sie zu: Authentication → Sign-in method');
                console.error('4. Aktivieren Sie "Anonymous"');
                console.error('5. Klicken Sie auf "Save"');
                alert('Anonyme Authentifizierung ist nicht aktiviert!\n\nBitte aktivieren Sie sie in der Firebase Console:\nAuthentication → Sign-in method → Anonymous aktivieren');
            }
            throw authError;
        }
    } catch (error) {
        console.error('Fehler bei Authentifizierung:', error);
        return false;
    }
}

// Lade Benutzer aus Firebase Realtime Database
async function loadUsers() {
    if (typeof firebase === 'undefined' || !firebase.database) {
        console.error('Firebase nicht verfügbar');
        return {};
    }
    
    // Versuche zuerst mit Authentifizierung
    let isAuthenticated = await ensureAuthenticated();
    
    // Wenn anonyme Auth fehlschlägt, versuche trotzdem zu laden
    // (falls /users öffentlich lesbar ist oder Auth bereits aktiv ist)
    try {
        const db = firebase.database();
        const snapshot = await db.ref('users').once('value');
        const users = snapshot.val();
        return users || {};
    } catch (error) {
        console.error('Fehler beim Laden der Benutzer:', error);
        
        // Wenn Permission-Fehler und Auth fehlgeschlagen, zeige Hinweis
        if (error.code === 'PERMISSION_DENIED' && !isAuthenticated) {
            console.error('Hinweis: Anonyme Authentifizierung muss in Firebase aktiviert sein!');
            console.error('Gehen Sie zu: Firebase Console → Authentication → Sign-in method → Anonymous aktivieren');
        }
        
        return {};
    }
}

// Event Listener für das Login-Formular
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const loginButton = document.getElementById('loginButton') || document.querySelector('button[type="submit"]');
    
    // Zeige Ladeanzeige
    if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = 'Lädt...';
    }
    
    if (typeof firebase === 'undefined' || !firebase.database) {
        errorMessage.textContent = 'Firebase nicht verfügbar';
        errorMessage.style.display = 'block';
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Anmelden';
        }
        return;
    }
    
    try {
        // Lade Benutzer aus Firebase Realtime Database
        console.log('Lade Benutzer aus Firebase...');
        const users = await loadUsers();
        console.log('Geladene Benutzer:', users);
        console.log('Anzahl Benutzer:', Object.keys(users).length);
        
        // Suche nach Benutzer mit passendem Username
        let foundUser = null;
        for (const userId in users) {
            const user = users[userId];
            console.log('Prüfe Benutzer:', user.username, 'vs', username);
            if (user.username === username) {
                foundUser = { ...user, id: userId };
                console.log('Benutzer gefunden:', foundUser);
                break;
            }
        }
        
        if (!foundUser) {
            console.log('Benutzer nicht gefunden für Username:', username);
            errorMessage.textContent = 'Ungültiger Benutzername oder Passwort';
            errorMessage.style.display = 'block';
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Anmelden';
            }
            return;
        }
        
        // Überprüfe die Anmeldedaten
        console.log('Prüfe Passwort...', foundUser.password, 'vs', password);
        if (foundUser.password === password) {
            console.log('Erfolgreich eingeloggt:', foundUser.username);
            
            // Speichere die Benutzerinformationen im localStorage
            localStorage.setItem('currentUser', JSON.stringify({
                username: foundUser.username,
                name: foundUser.name,
                role: foundUser.role || 'user',
                id: foundUser.id,
                createdAt: foundUser.createdAt
            }));
            
            // Versuche anonyme Authentifizierung für Security Rules
            try {
                if (firebase.auth) {
                    await firebase.auth().signInAnonymously();
                    console.log('Anonyme Authentifizierung erfolgreich');
                }
            } catch (authError) {
                console.warn('Anonyme Authentifizierung fehlgeschlagen:', authError);
                // Weiterleiten trotzdem, da localStorage-Benutzer gespeichert wurde
            }
            
            // Warte kurz, damit localStorage gespeichert wird
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Leite zur Hauptseite weiter
            window.location.href = 'index.html';
        } else {
            // Zeige Fehlermeldung
            errorMessage.textContent = 'Ungültiger Benutzername oder Passwort';
            errorMessage.style.display = 'block';
            
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Anmelden';
            }
        }
    } catch (error) {
        console.error('Fehler beim Login:', error);
        errorMessage.textContent = 'Fehler beim Verbinden mit dem Server: ' + error.message;
        errorMessage.style.display = 'block';
        
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Anmelden';
        }
    }
}); 