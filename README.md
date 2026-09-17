# BoatStriker AIレビュー機能 バックエンド セットアップ手順

## これは何か
index.html（BoatStriker本体）から、選んだ買い目とGO判定の根拠をこのサーバーに送ると、
Claude APIが「行く・絞る・見送る」の意見を返してくれる中継サーバーです。
APIキーをブラウザに直接書かずに済むように、この中継が必要です。

判定ロジック（GO/見送りの計算式）自体には一切手を加えていません。

## 手順

### 1. Anthropic APIキーを取得する（未取得の場合）
1. https://platform.claude.com/dashboard を開く（さっき見ていたページです）
2. 左メニューから「API Keys」を選び、「Create Key」
3. 表示されたキー（`sk-ant-...`で始まる文字列）をコピーして控えておく
   ※このキーは二度と全文表示されないので、ここで必ずメモすること

### 2. Vercelアカウントを作る（未取得の場合）
1. https://vercel.com にアクセスし、GitHubアカウントでサインアップ
2. 無料プラン（Hobby）でOK。クレジットカード登録は不要

### 3. このフォルダをGitHubリポジトリにする
このフォルダ（`boatstriker-ai-backend`）を、新しいGitHubリポジトリとして作成してpushしてください。
（既存のBoatStrikerのリポジトリとは別の、新しい小さなリポジトリにするのがおすすめです）

```bash
cd boatstriker-ai-backend
git init
git add .
git commit -m "init"
git remote add origin https://github.com/あなたのユーザー名/boatstriker-ai-backend.git
git push -u origin main
```

### 4. Vercelにデプロイする
1. Vercelのダッシュボードで「Add New... > Project」
2. 上記でpushしたGitHubリポジトリを選択して「Import」
3. そのまま「Deploy」（設定変更は不要）
4. デプロイ完了後、`https://boatstriker-ai-backend-xxxx.vercel.app` のようなURLが発行される
   → この `https://.../api/review` が、次でindex.htmlに設定するエンドポイントURLです

### 5. 環境変数（APIキー）を設定する
1. Vercelのプロジェクトページ > 「Settings」タブ > 「Environment Variables」
2. 以下を追加：
   - Key: `ANTHROPIC_API_KEY`
   - Value: 手順1で控えたキー（`sk-ant-...`）
3. 追加後、「Deployments」タブから最新デプロイを「Redeploy」（環境変数は再デプロイ後に反映されます）

### 6. index.html側の設定
index.html内の `AI_REVIEW_ENDPOINT` という変数に、手順4で発行されたURL＋`/api/review`を設定します。
（Claudeとのチャットで次に用意するindex.htmlの差分に、この設定箇所の説明を含めます）

## 費用について
- Vercel：この規模の使い方であれば無料枠（Hobby）で十分収まります
- Anthropic API：呼び出し1回ごとに従量課金（claude-haiku-4-5を使う設定にしているため、1回あたり数円程度が目安）。
  使いすぎが心配な場合は、platform.claude.com のダッシュボードで使用量アラートを設定できます

## セキュリティに関する注意
- `ALLOWED_ORIGIN` 環境変数を設定すると、index.htmlを公開しているドメイン以外からのアクセスを拒否できます
  （設定しない場合、誰でもこのAPIエンドポイントを叩けてしまい、あなたのAPI利用料がかかる可能性があります）
- 心配な場合は、GitHub Pagesの公開URL（例：`https://ユーザー名.github.io`）を
  `ALLOWED_ORIGIN` に設定することを強く推奨します
