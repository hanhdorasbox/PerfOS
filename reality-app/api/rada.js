// ─── Vercel serverless funkce: proxy na Claude API ──────────────────────────
// Klíč ANTHROPIC_API_KEY čte z prostředí serveru (Vercel → Settings → Env Vars),
// takže se nikdy nedostane do prohlížeče. Frontend volá jen /api/rada.
//
// Nasazení: soubor stačí mít v reality-app/api/ — Vercel ho automaticky spustí
// jako serverless funkci na cestě /api/rada (žádný build ani package.json).

const MODEL = 'claude-opus-4-8';
const MAX_TOKENS = 800;

const SYSTEMS = {
  komentar: {
    cs: 'Jsi zkušený český investiční poradce pro nemovitosti. Dostaneš spočítané parametry a metriky jedné konkrétní nemovitosti. Napiš stručné zhodnocení (3–5 vět, česky): co je na tom dobré, co je riziko, na co je to citlivé (úrok, neobsazenost, cena) a jestli za daných předpokladů dává investice smysl. Buď konkrétní, žádné omáčky. Nejde o závazné investiční doporučení — mluv o scénáři a předpokladech.',
    vi: 'Bạn là cố vấn đầu tư bất động sản dày dạn tại Séc. Bạn nhận các thông số và chỉ số đã tính của một bất động sản cụ thể. Viết đánh giá ngắn gọn (3–5 câu, tiếng Việt): điểm tốt, rủi ro, độ nhạy (lãi suất, tỷ lệ trống, giá) và liệu khoản đầu tư có hợp lý với các giả định này không. Cụ thể, không lan man. Đây không phải lời khuyên đầu tư ràng buộc — hãy nói về kịch bản và giả định.',
  },
  odhad: {
    cs: 'Jsi realitní odhadce pro český trh. Z popisu nemovitosti odhadni obvyklý měsíční nájem a kupní cenu — vždy jako rozsah (od–do) a stručně zdůvodni (lokalita, dispozice, stav). Uveď, že jde o hrubý orientační odhad bez znalosti konkrétní nabídky. Odpovídej česky, stručně.',
    vi: 'Bạn là chuyên gia định giá bất động sản cho thị trường Séc. Từ mô tả, hãy ước tính tiền thuê hàng tháng và giá mua thông thường — luôn dưới dạng khoảng (từ–đến) và giải thích ngắn gọn (khu vực, bố cục, tình trạng). Nêu rõ đây là ước tính sơ bộ, không biết tin rao cụ thể. Trả lời bằng tiếng Việt, ngắn gọn.',
  },
  chat: {
    cs: 'Jsi realitní investiční poradce. Uživatel počítá výhodnost investice do nemovitosti a dostal jsi kontext jeho analýzy. Odpovídej stručně, věcně a česky. Když se ptá na „co když“ scénáře, vysvětli dopad na cash flow, výnos nebo návratnost. Nejde o závazné investiční doporučení.',
    vi: 'Bạn là cố vấn đầu tư bất động sản. Người dùng đang tính hiệu quả đầu tư và bạn có bối cảnh phân tích của họ. Trả lời ngắn gọn, đúng trọng tâm, bằng tiếng Việt. Khi hỏi kịch bản „nếu như“, hãy giải thích tác động đến dòng tiền, lợi suất hoặc thời gian hoàn vốn. Đây không phải lời khuyên đầu tư ràng buộc.',
  },
};

const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY není nastavený na serveru (Vercel → Settings → Environment Variables).' });
    return;
  }

  try {
    const body = await readJson(req);
    const lang = body.lang === 'vi' ? 'vi' : 'cs';
    const mode = ['komentar', 'odhad', 'chat'].includes(body.mode) ? body.mode : 'chat';
    const system = SYSTEMS[mode][lang];

    let messages;
    if (mode === 'chat') {
      const hist = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
      const ack = lang === 'vi' ? 'Đã rõ bối cảnh. Bạn hỏi gì?' : 'Rozumím kontextu. Na co se chceš zeptat?';
      messages = [
        { role: 'user', content: `${lang === 'vi' ? 'Bối cảnh phân tích' : 'Kontext analýzy'}:\n${clip(body.context, 4000)}` },
        { role: 'assistant', content: ack },
        ...hist
          .filter((m) => m && m.content)
          .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: clip(m.content, 2000) })),
      ];
    } else if (mode === 'odhad') {
      messages = [{ role: 'user', content: `${lang === 'vi' ? 'Mô tả bất động sản' : 'Popis nemovitosti'}:\n${clip(body.description, 2000)}` }];
    } else {
      messages = [{ role: 'user', content: `${lang === 'vi' ? 'Dữ liệu phân tích' : 'Data analýzy'}:\n${clip(body.context, 4000)}` }];
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: MAX_TOKENS, system, messages }),
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'Chyba Claude API' });
      return;
    }
    const text = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Chyba serveru' });
  }
}

// Přečte JSON tělo requestu (Vercel ho někdy předparsuje, jindy ne).
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
