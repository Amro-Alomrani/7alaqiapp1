# 🍎 دليل النشر على TestFlight بدون Mac

> **الفكرة:** GitHub بيعطيك Mac سحابي مجاني، بشتغل أوتوماتيك ويبني التطبيق ويرفعه على TestFlight. إنت ما رح تلمس Xcode ولا Mac أبداً.

---

## ✅ اللي صار جاهز

- منصة iOS تمت إضافتها للمشروع (`ios/` folder)
- ملف الإعدادات `Info.plist` فيه كل الأذونات اللي بحتاجها التطبيق
- ملف GitHub Actions workflow جاهز ([.github/workflows/ios-testflight.yml](.github/workflows/ios-testflight.yml))
- `.gitignore` محدّث (الشهادات والبيانات الحساسة ما رح تترفع)

---

## 📋 المرحلة 1: ارفع المشروع على GitHub (5 دقائق)

### إذا ما عندك repo بعد:
1. روح على <https://github.com/new>
2. اسم المشروع: `barber-go` (أو اللي بدك إياه)
3. **خليه Private** (مهم لأنه فيه إعدادات Firebase)
4. اضغط "Create repository"

### ارفع الكود من الجهاز:
افتح PowerShell بمجلد المشروع وشغّل:

```powershell
cd 'c:\zite- app'
git init
git add .
git commit -m "Initial commit - iOS ready"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/barber-go.git
git push -u origin main
```

> استبدل `YOUR_USERNAME` باسم حسابك على GitHub.

---

## 📋 المرحلة 2: اشترك في Apple Developer ($99/سنة)

1. روح على <https://developer.apple.com/programs/enroll/>
2. سجّل دخول بـ Apple ID تبعك
3. اختار **Individual** (للأفراد) أو **Organization** (للشركات)
4. ادفع الـ $99
5. الموافقة بتاخد من ساعة لـ 48 ساعة

---

## 📋 المرحلة 3: جهّز التطبيق على Apple

### 3.1 — أنشئ App ID
1. روح على <https://developer.apple.com/account/resources/identifiers/list>
2. اضغط **+** → اختار **App IDs** → **App**
3. **Description:** `Barber Go`
4. **Bundle ID:** اختار **Explicit** واكتب: `com.barbergo.app`
5. **Capabilities:** فعّل **Push Notifications** (اختياري)
6. اضغط **Continue** → **Register**

### 3.2 — أنشئ Distribution Certificate
> هاي الخطوة بحتاجلها ملف CSR. خليني أعطيك طريقة بدون Mac:

**على Windows باستخدام OpenSSL** (لو ما عندك OpenSSL، نزّله من <https://slproweb.com/products/Win32OpenSSL.html>):

```powershell
# في PowerShell بأي مجلد فاضي
openssl genrsa -out distribution.key 2048
openssl req -new -key distribution.key -out CertificateSigningRequest.certSigningRequest -subj "/emailAddress=YOUR_EMAIL@example.com/CN=YOUR_NAME/C=JO"
```

> استبدل البريد والاسم. ورح يطلع عندك ملفين: `distribution.key` و `CertificateSigningRequest.certSigningRequest`

ثم في Apple:
1. <https://developer.apple.com/account/resources/certificates/list>
2. اضغط **+** → اختار **Apple Distribution** → **Continue**
3. ارفع ملف `CertificateSigningRequest.certSigningRequest`
4. حمّل الملف اللي ينزّل (`distribution.cer`)

**حوّل الـ certificate لـ p12** (هاد اللي رح يلزمنا):

```powershell
# في نفس المجلد اللي فيه distribution.key و distribution.cer
openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM
openssl pkcs12 -export -inkey distribution.key -in distribution.pem -out distribution.p12 -name "Apple Distribution"
```

> رح يطلب منك كلمة مرور — اكتب أي كلمة وتذكّرها (مثلاً `barbergo123`). هاي رح تكون قيمة `P12_PASSWORD`.

### 3.3 — أنشئ Provisioning Profile
1. <https://developer.apple.com/account/resources/profiles/list>
2. اضغط **+** → اختار **App Store** تحت Distribution → **Continue**
3. **App ID:** اختار `com.barbergo.app`
4. **Certificate:** اختار الشهادة اللي عملتها لساتك
5. **Profile Name:** اكتب `BarberGo AppStore` (احفظ الاسم بالظبط)
6. **Generate** → حمّل الملف (`BarberGo_AppStore.mobileprovision`)

### 3.4 — أنشئ التطبيق على App Store Connect
1. روح على <https://appstoreconnect.apple.com/apps>
2. اضغط **+** → **New App**
3. املأ:
   - **Platform:** iOS
   - **Name:** Barber Go
   - **Primary Language:** Arabic أو English
   - **Bundle ID:** `com.barbergo.app`
   - **SKU:** `barbergo-001`
   - **User Access:** Full Access
4. **Create**

### 3.5 — أنشئ App Store Connect API Key
1. <https://appstoreconnect.apple.com/access/integrations/api>
2. **Generate API Key** أو **+**
3. **Name:** `GitHub Actions`
4. **Access:** **App Manager**
5. اضغط **Generate**
6. **حمّل الـ .p8 file** (مرة واحدة فقط ما رح تقدر ترجع تحمّله!)
7. احفظ:
   - **Key ID** (مثلاً `ABC123XYZ`)
   - **Issuer ID** (UUID طويل)

### 3.6 — جيب Team ID
1. <https://developer.apple.com/account>
2. تحت **Membership Details** → انسخ **Team ID** (10 أحرف)

---

## 📋 المرحلة 4: حوّل الملفات لـ Base64

GitHub بيخزّن الأسرار كنص، فلازم نحوّل الملفات:

```powershell
# في PowerShell، روح على المجلد اللي فيه الملفات
cd C:\path\to\your\certs

# 1. الـ p12
[Convert]::ToBase64String([IO.File]::ReadAllBytes("distribution.p12")) | Set-Clipboard
# الناتج موجود بالـ clipboard. الصقه ببرنامج Notepad واحفظه مؤقتاً

# 2. الـ provisioning profile
[Convert]::ToBase64String([IO.File]::ReadAllBytes("BarberGo_AppStore.mobileprovision")) | Set-Clipboard

# 3. الـ p8 API key
[Convert]::ToBase64String([IO.File]::ReadAllBytes("AuthKey_ABC123XYZ.p8")) | Set-Clipboard
```

---

## 📋 المرحلة 5: ضيف الأسرار على GitHub

روح على repo تبعك → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

ضيف الـ 9 secrets هدول:

| اسم الـ Secret | القيمة |
|---|---|
| `APPLE_TEAM_ID` | الـ Team ID (10 أحرف) من خطوة 3.6 |
| `APPLE_BUNDLE_ID` | `com.barbergo.app` |
| `PROVISIONING_PROFILE_NAME` | `BarberGo AppStore` (نفس اسم الـ profile) |
| `BUILD_CERTIFICATE_BASE64` | base64 تبع `distribution.p12` |
| `P12_PASSWORD` | الكلمة اللي حطيتها وقت تصدير الـ p12 |
| `KEYCHAIN_PASSWORD` | أي كلمة عشوائية (مثلاً `tempkey123`) |
| `BUILD_PROVISION_PROFILE_BASE64` | base64 تبع الـ mobileprovision |
| `APP_STORE_CONNECT_API_KEY_ID` | الـ Key ID من خطوة 3.5 |
| `APP_STORE_CONNECT_API_ISSUER_ID` | الـ Issuer ID من خطوة 3.5 |
| `APP_STORE_CONNECT_API_KEY_BASE64` | base64 تبع ملف `.p8` |

---

## 📋 المرحلة 6: شغّل البناء! 🚀

### الطريقة 1: أوتوماتيك
كل push على branch `main` رح يطلق البناء.

### الطريقة 2: يدوي
1. روح على GitHub repo → **Actions** tab
2. على الشمال اختار **iOS Build & TestFlight Deploy**
3. اضغط **Run workflow** → اختار branch `main` → **Run**

### المتابعة:
- البناء بياخد **20-30 دقيقة** أول مرة
- بتقدر تشوف الـ logs لايف
- لو فشل، اضغط على الخطوة الحمراء وشوف الخطأ

---

## 📋 المرحلة 7: نزّل التطبيق على آيفونك

1. بعد ما البناء يخلص بنجاح، التطبيق رح يصير في **Processing** على App Store Connect (~10 دقائق)
2. روح على <https://appstoreconnect.apple.com/apps> → اختار التطبيق → **TestFlight** tab
3. لما تخلص المعالجة، ضيف نفسك كـ **Internal Tester**:
   - **Internal Testing** → **+** → ضيف نفسك (لازم تكون في الـ Apple Developer team)
4. على الآيفون:
   - نزّل تطبيق **TestFlight** من App Store
   - سجّل دخول بـ Apple ID نفسه
   - رح تلاقي **Barber Go** جاهز للتنصيب

---

## 🆘 المشاكل الشائعة

### "Code signing failed"
- تأكد إنه `PROVISIONING_PROFILE_NAME` بنفس الاسم اللي على Apple بالظبط (case-sensitive)
- تأكد إنه الـ certificate وقت تحويله لـ p12 ما فيه فراغات بالاسم

### "Bundle ID does not match"
- لازم Bundle ID على Apple = الـ `appId` بـ [capacitor.config.ts](capacitor.config.ts) = `com.barbergo.app`

### "Build number already used"
- الـ workflow بيرفع الرقم أوتوماتيك مع كل run — ما لازم يصير

### Build بياخد وقت طويل
- أول مرة طبيعي ياخد 25-30 دقيقة
- المرات اللي بعدها ~15 دقيقة (بسبب الـ cache)

---

## 📝 ملخص بسيط

```
كل تعديل بالكود
    ↓
git add . && git commit -m "..." && git push
    ↓
GitHub Actions يبني التطبيق (Mac سحابي)
    ↓
يرفعه على TestFlight أوتوماتيك
    ↓
بعد 20 دقيقة تشوفه على آيفونك من تطبيق TestFlight
```

---

## 🔗 روابط مهمة

- App Store Connect: <https://appstoreconnect.apple.com>
- Apple Developer Portal: <https://developer.apple.com/account>
- GitHub Actions logs: `https://github.com/YOUR_USERNAME/barber-go/actions`

---

**أي مشكلة تواجهك، ابعتلي الـ error من Actions log وبحلها معك.**
