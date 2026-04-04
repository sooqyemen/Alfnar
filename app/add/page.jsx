'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { getFirebase } from '@/lib/firebaseClient';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage';

import { isAdminUser } from '@/lib/admin';
import { adminCreateListing } from '@/lib/listings';
import { DEAL_TYPES, NEIGHBORHOODS, PROPERTY_CLASSES, PROPERTY_TYPES, STATUS_OPTIONS } from '@/lib/taxonomy';
import { formatPriceSAR, statusBadge } from '@/lib/format';

const MAX_FILES = 30;
const JEDDAH_BOUNDS = { north: 22.0, south: 21.0, east: 39.5, west: 39.0 };
const DEFAULT_CENTER = { lat: 21.7628, lng: 39.0994 };
const FORM_STEPS = [
  { key: 'basic', label: 'البيانات الأساسية' },
  { key: 'details', label: 'التفاصيل' },
  { key: 'media', label: 'الصور والموقع' },
  { key: 'review', label: 'المراجعة والنشر' },
];

function Field({ label, children, hint }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="muted" style={{ fontSize: 13, marginBottom: 6, fontWeight: 900 }}>
        {label}
      </div>
      {children}
      {hint ? (
        <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />;
}

function toNum(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

function isFiniteNum(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function inJeddahBounds(lat, lng) {
  return lat <= JEDDAH_BOUNDS.north && lat >= JEDDAH_BOUNDS.south && lng <= JEDDAH_BOUNDS.east && lng >= JEDDAH_BOUNDS.west;
}

let __gmapsPromise = null;
function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (__gmapsPromise) return __gmapsPromise;

  __gmapsPromise = new Promise((resolve, reject) => {
    const scriptId = 'google-maps-js-add-page';
    const existing = document.getElementById(scriptId);

    if (existing) {
      const check = () => {
        if (window.google && window.google.maps) resolve(window.google.maps);
        else setTimeout(check, 80);
      };
      check();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=ar&region=SA`;
    script.onload = () => {
      if (window.google && window.google.maps) resolve(window.google.maps);
      else reject(new Error('تم تحميل الخريطة لكن الكائن غير متوفر.'));
    };
    script.onerror = () => reject(new Error('تعذر تحميل الخريطة.'));
    document.head.appendChild(script);
  });

  return __gmapsPromise;
}

function MapPicker({ lat, lng, onChange }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const listenersRef = useRef([]);
  const lastValidRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [boundsMsg, setBoundsMsg] = useState('');
  const [geoErr, setGeoErr] = useState('');
  const [mapType, setMapType] = useState('roadmap');

  const applyPos = useCallback(
    (lat0, lng0, { pan = true } = {}) => {
      if (!isFiniteNum(lat0) || !isFiniteNum(lng0)) return;

      if (!inJeddahBounds(lat0, lng0)) {
        setBoundsMsg('اختر موقعًا داخل جدة فقط.');
        const fallback = lastValidRef.current || DEFAULT_CENTER;
        try {
          markerRef.current?.setPosition?.(fallback);
          mapRef.current?.panTo?.(fallback);
        } catch {}
        return;
      }

      const pos = { lat: round6(lat0), lng: round6(lng0) };
      setBoundsMsg('');
      lastValidRef.current = pos;
      onChange?.(pos);

      try {
        markerRef.current?.setPosition?.(pos);
        if (pan) mapRef.current?.panTo?.(pos);
        if ((mapRef.current?.getZoom?.() || 0) < 16) mapRef.current?.setZoom?.(16);
      } catch {}
    },
    [onChange]
  );

  useEffect(() => {
    let alive = true;

    async function init() {
      try {
        if (!apiKey) throw new Error('مفتاح الخريطة غير موجود.');
        const maps = await loadGoogleMaps(apiKey);
        if (!alive) return;
        const el = mapElRef.current;
        if (!el) return;

        const has = isFiniteNum(lat) && isFiniteNum(lng) && inJeddahBounds(lat, lng);
        const center = has ? { lat, lng } : DEFAULT_CENTER;

        const map = new maps.Map(el, {
          center,
          zoom: has ? 16 : 13,
          mapTypeId: mapType,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
          rotateControl: false,
          scaleControl: false,
          clickableIcons: false,
          gestureHandling: 'greedy',
        });

        const marker = new maps.Marker({
          position: center,
          map,
          draggable: true,
        });

        mapRef.current = map;
        markerRef.current = marker;
        lastValidRef.current = center;

        listenersRef.current.push(
          map.addListener('click', (e) => applyPos(e?.latLng?.lat?.(), e?.latLng?.lng?.())),
          marker.addListener('dragend', () => {
            const pos = marker.getPosition();
            applyPos(pos?.lat?.(), pos?.lng?.());
          })
        );

        setReady(true);
      } catch (e) {
        if (!alive) return;
        setErr(String(e?.message || 'تعذر تحميل الخريطة.'));
        setReady(false);
      }
    }

    init();

    return () => {
      alive = false;
      try {
        (listenersRef.current || []).forEach((l) => l?.remove?.());
      } catch {}
      listenersRef.current = [];
      try {
        markerRef.current?.setMap?.(null);
      } catch {}
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, applyPos]);

  useEffect(() => {
    if (!mapRef.current) return;
    try {
      mapRef.current.setMapTypeId(mapType);
    } catch {}
  }, [mapType]);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (!isFiniteNum(lat) || !isFiniteNum(lng) || !inJeddahBounds(lat, lng)) return;
    try {
      markerRef.current.setPosition({ lat, lng });
      mapRef.current.panTo({ lat, lng });
      lastValidRef.current = { lat, lng };
    } catch {}
  }, [lat, lng]);

  const useMyLocation = useCallback(() => {
    setGeoErr('');
    if (!navigator?.geolocation) {
      setGeoErr('المتصفح لا يدعم تحديد الموقع.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => applyPos(pos?.coords?.latitude, pos?.coords?.longitude),
      () => setGeoErr('تعذر الحصول على موقعك الحالي.'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [applyPos]);

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div className="muted" style={{ fontSize: 12 }}>
          اضغط على الخريطة أو اسحب الدبوس لتحديد الموقع.
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={() => setMapType('roadmap')} style={{ fontSize: 12, padding: '6px 10px' }}>
            عادي
          </button>
          <button className="btn" type="button" onClick={() => setMapType('hybrid')} style={{ fontSize: 12, padding: '6px 10px' }}>
            قمر صناعي
          </button>
          <button className="btn" type="button" onClick={useMyLocation} style={{ fontSize: 12, padding: '6px 10px' }}>
            موقعي الحالي
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(214, 179, 91, 0.28)',
          background: '#f5f5f5',
        }}
      >
        <div ref={mapElRef} style={{ width: '100%', height: typeof window !== 'undefined' && window.innerWidth <= 768 ? 320 : 420 }} />

        {!ready && !err ? (
          <div
            className="muted"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 14,
              background: 'rgba(255,255,255,.7)',
              backdropFilter: 'blur(6px)',
              fontWeight: 800,
            }}
          >
            جاري تحميل الخريطة…
          </div>
        ) : null}

        {err ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 14,
              textAlign: 'center',
              background: 'rgba(255,255,255,.78)',
              fontWeight: 800,
              color: '#b42318',
            }}
          >
            {err}
          </div>
        ) : null}
      </div>

      {boundsMsg ? <div className="muted" style={{ marginTop: 8, color: '#b45f06', fontSize: 12, fontWeight: 900 }}>{boundsMsg}</div> : null}
      {geoErr ? <div className="muted" style={{ marginTop: 8, color: '#b42318', fontSize: 12 }}>{geoErr}</div> : null}
    </div>
  );
}

function useUploader(storage) {
  const [queue, setQueue] = useState([]);
  const [uploading, setUploading] = useState(false);

  const removeAt = useCallback(
    async (idx) => {
      const item = queue[idx];
      if (!item) return;
      if (item.refPath) {
        try {
          await deleteObject(storageRef(storage, item.refPath));
        } catch {}
      }
      setQueue((prev) => prev.filter((_, i) => i !== idx));
    },
    [queue, storage]
  );

  const addFiles = useCallback(
    async (files) => {
      if (!storage) return;

      const list = Array.from(files || []);
      if (!list.length) return;

      const available = Math.max(0, MAX_FILES - queue.length);
      const picked = list.slice(0, available);
      if (!picked.length) return;

      setUploading(true);

      for (const file of picked) {
        const safeName = String(file.name || 'file').replace(/[^\w.\-]+/g, '_');
        const refPath = `fanar_images/listings/draft_${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;
        const refObj = storageRef(storage, refPath);
        let tempKey = '';

        setQueue((prev) => {
          tempKey = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
          return [...prev, { key: tempKey, name: file.name || 'file', progress: 0, url: '', refPath, kind: String(file.type || '').startsWith('video/') ? 'video' : 'image' }];
        });

        await new Promise((resolve) => {
          const task = uploadBytesResumable(refObj, file);
          task.on(
            'state_changed',
            (snap) => {
              const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
              setQueue((prev) => prev.map((x) => (x.key === tempKey ? { ...x, progress: pct } : x)));
            },
            () => {
              setQueue((prev) => prev.filter((x) => x.key !== tempKey));
              resolve();
            },
            async () => {
              try {
                const url = await getDownloadURL(task.snapshot.ref);
                setQueue((prev) => prev.map((x) => (x.key === tempKey ? { ...x, url, progress: 100 } : x)));
              } catch {
                setQueue((prev) => prev.filter((x) => x.key !== tempKey));
              }
              resolve();
            }
          );
        });
      }

      setUploading(false);
    },
    [storage, queue.length]
  );

  const media = useMemo(
    () => queue
      .filter((q) => q.url)
      .map((q) => ({ url: q.url, refPath: q.refPath || '', name: q.name || '', kind: q.kind || 'image' })),
    [queue]
  );
  const urls = useMemo(() => media.map((q) => q.url).filter(Boolean), [media]);
  return { queue, setQueue, uploading, addFiles, removeAt, urls, media };
}

function StepHeader({ step, setStep }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
      {FORM_STEPS.map((item, index) => {
        const active = step === item.key;
        const done = FORM_STEPS.findIndex((x) => x.key === step) > index;
        return (
          <button
            key={item.key}
            type="button"
            className={active ? 'btn btnPrimary' : 'btn'}
            onClick={() => setStep(item.key)}
            style={{ width: '100%', padding: '10px 12px', fontWeight: 900, opacity: done ? 0.9 : 1 }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="card" style={{ padding: 12 }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 900 }}>{value || '—'}</div>
    </div>
  );
}

function CreateListingForm({ form, setForm, onSave, onReset, busy, createdId, uploader, saveErr }) {
  const [step, setStep] = useState('basic');
  const { queue, uploading, addFiles, removeAt } = uploader;
  const pricePreview = form.price ? formatPriceSAR(Number(form.price)) : '';

  const stepIndex = FORM_STEPS.findIndex((s) => s.key === step);
  const canGoNext = useMemo(() => {
    if (step === 'basic') return !!String(form.title || '').trim() && !!String(form.neighborhood || '').trim();
    if (step === 'details') return true;
    if (step === 'media') return true;
    return true;
  }, [form, step]);

  const nextStep = () => {
    if (stepIndex >= FORM_STEPS.length - 1) return;
    setStep(FORM_STEPS[stepIndex + 1].key);
  };

  const prevStep = () => {
    if (stepIndex <= 0) return;
    setStep(FORM_STEPS[stepIndex - 1].key);
  };

  return (
    <section className="card" style={{ padding: 14, marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontWeight: 950 }}>إضافة إعلان جديد</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>قسمنا النموذج إلى خطوات حتى يكون أوضح وأسهل.</div>
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={onReset} disabled={busy || uploading}>مسح النموذج</button>
          <Link href="/admin" className="btn">لوحة الأدمن</Link>
        </div>
      </div>

      <StepHeader step={step} setStep={setStep} />

      {createdId ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderColor: 'rgba(16,185,129,.25)', background: 'rgba(16,185,129,.07)' }}>
          <div style={{ fontWeight: 900 }}>تم حفظ الإعلان بنجاح.</div>
          <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>رقم الإعلان: {createdId}</div>
          <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <Link href={`/listing/${createdId}`} className="btn btnPrimary">عرض الإعلان</Link>
            <button className="btn" type="button" onClick={onReset}>إضافة إعلان جديد</button>
          </div>
        </div>
      ) : null}

      {saveErr ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderColor: 'rgba(220,38,38,.22)', background: 'rgba(220,38,38,.06)', fontWeight: 900 }}>
          {saveErr}
        </div>
      ) : null}

      {step === 'basic' ? (
        <div style={{ marginTop: 12 }}>
          <Field label="نوع الصفقة">
            <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
              {DEAL_TYPES.map((d) => (
                <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="radio" name="dealType" checked={form.dealType === d.key} onChange={() => setForm((p) => ({ ...p, dealType: d.key }))} />
                  <span style={{ fontWeight: 900 }}>{d.label}</span>
                </label>
              ))}
            </div>
          </Field>

          <Field label="نوع العقار">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {PROPERTY_TYPES.map((t) => (
                <button key={t} type="button" className={form.propertyType === t ? 'btn btnPrimary' : 'btn'} onClick={() => setForm((p) => ({ ...p, propertyType: t }))}>
                  {t}
                </button>
              ))}
            </div>
          </Field>

          <Field label="عنوان الإعلان">
            <input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="مثال: أرض للبيع في حي الياقوت مخطط بايزيد" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="الحي">
              <select className="input" value={form.neighborhood} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}>
                <option value="">اختر الحي</option>
                {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>

            <Field label="تصنيف العقار - اختياري">
              <select className="input" value={form.propertyClass} onChange={(e) => setForm((p) => ({ ...p, propertyClass: e.target.value }))}>
                <option value="">بدون</option>
                {PROPERTY_CLASSES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
          </div>
        </div>
      ) : null}

      {step === 'details' ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label={`السعر (${form.dealType === 'rent' ? 'سنوي' : 'ريال'})`}>
              <input className="input" inputMode="numeric" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value.replace(/[^\d]/g, '') }))} placeholder={form.dealType === 'rent' ? 'مثال: 20000' : 'مثال: 950000'} />
              {pricePreview ? <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>المعاينة: {pricePreview} {form.dealType === 'rent' ? 'سنوي' : ''}</div> : null}
            </Field>

            <Field label="المساحة (م²) - اختياري">
              <input className="input" inputMode="numeric" value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value.replace(/[^\d]/g, '') }))} placeholder="مثال: 400" />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="المخطط - اختياري">
              <input className="input" value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} placeholder="مثال: بايزيد" />
            </Field>

            <Field label="الجزء - اختياري">
              <input className="input" value={form.part} onChange={(e) => setForm((p) => ({ ...p, part: e.target.value }))} placeholder="مثال: 1ط أو ج" />
            </Field>
          </div>

          <Field label="حالة الإعلان">
            <select className="input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              {STATUS_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
            <div style={{ marginTop: 6 }}>{statusBadge(form.status)}</div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="رقم الترخيص - اختياري">
              <input className="input" value={form.licenseNumber} onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))} placeholder="مثال: 7200xxxxxx" />
            </Field>

            <Field label="رقم الجوال المباشر - اختياري" hint="إذا كان الإعلان مباشرًا يمكن وضع رقم الموظف أو المسوّق ليتم التواصل معه بدل رقم المكتب.">
              <input
                className="input"
                inputMode="tel"
                value={form.contactPhone}
                onChange={(e) => setForm((p) => ({ ...p, contactPhone: e.target.value.replace(/[^\d+]/g, '') }))}
                placeholder="مثال: 0555666850 أو 966555666850"
              />
            </Field>
          </div>

          <Field label="الوصف - اختياري" hint="يفضل كتابة أهم المميزات وقرب العقار من الطرق أو الخدمات.">
            <textarea className="input" rows={5} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} placeholder="مثال: أرض سكنية في حي الياقوت، قريبة من طريق رئيسي، مباشرة من المالك..." />
          </Field>
        </div>
      ) : null}

      {step === 'media' ? (
        <div style={{ marginTop: 12 }}>
          <Field label="رفع صور أو فيديو" hint={`حد أقصى ${MAX_FILES} ملف`}>
            <label className="btn btnPrimary" style={{ cursor: 'pointer' }}>
              اختر ملفات
              <input type="file" multiple accept="image/*,video/*" onChange={(e) => addFiles(e.target.files)} style={{ display: 'none' }} />
            </label>

            {queue.length ? (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {queue.map((q, idx) => (
                  <div key={`${q.name}_${idx}`} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{q.url ? 'تم الرفع' : `جاري الرفع: ${q.progress || 0}%`}</div>
                      </div>
                      <button className="btn" type="button" onClick={() => removeAt(idx)} style={{ fontSize: 12 }}>حذف</button>
                    </div>

                    <div style={{ marginTop: 8, height: 10, borderRadius: 999, background: 'rgba(214,179,91,0.22)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, q.progress || 0)}%`, height: '100%', background: 'linear-gradient(135deg, var(--primary), var(--primary2))', borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>لم يتم اختيار ملفات بعد.</div>
            )}
          </Field>

          <Divider />
          <Field label="الموقع على الخريطة" hint="حدد الموقع بدقة ثم راجع الإحداثيات أسفل الخريطة.">
            <MapPicker lat={toNum(form.lat)} lng={toNum(form.lng)} onChange={({ lat, lng }) => setForm((p) => ({ ...p, lat: String(lat), lng: String(lng) }))} />

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
                الإحداثيات: <span style={{ color: 'var(--text)', fontWeight: 950 }}>{form.lat || '—'} , {form.lng || '—'}</span>
              </div>

              <button className="btn" type="button" onClick={() => setForm((p) => ({ ...p, lat: '', lng: '' }))} style={{ fontSize: 12, padding: '6px 10px' }}>
                مسح الموقع
              </button>
            </div>
          </Field>
        </div>
      ) : null}

      {step === 'review' ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <ReviewRow label="نوع الصفقة" value={form.dealType === 'rent' ? 'إيجار' : 'بيع'} />
            <ReviewRow label="نوع العقار" value={form.propertyType} />
            <ReviewRow label="العنوان" value={form.title} />
            <ReviewRow label="الحي" value={form.neighborhood} />
            <ReviewRow label="السعر" value={pricePreview ? `${pricePreview}${form.dealType === 'rent' ? ' سنوي' : ''}` : '—'} />
            <ReviewRow label="المساحة" value={form.area ? `${form.area} م²` : '—'} />
            <ReviewRow label="المخطط" value={form.plan} />
            <ReviewRow label="الجزء" value={form.part} />
            <ReviewRow label="عدد الملفات" value={queue.length ? String(queue.length) : '0'} />
            <ReviewRow label="رقم الترخيص" value={form.licenseNumber || '—'} />
            <ReviewRow label="رقم الجوال المباشر" value={form.contactPhone || '—'} />
            <ReviewRow label="الموقع" value={form.lat && form.lng ? `${form.lat}, ${form.lng}` : 'غير محدد'} />
          </div>

          <Field label="الوصف النهائي">
            <div className="card" style={{ padding: 12, minHeight: 90, lineHeight: 1.8 }}>{form.description || 'لا يوجد وصف.'}</div>
          </Field>
        </div>
      ) : null}

      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button className="btn" type="button" onClick={prevStep} disabled={stepIndex === 0}>السابق</button>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {step !== 'review' ? (
            <button className="btn btnPrimary" type="button" onClick={nextStep} disabled={!canGoNext}>التالي</button>
          ) : (
            <button className="btn btnPrimary" type="button" onClick={onSave} disabled={busy || uploading}>
              {busy ? 'جاري الحفظ…' : uploading ? 'انتظر اكتمال الرفع…' : 'نشر الإعلان'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function AddListingPage() {
  const fb = getFirebase();
  const auth = fb?.auth;
  const storage = fb?.storage;

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState('');

  const initialForm = useMemo(
    () => ({
      dealType: 'sale',
      propertyType: 'أرض',
      propertyClass: '',
      title: '',
      price: '',
      area: '',
      neighborhood: '',
      plan: '',
      part: '',
      status: 'available',
      description: '',
      licenseNumber: '',
      contactPhone: '',
      lat: '',
      lng: '',
      images: [],
    }),
    []
  );

  const [form, setForm] = useState(initialForm);
  const uploader = useUploader(storage);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setChecking(false);
    });
    return () => unsub();
  }, [auth]);

  const isAdmin = isAdminUser(user);

  const resetForm = useCallback(() => {
    setCreatedId('');
    setAuthErr('');
    setForm(initialForm);
    uploader.setQueue([]);
  }, [initialForm, uploader]);

  const login = async (e) => {
    e.preventDefault();
    setAuthErr('');
    setAuthBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      setPass('');
    } catch {
      setAuthErr('بيانات الدخول غير صحيحة.');
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    setAuthErr('');
    setAuthBusy(true);
    try {
      await signOut(auth);
    } catch {
      setAuthErr('تعذر تسجيل الخروج.');
    } finally {
      setAuthBusy(false);
    }
  };

  const saveListing = useCallback(async () => {
    setSaving(true);
    setAuthErr('');

    try {
      const payload = {
        dealType: form.dealType || 'sale',
        propertyType: form.propertyType || 'أرض',
        propertyClass: form.propertyClass || '',
        title: String(form.title || '').trim(),
        price: toNum(form.price),
        area: toNum(form.area),
        neighborhood: String(form.neighborhood || '').trim(),
        plan: String(form.plan || '').trim(),
        part: String(form.part || '').trim(),
        status: form.status || 'available',
        description: String(form.description || '').trim(),
        licenseNumber: String(form.licenseNumber || '').trim(),
        contactPhone: String(form.contactPhone || '').trim(),
        lat: toNum(form.lat),
        lng: toNum(form.lng),
        images: uploader.urls.length ? uploader.urls : [],
        imagesMeta: uploader.media.length ? uploader.media : [],
        updatedAt: new Date(),
      };

      if (!payload.title) throw new Error('اكتب عنوان الإعلان.');
      if (!payload.neighborhood) throw new Error('اختر الحي.');

      const created = await adminCreateListing(payload);
      const id = created?.id || created || '';
      setCreatedId(id || 'تم');
    } catch (e) {
      setAuthErr(String(e?.message || 'تعذر حفظ الإعلان.'));
    } finally {
      setSaving(false);
    }
  }, [form, uploader.urls, uploader.media]);

  if (checking) {
    return (
      <div className="container" style={{ paddingTop: 16 }}>
        <section className="card" style={{ padding: 14 }}>جاري التحقق…</section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: 16, paddingBottom: 24 }}>
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 950 }}>تسجيل الدخول لإضافة إعلان</div>
          <div className="muted" style={{ marginTop: 8 }}>بعد تسجيل الدخول ستظهر لك صفحة إضافة الإعلان مباشرة.</div>

          <form onSubmit={login} style={{ marginTop: 12 }}>
            <Field label="البريد">
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>

            <Field label="كلمة المرور">
              <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
            </Field>

            {authErr ? <div style={{ marginTop: 10, color: 'var(--danger)', fontWeight: 900 }}>{authErr}</div> : null}

            <button className="btn btnPrimary" style={{ marginTop: 12, width: '100%' }} disabled={authBusy}>
              {authBusy ? '...' : 'تسجيل دخول'}
            </button>
          </form>
        </section>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container" style={{ paddingTop: 16, paddingBottom: 24 }}>
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 950 }}>غير مصرح</div>
          <div className="muted" style={{ marginTop: 8 }}>هذا الحساب لا يملك صلاحية إضافة إعلانات.</div>
          <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn" onClick={logout} disabled={authBusy}>تسجيل خروج</button>
            <Link href="/account" className="btn">الحساب</Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingTop: 16, paddingBottom: 30 }}>
      <section className="card" style={{ padding: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950 }}>إضافة إعلان</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Link href="/admin" className="btn">لوحة الأدمن</Link>
            <button className="btn" onClick={logout} disabled={authBusy}>خروج</button>
          </div>
        </div>
      </section>

      <CreateListingForm
        form={form}
        setForm={setForm}
        onSave={saveListing}
        onReset={resetForm}
        busy={saving}
        createdId={createdId}
        uploader={uploader}
        saveErr={authErr}
      />
    </div>
  );
}
