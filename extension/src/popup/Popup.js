class Popup {
  constructor() {
    this.config = new Config();
    this.statistics = new Statistics();
  }

  async init() {
    await this.config.loadConfig();
    await this.statistics.loadStatistics();

    this.bindElements();
    this.updateUI();
    this.attachEventListeners();
  }

  bindElements() {
    this.toggleProtection = document.getElementById('toggle-protection');
    this.statProtected = document.getElementById('stat-protected');
    this.statDanger = document.getElementById('stat-danger');
    this.statScanned = document.getElementById('stat-scanned');
    this.statPlatforms = document.getElementById('stat-platforms');

    this.statusBadge = document.querySelector('.status-indicator .badge');
    this.statusText = document.querySelector('.status-indicator .status-text');

    this.platformItems = document.querySelectorAll('.platform-item');

    this.btnSettings = document.getElementById('btn-settings');
    this.btnOpenWeb = document.getElementById('btn-open-web');
    this.navStats = document.getElementById('nav-stats');
    this.navSettings = document.getElementById('nav-settings');
    this.navFeedback = document.getElementById('nav-feedback');
  }

  updateUI() {
    this.toggleProtection.checked = this.config.protectionStatus;

    if (this.config.protectionStatus) {
      this.statusBadge.innerHTML = '<i class="ph-fill ph-check-circle"></i> AKTIF';
      this.statusBadge.className = 'badge active';
      this.statusText.innerText = 'Komentar berbahaya sedang diproteksi';
    } else {
      this.statusBadge.innerHTML = '<i class="ph-fill ph-x-circle"></i> NONAKTIF';
      this.statusBadge.className = 'badge inactive';
      this.statusText.innerText = 'Proteksi komentar dinonaktifkan';
    }

    // Update Ringkasan Hari Ini
    this.statistics.getTodayStats().then(todayStats => {
      this.statProtected.innerText = todayStats.todayProtected;
      this.statScanned.innerText = todayStats.todayScanned;
      this.statPlatforms.innerText = this.config.selectedPlatforms.length;

      this.platformItems.forEach(item => {
        const platform = item.dataset.platform;
        item.classList.toggle('active', this.config.selectedPlatforms.includes(platform));
      });
    });
  }

  attachEventListeners() {
    this.toggleProtection.addEventListener('change', async (e) => {
      await this.config.updateConfig({ protectionStatus: e.target.checked });
      this.updateUI(); // Segera perbarui label dan teks di popup
    });

    this.navSettings.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/settings/settings.html") });
    });

    this.navStats.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/stats/stats.html") });
    });

    this.navFeedback.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/feedback/feedback.html") });
    });

    this.btnSettings.addEventListener('click', () => {
      this.navSettings.click();
    });

    this.btnOpenWeb.addEventListener('click', () => {
      window.open('https://texguard.site', '_blank');
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const popup = new Popup();
  popup.init();
});
