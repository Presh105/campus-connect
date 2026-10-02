import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeUrl } from '@/lib/url';

interface FeedAd {
  id: string;
  title: string;
  image_urls: string[];
  link: string | null;
  slide_titles?: string[] | null;
  slide_links?: string[] | null;
}

export function FeedAdCard({ ad }: { ad: FeedAd }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (ad.image_urls.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % ad.image_urls.length);
    }, 3500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [ad.image_urls.length]);

  const slideTitle = ad.slide_titles?.[currentSlide]?.trim() || ad.title;
  const slideLink = normalizeUrl(ad.slide_links?.[currentSlide] || ad.link);

  const handleClick = (e: React.MouseEvent) => {
    // Record click (best-effort, never blocks navigation)
    supabase.rpc('increment_ad_click' as any, { _ad_id: ad.id, _slide: currentSlide }).then(() => {});
    // We rely on the <a> tag's default behavior so it always opens, every click.
    if (!slideLink) e.preventDefault();
  };

  if (ad.image_urls.length === 0) return null;

  return (
    <Card className="overflow-hidden shadow-soft">
      <a
        href={slideLink || '#'}
        target="_blank"
        rel="noopener noreferrer sponsored"
        onClick={handleClick}
        className="block cursor-pointer"
        aria-label={`Ad: ${slideTitle}`}
      >
        <div className="relative">
          <div className="relative w-full h-40 overflow-hidden">
            {ad.image_urls.map((url, idx) => (
              <img
                key={idx}
                src={url}
                alt={ad.slide_titles?.[idx] || ad.title}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${idx === currentSlide ? 'opacity-100' : 'opacity-0'}`}
                draggable={false}
              />
            ))}
          </div>
          {ad.image_urls.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {ad.image_urls.map((_, idx) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentSlide ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-background/80 text-foreground text-[10px] backdrop-blur-sm">
            Ad
          </Badge>
        </div>
        <div className="p-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{slideTitle}</p>
          {slideLink && <ExternalLink className="w-4 h-4 text-primary shrink-0" />}
        </div>
      </a>
    </Card>
  );
}
