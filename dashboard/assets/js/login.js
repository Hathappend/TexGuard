const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://api.texguard.site'; 

// Cek apakah sudah login
if (localStorage.getItem('admin_token')) {
    window.location.href = 'index.html';
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const btn = document.getElementById('submit-btn');
    const errorBox = document.getElementById('error-box');
    
    btn.disabled = true;
    btn.innerHTML = 'Memverifikasi...';
    errorBox.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: password })
        });

        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('admin_token', data.access_token);
            window.location.href = 'index.html';
        } else {
            const errData = await response.json();
            throw new Error(errData.detail || 'Password Salah');
        }
    } catch (error) {
        errorBox.innerText = error.message;
        errorBox.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> Masuk ke Dasbor`;
    }
});
