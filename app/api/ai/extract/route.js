const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function buildPrompt(payload) {
  return `
أنت مساعد استخراج عقاري احترافي لمكتب لؤلؤة الفنار العقارية.

المطلوب:
1) اقرأ النص الخام.
2) استخرج كل سجل مهم إلى عنصر مستقل.
3) كل عنصر يكون إما listing أو request أو ignore.
4) إذا وُجد رقم هاتف بدون اسم، اجعل الاسم الافتراضي "مسوق".
5) إذا لم يوجد اسم ولا رقم، أبقِ الصفة "مسوق" والاسم "مسوق" مع ملاحظة أن البيانات ناقصة.
6) لا تخمّن أرقامًا غير موجودة.
7) إذا كان السجل عرضًا، استخرج: title, dealType, propertyType, propertyClass, neighborhood, plan, part, price, area, direct, status, description.
8) إذا كان السجل طلبًا، استخرج: dealType, propertyType, neighborhood, plan, part, budgetMin, budgetMax, areaMin, areaMax, name, phone, note.
9) اجعل الملخص عربيًا وواضحًا.
10) أعد النتيجة فقط في JSON صالح.

بيانات المصدر:
${JSON.stringify(payload.source || {}, null, 2)}

النص الخام:
${payload.rawText || ''}
`;
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    cleanedText: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          recordType: { type: 'string', enum: ['listing', 'request', 'ignore'] },
          extractionStatus: { type: 'string' },
          confidence: { type: 'number' },
          summary: { type: 'string' },
          rawText: { type: 'string' },
          source: {
            type: 'object',
            additionalProperties: false,
            properties: {
              sourceType: { type: 'string' },
              contactName: { type: 'string' },
              contactPhone: { type: 'string' },
              contactRole: { type: 'string' }
            },
            required: ['sourceType', 'contactName', 'contactPhone', 'contactRole']
          },
          listing: {
            type: ['object', 'null'],
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              dealType: { type: 'string' },
              propertyType: { type: 'string' },
              propertyClass: { type: 'string' },
              neighborhood: { type: 'string' },
              plan: { type: 'string' },
              part: { type: 'string' },
              price: { type: ['number', 'null'] },
              area: { type: ['number', 'null'] },
              direct: { type: 'boolean' },
              status: { type: 'string' },
              description: { type: 'string' }
            },
            required: ['title', 'dealType', 'propertyType', 'propertyClass', 'neighborhood', 'plan', 'part', 'price', 'area', 'direct', 'status', 'description']
          },
          request: {
            type: ['object', 'null'],
            additionalProperties: false,
            properties: {
              dealType: { type: 'string' },
              propertyType: { type: 'string' },
              neighborhood: { type: 'string' },
              plan: { type: 'string' },
              part: { type: 'string' },
              budgetMin: { type: ['number', 'null'] },
              budgetMax: { type: ['number', 'null'] },
              areaMin: { type: ['number', 'null'] },
              areaMax: { type: ['number', 'null'] },
              name: { type: 'string' },
              phone: { type: 'string' },
              note: { type: 'string' }
            },
            required: ['dealType', 'propertyType', 'neighborhood', 'plan', 'part', 'budgetMin', 'budgetMax', 'areaMin', 'areaMax', 'name', 'phone', 'note']
          }
        },
        required: ['recordType', 'extractionStatus', 'confidence', 'summary', 'rawText', 'source', 'listing', 'request']
      }
    }
  },
  required: ['summary', 'cleanedText', 'items']
};

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: 'متغير OPENAI_API_KEY غير موجود في الخادم.' }, 500);
    }

    const payload = await request.json();
    if (!String(payload?.rawText || '').trim()) {
      return jsonResponse({ error: 'النص الخام مطلوب للتحليل.' }, 400);
    }

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: buildPrompt(payload),
        text: {
          format: {
            type: 'json_schema',
            name: 'real_estate_inbox_extract',
            schema,
            strict: true,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return jsonResponse({ error: data?.error?.message || 'فشل الاتصال بـ OpenAI.' }, response.status);
    }

    const raw = data?.output?.[0]?.content?.[0]?.text || data?.output_text;
    const parsed = JSON.parse(raw || '{}');
    return jsonResponse(parsed);
  } catch (error) {
    return jsonResponse({ error: error?.message || 'حدث خطأ أثناء التحليل.' }, 500);
  }
}
