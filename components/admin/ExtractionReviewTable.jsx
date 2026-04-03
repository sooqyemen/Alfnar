'use client';

import { useState } from 'react';
import { formatPriceSAR } from '@/lib/format';

export default function ExtractionReviewTable({ items = [], onApprove }) {
  const [savingIndex, setSavingIndex] = useState(-1);
  const [message, setMessage] = useState('');

  async function handleApprove(item, index) {
    setSavingIndex(index);
    setMessage('');
    try {
      await onApprove?.(item);
      setMessage('تم حفظ العنصر المعتمد بنجاح.');
    } catch (err) {
      setMessage(err?.message || 'تعذر اعتماد العنصر.');
    } finally {
      setSavingIndex(-1);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <h3 style={{ margin: 0, color: '#0f172a' }}>نتائج الاستخراج للمراجعة</h3>
        <div style={mutedStyle}>راجع القيم قبل اعتمادها في قاعدة البيانات.</div>
      </div>
      {message ? <div style={noticeStyle}>{message}</div> : null}
      <div style={{ display: 'grid', gap: 14 }}>
        {items.length ? items.map((item, index) => {
          const listing = item.listing || {};
          const request = item.request || {};
          const isRequest = item.recordType === 'request';
          return (
            <div key={`${item.recordType}-${index}`} style={rowStyle}>
              <div style={metaStyle}>
                <div style={pillStyle}>{isRequest ? 'طلب' : 'عرض'}</div>
                <div style={pillStyle}>ثقة {Math.round(Number(item.confidence || 0) * 100)}%</div>
              </div>
              <div style={summaryStyle}>{item.summary || 'بدون ملخص'}</div>
              <div style={gridStyle}>
                {!isRequest ? (
                  <>
                    <Info label="نوع العقار" value={listing.propertyType} />
                    <Info label="الصفقة" value={listing.dealType} />
                    <Info label="الحي" value={listing.neighborhood} />
                    <Info label="السعر" value={listing.price ? formatPriceSAR(listing.price) : '—'} />
                    <Info label="المساحة" value={listing.area ? `${listing.area} م²` : '—'} />
                    <Info label="المصدر" value={`${item.source?.contactName || 'مسوق'} — ${item.source?.contactPhone || '—'}`} />
                  </>
                ) : (
                  <>
                    <Info label="نوع الطلب" value={request.propertyType} />
                    <Info label="الصفقة" value={request.dealType} />
                    <Info label="الحي" value={request.neighborhood} />
                    <Info label="الميزانية" value={request.budgetMax ? formatPriceSAR(request.budgetMax) : '—'} />
                    <Info label="العميل" value={request.name || item.source?.contactName || 'مسوق'} />
                    <Info label="الجوال" value={request.phone || item.source?.contactPhone || '—'} />
                  </>
                )}
              </div>
              <details style={detailsStyle}>
                <summary>عرض النص الأصلي</summary>
                <pre style={preStyle}>{item.rawText || '—'}</pre>
              </details>
              <button type="button" style={buttonStyle} disabled={savingIndex === index} onClick={() => handleApprove(item, index)}>
                {savingIndex === index ? 'جاري الاعتماد...' : isRequest ? 'اعتماد الطلب' : 'اعتماد العرض'}
              </button>
            </div>
          );
        }) : (
          <div style={emptyStyle}>لا توجد نتائج بعد. ابدأ بتحليل رسالة أو ملف محادثة.</div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div style={infoStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value || '—'}</div>
    </div>
  );
}

const cardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 16 };
const mutedStyle = { color: '#64748b' };
const noticeStyle = { padding: 12, background: '#ecfccb', color: '#365314', borderRadius: 12, marginBottom: 12 };
const rowStyle = { padding: 16, border: '1px solid #e5e7eb', borderRadius: 16, background: '#fcfcfd' };
const metaStyle = { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 };
const pillStyle = { padding: '6px 10px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 12 };
const summaryStyle = { fontWeight: 600, color: '#0f172a', marginBottom: 14, lineHeight: 1.8 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 };
const infoStyle = { padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb' };
const infoLabelStyle = { fontSize: 12, color: '#64748b', marginBottom: 6 };
const infoValueStyle = { color: '#0f172a' };
const detailsStyle = { marginTop: 12 };
const preStyle = { whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid #e5e7eb', fontFamily: 'inherit', lineHeight: 1.8 };
const buttonStyle = { marginTop: 14, padding: '11px 14px', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' };
const emptyStyle = { padding: 20, textAlign: 'center', color: '#64748b' };
