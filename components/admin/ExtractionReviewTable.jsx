'use client';

import { useEffect, useMemo, useState } from 'react';
import { formatPriceSAR } from '@/lib/format';

const FILTERS = [
  { value: 'all', label: 'الكل' },
  { value: 'needs_review', label: 'للمراجعة' },
  { value: 'auto_saved', label: 'تم حفظه' },
  { value: 'possible_duplicate', label: 'مكرر محتمل' },
  { value: 'ignored', label: 'متجاهل' },
];

export default function ExtractionReviewTable({ items = [], onApprove, onIgnore, onDelete, onBulkDelete, onRefresh }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return items;
    return items.filter((item) => String(item.extractionStatus || '') === activeFilter);
  }, [activeFilter, items]);

  const filteredIds = useMemo(() => filtered.map((item) => item.id).filter(Boolean), [filtered]);
  const selectedInFilter = useMemo(() => selectedIds.filter((id) => filteredIds.includes(id)), [selectedIds, filteredIds]);
  const allInFilterSelected = filteredIds.length > 0 && selectedInFilter.length === filteredIds.length;

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((item) => item.id === id)));
  }, [items]);

  async function handleApprove(item) {
    setBusyId(item.id || item.summary);
    setMessage('');
    try {
      await onApprove?.(item);
      setMessage('تم اعتماد العنصر بنجاح.');
      onRefresh?.();
    } catch (err) {
      setMessage(err?.message || 'تعذر اعتماد العنصر.');
    } finally {
      setBusyId('');
    }
  }

  async function handleIgnore(item) {
    setBusyId(item.id || item.summary);
    setMessage('');
    try {
      await onIgnore?.(item);
      setMessage('تم نقل العنصر إلى المتجاهل.');
      onRefresh?.();
    } catch (err) {
      setMessage(err?.message || 'تعذر تحديث حالة العنصر.');
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete(item) {
    setBusyId(item.id || item.summary);
    setMessage('');
    try {
      await onDelete?.(item);
      setSelectedIds((current) => current.filter((id) => id !== item.id));
      setMessage('تم حذف العنصر نهائيًا.');
      onRefresh?.();
    } catch (err) {
      setMessage(err?.message || 'تعذر حذف العنصر. تأكد من صلاحيات Firestore.');
    } finally {
      setBusyId('');
    }
  }

  async function handleBulkDelete() {
    const selectedItems = filtered.filter((item) => selectedIds.includes(item.id));
    if (!selectedItems.length) {
      setMessage('حدد عنصرًا واحدًا على الأقل قبل الحذف.');
      return;
    }

    setBusyId('__bulk_delete__');
    setMessage('');
    try {
      if (onBulkDelete) {
        await onBulkDelete(selectedItems);
      } else {
        for (const item of selectedItems) {
          await onDelete?.(item);
        }
      }
      setSelectedIds([]);
      setMessage(`تم حذف ${selectedItems.length} عنصر${selectedItems.length > 1 ? 'ًا' : ''} نهائيًا.`);
      onRefresh?.();
    } catch (err) {
      setMessage(err?.message || 'تعذر حذف العناصر المحددة.');
    } finally {
      setBusyId('');
    }
  }

  function toggleOne(id) {
    if (!id) return;
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function toggleSelectAllInFilter() {
    setSelectedIds((current) => {
      if (allInFilterSelected) {
        return current.filter((id) => !filteredIds.includes(id));
      }
      return Array.from(new Set([...current, ...filteredIds]));
    });
  }

  const bulkBusy = busyId === '__bulk_delete__';

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a' }}>نتائج الاستخراج</h3>
          <div style={mutedStyle}>الواضح يحفظ تلقائيًا، والغامض يظهر هنا لتأكيده أو تجاهله.</div>
        </div>
        <div style={tabsStyle}>
          {FILTERS.map((item) => (
            <button key={item.value} type="button" onClick={() => setActiveFilter(item.value)} style={activeFilter === item.value ? activeTabStyle : tabStyle}>{item.label}</button>
          ))}
        </div>
      </div>

      {message ? <div style={noticeStyle}>{message}</div> : null}

      <div style={bulkBarStyle}>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={allInFilterSelected} onChange={toggleSelectAllInFilter} disabled={!filteredIds.length || bulkBusy} />
          <span>تحديد الكل داخل هذا الفلتر</span>
        </label>
        <div style={bulkActionsStyle}>
          <span style={mutedStyle}>المحدد: {selectedInFilter.length}</span>
          <button type="button" style={dangerStyle} disabled={!selectedInFilter.length || bulkBusy} onClick={handleBulkDelete}>
            {bulkBusy ? 'جاري الحذف...' : 'حذف المحدد'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {filtered.length ? filtered.map((item) => {
          const listing = item.listing || {};
          const request = item.request || {};
          const isRequest = item.recordType === 'request';
          const busy = bulkBusy || busyId === (item.id || item.summary);
          const checked = selectedIds.includes(item.id);
          return (
            <div key={item.id || `${item.recordType}-${item.summary}`} style={rowStyle}>
              <div style={rowTopStyle}>
                <label style={checkboxLabelStyle}>
                  <input type="checkbox" checked={checked} onChange={() => toggleOne(item.id)} disabled={busy} />
                  <span>تحديد</span>
                </label>
                <div style={metaStyle}>
                  <Badge text={isRequest ? 'طلب' : item.recordType === 'listing' ? 'عرض' : 'غير مهم'} kind={isRequest ? 'green' : 'blue'} />
                  <Badge text={statusLabel(item.extractionStatus)} kind={statusKind(item.extractionStatus)} />
                  <Badge text={`ثقة ${Math.round(Number(item.confidence || 0) * 100)}%`} kind="gray" />
                </div>
              </div>
              <div style={summaryStyle}>{item.summary || 'بدون ملخص'}</div>
              {item.reason ? <div style={reasonStyle}>السبب: {item.reason}</div> : null}
              <div style={gridStyle}>
                {!isRequest ? (
                  <>
                    <Info label="نوع العقار" value={listing.propertyType} />
                    <Info label="الصفقة" value={listing.dealType === 'rent' ? 'إيجار' : listing.dealType === 'sale' ? 'بيع' : listing.dealType} />
                    <Info label="الموقع" value={[listing.neighborhood, listing.plan, listing.part].filter(Boolean).join(' — ')} />
                    <Info label="السعر" value={listing.price ? formatPriceSAR(listing.price) : '—'} />
                    <Info label="المساحة" value={listing.area ? `${listing.area} م²` : '—'} />
                    <Info label="المصدر" value={`${item.source?.contactName || 'مسوق'} — ${item.source?.contactPhone || '—'}`} />
                  </>
                ) : (
                  <>
                    <Info label="نوع الطلب" value={request.propertyType} />
                    <Info label="الصفقة" value={request.dealType === 'rent' ? 'إيجار' : request.dealType === 'sale' ? 'بيع' : request.dealType} />
                    <Info label="الموقع" value={[request.neighborhood, request.plan, request.part].filter(Boolean).join(' — ')} />
                    <Info label="الميزانية" value={request.budgetMax ? formatPriceSAR(request.budgetMax) : '—'} />
                    <Info label="المصدر" value={`${request.name || item.source?.contactName || 'مسوق'} — ${request.phone || item.source?.contactPhone || '—'}`} />
                    <Info label="مباشر" value={request.directClient ? 'نعم' : '—'} />
                  </>
                )}
              </div>
              <details style={detailsStyle}>
                <summary>عرض النص الأصلي</summary>
                <pre style={preStyle}>{item.rawText || '—'}</pre>
              </details>
              <div style={actionsStyle}>
                {item.extractionStatus !== 'auto_saved' && item.recordType !== 'ignored' ? (
                  <button type="button" style={buttonStyle} disabled={busy} onClick={() => handleApprove(item)}>{busyId === (item.id || item.summary) ? 'جاري...' : isRequest ? 'اعتماد الطلب' : 'اعتماد العرض'}</button>
                ) : null}
                {item.extractionStatus !== 'ignored' ? <button type="button" style={secondaryStyle} disabled={busy} onClick={() => handleIgnore(item)}>تجاهل</button> : null}
                <button type="button" style={dangerStyle} disabled={busy} onClick={() => handleDelete(item)}>{busyId === (item.id || item.summary) ? 'جاري الحذف...' : 'حذف نهائي'}</button>
              </div>
            </div>
          );
        }) : (
          <div style={emptyStyle}>لا توجد عناصر ضمن هذا التصنيف حاليًا.</div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return <div style={infoStyle}><div style={infoLabelStyle}>{label}</div><div style={infoValueStyle}>{value || '—'}</div></div>;
}

function Badge({ text, kind = 'gray' }) {
  const style = kind === 'green' ? greenBadgeStyle : kind === 'blue' ? blueBadgeStyle : kind === 'red' ? redBadgeStyle : grayBadgeStyle;
  return <div style={style}>{text}</div>;
}

function statusLabel(value) {
  switch (value) {
    case 'auto_saved': return 'تم حفظه';
    case 'needs_review': return 'للمراجعة';
    case 'possible_duplicate': return 'مكرر محتمل';
    case 'ignored': return 'متجاهل';
    default: return value || '—';
  }
}

function statusKind(value) {
  switch (value) {
    case 'auto_saved': return 'green';
    case 'needs_review': return 'blue';
    case 'possible_duplicate': return 'red';
    default: return 'gray';
  }
}

const cardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 };
const mutedStyle = { color: '#64748b' };
const tabsStyle = { display: 'flex', flexWrap: 'wrap', gap: 8 };
const tabStyle = { padding: '8px 12px', borderRadius: 999, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' };
const activeTabStyle = { ...tabStyle, background: '#0f172a', color: '#fff', borderColor: '#0f172a' };
const noticeStyle = { padding: 12, background: '#ecfccb', color: '#365314', borderRadius: 12, marginBottom: 12 };
const bulkBarStyle = { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '12px 14px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', marginBottom: 14 };
const bulkActionsStyle = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' };
const rowStyle = { padding: 16, border: '1px solid #e5e7eb', borderRadius: 16, background: '#fcfcfd' };
const rowTopStyle = { display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 };
const checkboxLabelStyle = { display: 'inline-flex', alignItems: 'center', gap: 8, color: '#0f172a', fontSize: 14 };
const metaStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const blueBadgeStyle = { padding: '6px 10px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 12 };
const greenBadgeStyle = { padding: '6px 10px', borderRadius: 999, background: '#ecfdf5', color: '#047857', fontSize: 12 };
const redBadgeStyle = { padding: '6px 10px', borderRadius: 999, background: '#fee2e2', color: '#b91c1c', fontSize: 12 };
const grayBadgeStyle = { padding: '6px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569', fontSize: 12 };
const summaryStyle = { fontWeight: 600, color: '#0f172a', marginBottom: 10, lineHeight: 1.8 };
const reasonStyle = { color: '#475569', marginBottom: 12, lineHeight: 1.8 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 };
const infoStyle = { padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb' };
const infoLabelStyle = { fontSize: 12, color: '#64748b', marginBottom: 6 };
const infoValueStyle = { color: '#0f172a' };
const detailsStyle = { marginTop: 12 };
const preStyle = { whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid #e5e7eb', fontFamily: 'inherit', lineHeight: 1.8 };
const actionsStyle = { display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 };
const buttonStyle = { padding: '11px 14px', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', cursor: 'pointer' };
const secondaryStyle = { padding: '11px 14px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' };
const emptyStyle = { padding: 20, textAlign: 'center', color: '#64748b' };
const dangerStyle = { padding: '11px 14px', borderRadius: 12, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', cursor: 'pointer' };
