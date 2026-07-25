class QueueManager {
  constructor(uiProtector, statistics) {
    this.commentQueue = [];
    this.timer = null;
    this.API_URL = "https://api.texguard.site/api/predictions/batch";
    this.uiProtector = uiProtector;
    this.statistics = statistics;
  }

  queueComment(node) {
    if (node.dataset.skripsiStatus) return;
    
    const text = node.innerText.trim();
    if (text.length < 2) return; 

    const uniqueId = "id-" + Math.random().toString(36).substr(2, 9);
    node.dataset.skripsiStatus = "queued"; 

    this.commentQueue.push({
      id: uniqueId,
      text: text,
      node: node 
    });

    if (this.commentQueue.length >= 5) {
        if (this.timer) clearTimeout(this.timer);
        this.sendBatch(); 
    } else {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.sendBatch(), 1000); 
    }
  }

  async sendBatch() {
    if (this.commentQueue.length === 0) return;

    const batchToSend = [...this.commentQueue];
    this.commentQueue = []; 

    const payload = {
        comments: batchToSend.map(item => ({ id: item.id, text: item.text }))
    };

    try {
      const response = await fetch(this.API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.results) {
        for (const res of data.results) {
          const originalItem = batchToSend.find(item => item.id === res.id);
          
          if (originalItem && originalItem.node && originalItem.node.isConnected) {
            this.uiProtector.applyProtection(originalItem.node, res.category, res.confidence);
            
            if (res.category !== 'normal' && res.category !== 'aman' && res.category !== 'error') {
               this.statistics.addHistory({
                   text: originalItem.text,
                   category: res.category,
                   confidence: res.confidence,
                   platform: window.location.hostname
               });
            }
          }
        }
      }

    } catch (error) {
      console.error("❌ Gagal mengirim batch ke API:", error);
      batchToSend.forEach(item => delete item.node.dataset.skripsiStatus);
    }
  }

  clearQueue() {
    if (this.timer) clearTimeout(this.timer);
    this.commentQueue = [];
  }
}
