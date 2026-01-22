## Productivity++ (React + Firebase + Weather API)

**[ライブデモはこちら (Live Demo)](https://prod-plus-advance.vercel.app)**

モダンな技術スタックを用いた、タスク管理・天気予報・マインドフルネスを統合した生産性向上ツールです。
単なるToDoアプリではなく、ユーザーの状況（天気やメンタル）に合わせた動的なUI/UXを提供します。

## アップデートの目玉 (v2.0)

LocalStorage から Firebase への完全移行: データの永続化とマルチデバイス同期を実現。
Firebase Authentication: メール認証、パスワードリセット、セッション管理の実装。
マインドフルネス機能: 集中タイマーと、休憩用のミニゲーム（Canvas/タイピング）を搭載。

## 使用技術スタック分類技術要素

Frontend: React 19, Vite 7, Tailwind CSS
Backend / BaaS: Firebase (Firestore, Authentication)
State Management: Context API (AuthContext, ThemeContext)
Libraries: React Router, date-fns, Lucide React, opentype.js
External APIs: Open-Meteo, ZenQuotes, MyMemory Translation, DiceBear (Avatar), Datamuse

## 主要機能

1. インテリジェント・ホームFirebase-backed Daily Quote: useDailyQuoteフックにより、Firestoreと同期された「今日の名言」を全ユーザーに一貫して表示。傘アラート: 天気予報とタスクの内容を照合し、雨天時の外出予定がある場合にアラート音（SE）と共に通知。
2. タスク & カレンダー統合Firestore CRUD: タスクの追加、編集、削除、完了フラグをリアルタイムにDB保存。ハイブリッドビュー: カレンダー上で天気予報とスケジュールを同時に確認可能。
3. Focus & Mindfulness (休憩の科学)FocusWidget: ポモドーロ・タイマーに基づいた集中時間の管理。休憩用ゲーム:TracingGame: opentype.js を使用した文字なぞり書き（リラックス・発想転換用）。WordGame: Datamuse API を活用した連想語タイピングゲーム（集中力の維持）。
4. ユーザー体験レスポンシブデザイン: PC/スマホ両対応。テーマ切替: ダークモード/ライトモード対応。アバター生成: DiceBear API を利用したユニークなユーザーアイコンの自動生成。

## プロジェクト構成 (Structure)

src/
├── components/ # AvatarGenerator, FocusWidget (Games), Spinner 等
├── contexts/ # AuthContext, ThemeContext (Global State)
├── firebase/ # Firebase 初期化・環境変数設定
├── hooks/ # useDailyQuote, useMidnight, useTaskActions
├── pages/
│ ├── Auth/ # Login, Register, Email Verification
│ ├── Home/ # Dashboard (Quote + Weather + Tasks)
│ ├── Todo/ # Task Management
│ ├── Calendar/ # Integrated Schedule
│ └── Settings/ # Account & Profile Management
├── utils/ # 傘アラート判定ロジック等
└── data/ # 都市・天気コード定数

## セキュリティと実装のポイント

Firebase Security Rules: ユーザーごとのデータ隔離（自分のタスクのみ読み書き可能）。
認証ガード: ProtectedRoute による未認証ユーザーのアクセス制限。
環境変数の秘匿: API Key等は Vite の環境変数を利用し、GitHubには公開しない設計。
クリーンアップ設計: useMidnight カスタムフックにより、ブラウザを閉じている間の日付変更にも追従。

## セットアップ (Local Development)

リポジトリをクローン > .env ファイルを作成し、Firebase の認証情報を入力 > npm install >npm run dev

## ライセンス

MIT License

## credit

本プロジェクトは ChatGPT, Gemini, Claude のサポートを受けて作成しました。
