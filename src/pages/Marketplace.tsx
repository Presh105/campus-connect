import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Heart, ShoppingBag, Search, Trash2, Pin, Eye, MessageCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, Link } from 'react-router-dom';
import { MARKETPLACE_CATEGORIES } from '@/lib/constants';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { RulesBanner } from '@/components/rules/RulesBanner';
import { SectionAd } from '@/components/ads/SectionAd';

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  discount_price?: number | null;
  image_url: string | null;
  category: string;
  is_sold: boolean;
  is_sponsored?: boolean;
  is_pinned?: boolean;
  likes_count: number;
  view_count: number;
  created_at: string;
  seller_id: string;
  profiles?: { full_name: string; avatar_url: string | null };
}

export default function Marketplace() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [deleteListingId, setDeleteListingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { fetchListings(); }, [selectedCategory]);

  const fetchListings = async () => {
    let query = supabase
      .from('listings')
      .select('*')
      .eq('is_sold', false)
      .eq('approval_status', 'approved')
      .order('is_pinned', { ascending: false })
      // Point 5: Sort by likes for ranking similar products higher
      .order('likes_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (selectedCategory !== 'all') query = query.eq('category', selectedCategory);

    const { data: listingsData, error } = await query;
    if (error) { setLoading(false); return; }

    const sellerIds = [...new Set(listingsData.map(l => l.seller_id))];
    const { data: profilesData } = await supabase
      .from('profiles').select('user_id, full_name, avatar_url').in('user_id', sellerIds);

    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
    setListings(listingsData.map(l => ({ ...l, profiles: profilesMap.get(l.seller_id) || undefined })) as Listing[]);
    setLoading(false);
  };

  const filteredListings = listings.filter(l =>
    l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteListing = async () => {
    if (!deleteListingId) return;
    setDeleting(true);
    const { error } = await supabase.from('listings').delete().eq('id', deleteListingId);
    setDeleting(false);
    if (error) toast.error('Failed to delete');
    else { toast.success('Listing deleted'); setListings(prev => prev.filter(l => l.id !== deleteListingId)); }
    setDeleteListingId(null);
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Marketplace" 
        subtitle="Buy & sell with escrow protection"
        action={
          <Link to="/create-listing">
            <Button size="sm" className="rounded-full bg-gradient-primary shadow-primary">
              <Plus className="w-4 h-4 mr-1" /> Sell
            </Button>
          </Link>
        }
      />

      <RulesBanner location="marketplace" />
      
      <div className="px-4 py-4 space-y-4">
        <SectionAd placement="marketplace" />
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input placeholder="Search products..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="rounded-xl h-12 pl-12" />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {MARKETPLACE_CATEGORIES.map((cat) => (
            <Button key={cat.value} variant={selectedCategory === cat.value ? "default" : "outline"} size="sm" className="rounded-full whitespace-nowrap" onClick={() => setSelectedCategory(cat.value)}>
              {cat.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="overflow-hidden animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-3 space-y-2"><div className="w-full h-4 bg-muted rounded" /><div className="w-2/3 h-3 bg-muted rounded" /></div>
              </Card>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <Card className="p-8 text-center">
            <ShoppingBag className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="font-bold text-lg mb-2">No listings yet</h3>
            <Link to="/create-listing"><Button className="rounded-full bg-gradient-primary"><Plus className="w-4 h-4 mr-2" />Create Listing</Button></Link>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredListings.map((listing) => (
              <Card 
                key={listing.id} 
                className={`overflow-hidden shadow-soft animate-fade-in cursor-pointer ${listing.is_pinned ? 'ring-2 ring-primary/50' : ''} ${listing.is_sponsored ? 'ring-2 ring-warning/50' : ''}`}
                onClick={() => navigate(`/listing/${listing.id}`)}
              >
                {/* Point 22: Full image display */}
                <div className="aspect-square bg-muted relative">
                  {listing.image_url ? (
                    <img src={listing.image_url} alt={listing.title} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-12 h-12 text-muted-foreground/30" /></div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    {listing.is_pinned && <Badge className="bg-primary/90 text-primary-foreground"><Pin className="w-3 h-3" /></Badge>}
                    {listing.is_sponsored && <Badge className="bg-warning/90 text-warning-foreground">Sponsored</Badge>}
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-foreground line-clamp-1">{listing.title}</h3>
                  {listing.discount_price ? (
                    <div className="mt-1 flex items-baseline gap-2">
                      <p className="text-lg font-bold text-primary">₦{Number(listing.discount_price).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground line-through">₦{listing.price.toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="text-lg font-bold text-primary mt-1">₦{listing.price.toLocaleString()}</p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    {listing.seller_id !== user?.id ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/chat/private/${listing.seller_id}`); }}
                        className="flex items-center gap-1 text-xs text-primary font-medium line-clamp-1 min-w-0"
                        title="Chat with seller"
                      >
                        <MessageCircle className="w-3 h-3 shrink-0" />
                        <span className="truncate">{listing.profiles?.full_name || 'Seller'}</span>
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground line-clamp-1">You</span>
                    )}
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Heart className="w-3 h-3" />{listing.likes_count}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="w-3 h-3" />{listing.view_count || 0}</span>
                      {isAdmin && (
                        <button onClick={(e) => { e.stopPropagation(); setDeleteListingId(listing.id); }} className="text-destructive hover:text-destructive/80">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <DeleteConfirmDialog open={!!deleteListingId} onOpenChange={(open) => !open && setDeleteListingId(null)} onConfirm={handleDeleteListing} title="Delete this listing?" description="This will permanently remove the listing." loading={deleting} />
    </AppLayout>
  );
}
