class DOMObserverManager {
  constructor(queueManager) {
    this.CONFIG = [
      { platform: "TWITTER_X", selector: "[data-testid='tweetText']" },
      { platform: "TIKTOK", selector: "[data-e2e='comment-level-1'], [data-e2e='comment-level-2'], [data-e2e='comment-item']" },
      { platform: "YOUTUBE", selector: "#content-text, yt-formatted-string.ytd-comment-renderer" },
      { platform: "FACEBOOK", selector: "div[dir='auto']" }, 
      { platform: "INSTAGRAM", selector: "span._aacl" },
      { platform: "LINKEDIN", selector: ".comments-comment-item__main-content" },
      { platform: "REDDIT", selector: "div[data-testid='comment'] p" }
    ];
    this.queueManager = queueManager;
    this.currentPlatform = null;
    this.observer = null;
  }

  identifyPlatform() {
    const host = window.location.hostname;
    if (host.includes("youtube")) return "YOUTUBE";
    if (host.includes("facebook")) return "FACEBOOK";
    if (host.includes("instagram")) return "INSTAGRAM";
    if (host.includes("tiktok")) return "TIKTOK";
    if (host.includes("twitter") || host.includes("x.com")) return "TWITTER_X";
    if (host.includes("linkedin")) return "LINKEDIN";
    if (host.includes("reddit")) return "REDDIT";
    return null;
  }

  detectCommentNode(mutations, cfg) {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) { 
           if (node.matches && node.matches(cfg.selector)) this.queueManager.queueComment(node);
           const children = node.querySelectorAll(cfg.selector);
           children.forEach(child => this.queueManager.queueComment(child));
        }
      });
    }
  }

  startObserving() {
    this.currentPlatform = this.identifyPlatform();
    if (!this.currentPlatform) return;

    const cfg = this.CONFIG.find(c => c.platform === this.currentPlatform);
    if (!cfg) return;

    this.observer = new MutationObserver((mutations) => {
      this.detectCommentNode(mutations, cfg);
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
    // console.log(`%c[SKRIPSI] Proteksi Aktif - Platform: ${this.currentPlatform}`, "color: cyan; font-weight: bold; font-size: 14px;");
  }
}
