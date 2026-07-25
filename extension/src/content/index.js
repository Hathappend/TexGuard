(async () => {
  const config = new Config();
  await config.loadConfig();

  if (!config.protectionStatus) {
    // console.log("%c[SKRIPSI] Proteksi Nonaktif.", "color: orange; font-weight: bold; font-size: 14px;");
    return;
  }

  const uiProtector = new UIProtector();
  uiProtector.protectionMode = config.protectionMode;

  const statistics = new Statistics();
  await statistics.loadStatistics();

  const queueManager = new QueueManager(uiProtector, statistics);
  const domObserverManager = new DOMObserverManager(queueManager);

  const currentPlatform = domObserverManager.identifyPlatform();
  if (currentPlatform && config.selectedPlatforms.includes(currentPlatform)) {
      domObserverManager.startObserving();
  } else {
      // console.log(`%c[SKRIPSI] Platform ${currentPlatform || 'Unknown'} tidak diaktifkan di pengaturan atau tidak dikenali.`, "color: orange;");
  }
})();
