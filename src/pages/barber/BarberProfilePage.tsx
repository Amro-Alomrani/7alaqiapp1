import { useEffect, useMemo, useState } from 'react';
import { Camera, Star, Users, Scissors, TrendingUp, LogOut, ChevronRight, Plus, Trash2, Edit3, Image as ImageIcon, X, Loader2, QrCode as QrCodeIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBarber, usePosts } from '@/contexts/DataContext';
import {
  updateBarberProfile,
  createPost,
  updatePost,
  deletePost,
} from '@/lib/db';
import {
  describeImageUploadError,
  pickImage,
  uploadImage,
  profileImagePath,
  postImagePath,
} from '@/lib/storage';

export default function BarberProfilePage() {
  const navigate = useNavigate();
  const { logoutBarber, barberUser } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const uid = barberUser?.uid || '';
  const barber = useBarber(uid);
  const allPosts = usePosts();
  const myPosts = useMemo(() => allPosts.filter((p: any) => p.ownerUid === uid), [allPosts, uid]);

  const [editing, setEditing] = useState(false);
  const [shopName, setShopName] = useState('');
  const [bio, setBio] = useState('');
  const [name, setName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingHomeService, setSavingHomeService] = useState(false);
  const [savingHomeServiceFee, setSavingHomeServiceFee] = useState(false);
  const [homeServiceFeeDraft, setHomeServiceFeeDraft] = useState('0');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const [postOpen, setPostOpen] = useState(false);
  const [postEditingId, setPostEditingId] = useState<string | null>(null);
  const [postCaption, setPostCaption] = useState('');
  const [postStyle, setPostStyle] = useState('');
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [postImagePreview, setPostImagePreview] = useState<string>('');
  const [savingPost, setSavingPost] = useState(false);

  useEffect(() => {
    if (!barber || editing) return;
    setShopName(barber.shopName || '');
    setBio(barber.description || '');
    setName(barber.name || '');
    setHomeServiceFeeDraft(String(barber.homeServiceFee ?? 0));
  }, [barber?.id, barber?.shopName, barber?.description, barber?.name, barber?.homeServiceFee, editing]);

  const handleAvatar = async () => {
    if (!uid) return;
    const file = await pickImage();
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadImage(file, profileImagePath(uid, 'avatar'));
      await updateBarberProfile(uid, { avatar: url });
      toast.success(ar ? 'تم تحديث الصورة' : 'Avatar updated');
    } catch (e: any) {
      toast.error(ar ? 'فشل رفع الصورة' : 'Upload failed', { description: describeImageUploadError(e, ar) });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCover = async () => {
    if (!uid) return;
    const file = await pickImage();
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadImage(file, profileImagePath(uid, 'cover'));
      await updateBarberProfile(uid, { coverImage: url } as any);
      toast.success(ar ? 'تم تحديث الغلاف' : 'Cover updated');
    } catch (e: any) {
      toast.error(ar ? 'فشل رفع الغلاف' : 'Upload failed', { description: describeImageUploadError(e, ar) });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!uid) return;
    setSavingProfile(true);
    try {
      await updateBarberProfile(uid, {
        shopName: shopName.trim(),
        name: name.trim(),
        description: bio.trim(),
      } as any);
      setEditing(false);
      toast.success(ar ? 'تم الحفظ' : 'Saved');
    } catch (e: any) {
      toast.error(ar ? 'فشل الحفظ' : (e?.message || 'Save failed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleHomeServiceToggle = async () => {
    if (!uid || !barber || savingHomeService) return;
    const homeServiceFee = Number(homeServiceFeeDraft);
    if (!Number.isFinite(homeServiceFee) || homeServiceFee < 0) {
      toast.error(ar ? 'أدخل رسماً صحيحاً أو صفراً' : 'Enter a valid fee or zero');
      return;
    }
    const nextValue = barber.offersHomeService !== true;
    setSavingHomeService(true);
    try {
      await updateBarberProfile(uid, { offersHomeService: nextValue, homeServiceFee });
      toast.success(nextValue
        ? (ar ? 'أصبحت تستقبل طلبات الخدمة المنزلية' : 'Home-service requests are enabled')
        : (ar ? 'تم إيقاف استقبال طلبات الخدمة المنزلية' : 'Home-service requests are disabled'));
    } catch (error) {
      toast.error(ar ? 'تعذر تحديث إعداد الخدمة المنزلية' : 'Could not update home-service setting', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingHomeService(false);
    }
  };

  const handleSaveHomeServiceFee = async () => {
    if (!uid || !barber || savingHomeServiceFee) return;
    const homeServiceFee = Number(homeServiceFeeDraft);
    if (!Number.isFinite(homeServiceFee) || homeServiceFee < 0) {
      toast.error(ar ? 'أدخل رسماً صحيحاً أو صفراً' : 'Enter a valid fee or zero');
      return;
    }
    setSavingHomeServiceFee(true);
    try {
      await updateBarberProfile(uid, { homeServiceFee });
      toast.success(ar ? 'تم حفظ رسم الخدمة المنزلية' : 'Home-service fee saved');
    } catch (error) {
      toast.error(ar ? 'تعذر حفظ الرسم' : 'Could not save the fee', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingHomeServiceFee(false);
    }
  };

  const openCreatePost = () => {
    setPostEditingId(null);
    setPostCaption('');
    setPostStyle('');
    setPostImageFile(null);
    setPostImagePreview('');
    setPostOpen(true);
  };

  const openEditPost = (p: any) => {
    setPostEditingId(p.id);
    setPostCaption(p.caption || '');
    setPostStyle(p.hairStyle || '');
    setPostImageFile(null);
    setPostImagePreview(p.image || '');
    setPostOpen(true);
  };

  const handlePickPostImage = async () => {
    const file = await pickImage();
    if (!file) return;
    setPostImageFile(file);
    setPostImagePreview(URL.createObjectURL(file));
  };

  const handleSavePost = async () => {
    if (!uid) return;
    if (!postCaption.trim() && !postImageFile && !postImagePreview) {
      toast.error(ar ? 'أضف صورة أو وصف' : 'Add image or caption');
      return;
    }
    setSavingPost(true);
    try {
      let imageUrl = postImagePreview;
      if (postImageFile) {
        const tempId = postEditingId || `tmp_${Date.now()}`;
        const safeName = postImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '');
        imageUrl = await uploadImage(postImageFile, postImagePath(uid, tempId, safeName));
      }
      if (postEditingId) {
        await updatePost(postEditingId, {
          caption: postCaption.trim(),
          hairStyle: postStyle.trim(),
          image: imageUrl,
        });
        toast.success(ar ? 'تم تحديث المنشور' : 'Post updated');
      } else {
        await createPost(uid, {
          postedBy: 'barber',
          image: imageUrl,
          caption: postCaption.trim(),
          hairStyle: postStyle.trim(),
          tags: [],
          location: '',
          barber: {
            id: uid,
            name: barber?.name || name || '',
            shopName: barber?.shopName || shopName || '',
            avatar: barber?.avatar || '',
          } as any,
        } as any);
        toast.success(ar ? 'تم نشر المنشور' : 'Post published');
      }
      setPostOpen(false);
    } catch (e: any) {
      toast.error(ar ? 'فشل الحفظ' : 'Save failed', { description: postImageFile ? describeImageUploadError(e, ar) : (e?.message || '') });
    } finally {
      setSavingPost(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm(ar ? 'حذف هذا المنشور؟' : 'Delete this post?')) return;
    try {
      await deletePost(id);
      toast.success(ar ? 'تم الحذف' : 'Deleted');
    } catch (e: any) {
      toast.error(ar ? 'فشل الحذف' : (e?.message || 'Delete failed'));
    }
  };

  if (!uid) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {ar ? 'يجب تسجيل الدخول' : 'Please sign in'}
      </div>
    );
  }

  return (
    <div className="overflow-y-auto pb-32">
      <div className="relative h-48 mb-12">
        {barber?.coverImage ? (
          <img src={barber.coverImage} alt="cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 via-card to-background" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        <button
          onClick={handleCover}
          disabled={uploadingCover}
          className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-xl flex items-center gap-1.5"
        >
          {uploadingCover ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          {ar ? 'تغيير الغلاف' : 'Change cover'}
        </button>

        <div className="absolute -bottom-10 left-5 flex items-end gap-3">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary shadow-xl bg-card">
              {barber?.avatar ? (
                <img src={barber.avatar} alt={barber.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <ImageIcon size={24} />
                </div>
              )}
            </div>
            <button
              onClick={handleAvatar}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg"
            >
              {uploadingAvatar ? <Loader2 size={12} className="animate-spin text-primary-foreground" /> : <Camera size={13} className="text-primary-foreground" />}
            </button>
          </div>
        </div>

        <Button
          size="sm"
          onClick={editing ? handleSaveProfile : () => setEditing(true)}
          disabled={savingProfile}
          className="absolute bottom-3 right-5 h-8 rounded-xl bg-card text-foreground border border-border text-xs gap-1"
        >
          {savingProfile ? <Loader2 size={12} className="animate-spin" /> : (editing ? null : <Edit3 size={12} />)}
          {editing ? (ar ? 'حفظ' : 'Save') : (ar ? 'تعديل' : 'Edit Profile')}
        </Button>
      </div>

      <div className="px-5">
        <div className="mb-5">
          {editing ? (
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">{ar ? 'الاسم' : 'Name'}</p>
                <input value={name} onChange={e => setName(e.target.value)} className="bg-transparent text-foreground text-sm w-full outline-none" />
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">{ar ? 'اسم المحل' : 'Shop Name'}</p>
                <input value={shopName} onChange={e => setShopName(e.target.value)} className="bg-transparent text-foreground text-sm w-full outline-none" />
              </div>
              <div className="bg-card border border-border rounded-xl px-4 py-3">
                <p className="text-[10px] text-muted-foreground uppercase mb-1">{ar ? 'نبذة' : 'Bio'}</p>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3} className="bg-transparent text-foreground text-sm w-full outline-none resize-none" />
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-black text-foreground">{barber?.shopName || shopName || (ar ? 'أضف اسم محلك' : 'Add your shop name')}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{barber?.name || name}</p>
              {(barber as any)?.description || bio ? (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{(barber as any)?.description || bio}</p>
              ) : null}
            </>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: ar ? 'التقييم' : 'Rating', value: barber?.rating?.toFixed(1) || '0.0', icon: Star },
            { label: ar ? 'متابعون' : 'Followers', value: (barber?.followers || 0).toLocaleString(), icon: Users },
            { label: ar ? 'الثقة' : 'Trust', value: (barber as any)?.trustScore || 0, icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-2xl p-3 text-center">
              <Icon size={14} className="text-primary mx-auto mb-1" />
              <p className="text-base font-black text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">{ar ? 'استقبال الخدمة المنزلية' : 'Accept home-service requests'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {ar ? 'فعّلها فقط إذا كنت تقدم زيارات منزلية. يجب تسجيل خدمة وساعات دوام أولاً.' : 'Enable only if you offer home visits. Add a service and working hours first.'}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <label htmlFor="home-service-fee" className="text-xs text-muted-foreground">{ar ? 'رسم الزيارة (د.أ)' : 'Visit fee (JOD)'}</label>
              <input
                id="home-service-fee"
                type="number"
                min="0"
                step="0.25"
                value={homeServiceFeeDraft}
                onChange={event => setHomeServiceFeeDraft(event.target.value)}
                className="w-20 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
              <button type="button" onClick={() => void handleSaveHomeServiceFee()} disabled={savingHomeServiceFee || !barber}
                className="text-xs font-bold text-primary disabled:opacity-50">
                {savingHomeServiceFee ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ الرسم' : 'Save fee')}
              </button>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={barber?.offersHomeService === true}
            disabled={savingHomeService || !barber || !barber.services?.length || !barber.workingHours?.days?.length}
            onClick={() => void handleHomeServiceToggle()}
            className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-50 ${barber?.offersHomeService === true ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${barber?.offersHomeService === true ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{ar ? 'منشوراتي' : 'My Posts'}</p>
            <button
              onClick={openCreatePost}
              className="text-xs text-primary font-bold flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-xl"
            >
              <Plus size={13} /> {ar ? 'منشور جديد' : 'New post'}
            </button>
          </div>

          {myPosts.length === 0 ? (
            <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center">
              <ImageIcon size={28} className="text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-sm text-muted-foreground">{ar ? 'لا منشورات بعد. ابدأ بمشاركة عملك!' : 'No posts yet. Share your work!'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {myPosts.map(p => (
                <motion.div
                  key={p.id}
                  whileTap={{ scale: 0.96 }}
                  className="relative aspect-square rounded-xl overflow-hidden group bg-card"
                >
                  {p.image ? (
                    <img src={p.image} alt={p.caption} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs p-2 text-center">
                      {p.caption}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => openEditPost(p)}
                      className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center"
                    >
                      <Edit3 size={13} className="text-black" />
                    </button>
                    <button
                      onClick={() => handleDeletePost(p.id)}
                      className="w-8 h-8 bg-red-500/90 rounded-full flex items-center justify-center"
                    >
                      <Trash2 size={13} className="text-white" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border mb-5">
          {[
            { label: ar ? 'رمز QR الخاص بالصالون' : 'Shop QR Code', icon: QrCodeIcon, path: '/barber/qr' },
            { label: ar ? 'إعدادات الأعمال' : 'Business Settings', icon: Scissors, path: '/barber/services' },
            { label: ar ? 'طاقم العمل' : 'Staff Management', icon: Users, path: '/barber/staff' },
            { label: ar ? 'الأرباح والمدفوعات' : 'Payout & Earnings', icon: TrendingUp, path: '/barber/earnings' },
          ].map(({ label, icon: Icon, path }) => (
            <button key={label} onClick={() => navigate(path)} className="w-full flex items-center gap-3 px-4 py-3.5">
              <Icon size={17} className="text-muted-foreground" />
              <span className="flex-1 text-sm font-medium text-foreground text-left">{label}</span>
              <ChevronRight size={15} className="text-muted-foreground" />
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={() => { logoutBarber(); navigate('/barber/login'); }}
          className="w-full h-12 rounded-2xl gap-2 text-destructive border-destructive/20"
        >
          <LogOut size={16} /> {ar ? 'تسجيل الخروج' : 'Sign Out'}
        </Button>
      </div>

      <AnimatePresence>
        {postOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => setPostOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md bg-background border-t sm:border border-border sm:rounded-2xl rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-foreground">
                  {postEditingId ? (ar ? 'تعديل المنشور' : 'Edit Post') : (ar ? 'منشور جديد' : 'New Post')}
                </h2>
                <button onClick={() => setPostOpen(false)} className="w-8 h-8 rounded-full bg-card flex items-center justify-center">
                  <X size={16} />
                </button>
              </div>

              <button
                onClick={handlePickPostImage}
                className="w-full aspect-square bg-card border-2 border-dashed border-border rounded-2xl flex items-center justify-center mb-4 overflow-hidden"
              >
                {postImagePreview ? (
                  <img src={postImagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Camera size={28} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">{ar ? 'اختر صورة' : 'Pick an image'}</p>
                  </div>
                )}
              </button>

              <div className="space-y-3">
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">{ar ? 'الستايل' : 'Hair style'}</p>
                  <input
                    value={postStyle}
                    onChange={e => setPostStyle(e.target.value)}
                    placeholder={ar ? 'مثال: فيد كلاسيك' : 'e.g. Classic Fade'}
                    className="bg-transparent text-foreground text-sm w-full outline-none"
                  />
                </div>
                <div className="bg-card border border-border rounded-xl px-4 py-3">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">{ar ? 'وصف' : 'Caption'}</p>
                  <textarea
                    value={postCaption}
                    onChange={e => setPostCaption(e.target.value)}
                    rows={3}
                    placeholder={ar ? 'اكتب شيئًا...' : 'Say something...'}
                    className="bg-transparent text-foreground text-sm w-full outline-none resize-none"
                  />
                </div>
              </div>

              <Button
                onClick={handleSavePost}
                disabled={savingPost}
                className="w-full h-12 rounded-2xl mt-4 bg-primary text-primary-foreground gap-2"
              >
                {savingPost && <Loader2 size={14} className="animate-spin" />}
                {postEditingId ? (ar ? 'حفظ التعديلات' : 'Save changes') : (ar ? 'نشر' : 'Publish')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => navigate('/delete-account')} className="mx-5 mt-4 flex w-[calc(100%-2.5rem)] items-center justify-center gap-2 py-3 text-xs font-semibold text-destructive/80">
        <Trash2 size={14} />{ar ? 'طلب حذف الحساب والبيانات' : 'Request account and data deletion'}
      </button>
    </div>
  );
}
