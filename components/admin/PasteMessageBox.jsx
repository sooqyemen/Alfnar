'use client';

import { useRef, useState } from 'react';
import { unzipSync, strFromU8 } from 'fflate';
import { normalizeSaudiPhone } from '@/lib/contactUtils';

export default function PasteMessageBox({ onAnalyze, loading = false }) {
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    sourceType: 'نسخ ولصق',
    contactName: '',
    contactPhone: '',
    contactRole: 'مسوق',
    rawText: '',
  });
  const [localError, setLocalError] = useState('');
  const [fileInfo, setFileInfo] = useState('');

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAnalyze() {
    setLocalError('');
    if (!form.rawText.trim()) {
      setLocalError('ألصق الرسالة أو ارفع ملفًا أولًا.');
      return;
    }
    await onAnalyze?.({
      rawText: form.rawText,
      sourceType: form.sourceType,
      source: {
        sourceType: form.sourceType,
        contactName: form.contactName.trim(),
        contactPhone: normalizeSaudiPhone(form.contactPhone),
        contactRole: form.contactRole.trim() || 'مسوق',
      },
      importMode: fileInfo ? 'file' : 'paste',
      fileName: fileInfo,
      fileType: fileInfo ? (fileInfo.toLowerCase().endsWith('.zip') ? 'zip' : 'txt') : 'text',
    });
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLocalError('');
    try {
      if (file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        updateField('rawText', text);
        setFileInfo(file.name);
        return;
      }
      if (file.name.toLowerCase().endsWith('.zip')) {
        const buffer = await file.arrayBuffer();
        const files = unzipSync(new Uint8Array(buffer));
        const chunks = [];
        for (const [name, data] of Object.entries(files)) {
          if (name.startsWith('__MACOSX/') || name.endsWith('/')) continue;
          if (!name.toLowerCase().endsWith('.txt')) continue;
          chunks.push(`----- ${name} -----\n${strFromU8(data)}`);
        }
        if (!chunks.length) throw new Error('لم يتم العثور على ملفات TXT داخل ملف ZIP.');
        updateField('rawText', chunks.join('\n\n'));
        setFileInfo(file.name);
        return;
      }
      throw new Error('الملف المدعوم هو TXT أو ZIP فقط.');
    } catch (err) {
      setLocalError(err?.message || 'تعذر قراءة الملف.');
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <h3 style={{ margin: 0, color: '#0f172a' }}>إدخال المحادثة</h3>
          <div style={mutedStyle}>الصق رسالة واحدة، محادثة كاملة، أو ارفع TXT / ZIP. العروض والطلبات الواضحة تُحفظ تلقائيًا، والغامضة تذهب للمراجعة.</div>
        </div>
      </div>
      <div style={gridStyle}>
        <div>
          <label style={labelStyle}>نوع المصدر</label>
          <select value={form.sourceType} onChange={(e) => updateField('sourceType', e.target.value)} style={inputStyle}>
            <option>نسخ ولصق</option>
            <option>واتساب يدوي</option>
            <option>ملف ZIP</option>
            <option>ملف TXT</option>
            <option>مصدر آخر</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>اسم صاحب العرض / المجموعة</label>
          <input value={form.contactName} onChange={(e) => updateField('contactName', e.target.value)} style={inputStyle} placeholder="مثال: شوقي أو مؤسسة بن هشبل" />
        </div>
        <div>
          <label style={labelStyle}>رقم الجوال</label>
          <input value={form.contactPhone} onChange={(e) => updateField('contactPhone', e.target.value)} style={inputStyle} placeholder="05xxxxxxxx" dir="ltr" />
        </div>
        <div>
          <label style={labelStyle}>الصفة</label>
          <select value={form.contactRole} onChange={(e) => updateField('contactRole', e.target.value)} style={inputStyle}>
            <option>مسوق</option>
            <option>مالك</option>
            <option>مباشر من المالك</option>
            <option>مكتب</option>
            <option>وسيط</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label style={labelStyle}>النص الخام أو المحادثة</label>
        <textarea value={form.rawText} onChange={(e) => updateField('rawText', e.target.value)} style={textareaStyle} placeholder="ألصق محادثة واتساب أو عدة رسائل هنا..." />
      </div>

      <div style={toolbarStyle}>
        <button type="button" style={buttonStyle} onClick={() => fileInputRef.current?.click()}>رفع TXT أو ZIP</button>
        <button type="button" style={primaryButtonStyle} onClick={handleAnalyze} disabled={loading}>{loading ? 'جاري التحليل...' : 'تحليل وحفظ'}</button>
        {fileInfo ? <div style={mutedStyle}>تم تجهيز الملف: {fileInfo}</div> : null}
      </div>

      {localError ? <div style={errorStyle}>{localError}</div> : null}
      <input ref={fileInputRef} type="file" accept=".txt,.zip" hidden onChange={handleFileChange} />
    </div>
  );
}

const cardStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 };
const labelStyle = { display: 'block', marginBottom: 8, color: '#334155', fontSize: 14 };
const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff' };
const textareaStyle = { width: '100%', minHeight: 280, padding: 14, borderRadius: 14, border: '1px solid #cbd5e1', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.8 };
const toolbarStyle = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 16 };
const buttonStyle = { padding: '11px 15px', borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer' };
const primaryButtonStyle = { ...buttonStyle, background: '#0f172a', color: '#fff', border: 'none' };
const mutedStyle = { color: '#64748b', fontSize: 13, lineHeight: 1.7 };
const errorStyle = { marginTop: 12, padding: 12, borderRadius: 12, background: '#fee2e2', color: '#991b1b' };
