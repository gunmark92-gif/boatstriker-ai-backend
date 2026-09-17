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

// ============================================================
// 過去の検証で分かっている実績（2026/9/17時点）
// ここは新しい検証結果が出るたびに手で更新する想定の「知識ベース」。
// これがないと、AIは「今の数値」だけ見て一般論を喋るだけになり、
// これまでBoatStrikerで積み上げてきた検証結果を活かせない。
// ============================================================
const KNOWLEDGE_BASE_SYSTEM_PROMPT = `あなたはBoatStrikerという競艇予想アプリの「1号艇総流し」戦略の判定をレビューする役目です。
渡された「基準照合の内訳」「買い目」「参考：過去実績」を見て、行く・絞る・見送るのどれが妥当かを判断してください。

# 判断のルール
- 画面に表示されている数値をただ言い換えるだけの回答は禁止。必ずプロンプト内の「参考：過去実績」セクション（この端末のデータからその場で計算された最新の実績）と照らし合わせて、今回のパターンが過去どうだったかを踏まえて判断すること
- 「参考：過去実績」が「データ不足のため計算できませんでした」となっている場合のみ、下記の「一般的な傾向（2026/9/17時点の参考値、古くなっている可能性あり）」を代わりに使うこと。両方ある場合は必ずプロンプト内の実績を優先する
- 断定しすぎず、根拠になっている数値・過去実績を必ず引用すること
- 日本語で300字程度

# 一般的な傾向（2026/9/17時点の参考値、古くなっている可能性あり。プロンプト内に「参考：過去実績」があればそちらを優先）
- goodItems4個以上のGOは1号艇1着率56.1%、goodItems3個+補助2個のGO(弱いパターン)は40.0%程度だった
- 逃げシミュは60%未満でも1号艇1着率38.5%程度はあり、「基準未達＝ほぼ来ない」ではない。20%台以下は特に危険
- 警戒スコア(areScore)・対抗馬チェック(voteCheck)は判定に反映されない参考表示。voteCheckが1号艇と割れるのは94.4%と通常運転

# 出力形式
「判定：」に続けて一言の結論、その後に根拠（今回の数値＋過去実績との対比）を箇条書きで2〜4個、最後に一言まとめ。`;

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
        system: KNOWLEDGE_BASE_SYSTEM_PROMPT,
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
