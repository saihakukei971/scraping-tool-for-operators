document.addEventListener('DOMContentLoaded', () => {
  // チェックボックスの初期状態を設定
  chrome.storage.sync.get(['enableScraping'], (result) => {
    document.getElementById('enableScraping').checked = result.enableScraping || false;
  });

  // チェックボックスの状態が変わったときに保存
  document.getElementById('enableScraping').addEventListener('change', (event) => {
    const isEnabled = event.target.checked;

    // 設定を保存
    chrome.storage.sync.set({ enableScraping: isEnabled }, () => {
      console.log('設定を保存しました:', isEnabled);

      // 現在のタブにメッセージを送信
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleScrapingTool',
            isEnabled: isEnabled
          });
        }
      });
    });
  });
});