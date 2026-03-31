'use client';

/**
 * Admin Page - Aqar Abhur
 * - Dynamic form (deal type -> property type -> fields)
 * - Stable Google Map picker (no React #185 loop)
 * - Map type toggle: Roadmap / Hybrid (satellite)
 * - Robust uploader (id-based, progress, errors) + images/videos paths
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getFirebase } from '@/lib/firebaseClient';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, deleteDoc, getFirestore } from 'firebase/firestore';

import { isAdminUser } from '@/lib/admin';
import { adminCreateListing, adminUpdateListing, fetchListings } from '@/lib/listings';
import { DEAL_TYPES, NEIGHBORHOODS, PROPERTY_TYPES, STATUS_OPTIONS, PROPERTY_CLASSES } from '@/lib/taxonomy';
import { formatPriceSAR, statusBadge } from '@/lib/format';

// ===================== Constants =====================
const LISTINGS_COLLECTION = 'fanar_listings';
const MAX_FILES = 30;

const UPLOAD_CONCURRENCY = 2;
const IMAGE_TIMEOUT_MS = 180000;
const VIDEO_TIMEOUT_MS = 600000;
const STALL_MS = 20000;
const WATCH_INTERVAL_MS = 1200;

// Rough Jeddah bounds
const JEDDAH_BOUNDS = { north: 22.0, south: 21.0, east: 39.5, west: 39.0 };
const DEFAULT_CENTER = { lat: 21.7628, lng: 39.0994 };

// ===================== Helpers =====================
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
function approxSame(a, b, eps = 1e-7) {
  return Math.abs(a - b) <= eps;
}
function inJeddahBounds(lat, lng) {
  return (
    lat <= JEDDAH_BOUNDS.north &&
    lat >= JEDDAH_BOUNDS.south &&
    lng <= JEDDAH_BOUNDS.east &&
    lng >= JEDDAH_BOUNDS.west
  );
}
function uniq(arr) {
  return Array.from(new Set((arr || []).map(String).filter(Boolean)));
}
function safeFileName(name) {
  const raw = String(name || 'file');
  const safe = raw.replace(/\s+/g, '_').replace(/[^\w.\-]+/g, '_').slice(0, 120);
  return safe || `file_${Date.now()}.bin`;
}
function isVideoFile(file) {
  const t = String(file?.type || '');
  const n = String(file?.name || '').toLowerCase();
  return t.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|wmv|flv|3gp|m4v)(\?|$)/i.test(n);
}
function buildGoogleMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${round6(lat)},${round6(lng)}`;
}
function extractLatLngFromUrl(url) {
  try {
    const s = String(url || '').trim();
    if (!s) return { lat: null, lng: null };
    const m1 = s.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (m1) return { lat: Number(m1[1]), lng: Number(m1[2]) };
    const u = new URL(s);
    const q = u.searchParams.get('q') || u.searchParams.get('query') || '';
    const m2 = q.match(/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (m2) return { lat: Number(m2[1]), lng: Number(m2[2]) };
  } catch {}
  return { lat: null, lng: null };
}
function extractStoragePathFromDownloadURL(url) {
  try {
    const u = new URL(url);
    const idx = u.pathname.indexOf('/o/');
    if (idx === -1) return '';
    const encoded = u.pathname.slice(idx + 3);
    return decodeURIComponent(encoded);
  } catch {
    return '';
  }
}
function formatStorageError(e) {
  const code = String(e?.code || '');
  const msg = String(e?.message || '');
  if (msg.toLowerCase().includes('appcheck')) return 'رفع الملفات مرفوض بسبب App Check.';
  if (code === 'upload-stalled') return 'الرفع توقف بدون تقدم.';
  if (code === 'upload-timeout') return 'انتهت مهلة الرفع.';
  if (code === 'storage/unauthorized' || code === 'permission-denied') return 'لا توجد صلاحيات لرفع الملفات.';
  if (code === 'storage/bucket-not-found') return 'Storage Bucket غير صحيح.';
  if (code === 'storage/retry-limit-exceeded') return 'تعذر إكمال الرفع بسبب انقطاع في الشبكة.';
  if (code === 'storage/canceled') return 'تم إلغاء الرفع.';
  if (code === 'storage/quota-exceeded') return 'تم تجاوز سعة التخزين.';
  return msg || 'فشل رفع الملفات.';
}

// ===================== UI helpers =====================
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

// ===================== Google Maps loader (singleton) =====================
let __gmapsPromise = null;
function loadGoogleMaps(apiKey) {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google && window.google.maps) return Promise.resolve(window.google.maps);
  if (__gmapsPromise) return __gmapsPromise;

  __gmapsPromise = new Promise((resolve, reject) => {
    try {
      if (!apiKey) {
        reject(new Error('تعذر تحميل الخريطة. تأكد من NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.'));
        return;
      }

      const scriptId = 'google-maps-js';
      const existing = document.getElementById(scriptId);
      if (existing) {
        const check = () => {
          if (window.google && window.google.maps) resolve(window.google.maps);
          else setTimeout(check, 60);
        };
        check();
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        apiKey
      )}&v=weekly&language=ar&region=SA`;

      script.onload = () => {
        if (window.google && window.google.maps) resolve(window.google.maps);
        else reject(new Error('تم تحميل Google Maps لكن الكائن غير متوفر'));
      };
      script.onerror = () => reject(new Error('فشل تحميل Google Maps'));
      document.head.appendChild(script);
    } catch (e) {
      reject(e);
    }
  });

  return __gmapsPromise;
}

// ===================== Map Picker =====================
function MapPicker({ lat, lng, onChange }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const listenersRef = useRef([]);
  const resizeObsRef = useRef(null);
  const lastValidRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  const [boundsMsg, setBoundsMsg] = useState('');
  const [geoErr, setGeoErr] = useState('');
  const [mapType, setMapType] = useState('roadmap'); // roadmap | hybrid

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // init ONCE (fix React #185 loop)
  useEffect(() => {
    let alive = true;

    async function init() {
      setErr('');
      setBoundsMsg('');
      setGeoErr('');

      try {
        const maps = await loadGoogleMaps(apiKey);
        if (!alive) return;

        const el = mapElRef.current;
        if (!el) return;

        // already initialized
        if (mapRef.current && markerRef.current) {
          setReady(true);
          return;
        }

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

        const applyPos = (lat0, lng0) => {
          if (!isFiniteNum(lat0) || !isFiniteNum(lng0)) return;

          if (!inJeddahBounds(lat0, lng0)) {
            setBoundsMsg('اختر موقعًا داخل حدود جدة فقط.');
            const back = lastValidRef.current || DEFAULT_CENTER;
            try {
              marker.setPosition(back);
              map.panTo(back);
            } catch {}
            return;
          }

          setBoundsMsg('');
          const pos = { lat: round6(lat0), lng: round6(lng0) };
          lastValidRef.current = pos;

          // update marker/map
          try {
            marker.setPosition({ lat: lat0, lng: lng0 });
            map.panTo({ lat: lat0, lng: lng0 });
            if ((map.getZoom?.() || 0) < 16) map.setZoom(16);
          } catch {}

          // emit to parent (no loop, because we only call on user actions)
          try {
            onChangeRef.current?.(pos);
          } catch {}
        };

        listenersRef.current.push(
          map.addListener('click', (e) => {
            const lat1 = e?.latLng?.lat?.();
            const lng1 = e?.latLng?.lng?.();
            applyPos(lat1, lng1);
          })
        );

        listenersRef.current.push(
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            const lat1 = p?.lat?.();
            const lng1 = p?.lng?.();
            applyPos(lat1, lng1);
          })
        );

        // Resize handling
        const forceResize = () => {
          try {
            maps.event.trigger(map, 'resize');
            const p = marker.getPosition();
            if (p) map.panTo({ lat: p.lat(), lng: p.lng() });
          } catch {}
        };

        listenersRef.current.push(
          maps.event.addListenerOnce(map, 'idle', () => {
            [80, 240, 700].forEach((ms) => setTimeout(forceResize, ms));
          })
        );

        if (typeof ResizeObserver !== 'undefined') {
          resizeObsRef.current = new ResizeObserver(() => requestAnimationFrame(forceResize));
          resizeObsRef.current.observe(el);
        }

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
        resizeObsRef.current?.disconnect?.();
      } catch {}
      resizeObsRef.current = null;
      try {
        markerRef.current?.setMap?.(null);
      } catch {}
      markerRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // keep marker in sync when parent changes lat/lng (no onChange here)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    if (!isFiniteNum(lat) || !isFiniteNum(lng)) return;
    if (!inJeddahBounds(lat, lng)) return;

    try {
      const cur = markerRef.current.getPosition();
      if (cur && approxSame(cur.lat(), lat) && approxSame(cur.lng(), lng)) return;

      markerRef.current.setPosition({ lat, lng });
      mapRef.current.panTo({ lat, lng });
      lastValidRef.current = { lat, lng };
      if ((mapRef.current.getZoom?.() || 0) < 16) mapRef.current.setZoom(16);
      window.google?.maps?.event?.trigger?.(mapRef.current, 'resize');
    } catch {}
  }, [lat, lng]);

  // map type toggle (roadmap/hybrid)
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      mapRef.current.setMapTypeId(mapType);
    } catch {}
  }, [mapType]);

  const useMyLocation = useCallback(() => {
    setGeoErr('');
    setBoundsMsg('');

    if (!navigator?.geolocation) {
      setGeoErr('المتصفح لا يدعم تحديد الموقع.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat1 = pos?.coords?.latitude;
        const lng1 = pos?.coords?.longitude;
        if (!isFiniteNum(lat1) || !isFiniteNum(lng1)) {
          setGeoErr('تعذر استخدام موقعك الحالي.');
          return;
        }
        if (!inJeddahBounds(lat1, lng1)) {
          setGeoErr('موقعك الحالي خارج حدود جدة.');
          return;
        }
        try {
          onChangeRef.current?.({ lat: round6(lat1), lng: round6(lng1) });
        } catch {}
      },
      () => setGeoErr('تعذر الحصول على موقعك الحالي.'),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, []);

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div className="muted" style={{ fontSize: 12 }}>
          اضغط على الخريطة لتحديد الموقع أو اسحب الدبوس. (داخل جدة فقط)
        </div>

        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            className={mapType === 'roadmap' ? 'btn btnPrimary' : 'btn'}
            type="button"
            onClick={() => setMapType('roadmap')}
            style={{ fontSize: 12, padding: '6px 10px' }}
          >
            عادي
          </button>
          <button
            className={mapType === 'hybrid' ? 'btn btnPrimary' : 'btn'}
            type="button"
            onClick={() => setMapType('hybrid')}
            style={{ fontSize: 12, padding: '6px 10px' }}
          >
            قمر صناعي
          </button>
          <button className="btn" type="button" onClick={useMyLocation} style={{ fontSize: 12, padding: '6px 10px' }}>
            موقعي الحالي
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 10,
          position: 'relative',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1px solid rgba(214, 179, 91, 0.28)',
          background: 'rgba(255, 255, 255, 0.03)',
          padding: 0,
        }}
      >
        <div
          ref={mapElRef}
          style={{
            width: '100%',
            height: typeof window !== 'undefined' && window.innerWidth <= 768 ? 320 : 420,
          }}
        />

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
              textAlign: 'center',
              background: 'rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(6px)',
              fontWeight: 900,
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
              background: 'rgba(0, 0, 0, 0.12)',
              backdropFilter: 'blur(6px)',
              fontWeight: 900,
              color: '#b42318',
              direction: 'rtl',
            }}
          >
            {err}
          </div>
        ) : null}
      </div>

      {boundsMsg ? (
        <div className="muted" style={{ marginTop: 8, color: '#b45f06', fontSize: 12, fontWeight: 900 }}>
          {boundsMsg}
        </div>
      ) : null}

      {geoErr ? (
        <div className="muted" style={{ marginTop: 8, color: '#b42318', fontSize: 12 }}>
          {geoErr}
        </div>
      ) : null}
    </div>
  );
}

// ===================== Uploader =====================
function useUploader(storage) {
  const [queue, setQueue] = useState([]); // [{id,name,type,progress,url,refPath,status,error}]
  const [uploading, setUploading] = useState(false);

  const queueRef = useRef(queue);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  const removeAt = useCallback(
    async (idx) => {
      const current = queueRef.current || [];
      const item = current[idx];
      if (!item) return;

      // remove from state first
      setQueue((prev) => prev.filter((_, i) => i !== idx));

      // delete from storage if we have refPath and it's uploaded
      if (storage && item.refPath) {
        try {
          await deleteObject(storageRef(storage, item.refPath));
        } catch {}
      }
    },
    [storage]
  );

  const uploadOne = useCallback(
    async (item) => {
      const file = item.file;
      const isVideo = isVideoFile(file);
      const folder = isVideo ? 'fanar_videos' : 'fanar_images';
      const timeoutMs = isVideo ? VIDEO_TIMEOUT_MS : IMAGE_TIMEOUT_MS;

      const name = safeFileName(file?.name);
      const refPath = `${folder}/${Date.now()}_${Math.random().toString(16).slice(2)}_${name}`;
      const refObj = storageRef(storage, refPath);

      setQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'uploading', refPath, error: '' } : x)));

      const metadata = {
        contentType: file?.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
        cacheControl: 'public,max-age=31536000',
      };

      const task = uploadBytesResumable(refObj, file, metadata);

      let lastBytes = 0;
      let lastTick = Date.now();
      const startedAt = Date.now();

      return await new Promise((resolve, reject) => {
        const watcher = setInterval(() => {
          const now = Date.now();

          if (now - startedAt > timeoutMs) {
            try {
              task.cancel();
            } catch {}
            const err = new Error('upload-timeout');
            err.code = 'upload-timeout';
            clearInterval(watcher);
            reject(err);
            return;
          }

          if (now - lastTick > STALL_MS) {
            try {
              task.cancel();
            } catch {}
            const err = new Error('upload-stalled');
            err.code = 'upload-stalled';
            clearInterval(watcher);
            reject(err);
          }
        }, WATCH_INTERVAL_MS);

        const unsub = task.on(
          'state_changed',
          (snap) => {
            const bt = snap.bytesTransferred || 0;
            if (bt !== lastBytes) {
              lastBytes = bt;
              lastTick = Date.now();
            }
            const pct = snap.totalBytes ? Math.round((bt / snap.totalBytes) * 100) : 0;
            setQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, progress: pct } : x)));
          },
          (err) => {
            clearInterval(watcher);
            try {
              unsub();
            } catch {}
            reject(err);
          },
          async () => {
            clearInterval(watcher);
            try {
              unsub();
            } catch {}
            resolve(task);
          }
        );
      })
        .then(async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, url, progress: 100, status: 'done' } : x)));
          return url;
        })
        .catch((e) => {
          const msg = formatStorageError(e);
          setQueue((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: 'error', error: msg } : x)));
          return null;
        });
    },
    [storage]
  );

  const runPool = useCallback(async (items, concurrency, worker) => {
    const results = [];
    let i = 0;
    const workers = Array(concurrency)
      .fill(0)
      .map(async () => {
        while (i < items.length) {
          const idx = i++;
          results[idx] = await worker(items[idx], idx);
        }
      });
    await Promise.all(workers);
    return results;
  }, []);

  const addFiles = useCallback(
    async (files) => {
      if (!storage) return;

      const arr = Array.from(files || []).filter(Boolean);
      if (!arr.length) return;

      const currentLen = (queueRef.current || []).length;
      const available = Math.max(0, MAX_FILES - currentLen);
      const picked = arr.slice(0, available);
      if (!picked.length) return;

      const newItems = picked.map((file) => ({
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: file?.name || 'file',
        type: file?.type || '',
        file,
        progress: 0,
        url: '',
        refPath: '',
        status: 'queued',
        error: '',
      }));

      setQueue((prev) => [...prev, ...newItems]);
      setUploading(true);

      try {
        await runPool(newItems, UPLOAD_CONCURRENCY, async (it) => {
          return await uploadOne(it);
        });
      } finally {
        setUploading(false);
      }
    },
    [storage, runPool, uploadOne]
  );

  const urls = useMemo(() => uniq(queue.map((q) => q.url).filter(Boolean)), [queue]);

  return { queue, setQueue, uploading, addFiles, removeAt, urls };
}

// ===================== Create/Edit Form =====================
function CreateEditForm({ editingId, form, setForm, onSave, onReset, busy, createdId, uploader }) {
  const { queue, uploading, addFiles, removeAt } = uploader;

  const pricePreview = form.price ? formatPriceSAR(Number(String(form.price).replace(/[^\d]/g, ''))) : '';
  const rentAnnual = form.dealType === 'rent';

  const onMapChange = useCallback(
    ({ lat, lng }) => {
      setForm((p) => ({
        ...p,
        lat: String(round6(lat)),
        lng: String(round6(lng)),
        websiteUrl: buildGoogleMapsUrl(lat, lng),
      }));
    },
    [setForm]
  );

  const lat = toNum(form.lat);
  const lng = toNum(form.lng);

  return (
    <section className="card" style={{ padding: 14, marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ fontWeight: 950 }}>{editingId ? 'تعديل إعلان' : 'إضافة إعلان جديد'}</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" type="button" onClick={onReset} disabled={busy || uploading}>
            مسح
          </button>
          <button className="btn btnPrimary" type="button" onClick={onSave} disabled={busy || uploading}>
            {busy ? 'جاري الحفظ…' : uploading ? 'انتظر اكتمال الرفع…' : editingId ? 'تحديث الإعلان' : 'نشر الإعلان'}
          </button>
        </div>
      </div>

      {createdId ? (
        <div className="card" style={{ marginTop: 12, padding: 12, borderColor: 'rgba(16,185,129,.25)', background: 'rgba(16,185,129,.07)', fontWeight: 900 }}>
          تم حفظ الإعلان. رقم الإعلان: <b>{createdId}</b>
        </div>
      ) : null}

      <Field label="نوع الصفقة">
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          {DEAL_TYPES.map((d) => (
            <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="radio" name="dealType" checked={form.dealType === d.key} onChange={() => setForm((p) => ({ ...p, dealType: d.key, propertyType: '' }))} />
              <span style={{ fontWeight: 900 }}>{d.label}</span>
            </label>
          ))}
        </div>
      </Field>

      {form.dealType ? (
        <Field label="نوع العقار">
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {PROPERTY_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                className={form.propertyType === t ? 'btn btnPrimary' : 'btn'}
                onClick={() => setForm((p) => ({ ...p, propertyType: t }))}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      {form.propertyType ? (
        <>
          <Field label="تصنيف (سكني/تجاري) - اختياري">
            <select className="input" value={form.propertyClass} onChange={(e) => setForm((p) => ({ ...p, propertyClass: e.target.value }))}>
              <option value="">بدون</option>
              {PROPERTY_CLASSES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="عنوان الإعلان">
            <input className="input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="مثال: شقة للإيجار في حي الياقوت" />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label={rentAnnual ? 'السعر (ريال) - سنوي' : 'السعر (ريال)'}>
              <input
                className="input"
                inputMode="numeric"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value.replace(/[^\d]/g, '') }))}
                placeholder={rentAnnual ? 'مثال: 20000' : 'مثال: 950000'}
              />
              {pricePreview ? <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>المعاينة: {pricePreview}</div> : null}
            </Field>

            <Field label="المساحة (م²) - اختياري">
              <input className="input" inputMode="numeric" value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value.replace(/[^\d]/g, '') }))} placeholder="مثال: 120" />
            </Field>
          </div>

          <Field label="الحي">
            <select className="input" value={form.neighborhood} onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}>
              <option value="">اختر الحي</option>
              {NEIGHBORHOODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="المخطط (اختياري)">
              <input className="input" value={form.plan} onChange={(e) => setForm((p) => ({ ...p, plan: e.target.value }))} placeholder="مثال: الخالدية السياحي" />
            </Field>

            <Field label="الجزء (اختياري)">
              <input className="input" value={form.part} onChange={(e) => setForm((p) => ({ ...p, part: e.target.value }))} placeholder="مثال: ج" />
            </Field>
          </div>

          <Field label="حالة الإعلان">
            <select className="input" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <div style={{ marginTop: 6 }}>{statusBadge(form.status)}</div>
          </Field>

          <Field label="الوصف (اختياري)">
            <textarea className="input" rows={4} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} style={{ resize: 'vertical' }} placeholder="تفاصيل إضافية…" />
          </Field>

          <Divider />

          <Field label="رفع صور/فيديو" hint={`حد أقصى ${MAX_FILES} ملف`}>
            <label className="btn btnPrimary" style={{ cursor: 'pointer' }}>
              اختر ملفات
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </label>

            {queue.length ? (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {queue.map((q, idx) => (
                  <div key={q.id} className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.name}</div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                          {q.status === 'done' ? 'تم الرفع' : q.status === 'error' ? 'فشل الرفع' : `جاري الرفع: ${q.progress || 0}%`}
                        </div>
                        {q.error ? (
                          <div className="muted" style={{ marginTop: 6, color: 'var(--danger)', fontSize: 12 }}>
                            {q.error}
                          </div>
                        ) : null}
                      </div>

                      <button className="btn" type="button" onClick={() => removeAt(idx)} style={{ fontSize: 12 }} disabled={q.status === 'uploading'}>
                        حذف
                      </button>
                    </div>

                    <div style={{ marginTop: 8, height: 10, borderRadius: 999, background: 'rgba(214,179,91,0.22)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, q.progress || 0)}%`, height: '100%', background: 'linear-gradient(135deg, var(--primary), var(--primary2))', borderRadius: 999 }} />
                    </div>

                    {q.url ? (
                      <div className="muted" style={{ marginTop: 8, fontSize: 12, wordBreak: 'break-all' }}>
                        {q.url}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                لم يتم اختيار ملفات.
              </div>
            )}
          </Field>

          <Divider />

          <Field label="موقع العقار على الخريطة" hint="حدد الموقع من الخريطة (داخل جدة فقط).">
            <input
              className="input"
              value={form.websiteUrl}
              onChange={(e) => {
                const v = e.target.value;
                const p = extractLatLngFromUrl(v);
                setForm((prev) => ({
                  ...prev,
                  websiteUrl: v,
                  ...(isFiniteNum(p.lat) && isFiniteNum(p.lng) ? { lat: String(round6(p.lat)), lng: String(round6(p.lng)) } : {}),
                }));
              }}
              placeholder="رابط Google Maps (اختياري)"
            />

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
              <div className="muted" style={{ fontSize: 12, fontWeight: 900 }}>
                الإحداثيات المختارة:{' '}
                <span style={{ color: 'var(--text)', fontWeight: 950 }}>
                  {form.lat ? form.lat : '—'} , {form.lng ? form.lng : '—'}
                </span>
              </div>

              <button className="btn" type="button" onClick={() => setForm((p) => ({ ...p, lat: '', lng: '', websiteUrl: '' }))} style={{ fontSize: 12, padding: '6px 10px' }}>
                مسح الموقع
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <MapPicker lat={lat} lng={lng} onChange={onMapChange} />
            </div>
          </Field>
        </>
      ) : null}
    </section>
  );
}

// ===================== Manage Listings =====================
function ManageListings({ list, loadingList, actionBusyId, onLoad, onDelete, onEdit }) {
  const dangerBtnStyle = {
    border: '1px solid rgba(220,38,38,.35)',
    background: 'rgba(220,38,38,.08)',
    color: '#b42318',
  };

  return (
    <section className="card" style={{ padding: 14, marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 950 }}>إدارة العروض</div>
        <button className="btn" type="button" onClick={onLoad} disabled={loadingList}>
          {loadingList ? 'تحميل…' : 'تحديث القائمة'}
        </button>
      </div>

      <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
        {list.length ? `عدد العروض: ${list.length}` : 'لا توجد عروض حالياً.'}
      </div>

      {list.length ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((it) => {
            const id = it?.id || it?.docId || '';
            const busy = actionBusyId === id;

            return (
              <div key={id} className="card" style={{ padding: 12 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 240 }}>
                    <div style={{ fontWeight: 950 }}>{it.title || '—'}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {it.neighborhood ? `الحي: ${it.neighborhood}` : ''}{' '}
                      {it.price != null ? `• السعر: ${formatPriceSAR(Number(it.price))}` : ''}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <button className="btn" type="button" onClick={() => onEdit(id)} disabled={busy}>
                      تعديل
                    </button>
                    <button className="btn" type="button" onClick={() => onDelete(it)} style={dangerBtnStyle} disabled={busy}>
                      {busy ? '...' : 'حذف'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

// ===================== Page =====================
export default function AdminPage() {
  const fb = getFirebase();
  const auth = fb?.auth;
  const storage = fb?.storage;
  const db = fb?.db || fb?.firestore || (fb?.app ? getFirestore(fb.app) : getFirestore());

  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);

  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authErr, setAuthErr] = useState('');

  const [tab, setTab] = useState('create'); // create | manage

  const [editingId, setEditingId] = useState('');
  const [createdId, setCreatedId] = useState('');
  const [saving, setSaving] = useState(false);

  const initialForm = useMemo(
    () => ({
      dealType: '',
      propertyType: '',
      propertyClass: '',
      title: '',
      price: '',
      area: '',
      neighborhood: '',
      plan: '',
      part: '',
      status: 'available',
      description: '',
      websiteUrl: '',
      lat: '',
      lng: '',
    }),
    []
  );

  const [form, setForm] = useState(initialForm);

  // list
  const [list, setList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [actionBusyId, setActionBusyId] = useState('');

  const uploader = useUploader(storage);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setChecking(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setChecking(false);
    });
    return () => unsub();
  }, [auth]);

  const isAdmin = isAdminUser(user);

  const resetForm = useCallback(() => {
    setEditingId('');
    setCreatedId('');
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

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const rows = await fetchListings({ onlyPublic: false, includeLegacy: false, max: 500 });
      setList(Array.isArray(rows) ? rows : []);
    } catch {
      // fallback signature
      try {
        const rows = await fetchListings({ filters: {}, onlyPublic: false });
        setList(Array.isArray(rows) ? rows : []);
      } catch {
        setList([]);
      }
    } finally {
      setLoadingList(false);
    }
  }, []);

  const editListing = useCallback(
    (id) => {
      const it = (list || []).find((x) => x.id === id || x.docId === id);
      if (!it) return;

      setTab('create');
      setCreatedId('');
      setEditingId(id);

      // sync form
      setForm((p) => ({
        ...p,
        dealType: it.dealType || '',
        propertyType: it.propertyType || '',
        propertyClass: it.propertyClass || '',
        title: it.title || '',
        price: it.price != null ? String(it.price) : '',
        area: it.area != null ? String(it.area) : '',
        neighborhood: it.neighborhood || '',
        plan: it.plan || '',
        part: it.part || '',
        status: it.status || 'available',
        description: it.description || '',
        websiteUrl: it.websiteUrl || it.website || '',
        lat: it.lat != null ? String(it.lat) : '',
        lng: it.lng != null ? String(it.lng) : '',
      }));

      // sync existing media into uploader queue (display + save)
      const imgs = Array.isArray(it.images) ? it.images : [];
      uploader.setQueue(
        imgs.map((url, i) => ({
          id: `existing_${id}_${i}`,
          name: `existing_${i + 1}`,
          type: isVideoFile({ name: url, type: '' }) ? 'video/*' : 'image/*',
          file: null,
          progress: 100,
          url,
          refPath: '',
          status: 'done',
          error: '',
        }))
      );
    },
    [list, uploader]
  );

  const saveListing = useCallback(async () => {
    if (saving) return;

    if (uploader.uploading) {
      setAuthErr('انتظر اكتمال رفع الملفات ثم احفظ الإعلان.');
      return;
    }

    setSaving(true);
    setAuthErr('');

    try {
      const title = String(form.title || '').trim();
      const neighborhood = String(form.neighborhood || '').trim();

      if (!form.dealType) {
        setAuthErr('اختر نوع الصفقة.');
        setSaving(false);
        return;
      }
      if (!form.propertyType) {
        setAuthErr('اختر نوع العقار.');
        setSaving(false);
        return;
      }
      if (!title) {
        setAuthErr('اكتب عنوان الإعلان.');
        setSaving(false);
        return;
      }
      if (!neighborhood) {
        setAuthErr('اختر الحي.');
        setSaving(false);
        return;
      }

      const lat = toNum(form.lat);
      const lng = toNum(form.lng);

      const payload = {
        dealType: form.dealType || '',
        propertyType: form.propertyType || '',
        propertyClass: form.propertyClass || '',
        title,
        price: toNum(form.price),
        area: toNum(form.area),
        neighborhood,
        plan: String(form.plan || '').trim(),
        part: String(form.part || '').trim(),
        status: form.status || 'available',
        description: String(form.description || '').trim(),
        websiteUrl: String(form.websiteUrl || '').trim() || (isFiniteNum(lat) && isFiniteNum(lng) ? buildGoogleMapsUrl(lat, lng) : ''),
        lat: isFiniteNum(lat) ? round6(lat) : null,
        lng: isFiniteNum(lng) ? round6(lng) : null,
        images: uploader.urls,
        updatedAt: new Date(),
      };

      let id = editingId;
      if (editingId) {
        await adminUpdateListing(editingId, payload);
      } else {
        const created = await adminCreateListing(payload);
        id = created?.id || created || '';
      }

      setCreatedId(id || 'تم');
      setEditingId(id || editingId);

      await loadList();
    } catch (e) {
      setAuthErr(String(e?.message || 'تعذر حفظ الإعلان.'));
    } finally {
      setSaving(false);
    }
  }, [saving, editingId, form, uploader.uploading, uploader.urls, loadList]);

  const deleteListing = useCallback(
    async (it) => {
      const id = it?.id || it?.docId;
      if (!id) return;

      if (!confirm(`تأكيد حذف الإعلان؟\n\n${it?.title || id}`)) return;

      setActionBusyId(id);
      try {
        // try delete storage media too
        const media = Array.isArray(it.images) ? it.images : [];
        for (const url of media) {
          const path = extractStoragePathFromDownloadURL(url);
          if (path && storage) {
            try {
              await deleteObject(storageRef(storage, path));
            } catch {}
          }
        }

        await deleteDoc(doc(db, LISTINGS_COLLECTION, id));
        await loadList();
      } catch {
      } finally {
        setActionBusyId('');
      }
    },
    [db, storage, loadList]
  );

  if (checking) {
    return (
      <div className="container" style={{ paddingTop: 16 }}>
        <section className="card" style={{ padding: 14 }}>جاري التحقق…</section>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ paddingTop: 16 }}>
        <section className="card" style={{ padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontWeight: 950 }}>لوحة الأدمن</div>
          </div>

          <div className="muted" style={{ marginTop: 8 }}>
            سجل دخول الأدمن لإضافة/إدارة الإعلانات.
          </div>

          <form onSubmit={login} style={{ marginTop: 12 }}>
            <Field label="البريد">
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>

            <Field label="كلمة المرور">
              <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
            </Field>

            {authErr ? <div style={{ marginTop: 10, color: 'var(--danger)', fontWeight: 900 }}>{authErr}</div> : null}

            <button className="btn btnPrimary" style={{ marginTop: 12, width: '100%' }} disabled={authBusy}>
              {authBusy ? '...' : 'دخول'}
            </button>
          </form>
        </section>

        <style jsx>{`
          .btnPrimary { background: var(--primary); border-color: transparent; }
        `}</style>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container" style={{ paddingTop: 16 }}>
        <section className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 950 }}>غير مصرح</div>
          <div className="muted" style={{ marginTop: 8 }}>هذا الحساب لا يملك صلاحية الأدمن.</div>
          <div className="row" style={{ gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn" onClick={logout} disabled={authBusy}>تسجيل خروج</button>
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
            <div style={{ fontWeight: 950 }}>لوحة الأدمن</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </div>
          </div>

          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <button className="btn" onClick={logout} disabled={authBusy}>خروج</button>
          </div>
        </div>

        {authErr ? (
          <div className="card" style={{ marginTop: 12, padding: 12, borderColor: 'rgba(220,38,38,.22)', background: 'rgba(220,38,38,.06)', fontWeight: 900 }}>
            {authErr}
          </div>
        ) : null}

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <button className={tab === 'create' ? 'btn btnPrimary' : 'btn'} type="button" onClick={() => setTab('create')}>
            إضافة/تعديل
          </button>
          <button className={tab === 'manage' ? 'btn btnPrimary' : 'btn'} type="button" onClick={() => setTab('manage')}>
            إدارة العروض
          </button>
        </div>
      </section>

      {tab === 'create' ? (
        <CreateEditForm
          editingId={editingId}
          form={form}
          setForm={setForm}
          onSave={saveListing}
          onReset={resetForm}
          busy={saving}
          createdId={createdId}
          uploader={uploader}
        />
      ) : (
        <ManageListings
          list={list}
          loadingList={loadingList}
          actionBusyId={actionBusyId}
          onLoad={loadList}
          onDelete={deleteListing}
          onEdit={editListing}
        />
      )}

      {/* Minimal CSS to prevent layout break if global styles changed */}
      <style jsx>{`
        .btnPrimary { background: var(--primary); border-color: transparent; }
      `}</style>
    </div>
  );
}
