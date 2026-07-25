class SettingsPage {
    constructor() {
        this.config = new Config();
    }

    async init() {
        await this.config.loadConfig();
        this.bindElements();
        this.updateUI();
        this.attachEventListeners();
    }

    bindElements() {
        this.toggleStatus = document.getElementById('toggle-status');
        this.categoryCards = document.querySelectorAll('.selectable-card');
        this.platformChips = document.querySelectorAll('.platform-chip');
        this.modeCards = document.querySelectorAll('.mode-card');
        this.btnSave = document.getElementById('btn-save');
        this.btnReset = document.getElementById('btn-reset');
        this.toast = document.getElementById('toast');
    }

    updateUI() {
        // Status
        this.toggleStatus.checked = this.config.protectionStatus;

        // Categories
        this.categoryCards.forEach(card => {
            const cat = card.dataset.cat;
            if (this.config.selectedCategories.includes(cat)) {
                card.classList.add('active');
                if (this.config.selectedCategories.length === 1) {
                    card.classList.add('locked');
                } else {
                    card.classList.remove('locked');
                }
            } else {
                card.classList.remove('active');
                card.classList.remove('locked');
            }
        });

        // Platforms
        let visibleActiveCount = 0;
        this.platformChips.forEach(chip => {
            if (this.config.selectedPlatforms.includes(chip.dataset.plat)) visibleActiveCount++;
        });

        this.platformChips.forEach(chip => {
            const plat = chip.dataset.plat;
            if (this.config.selectedPlatforms.includes(plat)) {
                chip.classList.add('active');
                if (visibleActiveCount === 1) {
                    chip.classList.add('locked');
                } else {
                    chip.classList.remove('locked');
                }
            } else {
                chip.classList.remove('active');
                chip.classList.remove('locked');
            }
        });

        // Mode
        this.modeCards.forEach(card => {
            const mode = card.dataset.mode;
            if (this.config.protectionMode === mode) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
    }

    attachEventListeners() {
        // Toggle Status
        this.toggleStatus.addEventListener('change', (e) => {
            this.config.protectionStatus = e.target.checked;
        });

        // Categories click
        this.categoryCards.forEach(card => {
            card.addEventListener('click', () => {
                const cat = card.dataset.cat;
                const index = this.config.selectedCategories.indexOf(cat);
                
                if (index > -1) {
                    if (this.config.selectedCategories.length <= 1) {
                        this.showToast('Minimal satu kategori filter harus aktif!', 'error');
                        card.classList.add('shake');
                        setTimeout(() => card.classList.remove('shake'), 400);
                        return;
                    }
                    this.config.selectedCategories.splice(index, 1);
                } else {
                    this.config.selectedCategories.push(cat);
                }
                this.updateUI();
            });
        });

        // Platforms click
        this.platformChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const plat = chip.dataset.plat;
                const index = this.config.selectedPlatforms.indexOf(plat);
                
                if (index > -1) {
                    let visibleActiveCount = 0;
                    this.platformChips.forEach(c => {
                        if (this.config.selectedPlatforms.includes(c.dataset.plat)) visibleActiveCount++;
                    });

                    if (visibleActiveCount <= 1) {
                        this.showToast('Minimal satu platform harus aktif!', 'error');
                        chip.classList.add('shake');
                        setTimeout(() => chip.classList.remove('shake'), 400);
                        return;
                    }
                    this.config.selectedPlatforms.splice(index, 1);
                } else {
                    this.config.selectedPlatforms.push(plat);
                }
                this.updateUI();
            });
        });

        // Mode click
        this.modeCards.forEach(card => {
            card.addEventListener('click', () => {
                this.modeCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.config.protectionMode = card.dataset.mode;
            });
        });

        // Save Button
        this.btnSave.addEventListener('click', async () => {
            if (this.config.selectedCategories.length === 0) {
                this.showToast('Gagal Disimpan: Minimal satu kategori harus aktif!', 'error');
                return;
            }
            await this.config.saveConfig();
            this.showToast('Pengaturan Berhasil Disimpan');
        });

        // Reset Button
        this.btnReset.addEventListener('click', async () => {
            this.config = new Config(); 
            await this.config.saveConfig();
            this.updateUI();
            this.showToast('Pengaturan direset ke default');
        });

        // Sync with Popup
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.config) {
                const newConfig = changes.config.newValue;
                if (newConfig && newConfig.protectionStatus !== undefined) {
                    this.config.protectionStatus = newConfig.protectionStatus;
                    this.toggleStatus.checked = this.config.protectionStatus;
                }
            }
        });
    }

    showToast(message, type = 'success') {
        this.toast.innerText = message;
        if (type === 'error') {
            this.toast.classList.add('error');
        } else {
            this.toast.classList.remove('error');
        }
        this.toast.classList.add('show');
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = new SettingsPage();
    page.init();
});
