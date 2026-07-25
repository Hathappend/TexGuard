class StatsPage {
  constructor() {
    this.config = new Config();
    this.statistics = new Statistics();
    this.historyData = [];
  }

  async init() {
    await this.config.loadConfig();
    await this.statistics.loadStatistics();
    this.historyData = this.statistics.protectionHistory;
    this.filteredData = this.historyData;

    this.trendChartInstance = null;
    this.donutChartInstance = null;
    this.trendInterval = 'daily';
    this.currentPage = 1;
    this.itemsPerPage = 10;

    this.bindEvents();
    this.renderAll();
  }

  bindEvents() {
    const timeFilter = document.getElementById('time-filter');
    if (timeFilter) {
      timeFilter.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'all') {
          this.filteredData = this.historyData;
        } else {
          const days = parseInt(val, 10);
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          this.filteredData = this.historyData.filter(item => new Date(item.timestamp) >= cutoff);
        }
        this.currentPage = 1; // Reset to page 1 on filter
        this.renderAll();
      });
    }

    const trendIntervalFilter = document.getElementById('trend-interval');
    if (trendIntervalFilter) {
      trendIntervalFilter.addEventListener('change', (e) => {
        this.trendInterval = e.target.value;
        if (this.trendChartInstance) {
            this.trendChartInstance.destroy();
            this.trendChartInstance = null;
        }
        this.renderTrendChart();
      });
    }

    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderHistoryTable();
            }
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage) || 1;
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderHistoryTable();
            }
        });
    }
  }

  renderAll() {
    this.renderSummary();
    this.renderCharts();
    this.renderHistoryTable();
  }

  renderSummary() {
    document.getElementById('val-protected').innerText = this.filteredData.length;
    
    // Hitung total dipindai berdasarkan filter waktu
    let scannedCount = 0;
    const timeFilter = document.getElementById('time-filter');
    const val = timeFilter ? timeFilter.value : '7';
    
    if (val === 'all') {
        scannedCount = this.statistics.totalScanned;
    } else {
        const days = parseInt(val, 10);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        Object.keys(this.statistics.scannedByDate).forEach(dateStr => {
            if (new Date(dateStr) >= cutoff) {
                scannedCount += this.statistics.scannedByDate[dateStr];
            }
        });
    }
    
    document.getElementById('val-scanned').innerText = scannedCount;
    
    document.getElementById('val-platform').innerText = this.config.selectedPlatforms.length;
    // Mockup accuracy, could be fetched from backend if tracked
    document.getElementById('val-accuracy').innerText = '94%';
  }

  renderCharts() {
    this.renderTrendChart();
    this.renderDonutChart();
  }

  renderTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    const labels = [];
    const counts = [];
    
    if (this.trendInterval === 'daily') {
        // Harian: 7 hari terakhir
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('id-ID', { weekday: 'short' }));
            counts.push(0);
        }

        this.filteredData.forEach(item => {
            const itemDate = new Date(item.timestamp).toLocaleDateString('id-ID', { weekday: 'short' });
            const idx = labels.indexOf(itemDate);
            if (idx !== -1) counts[idx]++;
        });
    } else {
        // Mingguan: 4 minggu terakhir
        labels.push('Mgg 4', 'Mgg 3', 'Mgg 2', 'Mgg Ini');
        counts.push(0, 0, 0, 0);
        
        const now = new Date();
        now.setHours(23, 59, 59, 999);
        
        this.filteredData.forEach(item => {
            const itemDate = new Date(item.timestamp);
            const diffTime = Math.abs(now - itemDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 7) counts[3]++;
            else if (diffDays <= 14) counts[2]++;
            else if (diffDays <= 21) counts[1]++;
            else if (diffDays <= 28) counts[0]++;
        });
    }

    if (this.trendChartInstance) {
        this.trendChartInstance.destroy();
    }

    this.trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Komentar Diproteksi',
                data: counts,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { borderDash: [5, 5] }, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
  }

  renderDonutChart() {
    const ctx = document.getElementById('donutChart').getContext('2d');
    
    const counts = { 'toxic': 0, 'hate_speech': 0, 'cyberbullying': 0, 'spam': 0 };
    this.filteredData.forEach(item => {
        const cat = item.category === 'spam_judol' || item.category === 'spam_emot' ? 'spam' : item.category;
        if (counts[cat] !== undefined) counts[cat]++;
    });

    const labelsMap = {
        'toxic': 'Toxic', 'hate_speech': 'Hate Speech', 'cyberbullying': 'Cyberbullying', 
        'spam': 'Spam'
    };
    const colorsMap = {
        'toxic': '#1e293b', 'hate_speech': '#ef4444', 'cyberbullying': '#3b82f6', 
        'spam': '#f59e0b'
    };

    // If no history, show empty gray donut
    const isEmp = Object.values(counts).every(v => v === 0);
    const data = isEmp ? [1] : Object.values(counts);
    const bgColors = isEmp ? ['#e2e8f0'] : Object.keys(counts).map(k => colorsMap[k]);
    const total = data.reduce((a,b) => a+b, 0) || 1; 
    const labels = Object.keys(counts);

    if (this.donutChartInstance) {
        this.donutChartInstance.destroy();
    }

    this.donutChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: isEmp ? ['Tidak ada data'] : labels.map(k => labelsMap[k]),
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            cutout: '70%'
        }
    });

    const legendContainer = document.getElementById('donut-legend');
    legendContainer.innerHTML = '';
    labels.forEach((k, i) => {
        const val = data[i];
        if (val === 0 && !isEmp) return; // Skip empty in real mode
        const pct = Math.round((val / total) * 100);
        legendContainer.innerHTML += `
            <div class="legend-item">
                <div class="legend-color" style="background-color: ${colorsMap[k]}"></div>
                <span>${labelsMap[k]} <strong>${val}</strong> (${pct}%)</span>
            </div>
        `;
    });
  }

  renderHistoryTable() {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';

    // Urutkan riwayat terbalik (terbaru di atas)
    let recentHistory = [...this.filteredData].reverse();
    
    // Paginasi
    const totalPages = Math.ceil(recentHistory.length / this.itemsPerPage) || 1;
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    if (this.currentPage < 1) this.currentPage = 1;
    
    document.getElementById('page-indicator').innerText = `Halaman ${this.currentPage} dari ${totalPages}`;
    document.getElementById('btn-prev-page').disabled = this.currentPage === 1;
    document.getElementById('btn-next-page').disabled = this.currentPage === totalPages || totalPages === 0;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const paginatedItems = recentHistory.slice(startIndex, startIndex + this.itemsPerPage);

    if (paginatedItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 32px 0;">Belum ada riwayat proteksi</td></tr>';
        return;
    }

    const platformIcons = {
        'YOUTUBE': { icon: 'ph-youtube-logo', color: '#ff0000', name: 'YouTube' },
        'FACEBOOK': { icon: 'ph-facebook-logo', color: '#1877f2', name: 'Facebook' },
        'INSTAGRAM': { icon: 'ph-instagram-logo', color: '#e1306c', name: 'Instagram' },
        'TIKTOK': { icon: 'ph-tiktok-logo', color: '#000000', name: 'TikTok' },
        'TWITTER_X': { icon: 'ph-twitter-logo', color: '#1da1f2', name: 'Twitter' },
        'LINKEDIN': { icon: 'ph-linkedin-logo', color: '#0a66c2', name: 'LinkedIn' },
        'REDDIT': { icon: 'ph-reddit-logo', color: '#ff4500', name: 'Reddit' },
    };

    const catStyles = {
        'toxic': 'background:#fee2e2; color:#ef4444',
        'hate_speech': 'background:#fce7f3; color:#be185d',
        'cyberbullying': 'background:#dbeafe; color:#2563eb',
        'spam': 'background:#fef3c7; color:#d97706',
        'spam_judol': 'background:#fef3c7; color:#d97706',
        'spam_emot': 'background:#f3e8ff; color:#7e22ce',
    };

    paginatedItems.forEach(item => {
        const d = new Date(item.timestamp || Date.now());
        const dateStr = `${d.getDate()} ${d.toLocaleString('id-ID', {month:'short'})} ${d.getFullYear()}<br><span style="color:var(--text-muted)">${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}</span>`;
        
        let pInfo = platformIcons[item.platform];
        if (!pInfo) {
            const host = item.platform || '';
            const key = Object.keys(platformIcons).find(k => host.toUpperCase().includes(k.replace('_X',''))) || 'LAINNYA';
            pInfo = platformIcons[key] || { icon: 'ph-globe', color: '#666', name: host || 'Unknown' };
        }

        const catName = item.category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

        tbody.innerHTML += `
            <tr>
                <td>${dateStr}</td>
                <td>
                    <div class="platform-cell" style="color: ${pInfo.color}">
                        <i class="ph ${pInfo.icon}"></i> ${pInfo.name}
                    </div>
                </td>
                <td style="max-width: 300px;">
                    <div class="protected-text blurred" style="display: flex; align-items: center; justify-content: space-between;">
                        <span class="comment-text" style="flex: 1; margin-right: 8px;">${item.text}</span>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn-toggle-blur" title="Tampilkan/Sembunyikan">
                                <i class="ph-fill ph-eye-slash"></i>
                            </button>
                            <button class="btn-report" title="Laporkan Kesalahan" data-text="${encodeURIComponent(item.text)}" data-cat="${item.category}" data-platform="${item.platform}" data-time="${d.getTime()}" data-conf="${item.confidence || 0.85}">
                                <i class="ph-fill ph-warning" style="color: #ef4444;"></i>
                            </button>
                        </div>
                    </div>
                </td>
                <td><span class="badge-cat" style="${catStyles[item.category] || 'background:#eee'}">${catName}</span></td>
                <td><span class="badge-action">${this.config.protectionMode === 'hide' ? 'Hide' : 'Blur'}</span></td>
            </tr>
        `;
    });

    // Tambahkan event listener untuk setiap tombol toggle blur
    const toggleBtns = tbody.querySelectorAll('.btn-toggle-blur');
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const container = this.closest('.protected-text');
            const icon = this.querySelector('i');
            
            if (container.classList.contains('blurred')) {
                container.classList.remove('blurred');
                icon.classList.remove('ph-eye-slash');
                icon.classList.add('ph-eye');
            } else {
                container.classList.add('blurred');
                icon.classList.remove('ph-eye');
                icon.classList.add('ph-eye-slash');
            }
        });
    });

    // Tambahkan event listener untuk tombol laporkan
    const reportBtns = tbody.querySelectorAll('.btn-report');
    reportBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.getAttribute('data-text');
            const cat = this.getAttribute('data-cat');
            const platform = this.getAttribute('data-platform');
            const time = this.getAttribute('data-time');
            const conf = this.getAttribute('data-conf');
            
            const url = chrome.runtime.getURL(`src/pages/feedback/feedback.html?text=${text}&cat=${cat}&platform=${platform}&time=${time}&conf=${conf}`);
            chrome.tabs.create({ url: url });
        });
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = new StatsPage();
    page.init();
});
