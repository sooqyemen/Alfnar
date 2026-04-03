'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell from '@/components/admin/AdminShell';
import RequestsTable from '@/components/admin/RequestsTable';
import { fetchRequests } from '@/lib/requestService';

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchRequests(250);
      setRequests(data || []);
    } catch (err) {
      setError('تعذر تحميل الطلبات. تأكد من فهرس createdAt في مجموعة fanar_requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  return (
    <AdminGuard title="الطلبات الواردة">
      <AdminShell
        title="طلبات العملاء"
        description="هنا تظهر الطلبات القادمة من صفحة الطلبات مع إمكانية تغيير الحالة إلى جديد أو جاري المتابعة أو مغلق."
      >
        {error ? <div style={errorStyle}>{error}</div> : null}
        {loading ? <div style={loadingStyle}>جاري تحميل الطلبات...</div> : null}
        <RequestsTable requests={requests} onRefresh={loadRequests} />
      </AdminShell>
    </AdminGuard>
  );
}

const loadingStyle = { marginBottom: 12, color: '#64748b' };
const errorStyle = { marginBottom: 14, padding: 14, borderRadius: 14, background: '#fee2e2', color: '#991b1b' };
