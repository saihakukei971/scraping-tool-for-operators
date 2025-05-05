// バックグラウンドスクリプトの初期化
console.log('バックグラウンドスクリプトが初期化されました');

// ファイルのダウンロード処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadFile') {
    console.log('ダウンロードリクエスト受信:', message.filename);

    try {
      // データをBase64エンコード
      let content = message.content;
      if (message.format === 'csv' || message.format === 'excel') {
        // CSVには BOM を追加して文字化け対策
        content = '\ufeff' + content;
      }

      // データURIスキームで直接ダウンロード
      const dataURI = 'data:' + message.mimeType + ';base64,' + btoa(unescape(encodeURIComponent(content)));

      // ダウンロード実行
      chrome.downloads.download({
        url: dataURI,
        filename: message.filename,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('ダウンロードエラー:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('ダウンロード開始:', downloadId);
          sendResponse({ success: true });
        }
      });
    } catch (e) {
      console.error('ダウンロード処理エラー:', e);
      sendResponse({ success: false, error: e.message });
    }

    return true; // 非同期レスポンスのため必須
  }
});

// 拡張機能のインストール・更新時の処理
chrome.runtime.onInstalled.addListener((details) => {
  // デフォルト設定
  chrome.storage.sync.set({
    enableScraping: false,
    outputFormat: 'csv',
    filenameType: 'datetime',
    customFilename: 'scraped_data'
  });

  console.log('拡張機能がインストールされました');
});