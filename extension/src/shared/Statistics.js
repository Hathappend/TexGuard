class Statistics {
  constructor() {
    this.totalProtected = 0;
    this.protectionHistory = [];
    this.totalScanned = 0;
    this.scannedByDate = {};
    this._saveQueue = Promise.resolve();
  }

  async loadStatistics() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['totalProtected', 'protectionHistory', 'totalScanned', 'scannedByDate'], (result) => {
        if (result.totalProtected) this.totalProtected = result.totalProtected;
        if (result.protectionHistory) this.protectionHistory = result.protectionHistory;
        if (result.totalScanned) this.totalScanned = result.totalScanned;
        if (result.scannedByDate) this.scannedByDate = result.scannedByDate;
        resolve();
      });
    });
  }

  async saveStatistics() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        totalProtected: this.totalProtected,
        protectionHistory: this.protectionHistory,
        totalScanned: this.totalScanned,
        scannedByDate: this.scannedByDate
      }, () => resolve());
    });
  }

  async getStatistics() {
    await this.loadStatistics();
    return {
      totalProtected: this.totalProtected,
      protectionHistory: this.protectionHistory,
      totalScanned: this.totalScanned,
      scannedByDate: this.scannedByDate
    };
  }

  async addHistory(item) {
      // Gunakan promise queue (mutex) untuk mencegah Race Condition saat menyimpan komentar secara bersamaan (batch)
      this._saveQueue = this._saveQueue.then(() => {
          return new Promise((resolve) => {
              chrome.storage.local.get(['totalProtected', 'protectionHistory'], (result) => {
                  let total = result.totalProtected || 0;
                  let history = result.protectionHistory || [];
                  
                  total++;
                  history.push({
                      ...item,
                      timestamp: new Date().toISOString()
                  });
                  
                  // Batasi riwayat maksimal 500 (First-In, First-Out)
                  if (history.length > 500) {
                      history.shift();
                  }
                  
                  chrome.storage.local.set({
                      totalProtected: total,
                      protectionHistory: history
                  }, () => {
                      this.totalProtected = total;
                      this.protectionHistory = history;
                      resolve();
                  });
              });
          });
      });
      return this._saveQueue;
  }

  async addScannedCount(count) {
      this._saveQueue = this._saveQueue.then(() => {
          return new Promise((resolve) => {
              chrome.storage.local.get(['totalScanned', 'scannedByDate'], (result) => {
                  let total = result.totalScanned || 0;
                  let byDate = result.scannedByDate || {};
                  
                  const todayStr = new Date().toDateString();
                  total += count;
                  
                  if (!byDate[todayStr]) {
                      byDate[todayStr] = 0;
                  }
                  byDate[todayStr] += count;
                  
                  chrome.storage.local.set({
                      totalScanned: total,
                      scannedByDate: byDate
                  }, () => {
                      this.totalScanned = total;
                      this.scannedByDate = byDate;
                      resolve();
                  });
              });
          });
      });
      return this._saveQueue;
  }

  async getTodayStats() {
      await this.loadStatistics();
      const today = new Date().toDateString();
      let todayProtected = 0;
      let todayDanger = 0;
      let todayScanned = this.scannedByDate[today] || 0;

      this.protectionHistory.forEach(item => {
          const itemDate = new Date(item.timestamp).toDateString();
          if (itemDate === today) {
              todayProtected++;
              if (item.category !== 'normal' && item.category !== 'aman') {
                  todayDanger++;
              }
          }
      });

      return { todayProtected, todayDanger, todayScanned };
  }

  async clearHistory() {
    this.totalProtected = 0;
    this.protectionHistory = [];
    this.totalScanned = 0;
    this.scannedByDate = {};
    await this.saveStatistics();
  }
}
