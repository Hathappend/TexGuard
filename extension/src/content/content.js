// content.js
class ContentScript {
    constructor() {
        this.config = null;
        this.platform = this.detectPlatform();
        this.processedComments = new Set();
        this.isProcessing = false;
        this.queue = [];
        this.statistics = null;
    }

    detectPlatform() {
        const hostname = window.location.hostname;
        if (hostname.includes('youtube.com')) return 'YOUTUBE';
        if (hostname.includes('facebook.com')) return 'FACEBOOK';
        if (hostname.includes('instagram.com')) return 'INSTAGRAM';
        if (hostname.includes('tiktok.com')) return 'TIKTOK';
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'TWITTER_X';
        if (hostname.includes('linkedin.com')) return 'LINKEDIN';
        if (hostname.includes('reddit.com')) return 'REDDIT';
        return null;
    }

    async init() {
        // Load config and statistics
        if (typeof Config !== 'undefined' && typeof Statistics !== 'undefined') {
            this.config = new Config();
            await this.config.loadConfig();

            this.statistics = new Statistics();
            await this.statistics.loadStatistics();
        } else {
            console.error("TexGuard: Config or Statistics class not found.");
            return;
        }

        // Listen for config changes
        chrome.storage.onChanged.addListener((changes, namespace) => {
            // Hanya tangkap perubahan pengaturan (sync), BUKAN perubahan statistik (local)
            if (namespace === 'sync') {
                const configKeys = ['selectedPlatforms', 'selectedCategories', 'protectionStatus', 'protectionMode'];
                const hasConfigChanges = configKeys.some(key => changes[key]);

                if (hasConfigChanges) {
                    this.config.loadConfig().then(() => {
                        if (!this.config.protectionStatus || !this.config.selectedPlatforms.includes(this.platform)) {
                            this.unprotectAll();
                        }
                        this.showRefreshNotification();
                    });
                }
            }
        });

        // Start observing DOM if platform is supported and enabled in settings
        if (this.platform) {
            if (!this.config.selectedPlatforms.includes(this.platform)) {
                // console.log(`[TexGuard] Proteksi dinonaktifkan untuk platform ${this.platform} melalui pengaturan.`);
                return;
            }
            this.startObserving();
        }
    }

    getCommentSelector() {
        switch (this.platform) {
            case 'YOUTUBE': return 'ytd-comment-view-model #content-text';
            case 'FACEBOOK': return 'div[dir="auto"]';
            case 'TWITTER_X': return '[data-testid="tweetText"]';
            case 'TIKTOK': return "[data-e2e='comment-level-1'], [data-e2e='comment-level-2'], [data-e2e='comment-item']";
            case 'INSTAGRAM': return 'span[dir="auto"]:not(a *):not(h1 *):not(h2 *):not(h3 *), div[dir="auto"]:not(a *):not(h1 *):not(h2 *):not(h3 *)';
            default: return 'p, span';
        }
    }

    startObserving() {
        const initObserver = () => {
            let debounceTimer;
            const observer = new MutationObserver(() => {
                if (!this.config || !this.config.protectionStatus) return;
                if (!this.config.selectedPlatforms.includes(this.platform)) return;

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.findAndQueueComments();
                }, 500); // Tunggu 500ms agar browser selesai kalkulasi ukuran DOM (untuk filter isVisible)
            });

            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
            this.findAndQueueComments();
        };

        // Hindari Error 418 (React Hydration Mismatch) dengan menunda observasi DOM 
        // sampai React selesai melakukan render & hydration pertama.
        if (document.readyState === 'complete') {
            setTimeout(initObserver, 1500);
        } else {
            window.addEventListener('load', () => setTimeout(initObserver, 1500));
        }
    }

    findAndQueueComments() {
        if (!this.config.protectionStatus) return;

        const selector = this.getCommentSelector();
        const elements = document.querySelectorAll(selector);

        elements.forEach(el => {
            // Khusus Twitter/X: Hanya scan komentar (replies), abaikan timeline dan caption utama
            if (this.platform === 'TWITTER_X') {
                if (!window.location.pathname.includes('/status/')) return; // Abaikan beranda/timeline

                const statusMatch = window.location.pathname.match(/\/status\/(\d+)/);
                if (statusMatch) {
                    const mainTweetId = statusMatch[1];
                    const tweetContainer = el.closest('[data-testid="tweet"]');
                    if (tweetContainer) {
                        const links = Array.from(tweetContainer.querySelectorAll('a[href*="/status/"]'));
                        const isMainTweet = links.some(link => link.href.includes(mainTweetId));
                        if (isMainTweet) return; // Abaikan tweet utama
                    }
                }
            } else if (this.platform === 'FACEBOOK') {
                // Jangan gunakan filter struktur (DOM) karena Facebook sering merombak kodenya.
                // Gunakan filter URL seperti di Instagram: Abaikan halaman Beranda utama sepenuhnya!
                // Saat user mengklik postingan (modal terbuka), Facebook akan otomatis mengubah URL.
                const path = window.location.pathname;
                if (path === '/' || path === '/home.php') return;
            }

            const text = el.innerText.trim();
            // Cek elemen terlihat dengan lebih ketat (> 5px) untuk membuang teks phantom/screen-reader (sering muncul di IG)
            const isVisible = el.offsetWidth > 5 && el.offsetHeight > 5 && el.getClientRects().length > 0;

            // Periksa apakah elemen ini sudah diproses DENGAN teks yang sama (solusi untuk React node recycling)
            const isAlreadyProcessed = this.processedComments.has(el) && el.dataset.dspamLastText === text;

            if (!isAlreadyProcessed && text.length > 0 && isVisible) {
                // Segera tandai sebagai diproses agar tidak diulang-ulang jika teksnya tidak berubah
                this.processedComments.add(el);
                el.dataset.dspamLastText = text;

                // Filter tambahan di JS khusus Instagram
                if (this.platform === 'INSTAGRAM') {
                    // 1. Jangan scan apapun jika sedang di Beranda (Feed) atau Explore. 
                    const path = window.location.pathname;
                    if (!path.includes('/p/') && !path.includes('/reel')) return;

                    // 2. Spatial Filter: Blokir "Hover Popover Profil" (tooltip) yang melayang di body root.
                    if (!el.closest('article, main, section, ul, aside, [role="dialog"], [role="presentation"]')) return;

                    // Abaikan jika elemen ini adalah (atau berada di dalam) Link/Header
                    if (el.closest('a, [role="link"], h1, h2, h3')) return;

                    // Abaikan jika elemen ini *membungkus* Link
                    const innerLink = el.querySelector('a, [role="link"]');
                    if (innerLink && innerLink.innerText.trim() === text) return;

                    // Abaikan span pertama di setiap article (biasanya itu adalah Caption utama postingan)
                    const article = el.closest('article');
                    if (article) {
                        if (!article.dataset.firstSpanIdentified) {
                            const validSpansInArticle = Array.from(article.querySelectorAll(selector)).filter(span => {
                                const isSpanVisible = span.offsetWidth > 5 && span.offsetHeight > 5 && span.getClientRects().length > 0;
                                const isInLink = span.closest('a, [role="link"], h1, h2, h3');
                                const spanInnerLink = span.querySelector('a, [role="link"]');
                                const isWrapperOnly = spanInnerLink && spanInnerLink.innerText.trim() === span.innerText.trim();
                                return isSpanVisible && span.innerText.trim().length > 0 && !isInLink && !isWrapperOnly;
                            });

                            if (validSpansInArticle.length > 0) {
                                validSpansInArticle[0].dataset.isCaption = "true";
                            }
                            article.dataset.firstSpanIdentified = "true";
                        }

                        if (el.dataset.isCaption === "true") return; // Abaikan caption utama
                    }

                    const uiWords = ['Balas', 'Suka', 'Lihat', 'Sembunyikan', 'Komentar', 'Reply', 'Like', 'View', 'Hide', 'See', 'Translate'];
                    const isUIText = uiWords.some(ui => text.startsWith(ui));
                    const isTimestampOrLikes = /^[\d,.]+\s*(ming|j|mnt|h|hari|dtk|suka|kali|likes?|w|d|m|s)$/i.test(text);
                    const isStats = /^[\d,.]+\s*(posts?|followers?|following|kiriman|pengikut|mengikuti)$/i.test(text);
                    if (isUIText || isTimestampOrLikes || isStats) return;
                }

                // Jika lolos semua filter, masukkan ke antrean
                this.queue.push(el);
            }
        });

        this.processQueue();
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;
        this.isProcessing = true;

        const batch = this.queue.splice(0, 10);
        const payload = {
            platform: this.platform,
            comments: batch.map((el, i) => ({
                id: `comment_${Date.now()}_${i}`,
                text: el.innerText.trim()
            }))
        };

        try {
            const response = await fetch(`${this.config.apiUrl}/api/predictions/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();

                // Rekam jumlah pindaian ke memori
                await this.statistics.addScannedCount(batch.length);

                // console.log('TexGuard Detection Results:', data.results);
                data.results.forEach((res, index) => {
                    // Normalisasi kategori dari backend versi lama jika uvicorn belum di-restart
                    let detectedCategory = res.category;
                    if (detectedCategory === 'spam_judol' || detectedCategory === 'spam_emot') {
                        detectedCategory = 'spam';
                    }

                    if (detectedCategory !== 'normal' && detectedCategory !== 'aman') {
                        // Pastikan kategori yang terdeteksi dicentang di pengaturan Filter
                        if (this.config.selectedCategories.includes(detectedCategory)) {
                            const targetEl = batch[index];

                            if (this.platform === 'FACEBOOK') {
                                // Ambil parent yang membungkus baris-baris komentar ini
                                const parent = targetEl.parentElement;
                                if (parent) {
                                    // Cari semua baris teks (div[dir="auto"]) yang satu level (siblings) dengan elemen ini
                                    const siblingLines = Array.from(parent.children)
                                        .filter(l => l.matches('div[dir="auto"]') && l.innerText.trim().length > 0 && !!(l.offsetWidth || l.offsetHeight || l.getClientRects().length));

                                    if (siblingLines.length > 0) {
                                        // Kirim seluruh baris sebagai array agar diblur dan dikontrol bersamaan oleh 1 tombol
                                        this.applyProtection(siblingLines, detectedCategory, res.confidence);
                                    } else {
                                        this.applyProtection(targetEl, detectedCategory, res.confidence);
                                    }
                                } else {
                                    this.applyProtection(targetEl, detectedCategory, res.confidence);
                                }
                            } else {
                                this.applyProtection(targetEl, detectedCategory, res.confidence);
                            }
                        }
                    }
                });
            }
        } catch (error) {
            // Backend might be offline, ignore silently so we don't spam console
        } finally {
            this.isProcessing = false;
            if (this.queue.length > 0) {
                setTimeout(() => this.processQueue(), 500);
            }
        }
    }

    applyProtection(target, category, confidence = 0.85) {
        if (!this.config.protectionStatus) return;

        // Format kategori agar tampil lebih rapi (contoh: spam_judol -> Spam Judol)
        const displayCategory = category
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        // Dukung pengiriman array elemen (multi-line) atau elemen tunggal
        const elements = Array.isArray(target) ? target : [target];
        if (elements.length === 0) return;

        // Cek elemen pertama
        if (elements[0].dataset.dspamProtected) return;

        // Pastikan masih di DOM
        if (!document.body.contains(elements[0])) return;

        elements.forEach(el => {
            el.dataset.dspamProtected = 'true';
            el.classList.add('dspam-protected');
        });

        // Simpan ke riwayat statistik
        const textToSave = elements.map(el => el.innerText.trim()).join('\n');
        if (this.statistics && textToSave) {
            this.statistics.addHistory({
                text: textToSave,
                category: category,
                platform: this.platform,
                confidence: confidence
            });
        }

        const firstElement = elements[0];

        const eyeClosedSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256"><path fill="currentColor" d="M234.4 170.81a12 12 0 0 1-10.43 17.59a11.85 11.85 0 0 1-6.55-1.95l-33.88-23.71A127.35 127.35 0 0 1 128 176c-30.88 0-59.56-9-81.56-24.5l-20 14a12 12 0 1 1-13.78-19.64l24-16.8a135.25 135.25 0 0 1-15.11-20.93a12 12 0 1 1 21-11.83c13.71 24.38 43 51.7 85.45 51.7s71.74-27.32 85.45-51.7a12 12 0 1 1 21 11.83a135.25 135.25 0 0 1-15.11 20.93l24.47 17.13a12 12 0 0 1 5.58 13.63Z"/><path fill="currentColor" d="M128 56C85.58 56 56.32 83.32 42.58 107.7a12 12 0 1 0 21 11.83c10.42-18.52 32.55-39.53 64.42-39.53a71.8 71.8 0 0 1 12.28 1.07l-9 12.56A35.91 35.91 0 0 0 128 92a36 36 0 1 0 36 36a35.91 35.91 0 0 0-1.28-9.28l12.56-9A71.8 71.8 0 0 1 200 120c0 14.54-5.32 28.53-15 41l19.5 13.65c12.33-15.28 18.5-31.52 18.5-46.65c0-42.53-30-74-85-86.41Z"/></svg>`;
        const eyeOpenSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256"><path fill="currentColor" d="M247.31 124.76c-.35-.79-8.82-19.58-27.65-38.41C194.57 61.26 162.88 48 128 48S61.43 61.26 36.34 86.35C17.51 105.18 9 124 8.69 124.76a8 8 0 0 0 0 6.48c.35.79 8.82 19.58 27.65 38.41C61.43 194.74 93.12 208 128 208s66.57-13.26 91.66-38.35c18.83-18.83 27.3-37.62 27.65-38.41a8 8 0 0 0 0-6.48ZM128 192c-30.78 0-57.67-11.19-79.93-33.25A133.47 133.47 0 0 1 25 128a133.33 133.33 0 0 1 23.07-30.75C70.33 75.19 97.22 64 128 64s57.67 11.19 79.93 33.25A133.46 133.46 0 0 1 231 128c-7.22 13.57-31.38 53.14-103 64Zm0-112a48 48 0 1 0 48 48a48.05 48.05 0 0 0-48-48Zm0 80a32 32 0 1 1 32-32a32 32 0 0 1-32 32Z"/></svg>`;

        if (this.config.protectionMode === 'blur') {
            elements.forEach(el => {
                el.style.filter = 'blur(6px)';
                el.style.transition = 'filter 0.3s ease';
            });

            const badge = document.createElement('div');
            badge.classList.add('dspam-badge');

            // UI Aesthetic & Modern
            Object.assign(badge.style, {
                display: 'flex', // Menggunakan flex block agar pindah baris
                width: 'fit-content', // Agar lebar sesuai konten
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'rgba(241, 245, 249, 0.95)',
                border: '1px solid #cbd5e1',
                borderRadius: '20px',
                color: '#475569',
                fontSize: '12px',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                fontWeight: '500',
                cursor: 'pointer',
                marginBottom: '8px',
                marginTop: '4px',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease',
                userSelect: 'none'
            });

            let isBlurred = true;
            badge.innerHTML = `${eyeClosedSVG} <span>Komentar ${displayCategory} disembunyikan</span>`;

            badge.addEventListener('mouseenter', () => { badge.style.background = '#e2e8f0'; });
            badge.addEventListener('mouseleave', () => { badge.style.background = isBlurred ? 'rgba(241, 245, 249, 0.95)' : 'rgba(226, 232, 240, 0.95)'; });

            const toggleBlur = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isBlurred = !isBlurred;

                elements.forEach(el => {
                    el.style.filter = isBlurred ? 'blur(6px)' : 'none';
                });

                if (isBlurred) {
                    badge.innerHTML = `${eyeClosedSVG} <span>Komentar ${displayCategory} disembunyikan</span>`;
                    badge.style.color = '#475569';
                    badge.style.border = '1px solid #cbd5e1';
                } else {
                    badge.innerHTML = `${eyeOpenSVG} <span>Sembunyikan kembali</span>`;
                    badge.style.color = '#334155';
                    badge.style.border = '1px solid #94a3b8';
                }
            };

            badge.addEventListener('click', toggleBlur);

            if (firstElement.parentNode) {
                firstElement.parentNode.insertBefore(badge, firstElement);
            }
        } else {
            // Hide mode
            let targetElement = firstElement;

            // CSS global untuk dspam-badge adjacent sibling
            // React sering menghapus inline style/class pada teks.
            // Dengan menggunakan CSS sibling (+), teks akan selalu disembunyikan selama badge-nya ada di sebelahnya
            if (!document.getElementById('dspam-global-styles')) {
                const style = document.createElement('style');
                style.id = 'dspam-global-styles';
                style.innerHTML = `
                    .dspam-badge + span, 
                    .dspam-badge + div { 
                        display: none !important; 
                    }
                `;
                document.head.appendChild(style);
            }

            const badge = document.createElement('div');
            badge.classList.add('dspam-badge');
            Object.assign(badge.style, {
                padding: '6px 10px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#64748b',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                marginBottom: '6px'
            });
            badge.innerText = `[Komentar ${displayCategory} disembunyikan oleh TexGuard]`;

            if (targetElement.parentNode) {
                targetElement.parentNode.insertBefore(badge, targetElement);
            }
        }
    }

    unprotectAll() {
        const protectedElements = document.querySelectorAll('.dspam-protected, [data-dspam-hidden="true"]');
        protectedElements.forEach(el => {
            el.style.filter = 'none';
            el.style.display = '';
            delete el.dataset.dspamProtected;
            delete el.dataset.dspamHidden;
            el.classList.remove('dspam-protected');
            el.classList.remove('dspam-hidden');
        });

        const badges = document.querySelectorAll('.dspam-badge');
        badges.forEach(badge => badge.remove());

        this.processedComments.clear();
        this.queue = [];
    }

    showRefreshNotification() {
        if (document.getElementById('dspam-refresh-toast')) return;

        // Tambahkan CSS Keyframes untuk animasi Bounce & Pulse
        if (!document.getElementById('dspam-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'dspam-toast-styles';
            style.textContent = `
                @keyframes dspam-slide-bounce {
                    0% { transform: translateY(100px) scale(0.9); opacity: 0; }
                    50% { transform: translateY(-12px) scale(1.02); opacity: 1; }
                    75% { transform: translateY(6px) scale(0.98); opacity: 1; }
                    100% { transform: translateY(0) scale(1); opacity: 1; }
                }
                @keyframes dspam-pulse-ring {
                    0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); }
                    70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
                }
            `;
            document.head.appendChild(style);
        }

        // Suara notifikasi dinonaktifkan untuk mencegah peringatan "AudioContext not allowed to start" dari browser.

        const toast = document.createElement('div');
        toast.id = 'dspam-refresh-toast';
        // Gunakan setAttribute style untuk memastikan prioritas tertinggi (!important) di halaman seperti Facebook
        toast.setAttribute('style', `
            position: fixed !important;
            bottom: 24px !important;
            right: 24px !important;
            left: auto !important;
            background: white !important;
            padding: 16px !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2) !important;
            display: flex !important;
            align-items: center !important;
            gap: 16px !important;
            z-index: 2147483647 !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            border: 1px solid #e2e8f0 !important;
            animation: dspam-slide-bounce 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards !important;
            margin: 0 !important;
        `);

        const iconSVG = `<svg width="24" height="24" viewBox="0 0 256 256" style="color: #3b82f6"><path fill="currentColor" d="M224 128a96 96 0 1 1-21.67-60.69l11.45-12.72a8 8 0 0 1 11.89 10.7l-22.38 24.87a8 8 0 0 1-11.88-1.5l-20.73-28.14a8 8 0 0 1 12.92-9.52l9 12.2A80 80 0 1 0 208 128a8 8 0 0 1 16 0Z"/></svg>`;

        toast.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-width: 40px; height: 40px; background: #eff6ff; border-radius: 50%; animation: dspam-pulse-ring 1.5s infinite;">${iconSVG}</div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 600; font-size: 14px; color: #1e293b;">Pengaturan Diperbarui</span>
                <span style="font-size: 12px; color: #64748b;">Muat ulang halaman agar perubahan diterapkan.</span>
            </div>
            <button id="dspam-btn-refresh" style="margin-left: 8px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-weight: 500; font-size: 13px; cursor: pointer; transition: background 0.2s;">Muat Ulang</button>
            <button id="dspam-btn-close" style="background: transparent; border: none; font-size: 20px; color: #94a3b8; cursor: pointer; padding: 0 4px; line-height: 1; transition: color 0.2s;">×</button>
        `;

        document.body.appendChild(toast);

        // Hover effect for buttons
        const btnRefresh = document.getElementById('dspam-btn-refresh');
        btnRefresh.addEventListener('mouseenter', () => btnRefresh.style.background = '#2563eb');
        btnRefresh.addEventListener('mouseleave', () => btnRefresh.style.background = '#3b82f6');

        const btnClose = document.getElementById('dspam-btn-close');
        btnClose.addEventListener('mouseenter', () => btnClose.style.color = '#475569');
        btnClose.addEventListener('mouseleave', () => btnClose.style.color = '#94a3b8');

        // Event Listeners
        btnRefresh.addEventListener('click', () => window.location.reload());
        btnClose.addEventListener('click', () => {
            toast.style.transition = 'all 0.3s ease';
            toast.style.transform = 'translateY(100px)';
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        });
    }
}

// Initialize
const dspamContent = new ContentScript();
dspamContent.init();
