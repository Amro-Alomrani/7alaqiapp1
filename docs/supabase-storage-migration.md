# نقل مساحة الصور إلى Supabase مع إبقاء Firebase

هذا التغيير ينقل ملفات الصور فقط. تبقى Firebase Auth وFirestore وCloud Functions وFCM كما هي.

## إعدادات التطبيق

اضبط متغيرات Vite التالية في بيئة البناء (لا ترفع ملف `.env.local`):

- `VITE_SUPABASE_URL=https://vjeuesqrzywragnjvkpi.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = المفتاح العام `sb_publishable_...`
- `VITE_SUPABASE_PUBLIC_MEDIA_BUCKET=halaqi-media`
- `VITE_SUPABASE_PRIVATE_CHAT_BUCKET=halaqi-chat`

المفتاح العام مخصص للعميل. لا تضع `sb_secret` أو `service_role` في متغير `VITE_*` أو في ملفات Android.

## تهيئة مشروع Supabase

1. من Supabase Dashboard افتح Authentication → Third-Party Auth وأضف Firebase Auth للمشروع `halaqyapp`.
2. راجع migration في `supabase/migrations/202610280001_storage.sql` ثم طبّقها على قاعدة المشروع. تنشئ bucket عامًا لصور الملفات/الصالونات/المنشورات، وbucket خاصًا لصور محادثات الحجز مع RLS.
3. أنشئ `SUPABASE_SECRET_KEY` داخل Firebase Functions Secret Manager باستخدام Supabase secret key. أدخل القيمة عند مطالبة Firebase CLI بها؛ لا تضعها في المشروع أو المحادثة.
4. انشر الدالتين `ensureSupabaseStorageRole` و`ensureSupabaseBookingMediaAccess` مع دالة `deleteOwnAccount` المحدّثة.
5. اختبر مستخدمًا مسجّلًا يرفع صورة ملف شخصي ويحذفها، وطرفَي حجز يرفعان ويقرآن صورة محادثة، ثم تأكد أن مستخدمًا خارج الحجز لا يستطيع قراءة الصورة أو إصدار رابطها.
6. تحقّق من حذف كل ملفات المستخدم من البكتين عند حذف الحساب، ومن أن صور Firebase القديمة ما زالت تفتح. هذا النقل لا ينسخ ملفات Firebase القديمة؛ الروابط القديمة تبقى كما هي إلى أن تُرحّل الملفات صراحةً.

## ملاحظات التشغيل

- يسمح `halaqi-media` بالقراءة العامة للصور المعروضة ضمن صفحات الصالونات والملفات والمنشورات، لكن الرفع والحذف يظلان مقيدين بمالك المجلد.
- `halaqi-chat` خاص. يخزّن Firestore علامة `supabase-storage://` بدل رابط عام، ويصدر التطبيق روابط موقّتة بعد التحقق من عضوية الحجز.
- Firebase يظل مطلوبًا للإشعارات الفورية، والمواعيد، والحجوزات، والمصادقة، وحذف الحساب.
- لم يتم تطبيق migration أو نشر وظائف الإنتاج تلقائيًا. لا تعتبر نقل التخزين جاهزًا للإنتاج حتى يكتمل التحقق أعلاه.
