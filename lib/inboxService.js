'use client';

import {
  addDoc,
  collection,
  deleteDoc,
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

export async function fetchExtractedItems(max = 150) {
  const { db } = getFirebase();
  const q = query(collection(db, EXTRACTED_COLLECTION), orderBy('createdAt', 'desc'), limit(max));
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
    sourceType: String(payload.sourceType || source.sourceType || 'الوارد الذكي').trim(),
    fileName: String(payload.fileName || '').trim(),
    fileType: String(payload.fileType || '').trim(),
    importMode: String(payload.importMode || 'paste').trim(),
    status: String(payload.status || 'review').trim(),
    aiSummary: String(payload.aiSummary || '').trim(),
    aiStats: payload.aiStats || null,
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
      recordType: String(item.recordType || 'ignored').trim(),
      extractionStatus: String(item.extractionStatus || 'needs_review').trim(),
      confidence: Number(item.confidence || 0),
      summary: String(item.summary || '').trim(),
      listing: item.listing || null,
      request: item.request || null,
      rawText: String(item.rawText || '').trim(),
      reason: String(item.reason || '').trim(),
      groupMeta: item.groupMeta || null,
      source,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    saved.push({ id: ref.id, ...item, source });
  }

  return saved;
}

export async function updateExtractedItemStatus(id, extractionStatus, patch = {}) {
  const { db } = getFirebase();
  const ref = doc(db, EXTRACTED_COLLECTION, id);
  await updateDoc(ref, {
    extractionStatus: String(extractionStatus || 'needs_review').trim(),
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function promoteExtractedItem(item) {
  const source = ensureSourceContact(item.source || {});

  if (item.recordType === 'request') {
    const requestPayload = {
      ...(item.request || {}),
      name: String(item.request?.name || '').trim() || source.contactName,
      phone: String(item.request?.phone || '').trim() || source.contactPhone,
      sourceType: source.sourceType,
      sourceContactName: source.contactName,
      sourceContactPhone: source.contactPhone,
      sourceContactRole: source.contactRole,
      rawText: String(item.rawText || '').trim(),
      status: 'new',
      source: 'smart_inbox',
    };
    const id = await createRequest(requestPayload);
    return { id, collection: 'fanar_requests' };
  }

  if (item.recordType === 'listing') {
    const listingPayload = {
      ...(item.listing || {}),
      title: String(item.listing?.title || item.summary || 'عرض عقاري').trim(),
      sourceType: source.sourceType,
      sourceContactName: source.contactName,
      sourceContactPhone: source.contactPhone,
      sourceContactRole: source.contactRole,
      rawText: String(item.rawText || '').trim(),
      status: String(item.listing?.status || 'available').trim(),
    };
    const id = await adminCreateListing(listingPayload);
    return { id, collection: 'fanar_listings' };
  }

  return null;
}

export async function deleteExtractedItemEverywhere(item) {
  const { db } = getFirebase();
  if (!item?.id) return;

  const promotedCollection = String(item.promotedCollection || '').trim();
  const promotedDocId = String(item.promotedDocId || '').trim();

  if (promotedCollection && promotedDocId) {
    await deleteDoc(doc(db, promotedCollection, promotedDocId));
  }

  await deleteDoc(doc(db, EXTRACTED_COLLECTION, item.id));
}
