import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { deleteOwnAccount, hasPendingAccountDeletion } from '@/lib/account-deletion';

export default function DeleteAccountPage() {
  const navigate = useNavigate();
  const { customer, barberUser, logoutCustomer, logoutBarber } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [deleting, setDeleting] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [pending, setPending] = useState(hasPendingAccountDeletion);
  const signedIn = Boolean(customer?.uid || barberUser?.uid);

  const handleDelete = async () => {
    if ((!signedIn && !pending) || deleting) return;
    const message = ar
      ? 'سيُحذف حسابك وملفك وبيانات الحجوزات والمحتوى المرتبط بك نهائياً. لا يمكن التراجع. هل تريد المتابعة؟'
      : 'Your account, profile, bookings, and associated content will be permanently deleted. This cannot be undone. Continue?';
    if (!pending && !window.confirm(message)) return;

    setDeleting(true);
    setNeedsReauth(false);
    try {
      await deleteOwnAccount();
      [
        'halaqi_chat_history', 'barberco_bookings', 'zite_live_bookings',
        'zite_notifs_dismissed', 'zite_notifs_read', 'zite_fav_barbers',
        'zite_fav_salons', 'zite_user_onboarded',
      ].forEach(key => localStorage.removeItem(key));
      const accountUid = customer?.uid || barberUser?.uid;
      if (accountUid) {
        try {
          const statuses = JSON.parse(localStorage.getItem('zite_barber_status') || '{}');
          delete statuses[accountUid];
          localStorage.setItem('zite_barber_status', JSON.stringify(statuses));
        } catch { localStorage.removeItem('zite_barber_status'); }
      }
      logoutCustomer();
      logoutBarber();
      toast.success(ar ? 'تم حذف الحساب والبيانات المرتبطة به.' : 'Your account and associated data were deleted.');
      navigate('/intro', { replace: true });
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
      setPending(hasPendingAccountDeletion());
      if (code === 'deletion/pending') {
        toast.info(ar ? 'طلب الحذف قيد التنفيذ على الخادم. يمكنك إغلاق التطبيق ومتابعة الحالة لاحقًا.' : 'Deletion is continuing on the server. You can close the app and check again later.');
      } else if (code.includes('failed-precondition')) {
        setNeedsReauth(true);
        toast.error(ar ? 'سجّل الدخول من جديد ثم أعد طلب الحذف.' : 'Sign in again, then submit the deletion request.');
      } else {
        toast.error(ar ? 'تعذر حذف الحساب الآن. أعد المحاولة لاحقاً.' : 'Account deletion failed. Try again later.');
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleReauthenticate = async () => {
    setDeleting(true);
    try {
      const { signOutAll } = await import('@/lib/auth-providers');
      await signOutAll();
      logoutCustomer();
      logoutBarber();
      navigate('/login', { state: { from: '/delete-account' }, replace: true });
    } catch {
      toast.error(ar ? 'تعذر تسجيل الخروج. أعد تحميل الصفحة وحاول مجددًا.' : 'Could not sign out. Reload the page and try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12" dir={ar ? 'rtl' : 'ltr'}>
      <section className="mx-auto max-w-xl space-y-6 rounded-3xl border border-border bg-card p-6 shadow-xl">
        <button onClick={() => navigate('/intro')} className="text-sm font-bold text-primary">
          {ar ? 'العودة إلى 7alaqi' : 'Back to 7alaqi'}
        </button>
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-destructive" />
          <h1 className="text-2xl font-black">{ar ? 'حذف حساب 7alaqi' : 'Delete your 7alaqi account'}</h1>
        </div>
        <p className="text-sm leading-7 text-muted-foreground">
          {ar
            ? 'هذا الطلب يحذف حساب Firebase وملف المستخدم/الصالون والحجوزات والمحتوى والإشعارات المرتبطة بالحساب وملفاته المخزنة. سجّل الدخول بالحساب المطلوب حذفه قبل المتابعة.'
            : 'This request removes your Firebase account, user or salon profile, associated bookings, content and notifications, and stored files. Sign in to the account you want removed before continuing.'}
        </p>
        {signedIn || pending ? (
          <div className="space-y-3">
            {pending && <p className="text-sm leading-7 text-muted-foreground">{ar ? 'تم حفظ طلب الحذف. اضغط لمتابعة حالته، وسيستمر تنفيذه إذا أغلقت التطبيق.' : 'Your deletion request is saved. Check its status below; processing continues when the app is closed.'}</p>}
            <button onClick={handleDelete} disabled={deleting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-destructive px-4 py-3 font-bold text-white disabled:opacity-60">
              {deleting ? <Loader2 size={17} className="animate-spin" /> : <Trash2 size={17} />}
              {deleting ? (ar ? 'جارٍ متابعة طلب الحذف...' : 'Checking deletion request...') : pending ? (ar ? 'متابعة طلب الحذف' : 'Check deletion request') : (ar ? 'حذف الحساب والبيانات' : 'Delete account and data')}
            </button>
            {needsReauth && (
              <button onClick={handleReauthenticate} disabled={deleting}
                className="w-full rounded-2xl border border-border px-4 py-3 font-bold disabled:opacity-60">
                {ar ? 'تسجيل الدخول مجدداً ثم العودة للحذف' : 'Sign in again and return to deletion'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold">{ar ? 'سجّل الدخول بالحساب الذي تريد حذفه، وستعود إلى هذه الصفحة لإكمال الطلب.' : 'Sign in to the account you want to delete. You will return here to finish the request.'}</p>
            <button onClick={() => navigate('/login', { state: { from: '/delete-account' } })} className="w-full rounded-2xl bg-primary px-4 py-3 font-bold text-primary-foreground">
              {ar ? 'تسجيل الدخول' : 'Sign in'}
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {ar
            ? 'إذا فشل الطلب بسبب انتهاء جلسة الدخول، سجّل الدخول مجدداً لإثبات ملكية الحساب ثم أعد المحاولة.'
            : 'If your session is too old, sign in again to verify account ownership and retry.'}
        </p>
        <a href="mailto:7alaqi.suuport@gmail.com" className="block text-sm font-bold text-primary">{ar ? 'التواصل مع الدعم بشأن الحذف' : 'Contact deletion support'}</a>
      </section>
    </main>
  );
}
