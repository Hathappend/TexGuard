class Config {
  constructor() {
    this.selectedPlatforms = ['YOUTUBE', 'FACEBOOK', 'TIKTOK', 'INSTAGRAM', 'TWITTER_X', 'LINKEDIN', 'REDDIT'];
    this.selectedCategories = ['toxic', 'hate_speech', 'spam', 'cyberbullying'];
    this.protectionStatus = true;
    this.protectionMode = 'hide'; // or 'blur'
    this.apiUrl = 'https://api.texguard.site';
  }

  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['selectedPlatforms', 'selectedCategories', 'protectionStatus', 'protectionMode'], (result) => {
        if (result.selectedPlatforms) this.selectedPlatforms = result.selectedPlatforms;
        if (result.selectedCategories) this.selectedCategories = result.selectedCategories;
        if (result.protectionStatus !== undefined) this.protectionStatus = result.protectionStatus;
        if (result.protectionMode) this.protectionMode = result.protectionMode;
        resolve();
      });
    });
  }

  async saveConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.set({
        selectedPlatforms: this.selectedPlatforms,
        selectedCategories: this.selectedCategories,
        protectionStatus: this.protectionStatus,
        protectionMode: this.protectionMode
      }, () => resolve());
    });
  }

  async updateConfig(newConfig) {
    Object.assign(this, newConfig);
    await this.saveConfig();
  }
}
