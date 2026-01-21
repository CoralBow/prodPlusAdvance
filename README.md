## タスク・天気統合 Web アプリケーション (React + Vite)

！本READMEは未完成のため、後ほど更新する予定です。

このアプリケーションは、タスク管理（ToDo） と 天気情報 を一元的に管理できるシンプルなシングルページアプリケーション（SPA）です。PC（最大幅 840px）およびスマートフォンでの利用を考慮したレスポンシブデザインを採用しています。

## 主要機能

タスク管理 -タスクの追加・完了・削除が可能。 -データは LocalStorage に保存され、リロード後も保持されます。

天気予報 -選択した都市の 14 日間の天気予報を表示。 -雨が予想される日に、対象タスクが屋外関連かどうかを判定し、該当する場合は傘アラートを表示。
※タスク名に shouldShowUmbrellaAlert で定義された屋外キーワードが含まれる場合、当日の Home 画面で通知されます。

日替わりモチベーション引用
-ZenQuotes API から 1 日 1 回ランダムな英語の引用を取得し、日本語訳とあわせて表示。

統合ビュー -カレンダーページ：天気予報（本日～ 2 週間）とタスク一覧を組み合わせて表示し、1 日の予定を直感的に把握できます。

## 使用技術スタック

本アプリケーションは、モダンな Web 開発で広く利用されている以下の技術スタックを用いて構築されています。
分類 技術要素 備考
フロントエンド React 19 UI 構築のための JavaScript ライブラリ
ビルドツール Vite 7 高速な開発体験を提供するビルドツール
スタイリング Tailwind CSS ユーティリティファーストの CSS フレームワーク
ルーティング React Router 宣言的なルーティングを実現
外部 API Open-Meteo 天気予報データ取得
状態永続化 LocalStorage ブラウザストレージを利用したデータ保持

## プロジェクト構成 (Structure)

my-app
--public/ # 画像・音声などの静的ファイル
--src/
----pages/ # Home, Todo, Calendar, Weather 各ページ
----components/ # Header / Footer など共通 UI
----data/ # weathercode・都市データ
----utils/ # 汎用関数（傘アラート判定, テキスト切り詰め）
----App.jsx # ルーティング・状態管理の中枢
----main.jsx # エントリーポイント
--vite.config.js

## 機能詳細と技術的なポイント

### タスク（ToDo）

- `LocalStorage`に自動保存
- 今日のタスク数に応じて表示を切り替え（Home での表示の場合）
  - 0 件 → 「今日はタスクがありません 🎉」
  - 1 件以上 → 「1. タスクのタイトル（〆）」

### 天気機能

- 都市選択・保存（デフォルト：東京）
- 14 日間の天気・最高/最低気温を取得
- weathercode → カスタム表示マップ `mapWeatherCode.js`
- 雨予報の場合、傘アラートを表示可能

### API:

① 　 Weather API 取得について

本アプリでは Open-Meteo API を使用し、選択中の都市の 14 日間の天気予報を取得しています。
初期都市は localStorage に保存されており、ユーザー変更時は自動で永続化されます。

使用 API
https://api.open-meteo.com/v1/forecast
?latitude={lat}
&longitude={lon}
&daily=temperature_2m_max,temperature_2m_min,weathercode
&timezone=Asia/Tokyo
&forecast_days=14

② 　 ZenQuotes（英語の名言取得）

トップページ(Home.jsx)では ZenQuotes API を取得し、
当日の名言をランダム表示しています。

使用 API
https://zenquotes.io/api/quotes ← 全件取得

fetch 例（既存コードと一致）：
const res = await fetch(
"https://api.allorigins.win/raw?url=https://zenquotes.io/api/quotes/"
);

キャッシュ設計
localStorage キー：quoteOfDayCache
毎日 1 回のみ取得（再アクセスはキャッシュ表示）
0 時以降は自動更新

③ 　英語 → 日本語 翻訳 API

名言文は自動的に 日本語へ翻訳されます。
翻訳は /src/pages/Home.jsx 内の translateToJapanese(text) にて実行。

使用 API
https://api.mymemory.translated.net/get?q={text}&langpair=en|ja

キャッシュ設計
localStorage キー：translationCache
毎日 1 回のみ取得（再アクセスはキャッシュ表示）
0 時以降は自動更新

④ 　日本の祝日取得

カレンダーに祝日を明確にするために外部から取得します。

使用 API
https://holidays-jp.github.io/api/v1/date.json

## ルーティングマップ

| 画面        | 説明                                                 |
| ----------- | ---------------------------------------------------- |
| `/`         | 日替りモチベーション引用＋今日の天気＋タスク概要表示 |
| `/todo`     | タスク一覧・追加編集                                 |
| `/calendar` | カレンダーに天気とタスクを一画面に統合               |
| `/weather`  | 都市変更＋天気詳細 14 日分                           |

---

## 実装のポイント（技術的説明）

| 機能             | 実装概要                                  |
| ---------------- | ----------------------------------------- |
| タスク永続化     | `useEffect + localStorage`                |
| 初回マウント判定 | `useRef(hasMounted)`                      |
| 都市保存         | `localStorage.setItem("selectedCity")`    |
| 天気取得         | `fetch + AbortController` で中断安全      |
| 傘アラート       | 雨予報の判定後 `umbrellaAlertActive` 制御 |

---

## ライセンス

本プロジェクトは MIT ライセンス の下で公開されています。 自由にフォーク、改良、利用が可能です。

## credit

本プロジェクトは ChatGPT, Gemini, Claude のサポートを受けて作成しました。

