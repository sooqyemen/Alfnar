export function formatPriceSAR(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${n.toLocaleString('ar-SA')} ر.س`;
  }
}

export function statusBadge(status) {
  const s = String(status || 'available');
  if (s === 'sold') return <span className="badge sold">مباع</span>;
  if (s === 'reserved') return <span className="badge warn">محجوز</span>;
  if (s === 'canceled') return <span className="badge">ملغي</span>;
  return <span className="badge ok">متاح</span>;
}
