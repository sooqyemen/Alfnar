'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage';

import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import { formatPriceSAR, statusBadge } from '@/lib/format';
import { getFirebase } from '@/lib/firebaseClient';
import { adminDeleteListing, adminUpdateListing, fetchListingById, getListingMedia } from '@/lib/listings';
import { DEAL_TYPES, NEIGHBORHOODS, PROPERTY_CLASSES, PROPERTY_TYPES, STATUS_OPTIONS } from '@/lib/taxonomy';

const MAX_FILES = 30;

function cleanString(value) {
  return String(value || '').trim();
}

function toNum(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function isVideo(entry) {
  const kind = cleanString(entry?.kind).toLowerCase();
  if (kind === 'video') return true;
  const url = cleanString(entry?.url).toLowerCase();
  return ['.mp4', '.mov', '.webm', '.m4v'].some((ext) => url.includes(ext));
}

function safeFileName(file) {
  return cleanString(file?.name || 'file').replace(/[^\w.\-]+/g, '_');
}

function mediaEqual(a, b) {
  if (!a || !b) return false;
  if (a.refPath && b.refPath) return a.refPath === b.refPath;
  return a.url === b.url;
}

function mapListingToForm(item) {
  return {
    title: cleanString(item?.title),
    neighborhood: cleanString(item?.neighborhood),
    plan: cleanString(item?.plan),
    part: cleanString(item?.part),
    dealType: cleanString(item?.dealType || 'sale'),
    propertyType: cleanString(item?.propertyType || 'أرض'),
    propertyClass: cleanString(item?.propertyClass),
    price: item?.price ?? '',
    area: item?.area ?? '',
    status: cleanString(item?.status || 'available'),
    licenseNumber: cleanString(item?.licenseNumber || item?.license),
    contactPhone: cleanString(item?.contactPhone || item?.phone || item?.mobile || item?.whatsapp),
    description: cleanString(item?.description),
    lat: item?.lat ?? '',
    lng: item?.lng ?? '',
  };
}

function InfoCard({ label, value }) {
  return (
    <div style={infoCardStyle}>
      <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 800, color: '#0f172a' }}>{value || '—'}</div>
    </div>
  );
}

function MediaTile({ entry, selected, onToggle, onMakePrimary, onDelete }) {
  const video = isVideo(entry);

  return (
    <div style={{ ...mediaTileStyle, borderColor: selected ? '#0f172a' : '#e5e7eb' }}>
      <label style={checkboxWrapStyle}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span>تحديد</span>
      </label>

      <div style={mediaPreviewStyle}>
        {video ? (
          <video src={entry.url} style={mediaInnerStyle} controls preload="metadata" />
        ) : (
          <img src={entry.url} alt={entry.name || 'صورة الإعلان'} style={mediaInnerStyle} />
        )}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13, wordBreak: 'break-word' }}>{entry.name || 'ملف مرفوع'}</div>
        <div style={{ color: '#64748b', fontSize: 12, wordBreak: 'break-all' }}>{entry.refPath || entry.url}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={onMakePrimary} style={smallBtnStyle}>اجعلها رئيسية</button>
        <button type="button" className="btn" onClick={onDelete} style={{ ...smallBtnStyle, color: '#991b1b', borderColor: '#fecaca' }}>حذف</button>
      </div>
    </div>
  );
}

export default function AdminListingEditPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = cleanString(params?.id);
  const { storage } = getFirebase();
  const fileInputRef = useRef(null);

  const [listing, setListing] = useState(null);
  const [form, setForm] = useState(() => mapListingToForm(null));
  const [media, setMedia] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState(false);
  const [deletingListing, setDeletingListing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedEntries = useMemo(() => {
    return media.filter((entry) => selectedKeys.includes(entry.refPath || entry.url));
  }, [media, selectedKeys]);

  const load = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchListingById(listingId, { includeLegacy: false });
      if (!data) {
        setError('الإعلان غير موجود أو لا يمكن الوصول إليه.');
        setListing(null);
        setMedia([]);
        return;
      }
      setListing(data);
      setForm(mapListingToForm(data));
      setMedia(getListingMedia(data));
      setSelectedKeys([]);
    } catch (e) {
      setError(String(e?.message || 'تعذر تحميل الإعلان.'));
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => { load(); }, [load]);

  const syncMediaToDoc = useCallback(async (nextMedia, { message = '' } = {}) => {
    await adminUpdateListing(listingId, {
      imagesMeta: nextMedia,
      images: nextMedia.map((item) => item.url),
    });
    setMedia(nextMedia);
    setListing((prev) => (prev ? { ...prev, imagesMeta: nextMedia, images: nextMedia.map((item) => item.url) } : prev));
    setSelectedKeys([]);
    if (message) setSuccess(message);
  }, [listingId]);

  const updateFormField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveDetails = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!cleanString(form.title)) throw new Error('اكتب عنوان الإعلان.');
      if (!cleanString(form.neighborhood)) throw new Error('اختر الحي.');

      const patch = {
        title: cleanString(form.title),
        neighborhood: cleanString(form.neighborhood),
        plan: cleanString(form.plan),
        part: cleanString(form.part),
        dealType: cleanString(form.dealType || 'sale'),
        propertyType: cleanString(form.propertyType || 'أرض'),
        propertyClass: cleanString(form.propertyClass),
        price: toNum(form.price),
        area: toNum(form.area),
        status: cleanString(form.status || 'available'),
        licenseNumber: cleanString(form.licenseNumber),
        contactPhone: cleanString(form.contactPhone),
        description: cleanString(form.description),
        lat: toNum(form.lat),
        lng: toNum(form.lng),
      };

      await adminUpdateListing(listingId, patch);
      setListing((prev) => (prev ? { ...prev, ...patch } : prev));
      setSuccess('تم حفظ بيانات الإعلان بنجاح.');
    } catch (e) {
      setError(String(e?.message || 'تعذر حفظ التعديلات.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleEntry = (entry) => {
    const key = entry.refPath || entry.url;
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const selectAll = () => setSelectedKeys(media.map((entry) => entry.refPath || entry.url));
  const clearSelection = () => setSelectedKeys([]);

  const deleteEntries = async (entriesToDelete) => {
    if (!entriesToDelete.length) {
      setError('حدد صورة واحدة على الأقل.');
      return;
    }

    setDeletingMedia(true);
    setError('');
    setSuccess('');
    try {
      for (const entry of entriesToDelete) {
        if (entry.refPath) {
          try {
            await deleteObject(storageRef(storage, entry.refPath));
          } catch (_) {}
        }
      }
      const remaining = media.filter((entry) => !entriesToDelete.some((target) => mediaEqual(entry, target)));
      await syncMediaToDoc(remaining, {
        message: entriesToDelete.length === 1 ? 'تم حذف الملف.' : `تم حذف ${entriesToDelete.length} ملف.`,
      });
    } catch (e) {
      setError(String(e?.message || 'تعذر حذف الملفات.'));
    } finally {
      setDeletingMedia(false);
    }
  };

  const deleteSelected = async () => deleteEntries(selectedEntries);
  const deleteAllMedia = async () => deleteEntries(media);

  const makePrimary = async (entry) => {
    setDeletingMedia(true);
    setError('');
    setSuccess('');
    try {
      const rest = media.filter((item) => !mediaEqual(item, entry));
      const next = [entry, ...rest];
      await syncMediaToDoc(next, { message: 'تم تعيين الصورة الرئيسية.' });
    } catch (e) {
      setError(String(e?.message || 'تعذر تحديث ترتيب الصور.'));
    } finally {
      setDeletingMedia(false);
    }
  };

  const uploadFiles = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_FILES);
    if (!files.length) return;

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const uploaded = [];
      for (const file of files) {
        const path = `fanar_images/listings/${listingId}/${Date.now()}_${Math.random().toString(16).slice(2)}_${safeFileName(file)}`;
        const refObj = storageRef(storage, path);
        const task = uploadBytesResumable(refObj, file);

        await new Promise((resolve, reject) => {
          task.on('state_changed', null, reject, resolve);
        });

        const url = await getDownloadURL(task.snapshot.ref);
        uploaded.push({
          url,
          refPath: path,
          name: cleanString(file.name),
          kind: cleanString(file.type).startsWith('video/') ? 'video' : 'image',
        });
      }

      const next = [...media, ...uploaded];
      await syncMediaToDoc(next, {
        message: uploaded.length === 1 ? 'تم رفع الملف وربطه بالإعلان.' : `تم رفع ${uploaded.length} ملفات وربطها بالإعلان.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setError(String(e?.message || 'تعذر رفع الملفات.'));
    } finally {
      setUploading(false);
    }
  };

  const deleteListingNow = async () => {
    setDeletingListing(true);
    setError('');
    setSuccess('');
    try {
      for (const entry of media) {
        if (entry.refPath) {
          try {
            await deleteObject(storageRef(storage, entry.refPath));
          } catch (_) {}
        }
      }
      await adminDeleteListing(listingId);
      router.push('/admin/listings');
    } catch (e) {
      setError(String(e?.message || 'تعذر حذف الإعلان.'));
      setDeletingListing(false);
    }
  };

  const coverEntry = media[0] || null;
  const cover = coverEntry?.url || '/placeholder-image.jpg';

  return (
    <AdminGuard title="إدارة الإعلان والصور">
      <AdminShell
        title="تعديل الإعلان"
        description="هذه الصفحة مخصصة لتعديل بيانات الإعلان وإدارة صوره من نفس المكان، مع دعم التحديد الجماعي وحذف الصور ورفع صور جديدة."
        actions={[
          <Link key="back" href="/admin/listings" style={secondaryBtnStyle}>كل العروض</Link>,
          <Link key="view" href={listingId ? `/listing/${listingId}` : '/admin/listings'} style={primaryBtnStyle}>فتح الإعلان</Link>,
        ]}
      >
        {error ? <div style={errorStyle}>{error}</div> : null}
        {success ? <div style={successStyle}>{success}</div> : null}

        {loading ? <section style={panelStyle}>جاري تحميل الإعلان...</section> : null}

        {!loading && !listing ? (
          <section style={panelStyle}>
            الإعلان غير موجود.
          </section>
        ) : null}

        {!loading && listing ? (
          <>
            <section style={heroGridStyle}>
              <div style={coverCardStyle}>
                {isVideo(coverEntry) ? (
                  <video src={cover} style={coverStyle} controls preload="metadata" />
                ) : (
                  <img src={cover} alt={listing.title || 'صورة الإعلان'} style={coverStyle} />
                )}
              </div>

              <div style={panelStyle}>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a' }}>{form.title || 'بدون عنوان'}</div>
                    <div style={mutedTextStyle}>{[form.neighborhood, form.plan, form.part].filter(Boolean).join(' — ') || 'بدون موقع تفصيلي'}</div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={pillStyle}>{form.dealType === 'rent' ? 'إيجار' : 'بيع'}</span>
                    <span style={pillStyle}>{form.propertyType || '—'}</span>
                    <span>{statusBadge(form.status)}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                    <InfoCard label="السعر" value={formatPriceSAR(form.price)} />
                    <InfoCard label="المساحة" value={form.area ? `${form.area} م²` : '—'} />
                    <InfoCard label="عدد الصور" value={String(media.length)} />
                    <InfoCard label="رقم الجوال" value={form.contactPhone || '—'} />
                  </div>
                </div>
              </div>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h3 style={sectionTitleStyle}>بيانات الإعلان</h3>
                  <div style={mutedTextStyle}>تعديل العنوان، الحي، السعر، الحالة، ورقم الجوال المباشر.</div>
                </div>
                <button className="btn btnPrimary" type="button" onClick={saveDetails} disabled={saving || uploading || deletingMedia}>
                  {saving ? 'جاري الحفظ...' : 'حفظ البيانات'}
                </button>
              </div>

              <div style={formGridStyle}>
                <Field label="عنوان الإعلان">
                  <input className="input" value={form.title} onChange={(e) => updateFormField('title', e.target.value)} />
                </Field>

                <Field label="الحي">
                  <select className="input" value={form.neighborhood} onChange={(e) => updateFormField('neighborhood', e.target.value)}>
                    <option value="">اختر الحي</option>
                    {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>

                <Field label="نوع الصفقة">
                  <select className="input" value={form.dealType} onChange={(e) => updateFormField('dealType', e.target.value)}>
                    {DEAL_TYPES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </Field>

                <Field label="نوع العقار">
                  <select className="input" value={form.propertyType} onChange={(e) => updateFormField('propertyType', e.target.value)}>
                    {PROPERTY_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </Field>

                <Field label="التصنيف">
                  <select className="input" value={form.propertyClass} onChange={(e) => updateFormField('propertyClass', e.target.value)}>
                    <option value="">بدون</option>
                    {PROPERTY_CLASSES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </Field>

                <Field label="حالة الإعلان">
                  <select className="input" value={form.status} onChange={(e) => updateFormField('status', e.target.value)}>
                    {STATUS_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                  </select>
                </Field>

                <Field label={`السعر (${form.dealType === 'rent' ? 'سنوي' : 'ريال'})`}>
                  <input className="input" inputMode="numeric" value={form.price} onChange={(e) => updateFormField('price', e.target.value.replace(/[^\d]/g, ''))} />
                </Field>

                <Field label="المساحة">
                  <input className="input" inputMode="numeric" value={form.area} onChange={(e) => updateFormField('area', e.target.value.replace(/[^\d]/g, ''))} />
                </Field>

                <Field label="المخطط">
                  <input className="input" value={form.plan} onChange={(e) => updateFormField('plan', e.target.value)} />
                </Field>

                <Field label="الجزء">
                  <input className="input" value={form.part} onChange={(e) => updateFormField('part', e.target.value)} />
                </Field>

                <Field label="رقم الترخيص">
                  <input className="input" value={form.licenseNumber} onChange={(e) => updateFormField('licenseNumber', e.target.value)} />
                </Field>

                <Field label="رقم الجوال المباشر">
                  <input className="input" inputMode="tel" value={form.contactPhone} onChange={(e) => updateFormField('contactPhone', e.target.value.replace(/[^\d+]/g, ''))} />
                </Field>

                <Field label="خط العرض">
                  <input className="input" inputMode="decimal" value={form.lat} onChange={(e) => updateFormField('lat', e.target.value)} />
                </Field>

                <Field label="خط الطول">
                  <input className="input" inputMode="decimal" value={form.lng} onChange={(e) => updateFormField('lng', e.target.value)} />
                </Field>
              </div>

              <Field label="الوصف">
                <textarea className="input" rows={6} value={form.description} onChange={(e) => updateFormField('description', e.target.value)} style={{ resize: 'vertical' }} />
              </Field>
            </section>

            <section style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h3 style={sectionTitleStyle}>إدارة الصور والملفات</h3>
                  <div style={mutedTextStyle}>تقدر ترفع صور جديدة، تحدد عدة صور، وتحذف المحدد أو الكل مباشرة من لوحة الإدارة.</div>
                </div>
                <label className="btn btnPrimary" style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}>
                  {uploading ? 'جاري الرفع...' : 'رفع صور جديدة'}
                  <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={uploadFiles} style={{ display: 'none' }} disabled={uploading || deletingMedia} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                <button className="btn" type="button" onClick={selectAll} disabled={!media.length || deletingMedia}>تحديد الكل</button>
                <button className="btn" type="button" onClick={clearSelection} disabled={!selectedKeys.length || deletingMedia}>إلغاء التحديد</button>
                <button className="btn" type="button" onClick={deleteSelected} disabled={!selectedEntries.length || deletingMedia || uploading} style={{ color: '#991b1b', borderColor: '#fecaca' }}>
                  {deletingMedia ? 'جاري الحذف...' : `حذف المحدد (${selectedEntries.length})`}
                </button>
                <button className="btn" type="button" onClick={deleteAllMedia} disabled={!media.length || deletingMedia || uploading} style={{ color: '#991b1b', borderColor: '#fecaca' }}>
                  حذف كل الصور
                </button>
              </div>

              {!media.length ? (
                <div style={emptyMediaStyle}>لا توجد صور مرتبطة بهذا الإعلان حاليًا.</div>
              ) : (
                <div style={mediaGridStyle}>
                  {media.map((entry, index) => (
                    <MediaTile
                      key={`${entry.refPath || entry.url}_${index}`}
                      entry={entry}
                      selected={selectedKeys.includes(entry.refPath || entry.url)}
                      onToggle={() => toggleEntry(entry)}
                      onMakePrimary={() => makePrimary(entry)}
                      onDelete={() => deleteEntries([entry])}
                    />
                  ))}
                </div>
              )}
            </section>

            <section style={{ ...panelStyle, borderColor: '#fecaca' }}>
              <div style={sectionHeaderStyle}>
                <div>
                  <h3 style={{ ...sectionTitleStyle, color: '#991b1b' }}>منطقة خطرة</h3>
                  <div style={mutedTextStyle}>هذا الخيار يحذف الإعلان نفسه، ويحاول حذف كل الصور المرتبطة به من التخزين أيضًا.</div>
                </div>
                <button className="btn" type="button" onClick={deleteListingNow} disabled={deletingListing || uploading || deletingMedia} style={{ color: '#991b1b', borderColor: '#fecaca' }}>
                  {deletingListing ? 'جاري حذف الإعلان...' : 'حذف الإعلان بالكامل'}
                </button>
              </div>
            </section>
          </>
        ) : null}
      </AdminShell>
    </AdminGuard>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 6, fontWeight: 800 }}>{label}</div>
      {children}
    </div>
  );
}

const heroGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'stretch', marginBottom: 18 };
const panelStyle = { background: '#fff', borderRadius: 18, padding: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)', marginBottom: 18 };
const coverCardStyle = { background: '#fff', borderRadius: 18, border: '1px solid #e5e7eb', boxShadow: '0 10px 25px rgba(15,23,42,0.04)', overflow: 'hidden', minHeight: 260 };
const coverStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const mutedTextStyle = { color: '#64748b', lineHeight: 1.9 };
const pillStyle = { padding: '7px 11px', borderRadius: 999, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', fontSize: 12, fontWeight: 700 };
const infoCardStyle = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: 12 };
const sectionHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 };
const sectionTitleStyle = { margin: 0, color: '#0f172a', fontSize: 20 };
const formGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 };
const mediaGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 };
const mediaTileStyle = { display: 'grid', gap: 10, background: '#fff', borderRadius: 16, border: '1px solid #e5e7eb', padding: 12, boxShadow: '0 6px 16px rgba(15,23,42,0.04)' };
const checkboxWrapStyle = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#0f172a' };
const mediaPreviewStyle = { background: '#f8fafc', borderRadius: 14, overflow: 'hidden', aspectRatio: '1 / 1' };
const mediaInnerStyle = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const emptyMediaStyle = { padding: 16, borderRadius: 14, background: '#f8fafc', border: '1px dashed #cbd5e1', color: '#64748b' };
const smallBtnStyle = { fontSize: 12, padding: '8px 10px' };
const primaryBtnStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0f172a', color: '#fff', textDecoration: 'none' };
const secondaryBtnStyle = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#fff', color: '#0f172a', border: '1px solid #cbd5e1', textDecoration: 'none' };
const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
const successStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#dcfce7', color: '#166534' };
