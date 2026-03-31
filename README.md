# لؤلؤة الفنار العقارية

مشروع موقع عقاري مبني بـ Next.js + Firebase، جاهز كنقطة انطلاق كاملة للموقع.

## المميزات
- الصفحة الرئيسية
- صفحة كل العقارات
- صفحة تفاصيل العقار
- صفحة الخريطة
- صفحة الأحياء
- صفحة استقبال الطلبات
- صفحة تسجيل الدخول
- لوحة أدمن
- شعار وهوية بصرية جديدة
- زر واتساب برقم 0555666850

## مجموعات Firestore
- fanar_listings
- fanar_requests

## تشغيل المشروع
```bash
npm install
npm run dev
```

## الإعدادات
أنشئ ملف `.env.local` اعتمادًا على `.env.example` وأضف بيانات Firebase وGoogle Maps.

عدّل بريد الأدمن داخل:
- `firebase/firestore.rules`
- `firebase/storage.rules`

ثم أضف نفس البريد في `NEXT_PUBLIC_ADMIN_EMAILS`.
