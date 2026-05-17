import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import type { Barber, Post } from '@/types';
import { subscribeBarbers, subscribePosts } from '@/lib/db';

interface DataCtx {
  barbers: Barber[];
  posts: Post[];
  loadingBarbers: boolean;
  loadingPosts: boolean;
}

const DataContext = createContext<DataCtx>({
  barbers: [],
  posts: [],
  loadingBarbers: true,
  loadingPosts: true,
});

export function DataProvider({ children }: { children: ReactNode }) {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    let unsubB: (() => void) | null = null;
    let unsubP: (() => void) | null = null;

    try {
      unsubB = subscribeBarbers(list => {
        setBarbers(list);
        setLoadingBarbers(false);
      });
      unsubP = subscribePosts(list => {
        setPosts(list);
        setLoadingPosts(false);
      });
    } catch {
      setLoadingBarbers(false);
      setLoadingPosts(false);
    }

    return () => {
      if (unsubB) unsubB();
      if (unsubP) unsubP();
    };
  }, []);

  const value = useMemo(
    () => ({ barbers, posts, loadingBarbers, loadingPosts }),
    [barbers, posts, loadingBarbers, loadingPosts],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
export const useBarbers = () => useContext(DataContext).barbers;
export const usePosts = () => useContext(DataContext).posts;
export const useBarber = (id: string | undefined) => {
  const { barbers } = useData();
  return id ? barbers.find(b => b.id === id) : undefined;
};
