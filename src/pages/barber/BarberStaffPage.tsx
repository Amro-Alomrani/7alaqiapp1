import { useState, useEffect } from 'react';
import { useSafeBack } from "@/hooks/useSafeBack";
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Users, Loader2, Star, Check, Camera, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { addStaffMember, deleteStaffMember, subscribeStaff, type StaffDoc } from '@/lib/db';
import { describeImageUploadError, pickImage, uploadImage } from '@/lib/storage';

export default function BarberStaffPage() {
  const navigate = useNavigate();
  const safeBack = useSafeBack();
  const { barberUser } = useAuth();
  const { language } = useLanguage();
  const ar = language === 'ar';
  const uid = barberUser?.uid || '';

  const [staff, setStaff] = useState<(StaffDoc & { id: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSpecialty, setNewSpecialty] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  useEffect(() => {
    if (!uid) return;
    const unsub = subscribeStaff(uid, setStaff);
    return () => unsub();
  }, [uid]);

  const handlePickAvatar = async () => {
    const file = await pickImage();
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleAddStaff = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      let avatarUrl = '';
      if (avatarFile) {
        avatarUrl = await uploadImage(avatarFile, `barbers/${uid}/staff/${Date.now()}.jpg`);
      }
      await addStaffMember(uid, {
        barberId: uid,
        name: newName.trim(),
        specialties: newSpecialty.split(',').map(s => s.trim()).filter(Boolean),
        avatar: avatarUrl,
      });
      setShowAdd(false);
      setNewName('');
      setNewSpecialty('');
      setAvatarFile(null);
      setAvatarPreview('');
      toast.success(ar ? 'تم إضافة موظف جديد' : 'Staff member added');
    } catch (e: any) {
      toast.error(ar ? 'فشل إضافة الموظف' : 'Failed to add staff', {
        description: avatarFile ? describeImageUploadError(e, ar) : (e?.message || undefined),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    if (!confirm(ar ? 'حذف هذا الموظف؟' : 'Delete this staff member?')) return;
    try {
      await deleteStaffMember(staffId);
      toast.success(ar ? 'تم الحذف' : 'Deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20" dir={ar ? 'rtl' : 'ltr'}>
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-5 pt-12 pb-4 flex items-center justify-between">
        <button onClick={() => safeBack()} className="w-10 h-10 bg-card border border-border rounded-xl flex items-center justify-center">
          <ChevronLeft size={20} className={`text-foreground ${ar ? 'rotate-180' : ''}`} />
        </button>
        <h1 className="text-xl font-black text-foreground">{ar ? 'فريق العمل' : 'Staff Management'}</h1>
        <button onClick={() => setShowAdd(true)} className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
          <Plus size={20} />
        </button>
      </div>

      <div className="p-5 flex-1 space-y-4">
        {staff.length === 0 ? (
          <div className="text-center py-20">
            <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-1">{ar ? 'لا يوجد فريق عمل' : 'No staff yet'}</h3>
            <p className="text-sm text-muted-foreground">{ar ? 'أضف حلاقين لتتبع أدائهم' : 'Add barbers to track performance'}</p>
          </div>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
              {s.avatar ? (
                <img src={s.avatar} alt={s.name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {(s.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <p className="font-bold text-foreground text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.specialties?.join(', ')}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="flex items-center gap-1 justify-end text-xs text-green-400 font-bold mb-1">
                    <Check size={12} /> {s.completedCount} {ar ? 'طلب' : 'Jobs'}
                  </div>
                </div>
                <button onClick={() => handleDelete(s.id)} className="text-destructive p-1">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 pb-8"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-background border border-border rounded-3xl p-6"
            >
              <h2 className="text-lg font-bold text-foreground mb-4">{ar ? 'موظف جديد' : 'New Staff'}</h2>

              <div className="flex justify-center mb-4">
                <button onClick={handlePickAvatar} className="w-20 h-20 rounded-2xl bg-card border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={24} className="text-muted-foreground" />
                  )}
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">{ar ? 'اسم الموظف' : 'Staff Name'}</label>
                  <input
                    value={newName} onChange={e => setNewName(e.target.value)}
                    placeholder={ar ? 'مثال: سامر' : 'e.g. Samer'}
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">{ar ? 'التخصص' : 'Specialties (comma separated)'}</label>
                  <input
                    value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)}
                    placeholder={ar ? 'مثال: فيد, لحية' : 'e.g. Fades, Beards'}
                    className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition"
                  />
                </div>
                <button
                  onClick={handleAddStaff} disabled={loading || !newName.trim()}
                  className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : (ar ? 'إضافة' : 'Add Staff')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
