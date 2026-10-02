import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { normalizeUrl } from '@/lib/url';
import { Plus, Trash2, Image, ExternalLink } from 'lucide-react';
import { ImageUpload } from '@/components/ImageUpload';

interface Ad {
  id: string;
  title: string;
  image_urls: string[];
  link: string | null;
  is_active: boolean;
  placement?: string;
  slide_titles?: string[] | null;
  slide_links?: string[] | null;
  click_count?: number;
  created_at: string;
}

const PLACEMENTS: { value: string; label: string }[] = [
  { value: 'feed', label: 'Main Feed' },
  { value: 'marketplace', label: 'Marketplace (top)' },
  { value: 'welfare', label: 'Community Welfare' },
  { value: 'predictions', label: 'Predictions' },
];

export default function AdminAds() {
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [placement, setPlacement] = useState('feed');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [slideTitles, setSlideTitles] = useState<string[]>([]);
  const [slideLinks, setSlideLinks] = useState<string[]>([]);

  useEffect(() => { fetchAds(); }, []);

  const fetchAds = async () => {
    const { data } = await supabase.from('feed_ads').select('*').order('created_at', { ascending: false });
    setAds((data || []) as Ad[]);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!title.trim() || imageUrls.length === 0) {
      toast.error('Title and at least one image required');
      return;
    }
    const { error } = await supabase.from('feed_ads').insert({
      title: title.trim(),
      image_urls: imageUrls,
      link: normalizeUrl(link) || null,
      placement,
      slide_titles: slideTitles,
      slide_links: slideLinks.map(l => normalizeUrl(l)),
      created_by: user!.id,
    } as any);
    if (error) toast.error('Failed to create ad');
    else {
      toast.success('Ad created!');
      setTitle(''); setLink(''); setImageUrls([]); setSlideTitles([]); setSlideLinks([]); setShowAdd(false);
      fetchAds();
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from('feed_ads').update({ is_active: !current } as any).eq('id', id);
    fetchAds();
  };

  const deleteAd = async (id: string) => {
    await supabase.from('feed_ads').delete().eq('id', id);
    toast.success('Ad deleted');
    fetchAds();
  };

  return (
    <AppLayout>
      <PageHeader title="Manage Ads" subtitle="Create and manage feed advertisements" showBack />
      <div className="px-4 py-4 space-y-4">
        {!showAdd ? (
          <Button onClick={() => setShowAdd(true)} className="w-full rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Create Ad
          </Button>
        ) : (
          <Card className="p-4 space-y-3 border-primary/20">
            <h3 className="font-semibold">New Ad</h3>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ad title" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Link (optional)</Label>
              <Input value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Placement</Label>
              <select value={placement} onChange={e => setPlacement(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm">
                {PLACEMENTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Images ({imageUrls.length} added)</Label>
              {user && (
                <ImageUpload
                  bucket="posts"
                  userId={user.id}
                  onUpload={(url) => {
                    setImageUrls(prev => [...prev, url]);
                    setSlideTitles(prev => [...prev, '']);
                    setSlideLinks(prev => [...prev, '']);
                  }}
                />
              )}
              {imageUrls.length > 0 && (
                <div className="space-y-3 mt-2">
                  {imageUrls.map((url, idx) => (
                    <div key={idx} className="flex gap-2 items-start border border-border rounded-xl p-2">
                      <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Input
                          value={slideTitles[idx] || ''}
                          onChange={e => setSlideTitles(prev => { const c = [...prev]; c[idx] = e.target.value; return c; })}
                          placeholder={`Slide ${idx + 1} title (optional, falls back to main)`}
                          className="rounded-lg h-8 text-xs"
                        />
                        <Input
                          value={slideLinks[idx] || ''}
                          onChange={e => setSlideLinks(prev => { const c = [...prev]; c[idx] = e.target.value; return c; })}
                          placeholder={`Slide ${idx + 1} link (optional)`}
                          className="rounded-lg h-8 text-xs"
                        />
                      </div>
                      <button onClick={() => {
                        setImageUrls(prev => prev.filter((_, i) => i !== idx));
                        setSlideTitles(prev => prev.filter((_, i) => i !== idx));
                        setSlideLinks(prev => prev.filter((_, i) => i !== idx));
                      }} className="bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs shrink-0">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} className="flex-1 rounded-xl">Create Ad</Button>
              <Button variant="outline" onClick={() => setShowAdd(false)} className="rounded-xl">Cancel</Button>
            </div>
          </Card>
        )}

        {loading ? (
          <Card className="p-4 animate-pulse"><div className="w-3/4 h-4 bg-muted rounded" /></Card>
        ) : ads.length === 0 ? (
          <Card className="p-8 text-center">
            <Image className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No ads created yet</p>
          </Card>
        ) : (
          ads.map(ad => (
            <Card key={ad.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{ad.title}</h3>
                <div className="flex items-center gap-2">
                  <Switch checked={ad.is_active} onCheckedChange={() => toggleActive(ad.id, ad.is_active)} />
                  <button onClick={() => deleteAd(ad.id)} className="text-destructive hover:text-destructive/80">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {ad.link && (
                <a href={normalizeUrl(ad.link)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1">
                  {ad.link} <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <div className="flex gap-2">
                {ad.image_urls.map((url, idx) => (
                  <img key={idx} src={url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={ad.is_active ? 'default' : 'secondary'}>{ad.is_active ? 'Active' : 'Inactive'}</Badge>
                <Badge variant="outline" className="capitalize">{ad.placement || 'feed'}</Badge>
              </div>
            </Card>
          ))
        )}
      </div>
    </AppLayout>
  );
}
