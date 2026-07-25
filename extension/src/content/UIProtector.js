class UIProtector {
  constructor() {
    this.STYLES = {
      'spam_judol':  { color: '#ffebee', border: '2px solid red', label: 'SPAM JUDI' },
      'spam_emot':   { color: '#fff3e0', border: '2px dashed orange', label: 'SPAM EMOT' },
      'toxic':       { color: '#f3e5f5', border: '2px solid purple', label: 'TOXIC' },
      'hate_speech': { color: '#ffebee', border: '2px solid darkred', label: 'HATE SPEECH' },
      'cyberbullying': { color: '#e8eaf6', border: '2px solid darkblue', label: 'BULLYING' }
    };
    this.protectionMode = 'hide'; 
  }

  applyProtection(node, category, confidence) {
    node.dataset.skripsiStatus = "done";
    if (category === 'normal' || category === 'aman' || category === 'error') return;

    this.injectStyles();

    if (this.protectionMode === 'hide') {
      this.hideComment(node, category, confidence);
    } else {
      this.blurComment(node, category, confidence);
    }
  }

  injectStyles() {
    const styleId = 'texguard-protector-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            .texguard-hidden {
                position: relative !important;
                color: transparent !important;
                border-radius: 8px !important;
                padding: 8px !important;
                cursor: pointer !important;
                display: block !important;
                min-width: 200px !important;
                transition: all 0.3s !important;
            }
            .texguard-hidden > * {
                opacity: 0 !important;
                pointer-events: none !important;
            }
            .texguard-hidden::before {
                content: "Konten Disembunyikan";
                color: #555 !important;
                font-weight: bold !important;
                font-style: italic !important;
                font-size: 14px !important;
                display: inline-block !important;
                margin-right: 5px !important;
            }
            .texguard-hidden::after {
                content: attr(data-tg-label) !important;
                background: #333 !important;
                color: white !important;
                padding: 2px 6px !important;
                border-radius: 4px !important;
                font-size: 10px !important;
                display: inline-block !important;
                font-style: normal !important;
            }
            .texguard-hidden * {
                opacity: 0 !important;
                pointer-events: none !important;
            }
        `;
        document.head.appendChild(style);
    }
  }

  hideComment(node, category, confidence) {
    // Untuk Instagram: cari parent <li> terdekat untuk menyensor komentar beserta avatar/strukturnya
    // Hal ini mengatasi masalah "Phantom Sensor" di mana IG memecah teks asli
    let targetNode = node;
    const liWrapper = node.closest('li');
    if (liWrapper && window.location.hostname.includes('instagram.com')) {
        targetNode = liWrapper;
    }

    const config = this.STYLES[category] || this.STYLES['toxic'];
    const percent = (confidence * 100).toFixed(0);

    // Simpan style original agar bisa dikembalikan
    if (!targetNode.dataset.originalColor) targetNode.dataset.originalColor = targetNode.style.color || '';
    if (!targetNode.dataset.originalBg) targetNode.dataset.originalBg = targetNode.style.backgroundColor || '';
    if (!targetNode.dataset.originalBorder) targetNode.dataset.originalBorder = targetNode.style.border || '';

    targetNode.classList.add('texguard-hidden');
    targetNode.style.backgroundColor = config.color;
    targetNode.style.border = config.border;
    targetNode.setAttribute('data-tg-label', `${config.label} ${percent}%`);

    targetNode.dataset.isHidden = "true";
    targetNode.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleVisibility(targetNode, category, confidence);
    };
  }

  blurComment(node, category, confidence) {
    // Sama seperti hideComment, cari wrapper li terdekat untuk IG
    let targetNode = node;
    const liWrapper = node.closest('li');
    if (liWrapper && window.location.hostname.includes('instagram.com')) {
        targetNode = liWrapper;
    }

     targetNode.style.filter = "blur(5px)";
     targetNode.style.cursor = "pointer";
     targetNode.dataset.isHidden = "true";
     targetNode.onclick = (e) => {
       e.stopPropagation();
       e.preventDefault();
       this.toggleVisibility(targetNode, category, confidence);
     };
  }

  showComment(node) {
    if (this.protectionMode === 'hide') {
        node.classList.remove('texguard-hidden');
        node.style.backgroundColor = node.dataset.originalBg || '';
        node.style.border = node.dataset.originalBorder || '';
        node.style.color = node.dataset.originalColor || '';
        node.removeAttribute('data-tg-label');
    } else {
        node.style.filter = "none";
    }
    node.dataset.isHidden = "false";
  }

  toggleVisibility(node, category, confidence) {
    if (node.dataset.isHidden === "true") {
      this.showComment(node);
    } else {
      if (this.protectionMode === 'hide') {
        this.hideComment(node, category, confidence);
      } else {
        this.blurComment(node, category, confidence);
      }
    }
  }
}
