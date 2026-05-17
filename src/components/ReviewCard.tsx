import { Star } from 'lucide-react';
import { Review } from '@/types';

export default function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img src={review.userAvatar} alt={review.userName} className="w-9 h-9 rounded-full object-cover" />
          <div>
            <p className="text-sm font-semibold text-foreground">{review.userName}</p>
            <p className="text-xs text-muted-foreground">{review.date}</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} className={i < review.rating ? 'text-primary fill-primary' : 'text-muted-foreground'} />
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{review.comment}</p>
    </div>
  );
}
