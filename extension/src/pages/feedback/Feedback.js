class FeedbackPage {
    constructor() {
        this.selectedCategory = null;
        this.selectedAction = null;
        this.config = new Config();
        this.history = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
    }

    async loadHistory() {
        return new Promise(resolve => {
            chrome.storage.local.get(['texguardFeedbackHistory'], (result) => {
                this.history = result.texguardFeedbackHistory || [];
                resolve();
            });
        });
    }

    async saveHistory() {
        return new Promise(resolve => {
            chrome.storage.local.set({ texguardFeedbackHistory: this.history }, () => resolve());
        });
    }

    async init() {
        await this.config.loadConfig();
        await this.loadHistory();
        this.bindElements();
        this.attachEventListeners();
        this.renderHistory();
        
        const params = new URLSearchParams(window.location.search);
        if (params.has('text')) {
            this.prefillRealData(params);
        } else {
            this.prefillMockData();
        }
    }

    bindElements() {
        this.categoryCards = document.querySelectorAll('#feedback-categories .selectable-card');
        this.actionRadios = document.querySelectorAll('input[name="action"]');
        this.charCurrent = document.getElementById('char-current');
        this.inputReason = document.getElementById('input-reason');
        this.btnSubmit = document.getElementById('btn-submit');
        this.btnCancel = document.getElementById('btn-cancel');
        this.toast = document.getElementById('toast');
        
        // Pagination
        this.btnPrevPage = document.getElementById('btn-prev-page');
        this.btnNextPage = document.getElementById('btn-next-page');
        this.pageIndicator = document.getElementById('page-indicator');
    }

    attachEventListeners() {
        this.categoryCards.forEach(card => {
            card.addEventListener('click', () => {
                this.categoryCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.selectedCategory = card.dataset.cat;
            });
        });

        this.actionRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectedAction = e.target.value;
            });
        });

        this.inputReason.addEventListener('input', (e) => {
            this.charCurrent.innerText = e.target.value.length;
        });

        const copyIcon = document.querySelector('.ph-copy');
        if (copyIcon) {
            copyIcon.addEventListener('click', () => {
                const text = document.getElementById('input-text').value;
                navigator.clipboard.writeText(text);
                this.showToast('Komentar disalin');
            });
        }

        this.btnSubmit.addEventListener('click', async () => {
            if (!this.selectedCategory || !this.selectedAction) {
                this.showToast('Harap pilih Kategori dan Tindakan yang seharusnya');
                return;
            }
            
            const payload = {
                platform: document.getElementById('input-platform').value,
                system_label: document.getElementById('ai-cat').innerText,
                corrected_label: this.selectedCategory,
                comment_text: document.getElementById('input-text').value
            };

            try {
                const response = await fetch(`${this.config.apiUrl}/api/feedback`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                if (response.ok) {
                    // Save to local history
                    const now = new Date();
                    const dateStr = `${now.getDate()} ${now.toLocaleString('id-ID', {month:'short'})} ${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                    
                    const platformVal = document.getElementById('input-platform').value;
                    const platformIcons = {
                        'YOUTUBE': { icon: 'ph-youtube-logo', color: '#ff0000', name: 'YouTube' },
                        'FACEBOOK': { icon: 'ph-facebook-logo', color: '#1877f2', name: 'Facebook' },
                        'INSTAGRAM': { icon: 'ph-instagram-logo', color: '#e1306c', name: 'Instagram' },
                        'TIKTOK': { icon: 'ph-tiktok-logo', color: '#000000', name: 'TikTok' },
                        'TWITTER_X': { icon: 'ph-twitter-logo', color: '#1da1f2', name: 'Twitter/X' }
                    };
                    const pInfo = platformIcons[platformVal] || { icon: 'ph-globe', color: '#666', name: platformVal };

                    const sysCatStr = document.getElementById('ai-cat').innerText;
                    const sysActStr = document.getElementById('ai-action') ? document.getElementById('ai-action').innerText.split(' ')[0] : 'Blur';
                    const userCatStr = this.selectedCategory.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    const userActStr = this.selectedAction.charAt(0).toUpperCase() + this.selectedAction.slice(1);

                    this.history.unshift({
                        date: dateStr,
                        platform: pInfo.name,
                        icon: pInfo.icon,
                        color: pInfo.color,
                        text: payload.comment_text,
                        sysCat: sysCatStr,
                        sysAct: sysActStr,
                        userCat: userCatStr,
                        userAct: userActStr,
                        status: 'Terkirim'
                    });

                    // Keep only last 50
                    if (this.history.length > 50) this.history.pop();
                    this.currentPage = 1;
                    await this.saveHistory();
                    this.renderHistory();

                    this.showToast('Feedback Berhasil Dikirim');
                    setTimeout(() => { window.scrollTo(0,0); }, 1000);
                }
            } catch(e) {
                this.showToast('Gagal mengirim feedback');
            }
        });

        this.btnCancel.addEventListener('click', () => {
            if(confirm('Batalkan pengisian feedback?')) {
                window.close();
            }
        });

        // Pagination Events
        if (this.btnPrevPage) {
            this.btnPrevPage.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderHistory();
                }
            });
        }

        if (this.btnNextPage) {
            this.btnNextPage.addEventListener('click', () => {
                const totalPages = Math.ceil(this.history.length / this.itemsPerPage) || 1;
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderHistory();
                }
            });
        }
    }

    prefillMockData() {
        document.getElementById('input-datetime').value = '18 Mei 2024, 14:32';
        document.getElementById('input-text').value = 'Kamu bodoh banget, tidak pantas bikin konten.';
        document.getElementById('input-platform').value = 'YOUTUBE';
        
        const toxicCard = document.querySelector('[data-cat="toxic"]');
        if(toxicCard) toxicCard.click();

        const blurRadio = document.querySelector('input[value="blur"]');
        if(blurRadio) blurRadio.checked = true;
        this.selectedAction = 'blur';
    }

    prefillRealData(params) {
        const text = decodeURIComponent(params.get('text') || '');
        const platform = params.get('platform') || 'YOUTUBE';
        const cat = params.get('cat') || 'toxic';
        const timeStr = params.get('time');
        const confVal = parseFloat(params.get('conf') || 0.85);
        
        // Format datetime
        if (timeStr) {
            const d = new Date(Number(timeStr));
            const dateFormatted = `${d.getDate()} ${d.toLocaleString('id-ID', {month:'short'})} ${d.getFullYear()}, ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            document.getElementById('input-datetime').value = dateFormatted;
        }

        document.getElementById('input-text').value = text;
        document.getElementById('input-platform').value = platform.toUpperCase();

        const catName = cat.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const aiCatBadge = document.getElementById('ai-cat');
        
        // Map category classes based on stats.js
        const catStyles = {
            'toxic': 'background:#fee2e2; color:#ef4444',
            'hate_speech': 'background:#fce7f3; color:#be185d',
            'cyberbullying': 'background:#dbeafe; color:#2563eb',
            'spam': 'background:#fef3c7; color:#d97706',
            'spam_judol': 'background:#fef3c7; color:#d97706',
            'spam_emot': 'background:#f3e8ff; color:#7e22ce'
        };

        aiCatBadge.innerText = catName;
        aiCatBadge.className = 'badge-cat';
        if (catStyles[cat]) {
            aiCatBadge.style = catStyles[cat];
        } else {
            aiCatBadge.style = 'background:#eee; color:#333';
        }
        
        // Update Confidence Bar
        const pct = Math.round(confVal * 100);
        let confLevel = "Sedang";
        if (pct >= 85) confLevel = "Tinggi";
        else if (pct < 60) confLevel = "Rendah";
        
        document.getElementById('ai-conf-text').innerText = `${pct}% (${confLevel})`;
        document.getElementById('ai-conf-bar').style.width = `${pct}%`;
        
        this.charCurrent.innerText = text.length;
    }

    renderHistory() {
        const tbody = document.getElementById('feedback-history-tbody');
        tbody.innerHTML = '';

        const totalPages = Math.ceil(this.history.length / this.itemsPerPage) || 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;

        if (this.pageIndicator) {
            this.pageIndicator.innerText = `Halaman ${this.currentPage} dari ${totalPages}`;
        }
        if (this.btnPrevPage) {
            this.btnPrevPage.disabled = this.currentPage === 1;
        }
        if (this.btnNextPage) {
            this.btnNextPage.disabled = this.currentPage === totalPages;
        }

        if (this.history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 32px 0;">Belum ada riwayat feedback yang Anda kirimkan.</td></tr>';
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const pageData = this.history.slice(startIndex, startIndex + this.itemsPerPage);

        pageData.forEach(item => {
            const statusClass = item.status === 'Terkirim' ? 'sent' : 'accepted';
            tbody.innerHTML += `
                <tr>
                    <td>${item.date.replace(' ', '<br><span style="color:var(--text-muted)">')}</span></td>
                    <td>
                        <div class="platform-cell" style="color: ${item.color}">
                            <i class="ph ${item.icon}"></i> ${item.platform}
                        </div>
                    </td>
                    <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${item.text}
                    </td>
                    <td>
                        <div>${item.sysCat}</div>
                        <div style="font-size:10px; color:var(--text-muted)">(${item.sysAct})</div>
                    </td>
                    <td>
                        <div style="display:flex; align-items:center;">
                            <span class="history-arrow">→</span>
                            <div>
                                <div>${item.userCat}</div>
                                <div style="font-size:10px; color:var(--text-muted)">(${item.userAct})</div>
                            </div>
                        </div>
                    </td>
                    <td><span class="status-badge ${statusClass}">${item.status}</span></td>
                </tr>
            `;
        });
    }

    showToast(message) {
        this.toast.innerText = message;
        this.toast.classList.add('show');
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = new FeedbackPage();
    page.init();
});
