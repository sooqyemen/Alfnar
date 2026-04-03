'use client';

import { useState } from 'react';
import { formatPriceSAR } from '@/lib/format';
import { updateRequestStatus } from '@/lib/requestService';

const STATUS_OPTIONS = [
  { value: 'new', label: 'جديد' },
  { value: 'followup', label: 'جاري المتابعة' },
  { value: 'closed', label: 'مغلق' },
];

export default function RequestsTable({ requests = [], onRefresh }) {
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  async function handleChange(id, value) {
    setSavingId(id);
    setError('');
    try {
      await updateRequestStatus(id, value);
      onRefresh?.();
    } catch (err) {
      setError('تعذر تحديث حالة الطلب.');
    } finally {
      setSavingId('');
    }
  }

  return (
    <div style={wrapStyle}>
      {error ? <div style={errorStyle}>{error}</div> : null}
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>التاريخ</th>
              <th style={thStyle}>الاسم</th>
              <th style={thStyle}>الجوال</th>
              <th style={thStyle}>الطلب</th>
              <th style={thStyle}>الموقع</th>
              <th style={thStyle}>الميزانية</th>
              <th style={thStyle}>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {requests.length ? requests.map((item) => {
              const createdLabel = typeof item.createdAt?.toDate === 'function'
                ? item.createdAt.toDate().toLocaleString('ar-SA')
                : '—';
              const budget = item.budgetMax || item.budgetMin ? `${formatPriceSAR(item.budgetMin || 0)} — ${formatPriceSAR(item.budgetMax || 0)}` : '—';
              return (
                <tr key={item.id}>
                  <td style={tdStyle}>{createdLabel}</td>
                  <td style={tdStyle}>{item.name || 'بدون اسم'}</td>
                  <td style={tdStyle} dir="ltr">{item.phone || '—'}</td>
                  <td style={tdStyle}>{[item.dealType, item.propertyType].filter(Boolean).join(' / ') || '—'}</td>
                  <td style={tdStyle}>{[item.neighborhood, item.plan, item.part].filter(Boolean).join(' — ') || '—'}</td>
                  <td style={tdStyle}>{budget}</td>
                  <td style={tdStyle}>
                    <select
                      value={item.status || 'new'}
                      onChange={(e) => handleChange(item.id, e.target.value)}
                      disabled={savingId === item.id}
                      style={selectStyle}
                    >
                      {STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={7} style={emptyStyle}>لا توجد طلبات حالياً.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const wrapStyle = { background: '#fff', borderRadius: 18, border: '1px solid #e5e7eb', overflow: 'hidden' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', minWidth: 960 };
const thStyle = { textAlign: 'right', padding: 14, background: '#f8fafc', borderBottom: '1px solid #e5e7eb', color: '#334155', fontSize: 14 };
const tdStyle = { padding: 14, borderBottom: '1px solid #f1f5f9', color: '#0f172a', verticalAlign: 'top' };
const emptyStyle = { padding: 24, textAlign: 'center', color: '#64748b' };
const selectStyle = { padding: '10px 12px', borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff' };
const errorStyle = { margin: 12, padding: 12, borderRadius: 10, background: '#fee2e2', color: '#991b1b' };
