'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import PasteMessageBox from '@/components/admin/PasteMessageBox';
import ExtractionReviewTable from '@/components/admin/ExtractionReviewTable';
import { analyzeInboxInput } from '@/lib/aiExtractClient';
import {
  fetchExtractedItems,
  fetchInboxEntries,
  promoteExtractedItem,
  saveExtractedItems,
  saveInboxEntry,
  updateExtractedItemStatus,
  deleteExtractedItemEverywhere,
} from '@/lib/inboxService';

export default function AdminInboxPage() {
  const [loading, setLoading] = useState(false);
  const [recentEntries, setRecentEntries] = useState([]);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');

  async function load() {
    try {
      const [entries, extracted] = await Promise.all([fetchInboxEntries(40), fetchExtractedItems(120)]);
      setRecentEntries(entries || []);
      setItems(extracted || []);
    } catch (_) {
      setError('تعذر تحميل عناصر الوارد الذكي.');
    }
  }

  useEffect(() => { load(); }, []);

  async function handleAnalyze(payload) {
    setLoading(true);
    setError('');
    setSummary('');
    try {
      const analysis = await analyzeInboxInput(payload);
      const inboxEntryId = await saveInboxEntry({
        ...payload,
        parsedText: analysis.parsedText || '',
        aiSummary: analysis.summary || '',
        aiStats: analysis.stats || null,
        status: analysis.stats?.reviewCount ? 'review' : 'processed',
      });

      const savedItems = await saveExtractedItems({ inboxEntryId, items: analysis.items || [] });

      const autoSaved = savedItems.filter((item) => item.extractionStatus === 'auto_saved' && (item.recordType === 'listing' || item.recordType === 'request'));
      for (const item of autoSaved) {
        try {
          const promoted = await promoteExtractedItem(item);
          await updateExtractedItemStatus(item.id, 'auto_saved', {
            promotedAt: new Date(),
            promotedDocId: promoted?.id || '',
            promotedCollection: promoted?.collection || '',
          });
        } catch (_) {
          await updateExtractedItemStatus(item.id, 'needs_review', { reason: 'فشل الحفظ النهائي، راجع العنصر يدويًا.' });
        }
      }

      const stats = analysis.stats || {};
      setSummary(`تم التحليل: ${stats.totalGroups || 0} مقطع، محفوظ تلقائيًا ${stats.autoSavedCount || 0}، للمراجعة ${stats.reviewCount || 0}، متجاهل ${stats.ignoredCount || 0}.`);
      await load();
    } catch (err) {
      setError(err?.message || 'تعذر تحليل المحتوى.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(item) {
    const promoted = await promoteExtractedItem(item);
    await updateExtractedItemStatus(item.id, 'auto_saved', {
      promotedAt: new Date(),
      promotedDocId: promoted?.id || '',
      promotedCollection: promoted?.collection || '',
    });
    await load();
  }

  async function handleIgnore(item) {
    await updateExtractedItemStatus(item.id, 'ignored');
    await load();
  }

  async function handleDelete(item) {
    await deleteExtractedItemEverywhere(item);
    await load();
  }

  const stats = useMemo(() => {
    return {
      total: items.length,
      review: items.filter((item) => item.extractionStatus === 'needs_review').length,
      autoSaved: items.filter((item) => item.extractionStatus === 'auto_saved').length,
      ignored: items.filter((item) => item.extractionStatus === 'ignored').length,
    };
  }, [items]);

  return (
    <AdminGuard title="الوارد الذكي">
      <AdminShell title="الوارد الذكي" description="استورد محادثات الواتساب، دع المساعد يفرزها، ثم راجع العناصر الغامضة فقط.">
        {error ? <div style={errorStyle}>{error}</div> : null}
        {summary ? <div style={successStyle}>{summary}</div> : null}

        <div style={statsStyle}>
          <StatCard label="الإجمالي" value={stats.total} />
          <StatCard label="للمراجعة" value={stats.review} />
          <StatCard label="محفوظ تلقائيًا" value={stats.autoSaved} />
          <StatCard label="متجاهل" value={stats.ignored} />
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <PasteMessageBox onAnalyze={handleAnalyze} loading={loading} />
          <ExtractionReviewTable items={items} onApprove={handleApprove} onIgnore={handleIgnore} onDelete={handleDelete} onRefresh={load} />
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0, color: '#0f172a' }}>آخر الملفات أو الإدخالات</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              {recentEntries.map((entry) => (
                <div key={entry.id} style={entryStyle}>
                  <div style={{ fontWeight: 700 }}>{entry.fileName || entry.source?.contactName || 'وارد ذكي'}</div>
                  <div style={mutedStyle}>{entry.aiSummary || entry.rawText?.slice(0, 150) || '—'}</div>
                </div>
              ))}
              {!recentEntries.length ? <div style={mutedStyle}>لا توجد إدخالات بعد.</div> : null}
            </div>
          </div>
        </div>
      </AdminShell>
    </AdminGuard>
  );
}

function StatCard({ label, value }) {
  return <div style={statCardStyle}><div style={statValueStyle}>{value}</div><div style={mutedStyle}>{label}</div></div>;
}

const statsStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 };
const statCardStyle = { background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 16 };
const statValueStyle = { fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 6 };
const cardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const entryStyle = { padding: 12, borderRadius: 14, border: '1px solid #e5e7eb', background: '#fcfcfd' };
const mutedStyle = { color: '#64748b', lineHeight: 1.8 };
const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
const successStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#ecfccb', color: '#365314' };
