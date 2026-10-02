import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, MousePointerClick, ExternalLink } from 'lucide-react';
import { normalizeUrl } from '@/lib/url';

interface AdRow {
  id: string;
  title: string;
  image_urls: string[];
  link: string | null;
  slide_titles?: string[] | null;
  slide_links?: string[] | null;
  is_active: boolean;
  placement: string;
  click_count: number;
  created_at: string;
}
interface ClickRow { ad_id: string; slide_index: number; }

export default function AdminAdLibrary() {
  const [ads, setAds] = useState<AdRow[]>([]);
  const [perSlide, setPerSlide] = useState<Record<string, Record<number, number>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: adsData } = await supabase.from('feed_ads').select('*').order('created_at', { ascending: false });
      const { data: clicks } = await (supabase.from('ad_clicks') as any).select('ad_id, slide_index');
      const map: Record<string, Record<number, number>> = {};
      (clicks as ClickRow[] | null)?.forEach(c => {
        map[c.ad_id] ??= {};
        map[c.ad_id][c.slide_index] = (map[c.ad_id][c.slide_index] || 0) + 1;
      });
      setPerSlide(map);
      setAds((adsData || []) as AdRow[]);
      setLoading(false);
    })();
  }, []);

  const total = ads.reduce((s, a) => s + (a.click_count || 0), 0);

  return (
    <AppLayout>
      <PageHeader title="Ad Library" subtitle="All ads, clicks & performance" showBack />
      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          <div>
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total ad clicks · {ads.length} ads</p>
          </div>
        </Card>

        {loading ? (
          <Card className="p-4 animate-pulse"><div className="h-4 w-1/2 bg-muted rounded" /></Card>
        ) : ads.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">No ads yet</Card>
        ) : ads.map(ad => (
          <Card key={ad.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold">{ad.title}</h3>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  <Badge variant={ad.is_active ? 'default' : 'secondary'}>{ad.is_active ? 'Active' : 'Inactive'}</Badge>
                  <Badge variant="outline" className="capitalize">{ad.placement}</Badge>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-primary"><MousePointerClick className="w-4 h-4" /><span className="font-bold">{ad.click_count}</span></div>
                <p className="text-[10px] text-muted-foreground">clicks</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ad.image_urls.map((u, i) => {
                const title = ad.slide_titles?.[i] || ad.title;
                const link = normalizeUrl(ad.slide_links?.[i] || ad.link);
                const slideClicks = perSlide[ad.id]?.[i] || 0;
                return (
                  <div key={i} className="space-y-1">
                    <img src={u} alt="" className="w-full h-20 object-cover rounded-lg" />
                    <p className="text-xs font-medium truncate">{title}</p>
                    {link && <a href={link} target="_blank" rel="noopener" className="text-[10px] text-primary truncate flex items-center gap-1"><ExternalLink className="w-3 h-3" />{link}</a>}
                    <p className="text-[10px] text-muted-foreground">Slide {i + 1} · {slideClicks} clicks</p>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </AppLayout>
  );
}
