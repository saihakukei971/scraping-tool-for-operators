// グローバル変数
let scrapingToolActive = false;
let popupContainer = null;
let shadow = null;
let selectedElement = null;
let originalBorder = '';
let selecting = false;
let selectedElementsSet = new Set();
let scrolling = false;

// ページロード時に設定を確認
chrome.storage.sync.get(['enableScraping'], (result) => {
  if (result.enableScraping === true) {
    initializeScrapingTool();
    scrapingToolActive = true;
  }
});

// メッセージリスナー
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('メッセージを受信:', message);

  if (message.action === 'toggleScrapingTool') {
    if (message.isEnabled) {
      initializeScrapingTool();
      scrapingToolActive = true;
    } else {
      removeScrapingTool();
      scrapingToolActive = false;
    }
    sendResponse({ success: true });
  }

  return true; // 非同期レスポンスのため
});

// スクレイピングツールを初期化
function initializeScrapingTool() {
  // 既存のポップアップがあれば削除
  removeScrapingTool();

  // ポップアップのコンテナを作成
  popupContainer = document.createElement('div');
  popupContainer.id = 'scraping-tool-popup';
  shadow = popupContainer.attachShadow({ mode: 'open' });

  // Shadow DOM内のスタイルを定義
  const style = document.createElement('style');
  style.textContent = `
    #popupContainer {
      position: fixed;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 25%;
      padding: 10px;
      box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
      background-color: #f0f0f0;
      color: #333;
      z-index: 10000;
      transition: height 0.3s ease;
      font-family: Arial, sans-serif;
    }
    #toggleButton {
      position: absolute;
      top: 0;
      right: 10px;
      margin: 5px;
    }
    #buttonContainer {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      align-items: center;
    }
    button {
      background-color: #4a4a4a;
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 5px;
      cursor: pointer;
      transition: background-color 0.3s ease;
      font-size: 12px;
      margin-right: 5px;
    }
    button:disabled {
      background-color: #7a7a7a;
      cursor: not-allowed;
      opacity: 0.6;
    }
    button:hover:not(:disabled) {
      background-color: #5a5a5a;
    }
    #tableContainer {
      margin-top: 50px;
      height: calc(100% - 60px);
      overflow-y: auto;
    }
    #selectedElementsTable {
      width: 100%;
      padding-right: 10px;
      border: 1px solid #ccc;
      border-collapse: collapse;
    }
    #selectedElementsTable th, #selectedElementsTable td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #ccc;
      font-size: 12px;
    }
    #toast {
      visibility: hidden;
      min-width: 250px;
      margin-left: -125px;
      background-color: #333;
      color: #fff;
      text-align: center;
      border-radius: 5px;
      padding: 16px;
      position: fixed;
      z-index: 10001;
      left: 50%;
      bottom: 30px;
      font-size: 15px;
    }
    #toast.show {
      visibility: visible;
      -webkit-animation: fadein 0.5s, fadeout 0.5s 1.5s;
      animation: fadein 0.5s, fadeout 0.5s 1.5s;
    }
    @-webkit-keyframes fadein {
      from {bottom: 0; opacity: 0;}
      to {bottom: 30px; opacity: 1;}
    }
    @keyframes fadein {
      from {bottom: 0; opacity: 0;}
      to {bottom: 30px; opacity: 1;}
    }
    @-webkit-keyframes fadeout {
      from {bottom: 30px; opacity: 1;}
      to {bottom: 0; opacity: 0;}
    }
    @keyframes fadeout {
      from {bottom: 30px; opacity: 1;}
      to {bottom: 0; opacity: 0;}
    }
    select {
      padding: 4px;
      border-radius: 3px;
      border: 1px solid #ccc;
      font-size: 12px;
      margin-right: 5px;
    }
    input {
      padding: 4px;
      border-radius: 3px;
      border: 1px solid #ccc;
      font-size: 12px;
      width: 120px;
      margin-right: 5px;
    }
  `;
  shadow.appendChild(style);

  // ポップアップの内容を追加
  const contentContainer = document.createElement('div');
  contentContainer.id = 'popupContainer';
  contentContainer.innerHTML = `
    <div id="buttonContainer">
      <button id="selectButton">選択モード開始</button>
      <button id="bulkSelectButton" disabled>一括選択</button>
      <button id="extractButton" disabled>構造データ抽出</button>
      <select id="dataFormatSelect">
        <option value="csv">CSV</option>

        <option value="txt">テキスト</option>
      </select>
      <select id="filenameSelect">
        <option value="datetime">年月日時分秒</option>
        <option value="custom">ユーザー指定</option>
      </select>
      <input type="text" id="filenameInput" placeholder="ファイル名" style="display:none;">
      <button id="saveButton" disabled>保存</button>
      <button id="resetButton" disabled>リセット</button>
      <button id="scrollUpButton" disabled>↑</button>
      <button id="scrollDownButton" disabled>↓</button>
      <button id="toggleButton">▼</button>
    </div>
    <div id="tableContainer">
      <table id="selectedElementsTable" border="1">
        <thead>
          <tr>
            <th>テキスト</th>
            <th>リンク</th>
            <th>画像</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
    <div id="toast">処理完了</div>
  `;
  shadow.appendChild(contentContainer);

  // ポップアップをドキュメントに追加
  document.body.appendChild(popupContainer);

  // イベントリスナーの設定
  setupEventListeners();

  // 設定の初期値読み込み
  loadSettings();

  // 検索結果ページチェック
  checkIfSearchResultsPage();
}

// スクレイピングツールを削除
function removeScrapingTool() {
  const existingPopup = document.getElementById('scraping-tool-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
  popupContainer = null;
  shadow = null;
  selectedElement = null;
  selectedElementsSet.clear();
}

// イベントリスナーを設定
function setupEventListeners() {
  if (!shadow) return;

  // 展開・非展開の切り替え
  const toggleButton = shadow.querySelector('#toggleButton');
  const popupContainerElement = shadow.querySelector('#popupContainer');
  let isExpanded = true;
  toggleButton.addEventListener('click', () => {
    if (isExpanded) {
      popupContainerElement.style.height = '5%';
      toggleButton.textContent = '▲';
    } else {
      popupContainerElement.style.height = '25%';
      toggleButton.textContent = '▼';
    }
    isExpanded = !isExpanded;
  });

  // 選択モードのイベントリスナー
  shadow.querySelector('#selectButton').addEventListener('click', () => {
    selecting = !selecting;
    const selectButton = shadow.querySelector('#selectButton');
    if (selecting) {
      selectButton.textContent = '選択モード解除';
    } else {
      selectButton.textContent = '選択モード開始';
      if (selectedElement) {
        selectedElement.style.border = originalBorder;
        selectedElement = null;
      }
    }
  });

  // ホバー時の赤枠表示
  document.addEventListener('mouseover', (event) => {
    if (selecting && popupContainer) {
      if (popupContainer.contains(event.target)) {
        return; // 拡張機能の要素を無視
      }
      if (selectedElement) {
        selectedElement.style.border = originalBorder;
      }
      selectedElement = event.target;
      originalBorder = selectedElement.style.border;
      selectedElement.style.border = '2px solid red';
    }
  });

  // クリック時の要素確定
  document.addEventListener('click', (event) => {
    if (selecting && popupContainer) {
      if (popupContainer.contains(event.target)) {
        return; // 拡張機能の要素を無視
      }
      event.preventDefault();
      event.stopPropagation();
      selecting = false;
      shadow.querySelector('#selectButton').textContent = '選択モード開始';

      // テーブルをクリア（毎回選択時に上書き）
      const tableBody = shadow.querySelector('#selectedElementsTable tbody');
      tableBody.innerHTML = '';
      selectedElementsSet.clear();

      // 選択された要素をセットに追加
      selectedElementsSet.add(selectedElement);

      // 構造化データを抽出して表示
      extractStructuredData();

      // ボタンの有効化
      shadow.querySelector('#bulkSelectButton').disabled = false;
      shadow.querySelector('#extractButton').disabled = false;
      shadow.querySelector('#saveButton').disabled = false;
      shadow.querySelector('#scrollUpButton').disabled = false;
      shadow.querySelector('#scrollDownButton').disabled = false;
      shadow.querySelector('#resetButton').disabled = false;
    }
  }, true);

  // 一括選択ボタンのイベントリスナー
  shadow.querySelector('#bulkSelectButton').addEventListener('click', () => {
    if (selectedElementsSet.size === 0) {
      alert('最初に要素を選択してください。');
      return;
    }

    try {
      // 選択された要素から基準となる要素を取得
      const referenceElement = Array.from(selectedElementsSet)[0];

      // クラス名がない場合はエラー
      if (!referenceElement.className) {
        showToast('選択された要素にはクラス名がありません。別の要素を選択してください。');
        return;
      }

      // 同じクラス名を持つ要素をすべて取得
      const elements = document.getElementsByClassName(referenceElement.className);

      // 要素が見つからない場合はエラー
      if (elements.length === 0) {
        showToast('同じクラス名の要素が見つかりません');
        return;
      }

      // テーブルをクリア
      const tableBody = shadow.querySelector('#selectedElementsTable tbody');
      tableBody.innerHTML = '';

      // 既存の要素の赤枠をクリア
      selectedElementsSet.forEach(element => {
        element.style.border = originalBorder;
      });

      // セットをクリア
      selectedElementsSet.clear();

      // 新しい要素をすべて追加
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        // 赤枠で強調表示
        element.style.border = '2px solid red';
        // 選択された要素をセットに追加
        selectedElementsSet.add(element);
      }

      // 構造化データを抽出して表示
      extractStructuredData();

      showToast(`${elements.length}個の要素を選択しました`);
    } catch (error) {
      console.error('一括選択中にエラーが発生しました:', error);
      showToast('一括選択中にエラーが発生しました');
    }
  });

  // リセットボタンのイベントリスナー
  shadow.querySelector('#resetButton').addEventListener('click', () => {
    // 赤枠をリセット
    selectedElementsSet.forEach(element => {
      element.style.border = originalBorder;
    });
    selectedElementsSet.clear();

    // テーブルをリセット
    const tableBody = shadow.querySelector('#selectedElementsTable tbody');
    tableBody.innerHTML = '';

    // ボタンの状態をリセット
    shadow.querySelector('#bulkSelectButton').disabled = true;
    shadow.querySelector('#extractButton').disabled = true;
    shadow.querySelector('#saveButton').disabled = true;
    shadow.querySelector('#scrollUpButton').disabled = true;
    shadow.querySelector('#scrollDownButton').disabled = true;
    shadow.querySelector('#resetButton').disabled = true;
    shadow.querySelector('#filenameInput').style.display = 'none';

    // 選択モードをリセット
    selecting = false;
    shadow.querySelector('#selectButton').textContent = '選択モード開始';
  });

  // データ形式選択のイベントリスナー
  shadow.querySelector('#dataFormatSelect').addEventListener('change', (event) => {
    chrome.storage.sync.set({ outputFormat: event.target.value });
  });

  // ファイル名選択のイベントリスナー
  shadow.querySelector('#filenameSelect').addEventListener('change', (event) => {
    const filenameType = event.target.value;
    chrome.storage.sync.set({ filenameType: filenameType });

    // カスタムファイル名入力欄の表示/非表示
    const filenameInput = shadow.querySelector('#filenameInput');
    if (filenameType === 'custom') {
      filenameInput.style.display = 'inline-block';
      chrome.storage.sync.get(['customFilename'], (result) => {
        filenameInput.value = result.customFilename || '';
      });
    } else {
      filenameInput.style.display = 'none';
    }
  });

  // カスタムファイル名入力のイベントリスナー
  shadow.querySelector('#filenameInput').addEventListener('change', (event) => {
    chrome.storage.sync.set({ customFilename: event.target.value });
  });

  // 保存ボタンのイベントリスナー
  shadow.querySelector('#saveButton').addEventListener('click', () => {
    saveExtractedData();
  });

  // 構造化データ抽出ボタンのイベントリスナー
  shadow.querySelector('#extractButton').addEventListener('click', () => {
    extractStructuredData();
    showToast('構造データを抽出しました');
  });

  // スクロールボタンのイベントリスナー
  shadow.querySelector('#scrollUpButton').addEventListener('click', () => {
    scrollAndBulkSelect('up');
  });

  shadow.querySelector('#scrollDownButton').addEventListener('click', () => {
    scrollAndBulkSelect('down');
  });
}

// トーストメッセージを表示する関数
function showToast(message) {
  if (!shadow) return;

  const toast = shadow.querySelector('#toast');
  toast.textContent = message;
  toast.className = 'show';
  setTimeout(() => {
    toast.className = toast.className.replace('show', '');
  }, 2000);
}

// 設定をロード
function loadSettings() {
  if (!shadow) return;

  chrome.storage.sync.get(['outputFormat', 'filenameType', 'customFilename'], (result) => {
    if (result.outputFormat) {
      shadow.querySelector('#dataFormatSelect').value = result.outputFormat;
    }

    if (result.filenameType) {
      shadow.querySelector('#filenameSelect').value = result.filenameType;
      if (result.filenameType === 'custom') {
        const filenameInput = shadow.querySelector('#filenameInput');
        filenameInput.style.display = 'inline-block';
        filenameInput.value = result.customFilename || '';
      }
    }
  });
}

// 検索結果ページかどうかチェック
function checkIfSearchResultsPage() {
  if (location.href.includes('google.com/search') ||
      location.href.includes('search.yahoo.com') ||
      location.href.includes('search.yahoo.co.jp') ||
      location.href.includes('bing.com/search')) {

    console.log('検索結果ページを検出しました。自動処理を準備します。');

    // ページが完全に読み込まれるまで待機
    setTimeout(() => {
      // 最初に検索結果の要素を選択
      selectFirstSearchResult();
    }, 1500); // 1.5秒待機
  }
}

// 最初の検索結果を自動選択
function selectFirstSearchResult() {
  let resultElements = [];

  // 検索エンジンによって異なるセレクタを使用
  if (location.href.includes('google.com/search')) {
    resultElements = document.querySelectorAll('div.g, div[data-hveid]');
  } else if (location.href.includes('search.yahoo.com') || location.href.includes('search.yahoo.co.jp')) {
    resultElements = document.querySelectorAll('div.algo, li.sl-card');
  } else if (location.href.includes('bing.com/search')) {
    resultElements = document.querySelectorAll('li.b_algo');
  }

  if (resultElements.length > 0) {
    // 最初の結果を選択
    selecting = true;
    selectedElement = resultElements[0];
    originalBorder = selectedElement.style.border;
    selectedElement.style.border = '2px solid red';

    // 選択モードを終了し、要素を確定
    selecting = false;
    if (shadow) {
      shadow.querySelector('#selectButton').textContent = '選択モード開始';

      // テーブルをクリア
      const tableBody = shadow.querySelector('#selectedElementsTable tbody');
      tableBody.innerHTML = '';
      selectedElementsSet.clear();

      // 選択された要素をセットに追加
      selectedElementsSet.add(selectedElement);

      // 構造化データを抽出して表示
      extractStructuredData();

      // ボタンの有効化
      shadow.querySelector('#bulkSelectButton').disabled = false;
      shadow.querySelector('#extractButton').disabled = false;
      shadow.querySelector('#saveButton').disabled = false;
      shadow.querySelector('#scrollUpButton').disabled = false;
      shadow.querySelector('#scrollDownButton').disabled = false;
      shadow.querySelector('#resetButton').disabled = false;
    }
  }
}

// 構造化データを抽出する関数
function extractStructuredData() {
  if (!shadow) return;

  const tableBody = shadow.querySelector('#selectedElementsTable tbody');
  tableBody.innerHTML = ''; // テーブルをクリア

  // 選択された要素から構造化データを抽出
  selectedElementsSet.forEach(element => {
    try {
      // テキスト抽出
      const text = element.textContent.trim();

      // リンク抽出
      const links = Array.from(element.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        url: a.href
      }));

      // 画像抽出
      const images = Array.from(element.querySelectorAll('img')).map(img => ({
        alt: img.alt,
        src: img.src
      }));

      // テーブルに行を追加
      const newRow = document.createElement('tr');

      // テキスト列
      const textCell = document.createElement('td');
      textCell.textContent = text;
      newRow.appendChild(textCell);

      // リンク列
      const linkCell = document.createElement('td');
      if (links.length > 0) {
        links.forEach(link => {
          const linkElement = document.createElement('a');
          linkElement.href = link.url;
          linkElement.textContent = link.text || link.url;
          linkElement.target = '_blank';
          linkCell.appendChild(linkElement);
          linkCell.appendChild(document.createElement('br'));
        });
      } else {
        linkCell.textContent = 'なし';
      }
      newRow.appendChild(linkCell);

      // 画像列
      const imageCell = document.createElement('td');
      if (images.length > 0) {
        images.forEach(image => {
          if (image.src) {
            const thumbnail = document.createElement('img');
            thumbnail.src = image.src;
            thumbnail.alt = image.alt || '';
            thumbnail.style.maxWidth = '100px';
            thumbnail.style.maxHeight = '50px';
            thumbnail.style.margin = '2px';
            imageCell.appendChild(thumbnail);
          }
        });
      } else {
        imageCell.textContent = 'なし';
      }
      newRow.appendChild(imageCell);

      tableBody.appendChild(newRow);
    } catch (error) {
      console.error('データ抽出中にエラーが発生しました:', error);
    }
  });
}

// 抽出したデータを保存する関数
function saveExtractedData() {
  if (!shadow) return;

  const tableBody = shadow.querySelector('#selectedElementsTable tbody');
  const rows = tableBody.querySelectorAll('tr');

  if (rows.length === 0) {
    showToast('保存するデータがありません');
    return;
  }

  // 設定を取得
  chrome.storage.sync.get(['outputFormat', 'filenameType', 'customFilename'], (result) => {
    try {
      const outputFormat = result.outputFormat || 'csv';
      const filenameType = result.filenameType || 'datetime';
      let filename;

      // ファイル名の決定
      if (filenameType === 'custom') {
        const filenameInput = shadow.querySelector('#filenameInput');
        const userFilename = filenameInput.value.trim() || result.customFilename || 'scraped_data';
        filename = userFilename;
      } else {
        // 日時を使ったファイル名
        const now = new Date();
        const dateStr = now.getFullYear() +
                      ('0' + (now.getMonth() + 1)).slice(-2) +
                      ('0' + now.getDate()).slice(-2) + '_' +
                      ('0' + now.getHours()).slice(-2) +
                      ('0' + now.getMinutes()).slice(-2) +
                      ('0' + now.getSeconds()).slice(-2);
        filename = 'scraped_data_' + dateStr;
      }

      // データの変換と保存
      let content, mimeType, extension;

      switch (outputFormat) {
        case 'excel':
          // ExcelはCSVとしてエクスポートし、拡張子をxlsxに
          content = convertToCSV(rows);
          mimeType = 'text/csv';
          extension = '.xlsx';
          break;
        case 'txt':
          content = convertToText(rows);
          mimeType = 'text/plain';
          extension = '.txt';
          break;
        case 'csv':
        default:
          content = convertToCSV(rows);
          mimeType = 'text/csv';
          extension = '.csv';
      }

      console.log('保存開始:', filename + extension);
      showToast('保存中...');

      // バックグラウンドスクリプトにダウンロード要求を送信
      chrome.runtime.sendMessage({
        action: 'downloadFile',
        content: content,
        format: outputFormat,
        mimeType: mimeType,
        filename: filename + extension
      }, function(response) {
        console.log('保存レスポンス:', response);

        if (response && response.success) {
          showToast(`${filename}${extension} を保存しました`);

          // 検索ボックスをクリア
          setTimeout(() => {
            const searchBox = document.querySelector('#APjFqb, input[name="q"], input[type="search"]');
            if (searchBox) {
              searchBox.value = '';
              searchBox.focus();
            }
          }, 500);
        } else {
          const errorMsg = response ? response.error : '不明なエラー';
          console.error('保存エラー:', errorMsg);
          showToast('保存に失敗しました: ' + errorMsg);
        }
      });
    } catch (e) {
      console.error('保存処理エラー:', e);
      showToast('保存処理中にエラーが発生しました');
    }
  });
}

// データをCSV形式に変換
function convertToCSV(rows) {
  // CSV ヘッダー
  let csvContent = 'テキスト,リンクテキスト,リンクURL,画像URL\n';

  Array.from(rows).forEach(row => {
    const cells = row.querySelectorAll('td');

    // テキスト
    const text = cells[0] ? escapeCsvField(cells[0].textContent) : '';

    // リンク
    let linkText = '';
    let linkUrl = '';
    if (cells[1] && cells[1].querySelector('a')) {
      const link = cells[1].querySelector('a');
      linkText = escapeCsvField(link.textContent);
      linkUrl = escapeCsvField(link.href);
    }

    // 画像
    let imageUrl = '';
    if (cells[2] && cells[2].querySelector('img')) {
      const image = cells[2].querySelector('img');
      imageUrl = escapeCsvField(image.src);
    }

    csvContent += `${text},${linkText},${linkUrl},${imageUrl}\n`;
  });

  return csvContent;
}

// データをテキスト形式に変換
function convertToText(rows) {
  let textContent = '';

  Array.from(rows).forEach((row, index) => {
    const cells = row.querySelectorAll('td');

    textContent += `===== アイテム ${index + 1} =====\n`;

    // テキスト
    if (cells[0]) {
      textContent += `テキスト: ${cells[0].textContent.trim()}\n\n`;
    }

    // リンク
    if (cells[1]) {
      const links = cells[1].querySelectorAll('a');
      if (links.length > 0) {
        textContent += `リンク:\n`;
        Array.from(links).forEach((link, i) => {
          textContent += `  ${i + 1}. ${link.textContent.trim()}: ${link.href}\n`;
        });
        textContent += '\n';
      }
    }

    // 画像
    if (cells[2]) {
      const images = cells[2].querySelectorAll('img');
      if (images.length > 0) {
        textContent += `画像:\n`;
        Array.from(images).forEach((img, i) => {
          textContent += `  ${i + 1}. ${img.alt || '(代替テキストなし)'}: ${img.src}\n`;
        });
        textContent += '\n';
      }
    }

    textContent += '=======================\n\n';
  });

  return textContent;
}

// CSV用にフィールドをエスケープする関数
function escapeCsvField(field) {
  const stringField = String(field || '');
  if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
    return '"' + stringField.replace(/"/g, '""') + '"';
  }
  return stringField;
}

// スクロールしながら一括選択を行う関数
function scrollAndBulkSelect(direction) {
  if (!shadow) return;

  if (!selectedElement && selectedElementsSet.size === 0) {
    alert('最初に要素を選択してください。');
    return;
  }

  if (scrolling) {
    // スクロールを停止し、ボタンを元の状態に戻す
    scrolling = false;
    shadow.querySelector('#scrollUpButton').disabled = false;
    shadow.querySelector('#scrollDownButton').disabled = false;
    shadow.querySelector('#selectButton').disabled = false;
    shadow.querySelector('#bulkSelectButton').disabled = false;
    shadow.querySelector('#extractButton').disabled = false;
    shadow.querySelector('#saveButton').disabled = false;
    shadow.querySelector('#resetButton').disabled = false;
    return;
  }

  scrolling = true;
  shadow.querySelector('#scrollUpButton').disabled = direction !== 'up';
  shadow.querySelector('#scrollDownButton').disabled = direction !== 'down';
  shadow.querySelector('#selectButton').disabled = true;
  shadow.querySelector('#bulkSelectButton').disabled = true;
  shadow.querySelector('#extractButton').disabled = true;
  shadow.querySelector('#saveButton').disabled = true;
  shadow.querySelector('#resetButton').disabled = true;

  const scrollContainer = findScrollContainer(Array.from(selectedElementsSet)[0] || selectedElement);

  function performScroll() {
    if (!scrolling) return;

    const scrollAmount = direction === 'up' ? -window.innerHeight / 2 : window.innerHeight / 2;

    if (scrollContainer) {
      scrollContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    }

    setTimeout(() => {
      // スクロール後に新しく表示された要素を収集
      collectElements();

      if (scrolling) {
        performScroll();
      } else {
        console.log("Scrolling stopped");
      }
    }, 100); // 0.1秒待ってから次のスクロールを実行
  }

  performScroll();
}

// 要素を収集する関数
function collectElements() {
  if (!shadow) return;

  // 選択された要素から基準となる要素を取得
  const referenceElement = Array.from(selectedElementsSet)[0];
  if (!referenceElement) return;

  const className = referenceElement.className;
  if (!className) {
    console.log('選択された要素にはクラス名がありません。');
    return;
  }

  const elements = document.getElementsByClassName(className);

  // 新しい要素のみを追加
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (selectedElementsSet.has(element)) {
      continue; // 既に選択されている要素はスキップ
    }

    // 要素を赤枠で囲む
    element.style.border = '2px solid red';

    // 選択された要素をセットに追加
    selectedElementsSet.add(element);
  }

  // テーブルを更新
  extractStructuredData();
}

// スクロールコンテナを見つける関数
function findScrollContainer(element) {
  if (!element) return null;

  while (element) {
    if (element.classList && element.classList.contains('c-scrollbar__hider')) {
      return element;
    }
    element = element.parentElement;
  }
  return null;
}

// クリップボードの内容を自動的に検索する
document.addEventListener('click', async (event) => {
  // 有効でない場合は処理しない
  if (!scrapingToolActive) return;

  // 検索ボックスへのクリックのみ処理
  const isSearchInput = event.target.matches('#APjFqb, input[name="q"], input[type="search"]');
  if (!isSearchInput) return;

  try {
    // クリップボードからテキスト取得
    const clipboardText = await navigator.clipboard.readText();

    if (clipboardText.trim() !== '') {
      // 検索ボックスに入力
      event.target.value = clipboardText;

      // 入力イベント発火
      event.target.dispatchEvent(new Event('input', { bubbles: true }));

      // Enterキーを発火させて検索実行
      event.target.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));

      console.log('クリップボード内容で検索:', clipboardText);
    }
  } catch (error) {
    console.error('クリップボード読み取りエラー:', error);
  }
});

// ページのURLが変更された時に呼び出される関数
function handleUrlChange() {
  if (scrapingToolActive) {
    checkIfSearchResultsPage();
  }
}

// URLの変更を監視
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    console.log('URLが変更されました:', lastUrl);
    handleUrlChange();
  }
}).observe(document, { subtree: true, childList: true });

// ページロード時の初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded イベント発生');
  handleUrlChange();
});