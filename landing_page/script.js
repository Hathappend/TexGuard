document.addEventListener('DOMContentLoaded', () => {
    // Page Transition Setup
    setTimeout(() => {
        document.body.classList.add('page-loaded');
    }, 50);

    // Intercept links for smooth exit
    const links = document.querySelectorAll('a[href]');
    links.forEach(link => {
        link.addEventListener('click', e => {
            const href = link.getAttribute('href');
            // If it's a page link (not just an anchor like #faq, not a mailto, no target _blank)
            if (href && !href.startsWith('#') && !href.startsWith('mailto:') && link.target !== '_blank') {
                e.preventDefault();
                document.body.classList.remove('page-loaded');
                document.body.classList.add('page-leaving');
                setTimeout(() => {
                    window.location.href = href;
                }, 300); // 300ms matches CSS transition
            }
        });
    });

    // Drag to scroll for steps wrapper
    const slider = document.querySelector('.steps-wrapper');
    if (slider) {
        let isDown = false;
        let startX;
        let scrollLeft;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });

        slider.addEventListener('mouseleave', () => {
            isDown = false;
        });

        slider.addEventListener('mouseup', () => {
            isDown = false;
        });

        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2; // Scroll speed multiplier
            slider.scrollLeft = scrollLeft - walk;
        });
    }

    // Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    if (tabBtns.length > 0) {
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active from all btns
                tabBtns.forEach(b => b.classList.remove('active'));
                // Hide all contents
                tabContents.forEach(c => c.style.display = 'none');
                
                // Set current btn active
                btn.classList.add('active');
                // Show target content
                const targetId = btn.getAttribute('data-target');
                if (targetId) {
                    const targetEl = document.getElementById(targetId);
                    if (targetEl) {
                        targetEl.style.display = 'block';
                    }
                }
            });
        });
        
        // Hide all except active on load
        tabContents.forEach(c => {
            if (!c.classList.contains('active')) {
                c.style.display = 'none';
            }
        });

        // Check if there is a hash in the URL to activate specific tab
        if (window.location.hash) {
            const hashId = window.location.hash.substring(1); // remove '#'
            const targetBtn = document.querySelector(`.tab-btn[data-target="${hashId}"]`);
            if (targetBtn) {
                targetBtn.click();
            }
        }
    }

    // FAQ Accordion Logic
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            // Close all
            faqItems.forEach(i => i.classList.remove('active'));
            // Toggle current
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // Scroll Reveal Animation
    const revealElements = document.querySelectorAll('.reveal');
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target); // Only animate once
                }
            });
        }, {
            root: null,
            threshold: 0.15,
            rootMargin: "0px 0px -50px 0px"
        });

        revealElements.forEach(el => revealObserver.observe(el));
    }
});
