const OPENAI_URL = 'https://api.openai.com/v1/responses';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answerTemplate: { type: 'string' },
    emptyAnswer: { type: 'string' },
    filters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        neighborhood: { type: 'string' },
        propertyType: { type: 'string' },
        propertyClass: { type: 'string' },
        dealType: { type: 'string' },
        directOnly: { type: 'boolean' },
        priceMin: { type: ['number', 'null'] },
        priceMax: { type: ['number', 'null'] },
        priceTarget: { type: ['number', 'null'] },
        areaMin: { type: ['number', 'null'] },
        areaMax: { type: ['number', 'null'] }
      },
      required: ['neighborhood', 'propertyType', 'propertyClass', 'dealType', 'directOnly', 'priceMin', 'priceMax', 'priceTarget', 'areaMin', 'areaMax']
    }
  },
  required: ['answerTemplate', 'emptyAnswer', 'filters']
};

function buildPrompt(question) {
  return `
أنت مساعد بحث للعروض العقارية الداخلية.
حوّل السؤال التالي إلى فلاتر بحث منظمة.

قواعد مهمة:
- "بحدود مليون" تعني target = 1000000 ونطاقًا تقريبيًا قريبًا، مثل priceMin وpriceMax حولها.
- إذا ذُكر مباشر فقط، directOnly = true.
- إذا لم يُذكر نوع الصفقة بوضوح فاجعل dealType فارغًا.
- أعد JSON فقط.

السؤال:
${question}
`;
}

export async function POST(request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return jsonResponse({ error: 'متغير OPENAI_API_KEY غير موجود.' }, 500);
    const body = await request.json();
    const question = String(body?.question || '').trim();
    if (!question) return jsonResponse({ error: 'السؤال مطلوب.' }, 400);

    const response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: buildPrompt(question),
        text: {
          format: {
            type: 'json_schema',
            name: 'real_estate_search_filters',
            schema,
            strict: true,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return jsonResponse({ error: data?.error?.message || 'فشل فهم السؤال.' }, response.status);
    }

    const raw = data?.output?.[0]?.content?.[0]?.text || data?.output_text;
    const parsed = JSON.parse(raw || '{}');
    return jsonResponse(parsed);
  } catch (error) {
    return jsonResponse({ error: error?.message || 'حدث خطأ أثناء تحليل السؤال.' }, 500);
  }
}
