'use client';

import { useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import SearchAnswerCard from '@/components/admin/SearchAnswerCard';
import { fetchListings } from "@/lib/listings";
import { extractSearchFilters } from "@/lib/searchUtils";

export default function AdminSearchPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  async function handleSearch(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError('');
    try {
      const filters = extractSearchFilters(question);
      const listings = await fetchListings({ onlyPublic: false, filters, max: 120 });
      const finalResults = (listings || []).filter((item) => !filters.directOnly || item.direct).slice(0, 12);
      setResults(finalResults);
      setAnswer(finalResults.length ? `وجدت ${finalResults.length} نتيجة مطابقة تقريبًا حسب السؤال.` : `لم أجد نتيجة مطابقة الآن، لكن تقدر توسع النطاق أو تزيل شرط المباشر.`);
    } catch (err) {
      setError(err?.message || 'تعذر تنفيذ البحث.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminGuard title="البحث الذكي">
      <AdminShell title="البحث الذكي" description="اسأل بأي صياغة: هل عندنا أرض في الياقوت بحدود مليون؟ وسيعرض المصدر والجوال إذا وجد.">
        <form onSubmit={handleSearch} style={formStyle}>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} style={textareaStyle} placeholder="مثال: هل عندنا أرض سكنية في الياقوت بحدود مليون؟" />
          <button type="submit" style={buttonStyle} disabled={loading}>{loading ? 'جاري البحث...' : 'ابحث الآن'}</button>
        </form>
        {error ? <div style={errorStyle}>{error}</div> : null}
        <SearchAnswerCard answer={answer} results={results} />
      </AdminShell>
    </AdminGuard>
  );
}

const formStyle = { display: 'grid', gap: 12, marginBottom: 16 };
const textareaStyle = { width: '100%', minHeight: 110, padding: 14, borderRadius: 14, border: '1px solid #cbd5e1', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8, background: '#fff' };
const buttonStyle = { padding: '12px 16px', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', width: 'fit-content', cursor: 'pointer' };
const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
