'use client';

import { formatPriceSAR } from '@/lib/format';
import SourceBadge from './SourceBadge';

export default function SearchAnswerCard({ answer, results = [] }) {
  return (
    <div style={cardStyle}>
      <h3 style={{ marginTop: 0, color: '#0f172a' }}>نتيجة البحث</h3>
      <p style={answerStyle}>{answer || '—'}</p>
      <div style={{ display: 'grid', gap: 14 }}>
        {results.length ? results.map((item) => (
          <div key={item.id} style={resultStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={titleStyle}>{item.title || 'عرض عقاري'}</div>
                <div style={mutedStyle}>{[item.neighborhood, item.plan, item.part].filter(Boolean).join(' — ') || 'بدون موقع واضح'}</div>
              </div>
              <SourceBadge item={item} />
            </div>
            <div style={gridStyle}>
              <Info label="النوع" value={item.propertyType || '—'} />
              <Info label="التصنيف" value={item.propertyClass || '—'} />
              <Info label="السعر" value={item.price ? formatPriceSAR(item.price) : '—'} />
              <Info label="المساحة" value={item.area ? `${item.area} م²` : '—'} />
              <Info label="مباشر" value={item.direct ? 'نعم' : 'لا'} />
              <Info label="الوصف" value={item.description || '—'} />
            </div>
          </div>
        )) : <div style={mutedStyle}>لا توجد نتائج مطابقة بعد.</div>}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return <div style={infoStyle}><div style={infoLabelStyle}>{label}</div><div style={infoValueStyle}>{value}</div></div>;
}

const cardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const answerStyle = { color: '#334155', lineHeight: 1.9, marginBottom: 16 };
const resultStyle = { border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, background: '#fcfcfd' };
const titleStyle = { fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 4 };
const mutedStyle = { color: '#64748b', lineHeight: 1.8 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginTop: 14 };
const infoStyle = { borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb', padding: 12 };
const infoLabelStyle = { color: '#64748b', fontSize: 12, marginBottom: 6 };
const infoValueStyle = { color: '#0f172a' };
