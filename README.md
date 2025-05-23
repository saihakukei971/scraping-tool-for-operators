# click-scraper-extension

本ツールは、広告運用・Web担当者など非エンジニアでも扱える、Chrome拡張型のWebスクレイピング支援ツールです。  
日常的な運用業務において、管理画面やレポートサイトなどから必要な情報をGUI操作で素早く抽出・保存できる仕組みを提供します。

拡張機能をONにすると、対象のWebページ上に独自のオーバーレイパネルが表示され、任意の要素をクリックするだけで内容を抽出・記録できます。  
コードの記述や複雑な設定は一切不要であり、現場スタッフがそのまま業務に導入可能です。データはクリップボードコピーやCSV形式でのダウンロードにも対応しており、即時の資料化・集計が可能です。

本ツールは以下のような業務現場を想定しています：

- 媒体管理画面やレポートからのデータ抜き取り作業の効率化  
- 営業・運用レポート作成時の数値取得補助  
- 広告掲載結果・数値の目視確認と併せた保存作業の自動化

技術的には、manifest v3に準拠したChrome拡張形式で構成され、`content.js`によるページ内DOM操作、`popup.js`によるGUI切替、`background.js`による状態管理を組み合わせています。`chrome.storage`と`chrome.scripting` APIを適切に活用し、設定の永続化や動的なスクリプト挿入も実現しています。

**実務内製の自作ツール**であり、拡張性・保守性を重視して設計済みです。  
今後、特定ドメインに対するテンプレート機能や、抽出要素のマッピング保存機能の実装も視野に入れています。

---

## 🔧 利用方法

1. Chromeの拡張機能「デベロッパーモード」を有効化  
2. 本フォルダを「パッケージ化されていない拡張機能」として読み込み  
3. 任意のWebページを開き、ツールバーのアイコンから拡張機能を有効化  
4. 表示されたUIパネル上で、抽出したい要素をクリック選択  
5. 抽出データはログ出力またはダウンロード可能

---

## 📂 構成ファイル

- `manifest.json`：拡張機能の定義ファイル（MV3形式）
- `popup.html / popup.js`：設定画面および有効化切り替え処理
- `background.js`：サービスワーカーとして動作、設定保存処理
- `content.js`：実際にページ内にUIを挿入し、要素選択・抽出を行う処理

---

