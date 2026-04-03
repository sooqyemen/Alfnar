'use client';

import {
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

export const REQUESTS_COLLECTION = 'fanar_requests';

function mapDocs(snap) {
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function fetchRequests(max = 200) {
  const { db } = getFirebase();
  const q = query(collection(db, REQUESTS_COLLECTION), orderBy('createdAt', 'desc'), limit(max));
  const snap = await getDocs(q);
  return mapDocs(snap);
}

export async function updateRequestStatus(id, status) {
  const { db } = getFirebase();
  const ref = doc(db, REQUESTS_COLLECTION, id);
  await updateDoc(ref, {
    status: String(status || 'new').trim(),
    updatedAt: serverTimestamp(),
  });
}
