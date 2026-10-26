import { useNavigate } from 'react-router-dom';

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const navigate = useNavigate();
  const privacy = kind === 'privacy';

  if (privacy) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 text-foreground">
        <div className="mx-auto max-w-3xl">
          <button onClick={() => navigate('/intro')} className="mb-4 text-sm font-bold text-primary">
            العودة إلى 7alaqi
          </button>
          <iframe
            title="7alaqi Privacy Policy"
            src="/privacy.html"
            className="min-h-[85vh] w-full rounded-2xl border border-border bg-white"
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-6">
        <button onClick={() => navigate('/intro')} className="text-sm font-bold text-primary">العودة إلى 7alaqi</button>
        <h1 className="text-3xl font-black">شروط الاستخدام</h1>
        <p>باستخدام 7alaqi، توافق على استخدام التطبيق لحجز خدمات الحلاقة والتواصل مع الصالونات وفق القوانين المعمول بها.</p>
        <h2 className="text-xl font-bold">الحساب والحجوزات</h2>
        <p>أنت مسؤول عن صحة معلومات حسابك وعن الالتزام بمواعيد الحجوزات. الأسعار والتوفر يعرضهما الحلاق المسجل وقد يتغيران قبل تأكيد الطلب.</p>
        <h2 className="text-xl font-bold">الاستخدام المقبول</h2>
        <p>يُمنع إساءة استخدام التطبيق أو محاولة الوصول إلى حسابات أو بيانات مستخدمين آخرين.</p>
      </div>
    </main>
  );
}
