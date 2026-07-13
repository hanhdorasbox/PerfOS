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

const EXTRACT_SYSTEM = {
  cs: 'Z inzerátu nemovitosti (obrázek nebo text) vytěž údaje pro investiční kalkulačku. Odpověz POUZE JSON objektem, bez markdownu a bez komentářů, s klíči:\n- title: string|null (stručný název, např. „Byt 2+kk, Brno-Žabovřesky")\n- address: string|null\n- purchasePrice: number|null (kupní cena v Kč, celé číslo)\n- acquisitionCosts: number|null (provize RK v Kč, jen pokud je uvedena)\n- hoaMonthly: number|null (měsíční poplatky – SVJ, fond oprav, správa – v Kč)\n- monthlyRent: number|null (obvyklý měsíční nájem v Kč)\n- rentEstimated: boolean (true, pokud jsi nájem odhadl, protože nebyl v inzerátu)\n- area: number|null (plocha v m²)\n- note: string|null (jedna krátká věta česky: co bylo v inzerátu a co jsi odhadl)\nČísla piš bez mezer a bez měny. Když obvyklý měsíční nájem není uveden (běžné u prodeje), odhadni ho z lokality a plochy a nastav rentEstimated=true. Neznámé hodnoty = null.',
  vi: 'Từ tin rao bất động sản (ảnh hoặc văn bản), trích xuất dữ liệu cho công cụ tính đầu tư. CHỈ trả lời bằng một đối tượng JSON, không markdown, không chú thích, với các khóa:\n- title: string|null\n- address: string|null\n- purchasePrice: number|null (giá mua bằng Kč, số nguyên)\n- acquisitionCosts: number|null (phí môi giới bằng Kč, nếu có)\n- hoaMonthly: number|null (phí hàng tháng – quản lý, quỹ sửa chữa – bằng Kč)\n- monthlyRent: number|null (tiền thuê hàng tháng thông thường bằng Kč)\n- rentEstimated: boolean (true nếu bạn ước tính tiền thuê vì tin rao không nêu)\n- area: number|null (diện tích m²)\n- note: string|null (một câu ngắn tiếng Việt: có gì trong tin rao và bạn ước tính gì)\nViết số không có dấu cách, không có tiền tệ. Nếu tin rao không nêu tiền thuê (thường gặp khi bán), hãy ước tính từ khu vực và diện tích rồi đặt rentEstimated=true. Giá trị chưa biết = null.',
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
    const mode = ['komentar', 'odhad', 'chat', 'extract'].includes(body.mode) ? body.mode : 'chat';
    const system = mode === 'extract' ? EXTRACT_SYSTEM[lang] : SYSTEMS[mode][lang];

    let messages;
    if (mode === 'extract') {
      if (body.image) {
        messages = [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: body.mediaType || 'image/jpeg', data: body.image } },
          { type: 'text', text: lang === 'vi' ? 'Trích xuất dữ liệu từ tin rao này.' : 'Vytěž údaje z tohoto inzerátu nemovitosti.' },
        ] }];
      } else if (body.url) {
        const page = await fetchPageText(body.url);
        if (!page) {
          res.status(400).json({ error: lang === 'vi' ? 'Không tải được trang (có thể bị chặn). Hãy thử ảnh chụp màn hình.' : 'Nepodařilo se načíst stránku (možná ji web blokuje). Zkus screenshot.' });
          return;
        }
        messages = [{ role: 'user', content: `${lang === 'vi' ? 'Nguồn' : 'Zdroj'}: ${clip(body.url, 300)}\n\n${clip(page, 8000)}` }];
      } else {
        res.status(400).json({ error: 'Chybí image nebo url.' });
        return;
      }
    } else if (mode === 'chat') {
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
    if (mode === 'extract') {
      res.status(200).json({ text, fields: parseFields(text) });
      return;
    }
    res.status(200).json({ text });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Chyba serveru' });
  }
}

// Z odpovědi Claude vytáhne JSON objekt (i kdyby kolem něj byl text).
function parseFields(text) {
  try {
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s < 0 || e < 0) return {};
    return JSON.parse(text.slice(s, e + 1));
  } catch { return {}; }
}

// Načte text stránky inzerátu (best-effort): meta tagy + JSON-LD + viditelný text.
async function fetchPageText(url) {
  try {
    if (!/^https?:\/\//i.test(url)) return '';
    const host = new URL(url).hostname.toLowerCase();
    if (/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|::1)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) return '';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; RealityCalc/1.0)', 'accept-language': 'cs,en;q=0.8' },
    });
    clearTimeout(timer);
    const html = await r.text();
    const ld = (html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) || [])
      .map((s) => s.replace(/<[^>]+>/g, '')).join('\n');
    const metas = (html.match(/<meta[^>]+(?:og:title|og:description|name=["']description["'])[^>]*>/gi) || [])
      .map((m) => (m.match(/content=["']([^"']+)["']/i) || [])[1] || '').join('\n');
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return [metas, ld, bodyText].filter(Boolean).join('\n').slice(0, 12000);
  } catch { return ''; }
}

// Přečte JSON tělo requestu (Vercel ho někdy předparsuje, jindy ne).
async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}
