// Firebase wird bereits in firebase-simple.js initialisiert
// Verwende die globale Firebase-Instanz direkt

// Funktion zum erneuten Senden der Verifizierungs-E-Mail
async function resendVerificationEmail(email, password, button) {
    const verificationSuccess = document.getElementById('verificationSuccess');
    const errorMessage = document.getElementById('errorMessage');
    
    // Deaktiviere Button während des Sendens
    if (button) {
        button.disabled = true;
        button.textContent = 'Wird gesendet...';
    }
    
    try {
        // Melde den Benutzer erneut an (da wir vorher signOut aufgerufen haben)
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Sende Verifizierungs-E-Mail
        await user.sendEmailVerification();
        
        // Zeige Erfolgsmeldung
        if (verificationSuccess) {
            verificationSuccess.textContent = 'Eine Verifizierungs-E-Mail wurde an ' + email + ' gesendet. Bitte prüfen Sie Ihr Postfach.';
            verificationSuccess.style.display = 'block';
        }
        
        // Logge den Benutzer wieder aus (damit er sich nach Verifizierung erneut einloggen muss)
        await firebase.auth().signOut();
        
        // Aktiviere Button wieder
        if (button) {
            button.disabled = false;
            button.textContent = 'Verifizierungs-E-Mail erneut senden';
        }
        
        console.log('Verifizierungs-E-Mail erfolgreich gesendet an:', email);
        
    } catch (error) {
        console.error('Fehler beim Senden der Verifizierungs-E-Mail:', error);
        
        // Zeige Fehlermeldung
        let errorText = 'Fehler beim Senden der Verifizierungs-E-Mail.';
        if (error.code === 'auth/too-many-requests') {
            errorText = 'Zu viele Anfragen. Bitte warten Sie einige Minuten, bevor Sie es erneut versuchen.';
        } else if (error.code === 'auth/user-not-found') {
            errorText = 'Benutzer nicht gefunden.';
        } else {
            errorText = 'Fehler: ' + (error.message || 'Unbekannter Fehler');
        }
        
        if (errorMessage) {
            errorMessage.textContent = errorText;
            errorMessage.style.display = 'block';
        }
        
        // Aktiviere Button wieder
        if (button) {
            button.disabled = false;
            button.textContent = 'Verifizierungs-E-Mail erneut senden';
        }
    }
}

// Event Listener für das Login-Formular
// Warte, bis das DOM vollständig geladen ist
(function() {
    function initLogin() {
        // Warte zusätzlich kurz, um sicherzustellen, dass alle Scripts geladen sind
        setTimeout(function() {
            setupLoginForm();
        }, 100);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLogin);
    } else {
        // DOM ist bereits geladen
        initLogin();
    }
})();

function setupLoginForm() {
    // Prüfe mehrfach, ob das Formular existiert (für langsame Verbindungen)
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) {
        console.error('Login-Formular nicht gefunden, versuche es erneut...');
        // Versuche es nach kurzer Verzögerung erneut
        setTimeout(function() {
            setupLoginForm();
        }, 200);
        return;
    }
    
    // Prüfe, ob Event Listener bereits hinzugefügt wurde
    if (loginForm.hasAttribute('data-listener-added')) {
        return; // Bereits initialisiert
    }
    loginForm.setAttribute('data-listener-added', 'true');
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const errorMessage = document.getElementById('errorMessage');
        const loginButton = document.getElementById('loginButton') || document.querySelector('button[type="submit"]');
        
        // Prüfe, ob alle Elemente existieren
        if (!emailInput || !passwordInput) {
            console.error('E-Mail- oder Passwort-Feld nicht gefunden');
            if (errorMessage) {
                errorMessage.textContent = 'Fehler: Formularfelder nicht gefunden. Bitte laden Sie die Seite neu.';
                errorMessage.style.display = 'block';
            }
            return;
        }
        
        const email = emailInput.value;
        const password = passwordInput.value;
    
    // Zeige Ladeanzeige
    if (loginButton) {
        loginButton.disabled = true;
        loginButton.textContent = 'Lädt...';
    }
    
    // Prüfe, ob Firebase Auth verfügbar ist
    if (typeof firebase === 'undefined' || !firebase.auth) {
        errorMessage.textContent = 'Firebase Auth nicht verfügbar';
        errorMessage.style.display = 'block';
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Anmelden';
        }
        return;
    }
    
    try {
        // Verwende Firebase Auth mit E-Mail und Passwort
        console.log('Versuche Login mit E-Mail:', email);
        
        // Sign in mit E-Mail und Passwort (Firebase v8 Syntax)
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        
        // Erfolgreich eingeloggt
        const user = userCredential.user;
        console.log('Erfolgreich eingeloggt als:', user.email);
        
        // Prüfe, ob die E-Mail verifiziert ist
        if (!user.emailVerified) {
            // Zeige Verifizierungs-Container mit Button zum erneuten Senden
            const verificationContainer = document.getElementById('verificationContainer');
            const resendButton = document.getElementById('resendVerificationButton');
            const verificationSuccess = document.getElementById('verificationSuccess');
            
            // Verstecke Erfolgsmeldung falls vorhanden
            if (verificationSuccess) {
                verificationSuccess.style.display = 'none';
            }
            
            errorMessage.textContent = 'Bitte verifizieren Sie zuerst Ihre E-Mail-Adresse. Prüfen Sie Ihr Postfach.';
            errorMessage.style.display = 'block';
            
            if (verificationContainer && resendButton) {
                verificationContainer.style.display = 'block';
                
                // Event Listener für Button zum erneuten Senden
                // Entferne alte Event Listener falls vorhanden
                const newResendButton = resendButton.cloneNode(true);
                resendButton.parentNode.replaceChild(newResendButton, resendButton);
                
                newResendButton.addEventListener('click', async function() {
                    await resendVerificationEmail(email, password, newResendButton);
                });
            }
            
            // Melde den Benutzer aus (damit er sich nach Verifizierung erneut einloggen muss)
            await firebase.auth().signOut();
            
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Anmelden';
            }
            return;
        }
        
        // Prüfe, ob die E-Mail-Domain korrekt ist
        if (!user.email || !user.email.endsWith('@knoebel-fliesen.de')) {
            await firebase.auth().signOut();
            errorMessage.textContent = 'Nur E-Mail-Adressen von @knoebel-fliesen.de sind erlaubt.';
            errorMessage.style.display = 'block';
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = 'Anmelden';
            }
            return;
        }
        
        // Speichere die Benutzerinformationen im localStorage
        localStorage.setItem('currentUser', JSON.stringify({
            email: user.email,
            uid: user.uid,
            emailVerified: user.emailVerified
        }));
        
        // Warte kurz, damit localStorage gespeichert wird
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Leite zur Hauptseite weiter
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Fehler beim Login:', error);
        
        // Verstecke Verifizierungs-Container falls sichtbar
        const verificationContainer = document.getElementById('verificationContainer');
        if (verificationContainer) {
            verificationContainer.style.display = 'none';
        }
        
        // Zeige benutzerfreundliche Fehlermeldungen
        let errorText = 'Login fehlgeschlagen';
        
        // Prüfe auf INVALID_LOGIN_CREDENTIALS (kann in verschiedenen Fehlercodes auftreten)
        const errorMessageStr = error.message || '';
        const isInvalidCredentials = error.code === 'auth/user-not-found' || 
                                     error.code === 'auth/wrong-password' ||
                                     error.code === 'auth/invalid-credential' ||
                                     error.code === 'auth/internal-error' && 
                                     (errorMessageStr.includes('INVALID_LOGIN_CREDENTIALS') || 
                                      errorMessageStr.includes('INVALID_CREDENTIAL'));
        
        if (isInvalidCredentials) {
            errorText = 'Ungültige E-Mail-Adresse oder Passwort. Bitte überprüfen Sie Ihre Anmeldedaten.';
        } else if (error.code === 'auth/user-not-found') {
            errorText = 'Kein Benutzer mit dieser E-Mail-Adresse gefunden.';
        } else if (error.code === 'auth/wrong-password') {
            errorText = 'Falsches Passwort.';
        } else if (error.code === 'auth/invalid-email') {
            errorText = 'Ungültige E-Mail-Adresse.';
        } else if (error.code === 'auth/user-disabled') {
            errorText = 'Dieser Benutzer wurde deaktiviert.';
        } else if (error.code === 'auth/too-many-requests') {
            errorText = 'Zu viele fehlgeschlagene Versuche. Bitte warten Sie einige Minuten, bevor Sie es erneut versuchen.';
        } else if (error.code === 'auth/network-request-failed') {
            errorText = 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
        } else if (error.code === 'auth/invalid-credential') {
            errorText = 'Ungültige Anmeldedaten. Bitte überprüfen Sie E-Mail und Passwort.';
        } else {
            // Versuche, eine sinnvolle Fehlermeldung aus der Error-Message zu extrahieren
            if (errorMessageStr.includes('INVALID_LOGIN_CREDENTIALS') || 
                errorMessageStr.includes('INVALID_CREDENTIAL')) {
                errorText = 'Ungültige E-Mail-Adresse oder Passwort. Bitte überprüfen Sie Ihre Anmeldedaten.';
            } else {
                errorText = 'Login fehlgeschlagen: ' + (error.message || 'Unbekannter Fehler');
            }
        }
        
        errorMessage.textContent = errorText;
        errorMessage.style.display = 'block';
        
        if (loginButton) {
            loginButton.disabled = false;
            loginButton.textContent = 'Anmelden';
        }
    }
}); 