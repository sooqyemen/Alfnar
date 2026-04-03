'use client';

export default function SourceBadge({ item = {} }) {
  const sourceType = item.sourceType || item.source?.sourceType || 'الوارد الذكي';
  const contactName = item.sourceContactName || item.source?.contactName || 'مسوق';
  const contactPhone = item.sourceContactPhone || item.source?.contactPhone || '—';
  const contactRole = item.sourceContactRole || item.source?.contactRole || 'مسوق';

  return (
    <div style={wrapStyle}>
      <div style={titleStyle}>{sourceType}</div>
      <div style={lineStyle}>{contactName}</div>
      <div style={lineStyle}>{contactRole}</div>
      <div style={{ ...lineStyle, direction: 'ltr', textAlign: 'left' }}>{contactPhone}</div>
    </div>
  );
}

const wrapStyle = { display: 'inline-flex', flexDirection: 'column', gap: 4, padding: '10px 12px', border: '1px solid #dbeafe', background: '#eff6ff', borderRadius: 14, minWidth: 140 };
const titleStyle = { fontSize: 12, color: '#1d4ed8' };
const lineStyle = { fontSize: 13, color: '#0f172a' };
