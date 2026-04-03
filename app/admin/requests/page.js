'use client';

import { useEffect, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import RequestsTable from '@/components/admin/RequestsTable';
import { fetchRequests } from '@/lib/requestService';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    setError('');
    try {
      const data = await fetchRequests(250);
      setRequests(data || []);
    } catch (_) {
      setError('تعذر تحميل الطلبات.');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <AdminGuard title="الطلبات الواردة">
      <AdminShell title="الطلبات الواردة" description="كل الطلبات المستخرجة أو المضافة يدويًا تظهر هنا للمتابعة.">
        {error ? <div style={errorStyle}>{error}</div> : null}
        <RequestsTable requests={requests} onRefresh={load} />
      </AdminShell>
    </AdminGuard>
  );
}

const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
