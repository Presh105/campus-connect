import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FeedAdCard } from './FeedAdCard';

interface Ad {
  id: string;
  title: string;
  image_urls: string[];
  link: string | null;
  slide_titles?: string[] | null;
  slide_links?: string[] | null;
}

/**
 * Renders the most recent active ad whose `placement` matches the given section.
 * Returns null while loading or if no ad exists, so it disappears cleanly.
 */
export function SectionAd({ placement }: { placement: 'marketplace' | 'welfare' | 'predictions' | 'feed' }) {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from('feed_ads') as any)
        .select('id, title, image_urls, link, slide_titles, slide_links')
        .eq('is_active', true)
        .eq('placement', placement)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && data) setAd(data as any);
    })();
    return () => { cancelled = true; };
  }, [placement]);

  if (!ad) return null;
  return <FeedAdCard ad={ad} />;
}
