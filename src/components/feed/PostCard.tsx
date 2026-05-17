import { useState } from 'react';
import { Heart, MessageCircle, Bookmark, Share2, MapPin, Zap, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Post } from '@/types';
import BeforeAfterSlider from './BeforeAfterSlider';
import { Button } from '@/components/ui/button';

function formatCount(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export default function PostCard({ post }: { post: Post }) {
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(post.isFollowing);
  const [likes, setLikes] = useState(post.likes);
  const [showHeart, setShowHeart] = useState(false);

  const handleDoubleTap = () => {
    if (!liked) {
      setLiked(true);
      setLikes(l => l + 1);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 900);
    }
  };

  const handleLike = () => {
    setLiked(!liked);
    setLikes(l => liked ? l - 1 : l + 1);
  };

  return (
    <div className="bg-card border border-border rounded-3xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary/60 flex-shrink-0 cursor-pointer"
          onClick={() => navigate(`/barbers/${post.barber.id}`)}
        >
          <img src={post.barber.avatar} alt={post.barber.name} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/barbers/${post.barber.id}`)}>
          <p className="text-sm font-bold text-foreground truncate">{post.barber.name}</p>
          <div className="flex items-center gap-1">
            <MapPin size={10} className="text-muted-foreground" />
            <p className="text-xs text-muted-foreground truncate">{post.barber.shopName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post.type === 'trending' && (
            <div className="flex items-center gap-1 bg-primary/15 rounded-full px-2 py-0.5">
              <TrendingUp size={10} className="text-primary" />
              <span className="text-[10px] text-primary font-bold">HOT</span>
            </div>
          )}
          <button
            onClick={() => setFollowing(!following)}
            className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all ${following ? 'bg-secondary text-muted-foreground' : 'bg-primary text-primary-foreground'}`}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        </div>
      </div>

      <div className="relative" onDoubleClick={handleDoubleTap}>
        {post.type === 'before_after' && post.beforeImage && post.afterImage ? (
          <BeforeAfterSlider before={post.beforeImage} after={post.afterImage} />
        ) : (
          <div className="aspect-[4/5] overflow-hidden">
            <img
              src={post.image}
              alt={post.hairStyle}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 flex items-center gap-1.5">
          <span className="text-xs font-bold text-white">{post.hairStyle}</span>
        </div>
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.4, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Heart size={80} className="text-red-500 fill-red-500 drop-shadow-xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={handleLike} className="flex items-center gap-1.5">
              <motion.div whileTap={{ scale: 1.3 }}>
                <Heart size={22} className={liked ? 'text-red-500 fill-red-500' : 'text-foreground'} strokeWidth={liked ? 0 : 1.8} />
              </motion.div>
              <span className="text-sm font-semibold text-foreground">{formatCount(likes)}</span>
            </button>
            <button className="flex items-center gap-1.5">
              <MessageCircle size={22} className="text-foreground" strokeWidth={1.8} />
              <span className="text-sm font-semibold text-foreground">{formatCount(post.comments)}</span>
            </button>
            <button>
              <Share2 size={22} className="text-foreground" strokeWidth={1.8} />
            </button>
          </div>
          <motion.button whileTap={{ scale: 1.2 }} onClick={() => setSaved(!saved)}>
            <Bookmark size={22} className={saved ? 'text-primary fill-primary' : 'text-foreground'} strokeWidth={saved ? 0 : 1.8} />
          </motion.button>
        </div>

        <p className="text-sm text-foreground mt-2 leading-relaxed">
          <span className="font-bold">{post.barber.name.split(' ')[0]}</span>{' '}
          {post.caption}
        </p>
        <div className="flex gap-1 flex-wrap mt-1 mb-2">
          {post.tags.map(t => (
            <span key={t} className="text-xs text-primary/80 font-medium">{t}</span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-3">{post.timeAgo}</p>

        <Button
          onClick={() => navigate(`/book/${post.barber.id}`)}
          className="w-full h-11 rounded-2xl bg-primary text-primary-foreground font-bold text-sm gap-2 mb-1"
        >
          <Zap size={15} />
          Book This Look
        </Button>
      </div>
    </div>
  );
}
