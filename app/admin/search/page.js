'use client';

import { useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import SearchAnswerCard from '@/components/admin/SearchAnswerCard';
import { analyzeSearchQuestion } from '@/lib/aiExtractClient';
import { fetchListings } from '@/lib/listings';
import { formatSearchResult, matchListingToFilters, rankListings } from '@/lib/searchUtils';

export default function AdminSearchPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [results, setResults] = useState([]);

  async function handleSearch(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setAnswer('');
    setResults([]);
    try {
      const ai = await analyzeSearchQuestion({ question });
      const listings = await fetchListings({ onlyPublic: false, max: 400 });
      const filtered = (listings || []).filter((item) => matchListingToFilters(item, ai.filters || {}));
      const ranked = rankListings(filtered, ai.filters || {}).slice(0, 12).map(formatSearchResult);
      setResults(ranked);
      if (ranked.length) {
        setAnswer(ai.answerTemplate
          ? ai.answerTemplate.replace('{count}', String(ranked.length))
          : `نعم، وجدنا ${ranked.length} نتيجة مناسبة تقريبًا.`);
      } else {
        setAnswer(ai.emptyAnswer || 'لا يوجد لدينا الآن عرض مطابق تمامًا، لكن يمكنك توسيع الميزانية أو الحي لإظهار بدائل قريبة.');
      }
    } catch (err) {
      setError(err?.message || 'تعذر تنفيذ البحث الذكي.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminGuard title="البحث الذكي">
      <AdminShell
        title="اسأل عن العروض باللغة الطبيعية"
        description="اكتب مثل: هل عندنا أرض سكنية في الياقوت بحدود مليون؟ وسيتم فهم السؤال ثم تطبيقه على قاعدة العروض مع إظهار المصدر والجوال والصفة."
      >
        <form onSubmit={handleSearch} style={formStyle}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="مثال: هل عندنا أرض سكنية في الياقوت بحدود مليون ومباشر؟"
            style={textareaStyle}
            required
          />
          <button type="submit" style={buttonStyle} disabled={loading}>
            {loading ? 'جاري البحث...' : 'ابحث الآن'}
          </button>
        </form>
        {error ? <div style={errorStyle}>{error}</div> : null}
        <SearchAnswerCard answer={answer} results={results} />
      </AdminShell>
    </AdminGuard>
  );
}

const formStyle = { display: 'grid', gap: 12, marginBottom: 16 };
const textareaStyle = { width: '100%', minHeight: 120, padding: 14, borderRadius: 14, border: '1px solid #cbd5e1', fontFamily: 'inherit', lineHeight: 1.8 };
const buttonStyle = { padding: '12px 16px', borderRadius: 12, border: 'none', background: '#0f172a', color: '#fff', width: 'fit-content', cursor: 'pointer' };
const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
