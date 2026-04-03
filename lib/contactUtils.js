export function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function normalizeSaudiPhone(value) {
  const digits = digitsOnly(value);
  if (!digits) return '';
  if (digits.startsWith('966') && digits.length >= 12) return `0${digits.slice(3, 12)}`;
  if (digits.startsWith('00966') && digits.length >= 14) return `0${digits.slice(5, 14)}`;
  if (digits.startsWith('05') && digits.length === 10) return digits;
  if (digits.startsWith('5') && digits.length === 9) return `0${digits}`;
  return digits;
}

export function getDefaultContactName(name, phone) {
  const cleanName = String(name || '').trim();
  const cleanPhone = normalizeSaudiPhone(phone);
  if (cleanName) return cleanName;
  if (cleanPhone) {
    const masked = `${cleanPhone.slice(0, 4)}${'*'.repeat(Math.max(cleanPhone.length - 7, 0))}${cleanPhone.slice(-3)}`;
    return `مسوق - ${masked}`;
  }
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
  return parts.join(' — ');
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
  };
}
