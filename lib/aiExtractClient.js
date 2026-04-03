async function parseResponseSafely(res) {
  const text = await res.text();
  try {
    return { data: JSON.parse(text), rawText: text };
  } catch {
    return { data: null, rawText: text };
  }
}

function isWhatsAppHeader(line) {
  const clean = String(line || '').trim();
  return /^(?:\[)?\s*[\u200e\u200f\u202a-\u202e\ufeff]*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\s*[،,]?\s*\d{1,2}:\d{2}(?::\d{2})?/.test(clean);
}

function splitLargeText(rawText, maxChars = 180000) {
  const text = String(rawText || '');
  if (text.length <= maxChars) return [text];

  const lines = text.split(/\r?\n/);
  const chunks = [];
  let current = [];
  let currentLen = 0;

  for (const line of lines) {
    const lineLen = line.length + 1;
    const wouldOverflow = currentLen + lineLen > maxChars;
    const header = isWhatsAppHeader(line);

    if (wouldOverflow && current.length) {
      chunks.push(current.join('\n'));
      current = [];
      currentLen = 0;
    }

    if (header && currentLen > maxChars * 0.85) {
      chunks.push(current.join('\n'));
      current = [];
      currentLen = 0;
    }

    current.push(line);
    currentLen += lineLen;
  }

  if (current.length) chunks.push(current.join('\n'));
  return chunks.filter(Boolean);
}

function mergeStats(results) {
  return results.reduce(
    (acc, item) => {
      const s = item?.stats || {};
      acc.totalGroups += Number(s.totalGroups || 0);
      acc.autoSavedCount += Number(s.autoSavedCount || 0);
      acc.reviewCount += Number(s.reviewCount || 0);
      acc.ignoredCount += Number(s.ignoredCount || 0);
      return acc;
    },
    { totalGroups: 0, autoSavedCount: 0, reviewCount: 0, ignoredCount: 0 }
  );
}

export async function analyzeInboxInput(payload) {
  const rawText = String(payload?.rawText || '');
  const chunks = splitLargeText(rawText);

  const results = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const chunkPayload = {
      ...payload,
      rawText: chunks[i],
      chunkIndex: i,
      chunkCount: chunks.length,
    };

    const res = await fetch('/api/ai/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunkPayload),
    });

    const { data, rawText: responseText } = await parseResponseSafely(res);

    if (!res.ok) {
      const fallback = responseText?.startsWith('Request Entity Too Large')
        ? 'حجم المحادثة كبير جدًا للإرسال دفعة واحدة. تم تفعيل التجزئة، لكن ما زال أحد الأجزاء كبيرًا. جرّب ملفًا أصغر أو أرسل المحادثة على دفعات.'
        : `تعذر تحليل المحتوى. ${responseText || ''}`.trim();
      throw new Error(data?.error || fallback);
    }

    if (!data) {
      throw new Error('الخادم أعاد استجابة غير مفهومة بدل JSON.');
    }

    results.push(data);
  }

  if (results.length === 1) return results[0];

  const items = results.flatMap((r) => r?.items || []);
  const stats = mergeStats(results);
  const parsedText = results.map((r) => r?.parsedText || '').filter(Boolean).join('\n\n');
  const summary = `تم تحليل ${chunks.length} أجزاء من المحادثة: ${stats.totalGroups} مقطع، محفوظ تلقائيًا ${stats.autoSavedCount}، للمراجعة ${stats.reviewCount}، متجاهل ${stats.ignoredCount}.`;

  return { items, stats, parsedText, summary };
}

export async function analyzeSearchQuestion(payload) {
  const res = await fetch('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const { data, rawText } = await parseResponseSafely(res);
  if (!res.ok) {
    throw new Error(data?.error || rawText || 'تعذر فهم السؤال.');
  }
  if (!data) {
    throw new Error('الخادم أعاد استجابة غير مفهومة بدل JSON.');
  }
  return data;
}
