export function extractSearchFilters(question = '') {
  const text = String(question || '').trim();
  const normalized = text.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  const filters = {};

  if (/ارض|أرض/.test(text)) filters.propertyType = 'أرض';
  else if (/فيلا|فله|فله/.test(text)) filters.propertyType = 'فيلا';
  else if (/شقة|شقق/.test(text)) filters.propertyType = 'شقة';
  else if (/عمارة|عماره/.test(text)) filters.propertyType = 'عمارة';

  if (/سكني/.test(text)) filters.propertyClass = 'residential';
  if (/تجاري/.test(text)) filters.propertyClass = 'commercial';
  if (/ايجار|إيجار|سنوي/.test(text)) filters.dealType = 'rent';
  if (/بيع|للبيع/.test(text)) filters.dealType = 'sale';
  if (/مباشر/.test(text)) filters.directOnly = true;

  const moneyMatch = normalized.match(/(\d{3,7})\s*(?:الف|ألف|الفًا|الفا|مليون)?/i);
  if (moneyMatch) {
    const raw = Number(moneyMatch[1]);
    const isMillion = /مليون/.test(text);
    const target = isMillion ? raw * 1000000 : /الف|ألف/.test(text) ? raw * 1000 : raw;
    if (target > 0) {
      filters.priceMin = Math.round(target * 0.85);
      filters.priceMax = Math.round(target * 1.15);
    }
  }

  const knownNeighborhoods = [
    'الياقوت', 'الشراع', 'الصواري', 'اللؤلؤ', 'اللؤلؤة', 'الزمرد', 'الفنار', 'الشويصي',
    'أبحر الشمالية', 'البحيرات', 'الخليج', 'جوهرة العروس', 'الدرة', 'النجمة', 'اليسر',
  ];
  const neighborhood = knownNeighborhoods.find((item) => text.includes(item));
  if (neighborhood) filters.neighborhood = neighborhood;

  const partMatch = text.match(/\b([12][^\s،,.]{0,2})\b/u);
  if (partMatch) filters.part = partMatch[1];

  return filters;
}
