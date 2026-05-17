import { useState, useRef } from 'react';
import { Flame, Star, Clock, MapPin, Scissors, ChevronRight, Plus, X, ImagePlus, Loader2, Check, User, Heart, Eye, Share2 } from 'lucide-react';
import type { Post } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePosts, useBarbers } from '@/contexts/DataContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { createPost } from '@/lib/db';
import { uploadImage } from '@/lib/storage';
import { toast } from 'sonner';

type Tab = 'looks' | 'barbers' | 'trending';

function PostCreationSheet({
  onClose,
  customer,
  ar,
}: {
  onClose: () => void;
  customer: { uid: string; name: string; avatar: string; phone?: string };
  ar: boolean;
}) {
  const [image, setImage] = useState<string | undefined>();
  const [caption, setCaption] = useState('');
  const [hairStyle, setHairStyle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(ar ? 'الصورة كبيرة جداً (10MB max)' : 'Image too large'); return; }
    setUploading(true);
    try {
      const url = await uploadImage(file, `posts/${customer.uid}/${Date.now()}.jpg`);
      setImage(url);
    } catch {
      toast.error(ar ? 'فشل رفع الصورة' : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const submit = async () => {
    if (!caption.trim() && !image) {
      toast.error(ar ? 'أضف صورة أو وصف على الأقل' : 'Add a photo or caption');
      return;
    }
    setSubmitting(true);
    try {
      await createPost(customer.uid, {
        barber: {
          id: customer.uid,
          name: customer.name,
          shopName: '',
          avatar: customer.avatar,
        },
        postedBy: 'customer',
        type: 'photo',
        image: image || '',
        hairStyle: hairStyle.trim(),
        caption: caption.trim(),
        tags: [],
        likes: 0,
        comments: 0,
        saves: 0,
        location: '',
      });
      toast.success(ar ? 'تم نشر منشورك ✅' : 'Post published ✅');
      onClose();
    } catch {
      toast.error(ar ? 'فشل النشر، حاول مجدداً' : 'Publish failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 pb-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-background border border-border rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        dir={ar ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-foreground">{ar ? 'منشور جديد' : 'New Post'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X size={14} className="text-foreground" />
          </button>
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-2">
            {ar ? 'صورة (اختياري)' : 'Photo (optional)'}
          </label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          {image ? (
            <div className="relative">
              <img src={image} alt="" className="w-full h-44 object-cover rounded-2xl border border-border" />
              <button
                onClick={() => setImage(undefined)}
                className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center"
              >
                <X size={13} className="text-white" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-28 bg-card border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground active:bg-secondary"
            >
              {uploading
                ? <Loader2 size={22} className="animate-spin text-primary" />
                : <ImagePlus size={22} />}
              <span className="text-xs font-bold">
                {uploading ? (ar ? 'جاري الرفع...' : 'Uploading...') : (ar ? 'اختر صورة' : 'Choose Photo')}
              </span>
            </button>
          )}
        </div>
        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1.5">
            {ar ? 'نوع القصة (اختياري)' : 'Hairstyle (optional)'}
          </label>
          <input
            value={hairStyle}
            onChange={e => setHairStyle(e.target.value)}
            placeholder={ar ? 'مثال: فيد، قصة كلاسيك...' : 'e.g. Fade, Classic cut...'}
            className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary transition"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1.5">
            {ar ? 'الوصف' : 'Caption'}
          </label>
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder={ar ? 'شارك تجربتك مع قصتك...' : 'Share your experience...'}
            rows={3}
            className="w-full bg-card border border-border rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary transition resize-none"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 bg-card border border-border h-12 rounded-2xl text-sm font-bold">
            {ar ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            onClick={submit}
            disabled={submitting || uploading}
            className="flex-1 bg-primary text-primary-foreground h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {ar ? 'نشر' : 'Publish'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PostDetailModal({
  post,
  onClose,
  ar,
}: {
  post: Post;
  onClose: () => void;
  ar: boolean;
}) {
  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm bg-background border border-border rounded-t-3xl overflow-hidden max-h-[90vh] flex flex-col"
        dir={ar ? 'rtl' : 'ltr'}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            {post.barber.avatar ? (
              <img src={post.barber.avatar} alt="" className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <User size={16} className="text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-bold text-foreground text-sm">{post.barber.name}</p>
              {post.barber.shopName && (
                <p className="text-xs text-muted-foreground">{post.barber.shopName}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {post.image ? (
            <img src={post.image} alt={post.hairStyle} className="w-full object-cover max-h-72" />
          ) : (
            <div className="w-full h-40 bg-primary/5 flex items-center justify-center">
              <span className="text-6xl">✂️</span>
            </div>
          )}

          <div className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Heart size={16} className="text-red-400 fill-red-400" />
                <span className="text-sm font-bold text-foreground">{post.likes}</span>
                <span className="text-xs text-muted-foreground">{ar ? 'إعجاب' : 'likes'}</span>
              </div>
              {post.comments > 0 && (
                <div className="flex items-center gap-1.5">
                  <Eye size={16} className="text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground">{post.comments}</span>
                  <span className="text-xs text-muted-foreground">{ar ? 'تعليق' : 'comments'}</span>
                </div>
              )}
              {post.saves > 0 && (
                <div className="flex items-center gap-1.5">
                  <Share2 size={15} className="text-muted-foreground" />
                  <span className="text-sm font-bold text-foreground">{post.saves}</span>
                </div>
              )}
            </div>

            {post.hairStyle && (
              <div className="inline-flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-xl">
                <Scissors size={12} className="text-primary" />
                <span className="text-xs font-bold text-primary">{post.hairStyle}</span>
              </div>
            )}

            {post.caption && (
              <p className="text-sm text-foreground leading-relaxed">{post.caption}</p>
            )}

            {post.location && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin size={13} />
                <span className="text-xs">{post.location}</span>
              </div>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.tags.map(tag => (
                  <span key={tag} className="text-[11px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {post.postedBy !== 'customer' && (
          <div className="px-5 pb-8 pt-3 border-t border-border">
            <button
              onClick={() => { onClose(); navigate(`/barbers/${post.barber.id}`); }}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl text-sm"
            >
              {ar ? 'عرض ملف الحلاق' : 'View Barber Profile'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function FeedPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('looks');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const allPosts = usePosts();
  const allBarbers = useBarbers();
  const { language } = useLanguage();
  const { customer, isCustomerLoggedIn } = useAuth();
  const ar = language === 'ar';

  const topBarbers = [...allBarbers]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  const trendingPosts = [...allPosts].sort(
    (a, b) => (b.likes + b.comments * 2 + b.saves * 3) - (a.likes + a.comments * 2 + a.saves * 3)
  );
  const recentPosts = [...allPosts];

  return (
    <div className="min-h-screen bg-background pb-28" dir={ar ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="px-5 pt-14 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-black text-foreground">{ar ? 'اكتشف' : 'Discover'}</h1>
              <p className="text-xs text-muted-foreground">{ar ? 'أحدث أعمال الحلاقين' : 'Latest from barbers near you'}</p>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Scissors size={18} className="text-primary" />
            </div>
          </div>
          <div className="flex gap-2">
            {([
              { id: 'looks', label: ar ? 'الأعمال' : 'Recent', icon: Clock },
              { id: 'barbers', label: ar ? 'الحلاقون' : 'Barbers', icon: Star },
              { id: 'trending', label: ar ? 'الأبرز' : 'Hot', icon: Flame },
            ] as { id: Tab; label: string; icon: typeof Flame }[]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                  tab === id ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground'
                }`}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'looks' && (
        <div className="px-4 pt-4">
          {recentPosts.length === 0 ? (
            <EmptyState
              icon="✂️"
              title={ar ? 'لا توجد منشورات بعد' : 'No posts yet'}
              subtitle={ar ? 'سيظهر هنا أعمال الحلاقين وتجارب الزبائن' : 'Barber work will appear here'}
            />
          ) : (
            <div className="columns-2 gap-3">
              {recentPosts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="break-inside-avoid mb-3"
                  onClick={() => setSelectedPost(post)}
                >
                  <div className="rounded-2xl overflow-hidden bg-card border border-border cursor-pointer">
                    {post.image ? (
                      <img
                        src={post.image}
                        alt={post.hairStyle}
                        className="w-full object-cover"
                        style={{ aspectRatio: i % 3 === 0 ? '3/4' : '1/1' }}
                      />
                    ) : (
                      <div className="w-full bg-primary/10 flex items-center justify-center" style={{ aspectRatio: '1/1' }}>
                        <span className="text-4xl">✂️</span>
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        {post.barber.avatar ? (
                          <img src={post.barber.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                            <User size={10} className="text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-[11px] font-bold text-foreground truncate">{post.barber.name}</p>
                        {post.postedBy === 'customer' && (
                          <span className="text-[9px] font-bold bg-blue-500/15 text-blue-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            {ar ? 'زبون' : 'Customer'}
                          </span>
                        )}
                      </div>
                      {post.hairStyle && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{post.hairStyle}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground">❤️ {post.likes}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'barbers' && (
        <div className="px-4 pt-4 space-y-3">
          {topBarbers.length === 0 ? (
            <EmptyState icon="💈" title={ar ? 'لا يوجد حلاقون بعد' : 'No barbers yet'} subtitle={ar ? 'سيظهر هنا أفضل الحلاقين' : 'Top barbers will appear here'} />
          ) : (
            topBarbers.map((barber, i) => (
              <motion.div
                key={barber.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/barbers/${barber.id}`)}
                className="flex items-center gap-3 bg-card border border-border rounded-2xl p-3.5 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0 ${
                  i === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                  i === 1 ? 'bg-gray-400/20 text-gray-400' :
                  i === 2 ? 'bg-orange-500/20 text-orange-500' :
                  'bg-secondary text-muted-foreground'
                }`}>
                  {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                </div>
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-secondary">
                  {barber.avatar ? (
                    <img src={barber.avatar} alt={barber.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl">✂️</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-sm truncate">{barber.shopName || barber.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {barber.rating != null && (
                      <div className="flex items-center gap-0.5">
                        <Star size={10} className="fill-yellow-400 text-yellow-400" />
                        <span className="text-[11px] font-bold text-foreground">{barber.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {barber.address && (
                      <div className="flex items-center gap-0.5">
                        <MapPin size={9} className="text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground truncate">{barber.address}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {barber.services?.slice(0, 2).map(s => (
                      <span key={s.id} className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
              </motion.div>
            ))
          )}
        </div>
      )}

      {tab === 'trending' && (
        <div className="px-4 pt-4 space-y-4">
          {trendingPosts.length === 0 ? (
            <EmptyState icon="🔥" title={ar ? 'لا يوجد أعمال رائجة بعد' : 'Nothing trending yet'} subtitle={ar ? 'الأعمال الأكثر إعجاباً ستظهر هنا' : 'Most liked posts will appear here'} />
          ) : (
            trendingPosts.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedPost(post)}
                className="bg-card border border-border rounded-3xl overflow-hidden cursor-pointer"
              >
                {post.image ? (
                  <div className="aspect-[16/9] overflow-hidden relative">
                    <img src={post.image} alt="" className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1">
                      <Flame size={10} className="text-orange-400" />
                      <span className="text-[10px] text-white font-bold">#{i + 1} {ar ? 'الأبرز' : 'Trending'}</span>
                    </div>
                    {post.postedBy === 'customer' && (
                      <div className="absolute top-2 right-2 bg-blue-500/80 backdrop-blur-sm rounded-full px-2 py-1">
                        <span className="text-[10px] text-white font-bold">{ar ? 'زبون' : 'Customer'}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-primary/5 flex items-center justify-center">
                    <span className="text-5xl">✂️</span>
                  </div>
                )}
                <div className="p-3 flex items-center gap-3">
                  {post.barber.avatar ? (
                    <img src={post.barber.avatar} alt="" className="w-8 h-8 rounded-xl object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center">
                      <User size={14} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{post.barber.name}</p>
                    <p className="text-xs text-muted-foreground">{post.caption?.slice(0, 40) || post.hairStyle || ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-black text-primary">❤️ {post.likes}</p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {isCustomerLoggedIn && customer && (
        <motion.button
          onClick={() => setShowCreate(true)}
          whileTap={{ scale: 0.92 }}
          className="fixed bottom-28 right-5 z-30 w-14 h-14 bg-primary rounded-2xl shadow-xl shadow-primary/40 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
        >
          <Plus size={24} className="text-primary-foreground" />
        </motion.button>
      )}

      <AnimatePresence>
        {showCreate && customer && (
          <PostCreationSheet
            customer={{ uid: customer.uid, name: customer.name, avatar: customer.avatar, phone: customer.phone }}
            onClose={() => setShowCreate(false)}
            ar={ar}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedPost && (
          <PostDetailModal
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            ar={ar}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="text-center py-20">
      <span className="text-5xl block mb-4">{icon}</span>
      <p className="font-bold text-foreground text-base">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
    </div>
  );
}
