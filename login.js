// Standardbenutzer (in einer echten Anwendung sollten diese in einer sicheren Datenbank gespeichert werden)
const users = [
    {
        username: 'admin',
        password: 'admin123',
        role: 'admin'
    },
    {
        username: 'user',
        password: 'user123',
        role: 'user'
    }
];

// Event Listener für das Login-Formular
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    
    // Überprüfe die Anmeldedaten
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Speichere die Benutzerinformationen im localStorage
        localStorage.setItem('currentUser', JSON.stringify({
            username: user.username,
            role: user.role
        }));
        
        // Leite zur Hauptseite weiter
        window.location.href = 'index.html';
    } else {
        // Zeige Fehlermeldung
        errorMessage.textContent = 'Ungültiger Benutzername oder Passwort';
        errorMessage.style.display = 'block';
    }
}); 