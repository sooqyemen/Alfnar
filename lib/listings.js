'use client';

import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebase } from './firebaseClient';
import { inferPropertyClass, normalizeNeighborhoodName } from './taxonomy';

const COL = 'fanar_listings';
const LEGACY_COL = 'listings';
const REQ = 'fanar_requests';

const colRef = (db, name) => collection(db, name);
const listingsCol = (db) => colRef(db, COL);
const legacyListingsCol = (db) => colRef(db, LEGACY_COL);
const requestsCol = (db) => colRef(db, REQ);

function tsToMillis(v) {
  try {
    if (!v) return 0;
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'number') return v;
  } catch (_) {}
  return 0;
}

function mapDocs(snap) {
  return snap.docs.map((d) => ({ ...d.data(), id: d.id }));
}

function cleanString(value) {
  return String(value || '').trim();
}

function normalizeMediaEntry(entry) {
  if (!entry) return null;

  if (typeof entry === 'string') {
    const url = cleanString(entry);
    return url ? { url, refPath: '', name: '', kind: 'image' } : null;
  }

  const url = cleanString(entry.url || entry.src || entry.downloadURL || '');
  if (!url) return null;

  const kindRaw = cleanString(entry.kind || entry.type || 'image').toLowerCase();
  const kind = kindRaw.startsWith('video') ? 'video' : 'image';

  return {
    url,
    refPath: cleanString(entry.refPath || entry.path || ''),
    name: cleanString(entry.name || entry.fileName || ''),
    kind,
  };
}

export function getListingMedia(item) {
  const fromMeta = Array.isArray(item?.imagesMeta) ? item.imagesMeta.map(normalizeMediaEntry).filter(Boolean) : [];
  if (fromMeta.length) return fromMeta;
  const fromImages = Array.isArray(item?.images) ? item.images.map(normalizeMediaEntry).filter(Boolean) : [];
  return fromImages;
}

function mediaPatchFromInput({ imagesMeta, images }) {
  if (Array.isArray(imagesMeta)) {
    const normalized = imagesMeta.map(normalizeMediaEntry).filter(Boolean);
    return {
      imagesMeta: normalized,
      images: normalized.map((item) => item.url).filter(Boolean),
    };
  }

  if (Array.isArray(images)) {
    const normalized = images.map(normalizeMediaEntry).filter(Boolean);
    return {
      imagesMeta: normalized,
      images: normalized.map((item) => item.url).filter(Boolean),
    };
  }

  return null;
}

async function getFromBothCollections(getPrimary, getLegacy, { includeLegacy = false } = {}) {
  const primary = await getPrimary();
  if (!includeLegacy) return primary;
  try {
    const legacy = await getLegacy();
    const merged = [...primary, ...legacy];
    merged.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    return merged;
  } catch (e) {
    const msg = String(e?.message || '');
    if (e?.code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
      return primary;
    }
    throw e;
  }
}

async function fetchPublicBase(db, max = 200, refOverride) {
  const ref = refOverride || listingsCol(db);
  const q = query(ref, where('status', 'in', ['available', 'reserved']), limit(max));
  const snap = await getDocs(q);
  const items = mapDocs(snap);
  items.sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
  return items;
}

async function fetchAdminBase(db, max = 500, refOverride) {
  const ref = refOverride || listingsCol(db);
  const q = query(ref, orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return mapDocs(snap);
}

function applyClientFilters(items, filters = {}) {
  const f = filters || {};
  return items.filter((it) => {
    if (f.neighborhood && normalizeNeighborhoodName(cleanString(it.neighborhood)) !== normalizeNeighborhoodName(cleanString(f.neighborhood))) return false;
    if (f.dealType && cleanString(it.dealType) !== cleanString(f.dealType)) return false;
    if (f.propertyType && cleanString(it.propertyType) !== cleanString(f.propertyType)) return false;
    if (f.plan && cleanString(it.plan) !== cleanString(f.plan)) return false;
    if (f.part && cleanString(it.part) !== cleanString(f.part)) return false;
    if (f.q) {
      const q = cleanString(f.q).toLowerCase();
      const hay = `${it.title || ''} ${it.description || ''} ${it.neighborhood || ''} ${it.plan || ''} ${it.part || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.propertyClass) {
      const cls = cleanString(it.propertyClass) || inferPropertyClass(it.propertyType);
      if (cls !== f.propertyClass) return false;
    }
    return true;
  });
}

export async function fetchLatestListings({ onlyPublic = true, n = 12, includeLegacy = false } = {}) {
  const { db } = getFirebase();
  const max = Math.max(80, n * 10);
  const primaryFn = async () => {
    const items = onlyPublic ? await fetchPublicBase(db, max) : await fetchAdminBase(db, Math.max(n, 80));
    return items.slice(0, n);
  };
  const legacyFn = async () => {
    const legacyRef = legacyListingsCol(db);
    const items = onlyPublic ? await fetchPublicBase(db, max, legacyRef) : await fetchAdminBase(db, Math.max(n, 80), legacyRef);
    return items.slice(0, n);
  };
  return await getFromBothCollections(primaryFn, legacyFn, { includeLegacy });
}

export async function fetchListings({ filters = {}, onlyPublic = true, includeLegacy = false, max = 240 } = {}) {
  const { db } = getFirebase();
  const primaryFn = async () => {
    const base = onlyPublic ? await fetchPublicBase(db, max) : await fetchAdminBase(db, Math.max(max, 300));
    return applyClientFilters(base, filters);
  };
  const legacyFn = async () => {
    const legacyRef = legacyListingsCol(db);
    const base = onlyPublic ? await fetchPublicBase(db, max, legacyRef) : await fetchAdminBase(db, Math.max(max, 300), legacyRef);
    return applyClientFilters(base, filters);
  };
  return await getFromBothCollections(primaryFn, legacyFn, { includeLegacy });
}

export async function fetchListingById(id, { includeLegacy = true } = {}) {
  const { db } = getFirebase();
  if (!id) return null;
  const cleanId = String(id);

  async function tryGetByDocId(colName, docId) {
    try {
      const ref = doc(db, colName, docId);
      const snap = await getDoc(ref);
      if (snap.exists()) return { ...snap.data(), id: snap.id };
    } catch (e) {
      const msg = String(e?.message || '');
      if (e?.code === 'invalid-argument' || msg.includes('Invalid document reference')) {
        return null;
      }
      throw e;
    }
    return null;
  }

  async function tryFindByField(colName, field, value) {
    const q = query(collection(db, colName), where(field, '==', value), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { ...d.data(), id: d.id };
    }
    return null;
  }

  async function tryFindByAnyField(colName) {
    const fields = ['publicId', 'listingId', 'code', 'number', 'ref', 'legacyId'];
    const candidates = [cleanId];
    const asNum = Number(cleanId);
    if (!Number.isNaN(asNum)) candidates.push(asNum);
    for (const v of candidates) {
      for (const f of fields) {
        const found = await tryFindByField(colName, f, v);
        if (found) return found;
      }
    }
    return null;
  }

  const byDoc = await tryGetByDocId(COL, cleanId);
  if (byDoc) return byDoc;

  const byField = await tryFindByAnyField(COL);
  if (byField) return byField;

  if (includeLegacy) {
    try {
      const legacyByDoc = await tryGetByDocId(LEGACY_COL, cleanId);
      if (legacyByDoc) return legacyByDoc;
      const legacyByField = await tryFindByAnyField(LEGACY_COL);
      if (legacyByField) return legacyByField;
    } catch (e) {
      const msg = String(e?.message || '');
      if (!(e?.code === 'permission-denied' || msg.includes('Missing or insufficient permissions'))) {
        throw e;
      }
    }
  }

  return null;
}

export async function adminCreateListing(payload) {
  const { db } = getFirebase();
  const propertyType = cleanString(payload.propertyType);
  const propertyClass = cleanString(payload.propertyClass) || inferPropertyClass(propertyType) || 'residential';
  const mediaPatch = mediaPatchFromInput({ imagesMeta: payload.imagesMeta, images: payload.images }) || { imagesMeta: [], images: [] };

  const clean = {
    title: cleanString(payload.title) || 'عرض عقاري',
    neighborhood: normalizeNeighborhoodName(cleanString(payload.neighborhood) || ''),
    plan: cleanString(payload.plan) || '',
    part: cleanString(payload.part) || '',
    lat: payload.lat !== undefined && payload.lat !== null && payload.lat !== '' ? Number(payload.lat) : null,
    lng: payload.lng !== undefined && payload.lng !== null && payload.lng !== '' ? Number(payload.lng) : null,
    dealType: cleanString(payload.dealType || 'sale'),
    propertyType,
    propertyClass,
    area: payload.area ? Number(payload.area) : null,
    price: payload.price ? Number(payload.price) : null,
    direct: !!payload.direct,
    status: cleanString(payload.status || 'available'),
    description: cleanString(payload.description) || '',
    licenseNumber: cleanString(payload.licenseNumber) || '',
    contactPhone: cleanString(payload.contactPhone) || '',
    images: mediaPatch.images,
    imagesMeta: mediaPatch.imagesMeta,
    sourceType: cleanString(payload.sourceType) || 'يدوي',
    sourceContactName: cleanString(payload.sourceContactName) || 'مسوق',
    sourceContactPhone: cleanString(payload.sourceContactPhone) || '',
    sourceContactRole: cleanString(payload.sourceContactRole) || 'مسوق',
    rawText: cleanString(payload.rawText) || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (!(Number.isFinite(clean.lat) && Number.isFinite(clean.lng))) {
    clean.lat = null;
    clean.lng = null;
  }
  const ref = await addDoc(listingsCol(db), clean);
  return ref.id;
}

export async function adminUpdateListing(id, patch) {
  const { db } = getFirebase();
  const ref = doc(db, COL, id);
  const next = { ...patch };
  if (next.propertyType && !next.propertyClass) {
    next.propertyClass = inferPropertyClass(next.propertyType) || 'residential';
  }
  if (Object.prototype.hasOwnProperty.call(next, 'neighborhood')) {
    next.neighborhood = normalizeNeighborhoodName(cleanString(next.neighborhood));
  }
  if (Object.prototype.hasOwnProperty.call(next, 'lat')) {
    next.lat = next.lat !== '' && next.lat !== null && next.lat !== undefined ? Number(next.lat) : null;
    if (!Number.isFinite(next.lat)) next.lat = null;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'lng')) {
    next.lng = next.lng !== '' && next.lng !== null && next.lng !== undefined ? Number(next.lng) : null;
    if (!Number.isFinite(next.lng)) next.lng = null;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'price')) {
    next.price = next.price !== '' && next.price !== null && next.price !== undefined ? Number(next.price) : null;
    if (!Number.isFinite(next.price)) next.price = null;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'area')) {
    next.area = next.area !== '' && next.area !== null && next.area !== undefined ? Number(next.area) : null;
    if (!Number.isFinite(next.area)) next.area = null;
  }
  if (Object.prototype.hasOwnProperty.call(next, 'licenseNumber')) next.licenseNumber = cleanString(next.licenseNumber);
  if (Object.prototype.hasOwnProperty.call(next, 'contactPhone')) next.contactPhone = cleanString(next.contactPhone);

  const mediaPatch = mediaPatchFromInput({ imagesMeta: next.imagesMeta, images: next.images });
  if (mediaPatch) {
    next.imagesMeta = mediaPatch.imagesMeta;
    next.images = mediaPatch.images;
  }

  await updateDoc(ref, { ...next, updatedAt: serverTimestamp() });
}

export async function adminDeleteListing(id) {
  const { db } = getFirebase();
  if (!id) throw new Error('معرف الإعلان غير موجود.');
  await deleteDoc(doc(db, COL, String(id)));
}

export async function createRequest(payload) {
  const { db } = getFirebase();
  const clean = {
    dealType: String(payload.dealType || '').trim(),
    propertyType: String(payload.propertyType || '').trim(),
    ownershipType: String(payload.ownershipType || '').trim(),
    city: String(payload.city || 'جدة').trim(),
    region: String(payload.region || '').trim(),
    neighborhood: normalizeNeighborhoodName(String(payload.neighborhood || '').trim()),
    plan: String(payload.plan || '').trim(),
    part: String(payload.part || '').trim(),
    areaMin: payload.areaMin !== undefined && payload.areaMin !== null && payload.areaMin !== '' ? Number(payload.areaMin) : null,
    areaMax: payload.areaMax !== undefined && payload.areaMax !== null && payload.areaMax !== '' ? Number(payload.areaMax) : null,
    budgetMin: payload.budgetMin !== undefined && payload.budgetMin !== null && payload.budgetMin !== '' ? Number(payload.budgetMin) : null,
    budgetMax: payload.budgetMax !== undefined && payload.budgetMax !== null && payload.budgetMax !== '' ? Number(payload.budgetMax) : null,
    paymentMethod: String(payload.paymentMethod || '').trim(),
    seriousness: String(payload.seriousness || '').trim(),
    goal: String(payload.goal || '').trim(),
    wantsSimilar: String(payload.wantsSimilar || '').trim(),
    name: String(payload.name || '').trim(),
    phone: String(payload.phone || '').trim(),
    notes: String(payload.notes || '').trim(),
    status: String(payload.status || 'new').trim() || 'new',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(requestsCol(db), clean);
  return ref.id;
}
