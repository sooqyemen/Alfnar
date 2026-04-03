'use client';

import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { getFirebase } from './firebaseClient';
import { ensureSourceContact } from './contactUtils';
import { adminCreateListing, createRequest } from './listings';

export const INBOX_COLLECTION = 'fanar_inbox_entries';
export const EXTRACTED_COLLECTION = 'fanar_extracted_items';

function mapDocs(snap) {
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function fetchInboxEntries(max = 100) {
  const { db } = getFirebase();
  const q = query(collection(db, INBOX_COLLECTION), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return mapDocs(snap);
}

export async function saveInboxEntry(payload) {
  const { db } = getFirebase();
  const source = ensureSourceContact(payload.source || {});
  const ref = await addDoc(collection(db, INBOX_COLLECTION), {
    rawText: String(payload.rawText || '').trim(),
    parsedText: String(payload.parsedText || '').trim(),
    source,
    sourceType: String(payload.sourceType || source.sourceType || 'إدخال يدوي'),
    fileName: String(payload.fileName || '').trim(),
    fileType: String(payload.fileType || '').trim(),
    importMode: String(payload.importMode || 'paste').trim(),
    status: String(payload.status || 'review').trim(),
    aiSummary: String(payload.aiSummary || '').trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function saveExtractedItems({ inboxEntryId, items = [] }) {
  const { db } = getFirebase();
  const saved = [];
  for (const item of items) {
    const source = ensureSourceContact(item.source || {});
    const ref = await addDoc(collection(db, EXTRACTED_COLLECTION), {
      inboxEntryId: String(inboxEntryId || ''),
      recordType: String(item.recordType || 'listing'),
      extractionStatus: String(item.extractionStatus || 'pending_review'),
      confidence: Number(item.confidence || 0),
      summary: String(item.summary || '').trim(),
      listing: item.listing || null,
      request: item.request || null,
      rawText: String(item.rawText || '').trim(),
      source,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    saved.push({ id: ref.id, ...item, source });
  }
  return saved;
}

export async function promoteExtractedItem(item) {
  const { db } = getFirebase();
  const source = ensureSourceContact(item.source || {});
  if (item.recordType === 'request') {
    const requestPayload = {
      ...item.request,
      name: item.request?.name || source.contactName,
      phone: item.request?.phone || source.contactPhone,
      note: item.request?.note || item.summary || item.rawText || '',
      source: 'smart_inbox',
      sourceContactName: source.contactName,
      sourceContactPhone: source.contactPhone,
      sourceContactRole: source.contactRole,
      sourceType: source.sourceType || 'الوارد الذكي',
      rawText: item.rawText || '',
    };
    const id = await createRequest(requestPayload);
    if (item.id) {
      await updateDoc(doc(db, EXTRACTED_COLLECTION, item.id), {
        extractionStatus: 'approved',
        finalCollection: 'fanar_requests',
        finalId: id,
        updatedAt: serverTimestamp(),
      });
    }
    return { id, collection: 'fanar_requests' };
  }

  const listing = item.listing || {};
  const payload = {
    title: listing.title || listing.propertyType || 'عرض عقاري',
    dealType: listing.dealType || 'sale',
    propertyType: listing.propertyType || 'land',
    propertyClass: listing.propertyClass || 'residential',
    neighborhood: listing.neighborhood || '',
    plan: listing.plan || '',
    part: listing.part || '',
    area: listing.area || null,
    price: listing.price || null,
    direct: Boolean(listing.direct),
    status: listing.status || 'available',
    description: listing.description || item.summary || item.rawText || '',
    images: Array.isArray(listing.images) ? listing.images : [],
    lat: listing.lat ?? null,
    lng: listing.lng ?? null,
    sourceType: source.sourceType || 'الوارد الذكي',
    sourceContactName: source.contactName,
    sourceContactPhone: source.contactPhone,
    sourceContactRole: source.contactRole,
    rawText: item.rawText || '',
  };
  const id = await adminCreateListing(payload);
  if (item.id) {
    await updateDoc(doc(db, EXTRACTED_COLLECTION, item.id), {
      extractionStatus: 'approved',
      finalCollection: 'fanar_listings',
      finalId: id,
      updatedAt: serverTimestamp(),
    });
  }
  return { id, collection: 'fanar_listings' };
}
