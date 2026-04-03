export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeArabicDigits(value) {
  const map = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };
  return String(value || '').replace(/[٠-٩]/g, (d) => map[d] || d);
}

export function normalizeSaudiPhone(value) {
  const digits = digitsOnly(normalizeArabicDigits(value));
  if (!digits) return '';
  if (digits.startsWith('00966') && digits.length >= 14) return `0${digits.slice(5, 14)}`;
  if (digits.startsWith('966') && digits.length >= 12) return `0${digits.slice(3, 12)}`;
  if (digits.startsWith('05') && digits.length >= 10) return digits.slice(0, 10);
  if (digits.startsWith('5') && digits.length >= 9) return `0${digits.slice(0, 9)}`;
  return digits;
}

export function maskPhone(phone) {
  const normalized = normalizeSaudiPhone(phone);
  if (!normalized) return '';
  const head = normalized.slice(0, 4);
  const tail = normalized.slice(-3);
  return `${head}${'*'.repeat(Math.max(normalized.length - 7, 0))}${tail}`;
}

export function getDefaultContactName(name, phone) {
  const cleanName = String(name || '').trim();
  const cleanPhone = normalizeSaudiPhone(phone);
  if (cleanName) return cleanName;
  if (cleanPhone) return `مسوق - ${maskPhone(cleanPhone)}`;
  return 'مسوق';
}

export function getDefaultContactRole(role) {
  const cleanRole = String(role || '').trim();
  return cleanRole || 'مسوق';
}

export function buildSourceSummary(source = {}) {
  const parts = [];
  if (source.sourceType) parts.push(source.sourceType);
  if (source.contactName) parts.push(source.contactName);
  if (source.contactRole) parts.push(source.contactRole);
  if (source.contactPhone) parts.push(source.contactPhone);
  return parts.filter(Boolean).join(' — ');
}

export function ensureSourceContact(source = {}) {
  const phone = normalizeSaudiPhone(source.contactPhone || '');
  const name = getDefaultContactName(source.contactName || '', phone);
  const role = getDefaultContactRole(source.contactRole || '');
  return {
    ...source,
    contactPhone: phone,
    contactName: name,
    contactRole: role,
    sourceType: String(source.sourceType || '').trim() || 'الوارد الذكي',
  };
}
