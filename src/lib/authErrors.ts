function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

export function mapAuthError(code: string | undefined, ar: boolean): string {
  switch (code) {
    case 'auth/invalid-email':
      return ar ? 'بريد إلكتروني غير صالح' : 'Invalid email';
    case 'auth/user-not-found':
      return ar ? 'لا يوجد حساب بهذا البريد' : 'No account with this email';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return ar ? 'بريد أو كلمة مرور خاطئة' : 'Wrong email or password';
    case 'auth/email-already-in-use':
      return ar ? 'البريد مسجَّل مسبقاً' : 'Email already in use';
    case 'auth/weak-password':
      return ar ? 'كلمة المرور ضعيفة (6 أحرف على الأقل)' : 'Weak password (min 6 chars)';
    case 'auth/network-request-failed':
      return ar ? 'تعذّر الاتصال بالإنترنت' : 'Network error';
    case 'auth/too-many-requests':
      return ar ? 'محاولات كثيرة، انتظر قليلاً' : 'Too many attempts, try later';
    case 'auth/invalid-phone-number':
      return ar ? 'رقم الهاتف غير صالح. أدخل رقم أردني يبدأ بـ 7 ويتكوّن من 9 أرقام.' : 'Invalid phone number. Enter a 9-digit Jordanian mobile starting with 7.';
    case 'auth/invalid-app-credential':
    case 'auth/missing-app-credential':
    case 'auth/captcha-check-failed':
      return ar ? 'فشل التحقق الأمني من Firebase. تأكد من النطاقات المعتمدة وإعدادات reCAPTCHA في Firebase.' : 'Firebase security verification failed. Check authorized domains and reCAPTCHA settings in Firebase.';
    case 'auth/quota-exceeded':
      return ar ? 'تم تجاوز حد رسائل التحقق في Firebase. حاول لاحقاً أو راجع حدود المشروع.' : 'Firebase SMS quota exceeded. Try later or check the project quota.';
    case 'auth/billing-not-enabled':
      return ar ? 'إرسال رسائل SMS متوقف لأن الفوترة غير مفعّلة في مشروع Firebase. فعّل Billing من Firebase Console.' : 'SMS sign-in is disabled because Firebase billing is not enabled. Enable Billing in Firebase Console.';
    case 'auth/operation-not-allowed':
      return ar ? 'تسجيل الدخول برقم الهاتف غير مفعّل في Firebase Authentication.' : 'Phone sign-in is not enabled in Firebase Authentication.';
    case 'auth/app-not-authorized':
      return ar ? 'هذا التطبيق غير معتمد في إعدادات Firebase. راجع النطاقات وبصمات التطبيق.' : 'This app is not authorized in Firebase. Check authorized domains and app fingerprints.';
    case 'auth/code-expired':
      return ar ? 'انتهت صلاحية الرمز. أعد إرسال رمز جديد.' : 'The code expired. Request a new one.';
    case 'auth/invalid-verification-code':
      return ar ? 'رمز التحقق غير صحيح.' : 'The verification code is incorrect.';
    default:
      return ar ? `حدث خطأ: ${code || ''}` : `Error: ${code || 'unknown'}`;
  }
}

export function mapPasswordResetError(code: string | undefined, ar: boolean): string {
  switch (code) {
    case 'auth/user-not-found':
      return ar ? 'لا يوجد حساب بهذا البريد الإلكتروني' : 'No account exists with this email';
    case 'auth/invalid-email':
      return ar ? 'أدخل بريدًا إلكترونيًا صحيحًا' : 'Enter a valid email address';
    case 'auth/operation-not-allowed':
      return ar ? 'تسجيل الدخول بالبريد غير مفعّل في Firebase Authentication' : 'Email sign-in is not enabled in Firebase Authentication';
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
      return ar ? 'النطاق غير مضاف إلى Authorized domains في Firebase' : 'Add this domain to Firebase Authorized domains';
    default:
      return mapAuthError(code, ar);
  }
}

export function authErrorCode(error: unknown): string | undefined {
  return errorCode(error);
}
