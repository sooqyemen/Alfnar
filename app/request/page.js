'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

import { buildWhatsAppLink } from '@/components/WhatsAppBar';
import { createRequest } from '@/lib/listings';
import { NEIGHBORHOODS } from '@/lib/taxonomy';
import { formatPriceSAR } from '@/lib/format';

const DEAL_TYPES = [
  { key: 'sale', label: 'شراء (بحث عن بيع)' },
  { key: 'rent', label: 'استئجار (بحث عن إيجار)' },
];

const PROPERTY_TYPES = ['أرض', 'فيلا', 'شقة', 'دور', 'عمارة', 'تجاري', 'مستودع'];

export default function RequestPage() {
  const phoneDefault = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';

  const [dealType, setDealType] = useState('sale');
  const [propertyType, setPropertyType] = useState('أرض');
  const [neighborhood, setNeighborhood] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [areaMin, setAreaMin] = useState('');
  const [notes, setNotes] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const waPhone = useMemo(() => {
    // إذا المستخدم كتب رقم، نستخدمه. وإلا نستخدم رقم الواتساب الخاص بالموقع (للتواصل معك)
    return phoneDefault || '0555666850';
  }, [phoneDefault]);

  const waText = useMemo(() => {
    const min = budgetMin ? formatPriceSAR(Number(budgetMin)) : '';
    const max = budgetMax ? formatPriceSAR(Number(budgetMax)) : '';
    const budgetText =
      min && max ? `الميزانية: من ${min} إلى ${max}` : min ? `الميزانية: ${min}` : max ? `الميزانية: حتى ${max}` : '';

    const areaText = areaMin ? `المساحة المطلوبة: ${areaMin} م²+` : '';

    const lines = [
      'السلام عليكم، هذا طلب عقاري من موقع لؤلؤة الفنار العقارية:',
      `نوع الطلب: ${DEAL_TYPES.find((d) => d.key === dealType)?.label || dealType}`,
      `نوع العقار: ${propertyType}`,
      neighborhood ? `الحي: ${neighborhood}` : 'الحي: غير محدد',
      budgetText || 'الميزانية: غير محددة',
      areaText || '',
      notes ? `ملاحظات: ${notes}` : '',
      name ? `الاسم: ${name}` : '',
      phone ? `رقم العميل: ${phone}` : '',
    ].filter(Boolean);

    return lines.join('\n');
  }, [dealType, propertyType, neighborhood, budgetMin, budgetMax, areaMin, notes, name, phone]);

  const waLink = useMemo(() => buildWhatsAppLink({ phone: waPhone, text: waText }), [waPhone, waText]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setOk(false);

    // تحقق خفيف
    if (!dealType) return setErr('اختر نوع الطلب.');
    if (!propertyType) return setErr('اختر نوع العقار.');

    setBusy(true);
    try {
      const payload = {
        dealType,
        propertyType,
        neighborhood: neighborhood || '',
        budgetMin: budgetMin ? Number(budgetMin) : null,
        budgetMax: budgetMax ? Number(budgetMax) : null,
        areaMin: areaMin ? Number(areaMin) : null,
        notes: notes || '',
        name: name || '',
        phone: phone || '',
        source: 'web',
        createdAt: new Date(),
      };

      await createRequest(payload);

      setOk(true);
      // لا نمسح البيانات كلها حتى لو يحب يرجع يفتح واتساب بنفس الطلب
    } catch (e2) {
      setErr('تعذر إرسال الطلب. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div style={{ margin: '16px 0 12px' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>أرسل طلبك</h1>
        <div className="muted" style={{ marginTop: 6 }}>
          اكتب طلبك، وسيتم حفظه في النظام، ويمكنك أيضًا إرساله مباشرة عبر واتساب.
        </div>
      </div>

      <form className="card" style={{ padding: 16 }} onSubmit={submit}>
        {/* نوع الطلب */}
        <label style={{ display: 'block', marginTop: 10, marginBottom: 6, fontWeight: 900 }}>
          نوع الطلب
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DEAL_TYPES.map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => setDealType(d.key)}
              style={{
                border: dealType === d.key ? '1px solid rgba(214,179,91,0.55)' : '1px solid var(--border)',
                background: dealType === d.key ? 'rgba(214,179,91,0.12)' : '#fff',
                color: 'var(--text)',
                padding: '10px 14px',
                borderRadius: 999,
                fontWeight: 900,
                cursor: 'pointer',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* نوع العقار */}
        <label style={{ display: 'block', marginTop: 12, marginBottom: 6, fontWeight: 900 }}>
          نوع العقار
        </label>
        <select className="input" value={propertyType} onChange={(e) => setPropertyType(e.target.value)}>
          {PROPERTY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* الحي */}
        <label style={{ display: 'block', marginTop: 12, marginBottom: 6, fontWeight: 900 }}>
          الحي
        </label>
        <select className="input" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
          <option value="">اختر الحي (اختياري)</option>
          {(NEIGHBORHOODS || []).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        {/* الميزانية */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 900 }}>الميزانية من</label>
            <input
              className="input"
              inputMode="numeric"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="مثال: 500000"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 900 }}>الميزانية إلى</label>
            <input
              className="input"
              inputMode="numeric"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="مثال: 1200000"
            />
          </div>
        </div>

        {/* المساحة */}
        <label style={{ display: 'block', marginTop: 12, marginBottom: 6, fontWeight: 900 }}>
          المساحة المطلوبة (م²) - اختياري
        </label>
        <input
          className="input"
          inputMode="numeric"
          value={areaMin}
          onChange={(e) => setAreaMin(e.target.value.replace(/[^\d]/g, ''))}
          placeholder="مثال: 400"
        />

        {/* بيانات العميل */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 900 }}>الاسم (اختياري)</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميل" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 900 }}>رقم الجوال (اختياري)</label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xxxxxxxx"
            />
          </div>
        </div>

        {/* ملاحظات */}
        <label style={{ display: 'block', marginTop: 12, marginBottom: 6, fontWeight: 900 }}>
          ملاحظات إضافية
        </label>
        <textarea
          className="input"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="مثال: قريب من الخدمات… واجهة شمال… مباشر من المالك…"
          style={{ resize: 'vertical' }}
        />

        {err ? (
          <div style={{ marginTop: 10, color: 'var(--danger)', fontWeight: 900 }}>{err}</div>
        ) : null}

        {ok ? (
          <div style={{ marginTop: 10, color: 'var(--success)', fontWeight: 900 }}>
            تم إرسال الطلب بنجاح.
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn btnPrimary" type="submit" disabled={busy} style={{ flex: 1, minWidth: 180 }}>
            {busy ? '...' : 'إرسال الطلب'}
          </button>

          <a
            className="btn"
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              minWidth: 180,
              textAlign: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            إرسال عبر واتساب
          </a>
        </div>

        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
          تقدر أيضًا مشاهدة <Link href="/listings">كل العروض</Link> أو فتح <Link href="/map">الخريطة</Link>.
        </div>
      </form>
    </div>
  );
}
