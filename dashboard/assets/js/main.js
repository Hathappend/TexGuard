// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : 'https://api.texguard.site'; 

// Security Check
const token = localStorage.getItem('admin_token');
if (!token) {
    window.location.href = 'login.html';
}

// Logout Function
function logout() {
    localStorage.removeItem('admin_token');
    window.location.href = 'login.html';
}

// State
let ratioChartInstance = null;
let platformChartInstance = null;

// Navigation Logic
const pages = ['overview', 'telemetry', 'feedback'];
pages.forEach(page => {
    document.getElementById(`nav-${page}`).addEventListener('click', () => {
        // Update Nav
        pages.forEach(p => document.getElementById(`nav-${p}`).classList.remove('active'));
        document.getElementById(`nav-${page}`).classList.add('active');
        
        // Update Page Title
        const titles = {
            'overview': 'Dashboard Overview',
            'telemetry': 'Live Telemetry Log',
            'feedback': 'User Feedback & Retraining'
        };
        document.getElementById('page-title').innerText = titles[page];

        // Update View
        pages.forEach(p => document.getElementById(`page-${p}`).style.display = 'none');
        document.getElementById(`page-${page}`).style.display = 'block';
    });
});

// Helper: Format Date
const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Helper: Get Badge Class
const getBadgeClass = (label) => {
    if (label === 'spam') return 'badge-spam';
    if (label === 'normal') return 'badge-normal';
    return 'badge-toxic';
};

// Fetch Data
async function fetchData() {
    try {
        document.getElementById('loader').style.display = 'flex';
        
        const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert("Sesi berakhir atau token tidak valid. Silakan login kembali.");
            logout();
            return;
        }

        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        // Update Metrics
        document.getElementById('m-total-requests').innerText = data.overview.total_requests.toLocaleString('id-ID');
        document.getElementById('m-total-feedback').innerText = data.overview.total_feedback.toLocaleString('id-ID');
        
        const latency = data.overview.avg_latency_ms;
        document.getElementById('m-latency').innerText = `${latency} ms`;
        
        const latencyStatus = document.getElementById('latency-status');
        if (latency < 200) {
            latencyStatus.className = 'metric-status status-good';
            latencyStatus.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> <span>Super Cepat</span>`;
        } else if (latency < 500) {
            latencyStatus.className = 'metric-status';
            latencyStatus.style.color = 'var(--warning)';
            latencyStatus.innerHTML = `<span>Normal</span>`;
        } else {
            latencyStatus.className = 'metric-status status-bad';
            latencyStatus.innerHTML = `<span>Server Mulai Lambat</span>`;
        }

        // Update Charts
        updateCharts(data.overview);

        // Update Telemetry Table
        const telBody = document.getElementById('telemetry-body');
        telBody.innerHTML = '';
        data.latest_logs.forEach(log => {
            telBody.innerHTML += `
                <tr>
                    <td>${formatDate(log.timestamp)}</td>
                    <td>${log.platform}</td>
                    <td>${log.text.length > 50 ? log.text.substring(0,50)+'...' : log.text}</td>
                    <td><span class="badge ${getBadgeClass(log.predicted_label)}">${log.predicted_label}</span></td>
                    <td>${(log.confidence * 100).toFixed(1)}%</td>
                    <td>${log.inference_time_ms.toFixed(1)} ms</td>
                </tr>
            `;
        });

        // Update Feedback Table
        const fbBody = document.getElementById('feedback-body');
        fbBody.innerHTML = '';
        data.latest_feedbacks.forEach(log => {
            fbBody.innerHTML += `
                <tr>
                    <td>${formatDate(log.timestamp)}</td>
                    <td>${log.platform}</td>
                    <td>${log.text}</td>
                    <td><span class="badge ${getBadgeClass(log.original_predicted_label)}">${log.original_predicted_label}</span></td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Error fetching data:", error);
        alert("Gagal terhubung ke Backend API. Pastikan FastAPI sudah berjalan.");
    } finally {
        setTimeout(() => { document.getElementById('loader').style.display = 'none'; }, 500);
    }
}

function updateCharts(overview) {
    // Setup Chart.js Defaults for Dark Theme
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'Inter';

    // Ratio Chart
    const ratioCtx = document.getElementById('ratioChart').getContext('2d');
    if (ratioChartInstance) ratioChartInstance.destroy();
    
    ratioChartInstance = new Chart(ratioCtx, {
        type: 'doughnut',
        data: {
            labels: ['Normal', 'Spam', 'Toxic/Hate'],
            datasets: [{
                data: [overview.normal_count, overview.spam_count, overview.toxic_count],
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });

    // Platform Chart (Real Data from SQL)
    const platCtx = document.getElementById('platformChart').getContext('2d');
    if (platformChartInstance) platformChartInstance.destroy();

    const pc = overview.platform_counts || {};
    const pData = [
        pc['instagram'] || pc['INSTAGRAM'] || 0,
        pc['youtube'] || pc['YOUTUBE'] || 0,
        pc['tiktok'] || pc['TIKTOK'] || 0,
        pc['twitter'] || pc['TWITTER'] || pc['X'] || 0,
        pc['facebook'] || pc['FACEBOOK'] || 0,
        pc['unknown'] || 0
    ];

    platformChartInstance = new Chart(platCtx, {
        type: 'bar',
        data: {
            labels: ['Instagram', 'YouTube', 'TikTok', 'X/Twitter', 'Facebook', 'Lainnya'],
            datasets: [{
                label: 'Total Requests',
                data: pData,
                backgroundColor: '#3b82f6',
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

let currentExportType = '';

function openExportModal(type) {
    currentExportType = type;
    document.getElementById('export-modal').style.display = 'flex';
}

function closeExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}

function toggleDateInputs() {
    const isCustom = document.querySelector('input[name="export_range"]:checked').value === 'custom';
    document.getElementById('date-inputs').style.display = isCustom ? 'flex' : 'none';
}

async function processExport() {
    const btn = document.getElementById('export-submit-btn');
    btn.innerText = 'Memproses...';
    btn.disabled = true;

    try {
        const isCustom = document.querySelector('input[name="export_range"]:checked').value === 'custom';
        let url = `${API_BASE_URL}/api/admin/export/${currentExportType}`;
        
        if (isCustom) {
            const start = document.getElementById('export-start').value;
            const end = document.getElementById('export-end').value;
            if (!start || !end) {
                alert("Pilih tanggal mulai dan tanggal akhir terlebih dahulu!");
                btn.innerText = 'Download CSV';
                btn.disabled = false;
                return;
            }
            url += `?start_date=${start}&end_date=${end}`;
        }

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            alert("Sesi berakhir. Silakan login kembali.");
            logout();
            return;
        }

        if (!response.ok) throw new Error('Gagal mengekspor data');

        // Terima data teks (CSV)
        const csvData = await response.text();
        
        // Buat Blob dan Link untuk Download
        const blob = new Blob([csvData], { type: 'text/csv' });
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = downloadUrl;
        
        // Nama file
        let filename = `texguard_${currentExportType}.csv`;
        if (isCustom) {
            filename = `texguard_${currentExportType}_${document.getElementById('export-start').value}_to_${document.getElementById('export-end').value}.csv`;
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        
        closeExportModal();

    } catch (error) {
        console.error("Export error:", error);
        alert("Terjadi kesalahan saat mengunduh CSV.");
    } finally {
        btn.innerText = 'Download CSV';
        btn.disabled = false;
    }
}

// Initial Load
window.addEventListener('DOMContentLoaded', fetchData);
