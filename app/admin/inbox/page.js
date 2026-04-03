'use client';

import { useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import PasteMessageBox from '@/components/admin/PasteMessageBox';
import ExtractionReviewTable from '@/components/admin/ExtractionReviewTable';
import { analyzeInboxInput } from '@/lib/aiExtractClient';
import { promoteExtractedItem, saveExtractedItems, saveInboxEntry } from '@/lib/inboxService';

export default function AdminInboxPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [savedInboxId, setSavedInboxId] = useState('');

  async function handleAnalyze(payload) {
    setLoading(true);
    setError('');
    setAnalysis(null);
    setSavedInboxId('');
    try {
      const data = await analyzeInboxInput(payload);
      const inboxEntryId = await saveInboxEntry({
        ...payload,
        aiSummary: data.summary,
        parsedText: data.cleanedText || payload.rawText,
        status: 'review',
      });
      await saveExtractedItems({
        inboxEntryId,
        items: data.items || [],
      });
      setSavedInboxId(inboxEntryId);
      setAnalysis(data);
    } catch (err) {
      setError(err?.message || 'تعذر تحليل الرسالة أو الملف.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(item) {
    const payload = { ...item };
    if (savedInboxId && !payload.inboxEntryId) payload.inboxEntryId = savedInboxId;
    await promoteExtractedItem(payload);
  }

  return (
    <AdminGuard title="الوارد الذكي">
      <AdminShell
        title="الوارد الذكي للمحادثات"
        description="ألصق الرسالة أو ارفع TXT / ZIP، وسيتم استخراج العروض أو الطلبات مع إلزام المصدر والجوال كلما كانا متاحين. عند غياب الاسم مع وجود رقم سيُعيّن الاسم الافتراضي مسوق."
      >
        {error ? <div style={errorStyle}>{error}</div> : null}
        <div style={{ display: 'grid', gap: 16 }}>
          <PasteMessageBox onAnalyze={handleAnalyze} loading={loading} />
          {analysis ? (
            <div style={summaryStyle}>
              <div><strong>ملخص التحليل:</strong> {analysis.summary || '—'}</div>
              <div><strong>عدد العناصر:</strong> {(analysis.items || []).length}</div>
              {savedInboxId ? <div><strong>رقم سجل الوارد:</strong> {savedInboxId}</div> : null}
            </div>
          ) : null}
          <ExtractionReviewTable items={analysis?.items || []} onApprove={handleApprove} />
        </div>
      </AdminShell>
    </AdminGuard>
  );
}

const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
const summaryStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', color: '#334155', lineHeight: 1.9 };
