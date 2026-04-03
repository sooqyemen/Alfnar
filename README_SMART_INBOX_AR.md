# إضافة الوارد الذكي + الطلبات + البحث الذكي

## الملفات داخل هذا الأرشيف
- `app/admin/page.js`
- `app/admin/requests/page.js`
- `app/admin/inbox/page.js`
- `app/admin/search/page.js`
- `app/api/ai/extract/route.js`
- `app/api/ai/search/route.js`
- `components/admin/*`
- `lib/requestService.js`
- `lib/inboxService.js`
- `lib/contactUtils.js`
- `lib/aiExtractClient.js`
- `lib/searchUtils.js`
- `package.json`

## ماذا تضيف هذه الملفات؟
1. لوحة أدمن رئيسية جديدة فيها إحصاءات وروابط سريعة.
2. صفحة طلبات تعرض `fanar_requests` مع تغيير الحالة.
3. صفحة وارد ذكي للصق الرسائل أو رفع TXT / ZIP.
4. صفحة بحث ذكي تسأل فيها بالعربي عن العروض.
5. مسارات API للخادم تستعمل OpenAI عبر `OPENAI_API_KEY`.
6. حفظ الوارد الخام داخل `fanar_inbox_entries`.
7. حفظ العناصر المستخرجة للمراجعة داخل `fanar_extracted_items`.

## المطلوب بعد الاستبدال
1. ارفع الملفات في نفس المسارات.
2. نفّذ:
   ```bash
   npm install
   ```
3. أضف في متغيرات البيئة على Vercel أو `.env.local`:
   ```bash
   OPENAI_API_KEY=...
   OPENAI_MODEL=gpt-4.1-mini
   ```
4. تأكد أن بريد الأدمن موجود في:
   ```bash
   NEXT_PUBLIC_ADMIN_EMAILS
   ```

## مجموعات Firestore المطلوبة
- `fanar_requests`
- `fanar_listings`
- `fanar_inbox_entries`
- `fanar_extracted_items`

## ملاحظة مهمة
في الإدخال اليدوي، الجوال لا بد يكون موجودًا عمليًا حتى تستفيد من العرض.
أما في ZIP أو TXT:
- إذا وُجد رقم بدون اسم: الاسم الافتراضي = `مسوق`
- إذا لم يوجد اسم ولا رقم: العنصر يبقى بحاجة مراجعة

## ملاحظة فنية
`package.json` في هذا الأرشيف محدث ليضيف `fflate` حتى يقرأ ملفات ZIP داخل المتصفح.
