✅ بعد تركيب هذا الباتش:
1) افتح /admin وسجّل دخول الأدمن
2) جرّب رفع صورة وشاهد التقدم
   - لو تعلّق الرفع: الآن سيظهر لك خطأ واضح بدل التعليق.

⚠️ إذا ظهر لك خطأ صلاحيات (unauthorized/unauthenticated):
- ادخل Firebase Console → Storage → Rules
- انسخ محتوى firebase/storage.rules والصقه ثم Publish

⚠️ إذا ظهر bucket-not-found:
- راجع NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET في Vercel/.env.local
- القيمة المتوقعة عادة: <PROJECT_ID>.appspot.com
