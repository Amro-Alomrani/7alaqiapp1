import { useEffect, useState } from 'react';
import { subscribeBarberReviews } from '@/lib/db';

export function useReviewStats(barberId: string) {
  const [result, setResult] = useState({ barberId: '', rating: 0, count: 0 });
  useEffect(() => {
    if (!barberId) return;
    return subscribeBarberReviews(barberId, reviews => {
      const valid = reviews.filter(review => Number.isFinite(review.rating) && review.rating >= 1 && review.rating <= 5);
      setResult({ barberId, count: valid.length, rating: valid.length ? valid.reduce((sum, review) => sum + review.rating, 0) / valid.length : 0 });
    });
  }, [barberId]);
  return result.barberId === barberId ? result : { rating: 0, count: 0 };
}
