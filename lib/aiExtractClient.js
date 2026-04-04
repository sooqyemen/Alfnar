export async function analyzeInboxInput(payload) {
  const res = await fetch('/api/ai/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'تعذر تحليل المحتوى.');
  }
  return data;
}

export async function analyzeSearchQuestion(payload) {
  const res = await fetch('/api/ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'تعذر فهم السؤال.');
  }
  return data;
}
