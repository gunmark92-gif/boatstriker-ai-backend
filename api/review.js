// BoatStriker AIレビュー機能 バックエンド（Vercel Serverless Function）
// 役割：ブラウザからAPIキーを見えないようにするための中継のみ。
//       判定ロジック（GO/見送り等）はindex.html側のまま変更なし。
//
// デプロイ後のURL例：https://あなたのプロジェクト名.vercel.app/api/review
//
// 必須の環境変数（Vercelのプロジェクト設定 > Environment Variables で追加）：
//   ANTHROPIC_API_KEY = あなたのAPIキー（platform.claude.com/dashboard で発行）
//
// 任意の環境変数：
//   ALLOWED_ORIGIN = index.htmlを公開しているドメイン（例：https://your-github-username.github.io）
//                    未設定の場合は全オリジンを許可（ひとまず動かす用。絞りたくなったら設定）

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POSTのみ対応しています' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'サーバー側にANTHROPIC_API_KEYが設定されていません' });
    return;
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length > 8000) {
    res.status(400).json({ error: 'promptが不正です（未指定、または8000文字超）' });
    return;
  }

  try {
    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // コスト重視。精度を上げたい場合はclaude-sonnet-5に変更可
        max_tokens: 700,
        system: 'あなたはBoatStrikerという競艇予想アプリの判定を検証する役目です。渡された「基準照合の内訳」と「買い目」を見て、行く・絞る・見送るのどれが妥当かを簡潔に判断してください。断定しすぎず、根拠になっている数値を必ず引用してください。日本語で、300字程度で答えてください。',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      res.status(apiRes.status).json({ error: 'Anthropic APIエラー: ' + errText });
      return;
    }

    const data = await apiRes.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    const advice = textBlock ? textBlock.text : '(応答を取得できませんでした)';

    res.status(200).json({ advice });
  } catch (e) {
    res.status(500).json({ error: 'サーバーエラー: ' + String(e) });
  }
}
