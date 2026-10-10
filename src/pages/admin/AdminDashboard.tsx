import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, MessageSquare, ShoppingBag, ClipboardList, 
  TrendingUp, FileText, Shield, Bell, Settings, ChevronRight, Crown, Target, Ban, Megaphone,
  CreditCard, Send, Music, Image, Wallet, Bot, BarChart3, Video
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAdmin } from '@/hooks/useAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const adminMenuItems = [
  { 
    title: 'Member Directory', 
    description: 'View all registered members',
    icon: Users, 
    href: '/admin/students',
    color: 'text-primary'
  },
  { 
    title: 'User Roles', 
    description: 'Manage user roles and permissions',
    icon: Shield, 
    href: '/admin/users',
    color: 'text-warning'
  },
  { 
    title: 'Private Messages', 
    description: 'Monitor private conversations for security',
    icon: MessageSquare, 
    href: '/admin/messages',
    color: 'text-info'
  },
  { 
    title: 'Content Approvals', 
    description: 'Review pending posts, tasks, events & predictions',
    icon: ClipboardList, 
    href: '/admin/approvals',
    color: 'text-success'
  },
  { 
    title: 'Rules & Guidelines', 
    description: 'Manage pinned rules and guidelines',
    icon: FileText, 
    href: '/admin/rules',
    color: 'text-muted-foreground'
  },
  { 
    title: 'Sponsored Privileges', 
    description: 'Assign sponsored post access to users',
    icon: Crown, 
    href: '/admin/sponsored',
    color: 'text-secondary'
  },
  { 
    title: 'Prediction Participants', 
    description: 'View who predicted on each event',
    icon: Target, 
    href: '/admin/predictions',
    color: 'text-warning'
  },
  { 
    title: 'User Restrictions', 
    description: 'Ban users from specific features',
    icon: Ban, 
    href: '/admin/bans',
    color: 'text-destructive'
  },
  { 
    title: 'School Announcements', 
    description: 'Post memos and notices',
    icon: Megaphone, 
    href: '/admin/announcements',
    color: 'text-info'
  },
  { 
    title: 'Contact & Payment', 
    description: 'Manage payment accounts, links & instructions',
    icon: CreditCard, 
    href: '/admin/contact',
    color: 'text-success'
  },
  { 
    title: 'Broadcast Message', 
    description: 'Send messages by level & department',
    icon: Send, 
    href: '/admin/broadcast',
    color: 'text-primary'
  },
  { 
    title: 'Audio Manager', 
    description: 'Upload auto-play audio clips (15-30s)',
    icon: Music, 
    href: '/admin/audio',
    color: 'text-secondary'
  },
  { 
    title: 'Feed Ads', 
    description: 'Create and manage feed advertisements',
    icon: Image, 
    href: '/admin/ads',
    color: 'text-warning'
  },
  { 
    title: 'Issue Rewards', 
    description: 'Pay out monetization rewards',
    icon: Wallet, 
    href: '/admin/rewards',
    color: 'text-success'
  },
  { 
    title: 'Withdrawal Requests', 
    description: 'Credit members who cashed out points',
    icon: CreditCard, 
    href: '/admin/withdrawals',
    color: 'text-info'
  },
    {
    title: 'App Hub',
    description: 'Top-ups, disputes, drivers, lodges, restaurants, support, tasks, prices',
    icon: CreditCard,
    href: '/admin/hub',
    color: 'text-info'
  },
  { 
    title: 'Auto-Post Bot', 
    description: 'AI-generated engagement posts at your interval',
    icon: Bot, 
    href: '/admin/bot',
    color: 'text-primary'
  },
  { 
    title: 'Bot Post Queue', 
    description: 'Drop posts the bot will publish one at a time',
    icon: Bot, 
    href: '/admin/bot-queue',
    color: 'text-secondary'
  },
  { 
    title: 'Ad Library & Clicks', 
    description: 'All ads, per-slide performance and clicks',
    icon: BarChart3, 
    href: '/admin/ad-library',
    color: 'text-secondary'
  },
  { 
    title: 'Watch & Earn Videos', 
    description: 'Post video tasks (YouTube, TikTok, IG, FB, X) and reward points',
    icon: Video, 
    href: '/admin/video-tasks',
    color: 'text-primary'
  },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useAdmin();
  const { user, loading: authLoading } = useAuth();
  const [totalUsers, setTotalUsers] = useState<number>(0);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!roleLoading && !isAdmin) {
      navigate('/');
    }
  }, [user, isAdmin, authLoading, roleLoading, navigate]);

  // Real-time user count
  useEffect(() => {
    const fetchUserCount = async () => {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      setTotalUsers(count || 0);
    };

    fetchUserCount();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('profiles-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchUserCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader 
        title="Admin Dashboard" 
        subtitle="Manage Connect"
        showBack
      />

      <div className="px-4 py-4 space-y-4">
        {/* Admin Badge */}
        <Card className={`p-4 ${isSuperAdmin ? 'bg-gradient-to-r from-warning/30 to-primary/30' : 'bg-gradient-primary'} text-primary-foreground`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isSuperAdmin ? <Crown className="w-8 h-8 text-warning" /> : <Shield className="w-8 h-8" />}
              <div>
                <h2 className="font-display font-bold text-lg">
                  {isSuperAdmin ? 'Super Admin Panel' : 'Administrator Panel'}
                </h2>
                <p className="text-sm opacity-90">Full access to all management features</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{totalUsers}</p>
              <p className="text-xs opacity-90">Registered Users</p>
            </div>
          </div>
        </Card>

        {/* Menu Items */}
        <div className="space-y-3">
          {adminMenuItems.map((item) => (
            <Card 
              key={item.href}
              className="p-4 shadow-soft cursor-pointer hover:shadow-elevated transition-shadow"
              onClick={() => navigate(item.href)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center`}>
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
