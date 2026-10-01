import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, MessageCircle, Clock, User, Eye, Trash2, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, Star, Shield } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Link, useNavigate } from 'react-router-dom';
import { DEPARTMENTS } from '@/lib/constants';
import { toast } from 'sonner';
import { DeleteConfirmDialog } from '@/components/admin/DeleteConfirmDialog';
import { RulesBanner } from '@/components/rules/RulesBanner';
import { PostContent } from '@/components/posts/PostContent';
import { WelcomeMessage } from '@/components/WelcomeMessage';
import { SearchById } from '@/components/SearchById';
import { scoreAndSortPosts, saveFeedScrollPosition, restoreFeedScrollPosition, clearFeedScrollPosition } from '@/lib/feedAlgorithm';
import { notifyPostOwner, notifyUser } from '@/hooks/useNotify';
import { FeedAdCard } from '@/components/ads/FeedAdCard';

interface Post {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  image_urls: string[] | null;
  is_anonymous: boolean;
  is_sponsored: boolean;
  is_important?: boolean;
  is_monetized?: boolean;
  payout_method?: string | null;
  points_status?: 'pending' | 'approved' | 'declined';
  comments_count: number;
  view_count: number;
  created_at: string;
  user_id: string;
  short_id: string | null;
  likes_yes: number;
  likes_no: number;
  profiles?: {
    full_name: string;
    department: string;
    avatar_url: string | null;
    display_number: number;
    is_anonymous: boolean;
    system_id: string | null;
    points: number;
  };
}

interface VoteData {
  yes: number;
  no: number;
  userVote: boolean | null;
}

export default function Feed() {
  const { user, profile } = useAuth();
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 1000;
  const [userCommentedPosts, setUserCommentedPosts] = useState<Set<string>>(new Set());
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [postVotes, setPostVotes] = useState<Record<string, VoteData>>({});
  const [showImportantOnly, setShowImportantOnly] = useState(false);
  const viewedPosts = useRef<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [feedAds, setFeedAds] = useState<any[]>([]);

  // Pull-to-refresh state
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const touchStartY = useRef(0);

  const fetchPosts = useCallback(async (showRefreshing = false, useRandomness = false, append = false, pageOverride?: number) => {
    if (showRefreshing) setRefreshing(true);
    if (append) setLoadingMore(true);
    const currentPage = pageOverride ?? (append ? page + 1 : 0);
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (postsError || !postsData) { setLoading(false); setRefreshing(false); setLoadingMore(false); return; }
    setHasMore(postsData.length === PAGE_SIZE);
    setPage(currentPage);

    const userIds = [...new Set(postsData.map(p => p.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, full_name, department, avatar_url, display_number, is_anonymous, system_id, points')
      .in('user_id', userIds);

    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

    const postIds = postsData.map(p => p.id);
    const { data: votesData } = await supabase
      .from('post_votes')
      .select('post_id, vote, user_id')
      .in('post_id', postIds);

    const votesMap: Record<string, VoteData> = {};
    postIds.forEach(id => { votesMap[id] = { yes: 0, no: 0, userVote: null }; });
    votesData?.forEach(v => {
      if (!votesMap[v.post_id]) votesMap[v.post_id] = { yes: 0, no: 0, userVote: null };
      if (v.vote) votesMap[v.post_id].yes++;
      else votesMap[v.post_id].no++;
      if (v.user_id === user?.id) votesMap[v.post_id].userVote = v.vote;
    });
    setPostVotes(prev => append ? { ...prev, ...votesMap } : votesMap);

    const { data: commentsData } = await supabase
      .from('comments')
      .select('post_id, user_id')
      .in('post_id', postIds);

    const commentCountMap: Record<string, Set<string>> = {};
    commentsData?.forEach(c => {
      if (!commentCountMap[c.post_id]) commentCountMap[c.post_id] = new Set();
      commentCountMap[c.post_id].add(c.user_id);
    });

    const postsWithData = postsData.map(post => ({
      ...post,
      profiles: profilesMap.get(post.user_id) || undefined,
      comments_count: commentCountMap[post.id]?.size || 0,
      likes_yes: votesMap[post.id]?.yes || 0,
      likes_no: votesMap[post.id]?.no || 0,
    }));

    const sortedPosts = scoreAndSortPosts(postsWithData as Post[], useRandomness || showRefreshing);
    setPosts(prev => append ? [...prev, ...sortedPosts] : sortedPosts);
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, [user]);

  useEffect(() => {
    fetchPosts(false, true, false, 0);
    if (user) fetchUserComments();
    fetchAds();
  }, [user, fetchPosts]);

  // Unread chat badge on the Chats icon
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      const { data } = await supabase.rpc('get_recent_chats');
      if (data) setUnreadChatCount((data as any[]).reduce((sum, c) => sum + Number(c.unread_count || 0), 0));
    };
    fetchUnread();
    const ch = supabase
      .channel('feed-unread-chats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_messages' }, fetchUnread)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Realtime: keep monetization badge & other flags in sync for everyone
  useEffect(() => {
    const ch = supabase
      .channel('posts-monetize')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, (payload: any) => {
        const n = payload.new || {};
        setPosts(prev => prev.map(p => p.id === n.id ? { ...p, is_monetized: n.is_monetized, was_rewarded: n.was_rewarded, is_important: n.is_important, points_status: n.points_status } as any : p));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Infinite scroll: load more when nearing bottom
  useEffect(() => {
    const onScroll = () => {
      saveFeedScrollPosition(window.scrollY);
      if (loadingMore || !hasMore || loading) return;
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 600;
      if (nearBottom) fetchPosts(false, false, true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [fetchPosts, loadingMore, hasMore, loading]);

  const fetchAds = async () => {
    const { data } = await supabase.from('feed_ads').select('*').eq('is_active', true).order('sort_order');
    setFeedAds(data || []);
  };

  useEffect(() => {
    const savedPosition = restoreFeedScrollPosition();
    if (savedPosition > 0) setTimeout(() => { window.scrollTo(0, savedPosition); }, 100);
  }, [loading]);

  const fetchUserComments = async () => {
    if (!user) return;
    const { data } = await supabase.from('comments').select('post_id').eq('user_id', user.id);
    if (data) setUserCommentedPosts(new Set(data.map(c => c.post_id)));
  };

  const handleRefresh = () => {
    clearFeedScrollPosition();
    fetchPosts(true, true, false, 0);
    if (user) fetchUserComments();
    toast.success('Feed refreshed');
  };

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (window.scrollY > 0) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && diff < 150) { setPullY(diff); setIsPulling(true); }
  };
  const handleTouchEnd = () => {
    if (pullY > 60) handleRefresh();
    setPullY(0);
    setIsPulling(false);
  };

  const handlePostVisible = useCallback(async (postId: string) => {
    if (!user || viewedPosts.current.has(postId)) return;
    viewedPosts.current.add(postId);
    await supabase.from('content_views').upsert(
      { content_type: 'post', content_id: postId, user_id: user.id },
      { onConflict: 'content_type,content_id,user_id' }
    );
    const { count } = await supabase.from('content_views').select('*', { count: 'exact', head: true }).eq('content_type', 'post').eq('content_id', postId);
    if (count !== null) {
      await supabase.from('posts').update({ view_count: count }).eq('id', postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, view_count: count } : p));
    }
  }, [user]);

  const handleVote = async (postId: string, vote: boolean) => {
    if (!user) { toast.error('Please sign in to vote'); return; }
    const currentVote = postVotes[postId]?.userVote;
    if (currentVote === vote) {
      await supabase.from('post_votes').delete().eq('post_id', postId).eq('user_id', user.id);
      setPostVotes(prev => ({ ...prev, [postId]: { ...prev[postId], yes: prev[postId].yes - (vote ? 1 : 0), no: prev[postId].no - (!vote ? 1 : 0), userVote: null } }));
    } else if (currentVote !== null) {
      await supabase.from('post_votes').update({ vote }).eq('post_id', postId).eq('user_id', user.id);
      setPostVotes(prev => ({ ...prev, [postId]: { yes: prev[postId].yes + (vote ? 1 : -1), no: prev[postId].no + (!vote ? 1 : -1), userVote: vote } }));
    } else {
      const { error } = await supabase.from('post_votes').insert({ post_id: postId, user_id: user.id, vote });
      if (error) return;
      setPostVotes(prev => ({ ...prev, [postId]: { ...prev[postId], yes: (prev[postId]?.yes || 0) + (vote ? 1 : 0), no: (prev[postId]?.no || 0) + (!vote ? 1 : 0), userVote: vote } }));
      // Notify post owner
      notifyPostOwner(postId, user.id, profile?.full_name || null, profile?.is_anonymous || false, 'voted on');
    }
  };

  const handleDeletePost = async () => {
    if (!deletePostId) return;
    setDeleting(true);
    const { error } = await supabase.from('posts').delete().eq('id', deletePostId);
    setDeleting(false);
    if (error) toast.error('Failed to delete post');
    else { toast.success('Post deleted'); setPosts(prev => prev.filter(p => p.id !== deletePostId)); }
    setDeletePostId(null);
  };

  const handleMarkImportant = async (postId: string, current: boolean) => {
    const { error } = await supabase.from('posts').update({ is_important: !current } as any).eq('id', postId);
    if (!error) {
      toast.success(current ? 'Unmarked as important' : 'Marked as important');
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_important: !current } : p));
    }
  };

  const handleToggleMonetize = async (postId: string, current: boolean, posterId: string) => {
    const next = !current;
    const updates: any = { is_monetized: next };
    if (next) updates.was_rewarded = true;
    const { error } = await supabase.from('posts').update(updates).eq('id', postId);
    if (error) { toast.error('Failed'); return; }
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, is_monetized: next, was_rewarded: next ? true : (p as any).was_rewarded } as any : p));
    if (next && user) {
      // Look up poster's payout method for this post
      const { data: postRow } = await supabase.from('posts').select('payout_method').eq('id', postId).single() as any;
      const method = postRow?.payout_method || 'cash';
      let messageContent = '';
      let notifTitle = '🌟 Your post has been monetized!';
      let notifBody = '';
      if (method === 'cash') {
        const POINTS = 100;
        // Cash payout: credit 100 points directly (separate from post-creation points which admin must approve)
        const { data: prof } = await supabase.from('profiles').select('points').eq('user_id', posterId).single();
        await supabase.from('profiles').update({ points: (prof?.points || 0) + POINTS }).eq('user_id', posterId);
        messageContent = `🌟 Congratulations! Your post just earned a spot in our monetized lineup. You opted for CASH, so we've credited ${POINTS} points to your wallet — withdraw any time you hit the 1,000-point threshold. Thank you for the quality content. Keep them coming!`;
        notifBody = `Thank you for your contribution. +${POINTS} points have been added to your wallet.`;
      } else {
        // Pull next unused airtime code from the bank
        const { data: codeRow } = await supabase.from('airtime_codes' as any)
          .select('*').eq('network', method).eq('is_used', false)
          .order('created_at', { ascending: true }).limit(1).maybeSingle() as any;
        if (codeRow) {
          await supabase.from('airtime_codes' as any).update({ is_used: true, used_by: posterId, used_at: new Date().toISOString() }).eq('id', codeRow.id);
          messageContent = `🎁 Wonderful! Your post has earned a ${method.toUpperCase()} airtime reward. Your code is: ${codeRow.code} (₦${codeRow.amount}). Tap to copy and load it on your line. Thank you for raising the standard — keep posting!`;
          notifBody = `Your ${method.toUpperCase()} airtime code is ready in your private comment: ${codeRow.code} (₦${codeRow.amount}). Tap to copy.`;
        } else {
          messageContent = `🌟 Congratulations! Your post has been monetized. Your ${method.toUpperCase()} airtime is being prepared and will arrive here shortly — thank you for the great content.`;
          notifBody = `Your ${method.toUpperCase()} airtime is on the way.`;
        }
      }
      await supabase.from('post_private_comments' as any).insert({ post_id: postId, author_id: user.id, content: messageContent });
      await notifyUser(posterId, notifTitle, notifBody, 'monetization', postId, 'post');
      toast.success('Post monetized — reward sent privately');
    } else {
      toast.success('Monetization removed');
    }
  };

  const handleDecidePostPoints = async (postId: string, approve: boolean, posterId: string) => {
    const { data, error } = await (supabase as any).rpc('admin_decide_post_points', { _post_id: postId, _approve: approve });
    if (error) { toast.error(error.message || 'Failed'); return; }
    const newStatus = approve ? 'approved' : 'declined';
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, points_status: newStatus } as any : p));
    if (approve) {
      toast.success('100 points awarded to poster');
      await notifyUser(posterId, '🎉 +100 points awarded!', 'An admin approved your post — 100 points added to your wallet.', 'points', postId, 'post');
    } else {
      toast.success('Points declined for this post');
      await notifyUser(posterId, 'Post points declined', 'Your post did not qualify for points this time. Keep posting quality content!', 'points', postId, 'post');
    }
  };



  const getDepartmentLabel = (value: string) => DEPARTMENTS.find(d => d.value === value)?.label || value;
  const shouldShowAnonymous = (post: Post) => post.is_anonymous || post.profiles?.is_anonymous;

  let visiblePosts = posts.filter(post => {
    if (isAdmin) return true;
    if (post.user_id === user?.id) return true;
    if (userCommentedPosts.has(post.id)) return false;
    return true;
  });

  if (showImportantOnly) visiblePosts = visiblePosts.filter(p => (p as any).is_important);

  const getVotePercentage = (postId: string) => {
    const v = postVotes[postId];
    if (!v || (v.yes + v.no) === 0) return null;
    const total = v.yes + v.no;
    return { yesPercent: Math.round((v.yes / total) * 100), noPercent: Math.round((v.no / total) * 100), total };
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Feed" 
        subtitle={profile ? `Hey, ${profile.full_name.split(' ')[0]}! 👋` : 'See what\'s happening'}
        action={
          <div className="flex items-center gap-2">
            <Link to="/chats">
              <Button size="icon" variant="ghost" className="rounded-full relative">
                <MessageCircle className="w-5 h-5" />
                {unreadChatCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                  </span>
                )}
              </Button>
            </Link>
            <Link to="/create-post">
              <Button size="sm" className="rounded-full bg-gradient-primary shadow-primary">
                <Plus className="w-4 h-4 mr-1" /> Post
              </Button>
            </Link>
          </div>
        }
      />

      {/* Full-width search bar */}
      <div className="px-4 pt-3">
        <SearchById />
      </div>

      <WelcomeMessage />
      <RulesBanner location="feed" />

      {/* Important posts toggle */}
      <div className="px-4 pt-2 flex gap-2">
        <Button variant={!showImportantOnly ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setShowImportantOnly(false)}>
          All Posts
        </Button>
        <Button variant={showImportantOnly ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setShowImportantOnly(true)}>
          <Star className="w-3.5 h-3.5 mr-1" /> Important
        </Button>
      </div>

      {/* Pull to refresh indicator */}
      {isPulling && pullY > 10 && (
        <div className="text-center py-2 text-xs text-muted-foreground">
          {pullY > 60 ? '↑ Release to refresh' : '↓ Pull down to refresh'}
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="px-4 py-4 space-y-4 no-screenshot"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="space-y-2"><div className="w-24 h-4 bg-muted rounded" /><div className="w-16 h-3 bg-muted rounded" /></div>
                </div>
                <div className="w-full h-4 bg-muted rounded mb-2" />
                <div className="w-3/4 h-4 bg-muted rounded" />
              </Card>
            ))}
          </div>
        ) : visiblePosts.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-2 text-foreground">No posts yet</h3>
            <p className="text-muted-foreground mb-4">Be the first to share something!</p>
            <Link to="/create-post">
              <Button className="rounded-full bg-gradient-primary shadow-primary"><Plus className="w-4 h-4 mr-2" /> Create First Post</Button>
            </Link>
          </Card>
        ) : (
          visiblePosts.map((post, index) => (
            <div key={post.id}>
              <FeedPostCard
                post={post}
                isAdmin={isAdmin}
                userId={user?.id}
                userProfile={profile}
                postVotes={postVotes}
                onVote={handleVote}
                onDelete={setDeletePostId}
                onVisible={handlePostVisible}
                onMarkImportant={handleMarkImportant}
                onToggleMonetize={handleToggleMonetize}
                onDecidePoints={handleDecidePostPoints}
                feedAds={feedAds}
                getDepartmentLabel={getDepartmentLabel}
                shouldShowAnonymous={shouldShowAnonymous}
                getVotePercentage={getVotePercentage}
              />
              {/* Insert ad every 5 posts */}
              {feedAds.length > 0 && (index + 1) % 5 === 0 && (
                <div className="mt-4">
                  <FeedAdCard ad={feedAds[(Math.floor(index / 5)) % feedAds.length]} />
                </div>
              )}
            </div>
          ))
        )}
        {loadingMore && (
          <div className="text-center py-4 text-sm text-muted-foreground">Loading more posts…</div>
        )}
        {!hasMore && posts.length > 0 && !loading && (
          <div className="text-center py-4 text-xs text-muted-foreground">You've reached the end</div>
        )}
      </div>

      <DeleteConfirmDialog
        open={!!deletePostId}
        onOpenChange={(open) => !open && setDeletePostId(null)}
        onConfirm={handleDeletePost}
        title="Delete this post?"
        description="This will permanently delete the post and all its comments. This cannot be undone."
        loading={deleting}
      />
    </AppLayout>
  );
}

function FeedPostCard({
  post, isAdmin, userId, userProfile, postVotes,
  onVote, onDelete, onVisible, onMarkImportant, onToggleMonetize, onDecidePoints, feedAds,
  getDepartmentLabel, shouldShowAnonymous, getVotePercentage
}: {
  post: Post;
  isAdmin: boolean;
  userId?: string;
  userProfile?: any;
  postVotes: Record<string, VoteData>;
  onVote: (id: string, vote: boolean) => void;
  onDelete: (id: string) => void;
  onVisible: (id: string) => void;
  onMarkImportant: (id: string, current: boolean) => void;
  onToggleMonetize: (id: string, current: boolean, posterId: string) => void;
  onDecidePoints: (id: string, approve: boolean, posterId: string) => void;
  feedAds: any[];
  getDepartmentLabel: (v: string) => string;
  shouldShowAnonymous: (p: Post) => boolean;
  getVotePercentage: (id: string) => { yesPercent: number; noPercent: number; total: number } | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { onVisible(post.id); observer.unobserve(el); } },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.id, onVisible]);

  const isAnonymous = shouldShowAnonymous(post);
  const displayName = isAnonymous
    ? `Anonymous${post.short_id ? ` • #${post.short_id}` : ''}`
    : `${post.profiles?.full_name || 'Member'}${post.profiles?.display_number && post.profiles.display_number > 1 ? `#${post.profiles.display_number}` : ''}`;

  const allImages = [
    ...(post.image_url ? [post.image_url] : []),
    ...(post.image_urls || [])
  ];

  const votePct = getVotePercentage(post.id);
  const userVote = postVotes[post.id]?.userVote;
  const isImportant = (post as any).is_important;
  const postShortId = post.short_id;

  return (
    <Card ref={cardRef} className={`shadow-soft animate-fade-in select-none ${post.is_monetized ? 'ring-2 ring-success/70 shadow-[0_0_0_4px_hsl(var(--success)/0.08)] bg-success/5' : isImportant ? 'ring-2 ring-warning/50' : ''}`}>
      {/* Collapsed header - always visible */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <Avatar
            className={`w-10 h-10 ring-2 ring-border ${!isAnonymous && post.user_id !== userId ? 'cursor-pointer hover:ring-primary transition-shadow' : ''}`}
            title={!isAnonymous && post.user_id !== userId ? `Message ${post.profiles?.full_name || 'this member'}` : undefined}
            onClick={(e) => {
              if (isAnonymous || post.user_id === userId) return;
              e.stopPropagation();
              navigate(`/chat/private/${post.user_id}`);
            }}
          >
            {isAnonymous ? (
              <AvatarFallback className="bg-muted"><User className="w-5 h-5 text-muted-foreground" /></AvatarFallback>
            ) : (
              <>
                <AvatarImage src={post.profiles?.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground">{post.profiles?.full_name?.charAt(0) || '?'}</AvatarFallback>
              </>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-foreground">{displayName}</span>
              {isImportant && <Star className="w-3.5 h-3.5 text-warning fill-warning" />}
              {(post as any).was_rewarded && (
                <Badge className="bg-success/20 text-success border-success/30 text-[10px]">✓ User got rewarded</Badge>
              )}
              {post.is_monetized && (
                <Badge className="bg-success text-success-foreground border-success text-[10px] font-bold shadow-sm animate-pulse">💰 Monetized · Rewarded</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </div>
          </div>
          <div className="shrink-0">
            {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </div>
        </div>

        {/* Title - always visible */}
        <h3 className="font-bold text-foreground mt-2 leading-snug">{post.title}</h3>

        {/* Image preview in collapsed state */}
        {!expanded && allImages.length > 0 && (
          <div className="mt-2 rounded-xl overflow-hidden max-h-48">
            <img src={allImages[0]} alt="" className="w-full object-cover max-h-48" draggable={false} />
          </div>
        )}

        {/* Folded: Yes/No bar + comment icon */}
        {!expanded && (
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onVote(post.id, true); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                userVote === true ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground hover:bg-success/10 hover:text-success'
              }`}
            >
              <ThumbsUp className="w-3 h-3" /> Yes
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onVote(post.id, false); }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                userVote === false ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
              }`}
            >
              <ThumbsDown className="w-3 h-3" /> No
            </button>
            {votePct && (
              <div className="flex items-center gap-1.5 ml-auto text-[10px] text-muted-foreground">
                <span className="text-success font-medium">{votePct.yesPercent}%</span>
                <div className="w-12 h-1 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-success rounded-full transition-all" style={{ width: `${votePct.yesPercent}%` }} />
                </div>
                <span className="text-destructive font-medium">{votePct.noPercent}%</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />
              <span className="text-[10px] font-medium">{post.view_count || 0}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(true); setShowComments(true); }}
              className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs font-medium">{post.comments_count}</span>
            </button>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4">
          {isAdmin && post.profiles?.system_id && (
            <button
              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(post.profiles!.system_id!); toast.success('System ID copied!'); }}
              className="inline-flex items-center gap-1.5 px-2 py-1 mb-2 bg-destructive/10 rounded-full text-xs text-destructive hover:text-destructive/80 transition-colors"
            >
              <Shield className="w-3 h-3" />
              <span className="font-mono">{post.profiles.system_id}</span>
              <span className="text-[10px] opacity-60">admin</span>
            </button>
          )}

          <div className="mb-3">
            <PostContent content={post.content} maxLength={10000} />
          </div>

          {allImages.length > 0 && (
            <div className="space-y-2 mb-3">
              {allImages.map((url, idx) => (
                <div key={idx} className="rounded-xl overflow-hidden">
                  <img src={url} alt="" className="w-full object-contain max-h-96" draggable={false} />
                </div>
              ))}
            </div>
          )}

          {/* Embedded ad while reading every post */}
          {feedAds.length > 0 && (
            <div className="my-3">
              <FeedAdCard ad={feedAds[Math.abs(post.id.charCodeAt(0)) % feedAds.length]} />
            </div>
          )}
          <div className="py-2">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onVote(post.id, true); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  userVote === true ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground hover:bg-success/10 hover:text-success'
                }`}
              >
                <ThumbsUp className="w-3.5 h-3.5" /> Yes
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onVote(post.id, false); }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  userVote === false ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
                }`}
              >
                <ThumbsDown className="w-3.5 h-3.5" /> No
              </button>
              {votePct && (
                <div className="flex items-center gap-2 ml-auto text-xs text-muted-foreground">
                  <span className="text-success font-medium">{votePct.yesPercent}%</span>
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-success rounded-full transition-all" style={{ width: `${votePct.yesPercent}%` }} />
                  </div>
                  <span className="text-destructive font-medium">{votePct.noPercent}%</span>
                  <span className="opacity-60">({votePct.total})</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats & actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
            <div className="flex items-center gap-4">
              <button
                onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span className="text-sm font-medium">{post.comments_count}</span>
              </button>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Eye className="w-4 h-4" />
                <span className="text-sm font-medium">{post.view_count || 0}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Points status badge for poster */}
              {!isAdmin && userId === post.user_id && (!post.payout_method || post.payout_method === 'cash') && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  post.points_status === 'approved' ? 'bg-success/15 text-success' :
                  post.points_status === 'declined' ? 'bg-destructive/15 text-destructive' :
                  'bg-warning/15 text-warning'
                }`}>
                  {post.points_status === 'approved' ? '✓ +100 pts' : post.points_status === 'declined' ? '✗ No points' : '⏳ Pending review'}
                </span>
              )}
              {isAdmin && (
                <>
                  {/* Award / Decline points — hidden when poster chose airtime (they're paid via airtime instead) */}
                  {(!post.payout_method || post.payout_method === 'cash') && (
                    (!post.points_status || post.points_status === 'pending') ? (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); onDecidePoints(post.id, true, post.user_id); }}
                          className="text-xs px-2 py-1 rounded-full bg-success/15 text-success hover:bg-success/25" title="Award 100 points">
                          ✓ +100
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDecidePoints(post.id, false, post.user_id); }}
                          className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20" title="Decline points">
                          ✗ Decline
                        </button>
                      </>
                    ) : (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        post.points_status === 'approved' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                      }`}>
                        {post.points_status === 'approved' ? '✓ Awarded' : '✗ Declined'}
                      </span>
                    )
                  )}
                  <button onClick={(e) => { e.stopPropagation(); onToggleMonetize(post.id, !!post.is_monetized, post.user_id); }}
                    className={`transition-colors text-xs px-2 py-1 rounded-full ${post.is_monetized ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground hover:bg-success/10'}`}
                    title="Toggle monetization">
                    💰 {post.is_monetized ? 'Monetized' : 'Monetize'}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onMarkImportant(post.id, !!isImportant); }}
                    className={`transition-colors ${isImportant ? 'text-warning' : 'text-muted-foreground hover:text-warning'}`} title="Mark important">
                    <Star className={`w-4 h-4 ${isImportant ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
                    className="text-destructive hover:text-destructive/80 transition-colors" title="Delete post">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Private comments — visible to admin and post owner only, when monetized */}
          {(isAdmin || userId === post.user_id) && post.is_monetized && (
            <PrivateComments postId={post.id} userId={userId} isAdmin={isAdmin} />
          )}

          {showComments && (
            <InlineComments postId={post.id} userId={userId} isAdmin={isAdmin} userProfile={userProfile} />
          )}
        </div>
      )}
    </Card>
  );
}

function InlineComments({ postId, userId, isAdmin, userProfile }: { postId: string; userId?: string; isAdmin: boolean; userProfile?: any }) {
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchComments(); }, [postId]);

  const fetchComments = async () => {
    const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true }).limit(20);
    if (data) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, avatar_url, is_anonymous').in('user_id', userIds);
      const profilesMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
      setComments(data.map(c => ({ ...c, profiles: profilesMap.get(c.user_id) })));
    }
    setLoading(false);
  };

  const submitComment = async () => {
    if (!userId || !newComment.trim()) return;
    setSubmitting(true);
    let content = newComment.trim();
    if (replyTo) content = `@${replyTo} ${content}`;
    const { error } = await supabase.from('comments').insert({ post_id: postId, user_id: userId, content, is_anonymous: false });
    if (!error) {
      setNewComment('');
      const repliedName = replyTo;
      setReplyTo(null);
      fetchComments();
      const { data: allComments } = await supabase.from('comments').select('user_id').eq('post_id', postId);
      const uniqueCount = allComments ? new Set(allComments.map(c => c.user_id)).size : 0;
      await supabase.from('posts').update({ comments_count: uniqueCount }).eq('id', postId);
      // Notify post owner
      notifyPostOwner(postId, userId, userProfile?.full_name || null, userProfile?.is_anonymous || false, 'commented on');
      // Notify replied-to user
      if (repliedName) {
        const target = comments.find(c => (c.profiles?.full_name || 'Member') === repliedName && c.user_id !== userId);
        if (target) {
          const who = userProfile?.is_anonymous ? 'Someone' : (userProfile?.full_name || 'A member');
          notifyUser(target.user_id, `${who} replied to your comment`, content.slice(0, 100), 'reply', postId, 'post');
        }
      }
    }
    setSubmitting(false);
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  if (loading) return <div className="py-4 text-center text-sm text-muted-foreground">Loading comments...</div>;

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">No comments yet</p>
      ) : (
        comments.map(comment => {
          const isAnon = comment.is_anonymous || comment.profiles?.is_anonymous;
          return (
            <div key={comment.id} className="flex gap-2">
              <Avatar className="w-7 h-7 shrink-0">
                {isAnon ? (
                  <AvatarFallback className="bg-muted text-[10px]"><User className="w-3 h-3" /></AvatarFallback>
                ) : (
                  <>
                    <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">{comment.profiles?.full_name?.charAt(0) || '?'}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground">{isAnon ? 'Anonymous' : comment.profiles?.full_name || 'Member'}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={() => { setReplyTo(isAnon ? 'Anonymous' : comment.profiles?.full_name || 'Member'); }} className="text-muted-foreground hover:text-primary p-0.5">
                      <MessageCircle className="w-3 h-3" />
                    </button>
                    {(isAdmin || comment.user_id === userId) && (
                      <button onClick={() => deleteComment(comment.id)} className="text-destructive hover:text-destructive/80 p-0.5">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-line">{comment.content}</p>
              </div>
            </div>
          );
        })
      )}

      {userId && (
        <div className="space-y-1 pt-2">
          {replyTo && (
            <div className="flex items-center justify-between px-2 py-1 bg-muted rounded-lg text-xs">
              <span className="text-muted-foreground">Replying to <strong>@{replyTo}</strong></span>
              <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">✕</button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={replyTo ? `Reply to @${replyTo}...` : "Write a comment..."}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
              className="flex-1 h-9 px-3 rounded-full bg-muted text-sm text-foreground placeholder:text-muted-foreground border-0 outline-none focus:ring-2 focus:ring-primary/30"
              maxLength={2000}
            />
            <Button size="sm" className="rounded-full h-9 px-3" disabled={!newComment.trim() || submitting} onClick={submitComment}>
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrivateComments({ postId, userId, isAdmin }: { postId: string; userId?: string; isAdmin: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('post_private_comments' as any)
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true }) as any;
    if (data) setItems(data);
  };

  useEffect(() => { fetchItems(); }, [postId]);

  const submit = async () => {
    if (!userId || !text.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('post_private_comments' as any).insert({
      post_id: postId, author_id: userId, content: text.trim(),
    });
    setSubmitting(false);
    if (error) { toast.error('Failed'); return; }
    setText('');
    fetchItems();
  };

  return (
    <div className="mt-3 pt-3 border-t-2 border-dashed border-success/30 bg-success/5 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 text-success" />
        <span className="text-xs font-semibold text-success">Private — Admin & Poster only</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No private notes yet.</p>
      ) : items.map(it => (
        <div key={it.id} className="bg-background rounded-lg p-2 text-sm">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] text-muted-foreground">
              {it.author_id === userId ? 'You' : (isAdmin ? 'Poster' : 'Admin')} · {formatDistanceToNow(new Date(it.created_at), { addSuffix: true })}
            </span>
            <button
              onClick={() => { navigator.clipboard.writeText(it.content); toast.success('Copied'); }}
              className="text-[10px] text-primary hover:underline"
            >Copy</button>
          </div>
          <p className="whitespace-pre-line text-foreground select-text">{it.content}</p>
        </div>
      ))}
      {userId && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Write private note…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
            className="flex-1 h-9 px-3 rounded-full bg-background border border-border text-sm outline-none focus:ring-2 focus:ring-success/30"
          />
          <Button size="sm" className="rounded-full h-9 px-3 bg-success hover:bg-success/90" disabled={!text.trim() || submitting} onClick={submit}>
            Send
          </Button>
        </div>
      )}
    </div>
  );
}
