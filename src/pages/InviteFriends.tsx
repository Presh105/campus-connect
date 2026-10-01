import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Share2, Copy, Users, MessageCircle, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function InviteFriends() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState({ joined: 0, rewarded: 0, points: 0 });

  useEffect(() => {
    if (!user) return;
    (supabase.from('referrals' as any).select('rewarded, points_awarded').eq('referrer_id', user.id) as any)
      .then(({ data }: { data: { rewarded: boolean; points_awarded: number }[] | null }) => {
        if (!data) return;
        setStats({
          joined: data.length,
          rewarded: data.filter((r) => r.rewarded).length,
          points: data.reduce((sum, r) => sum + (r.points_awarded || 0), 0),
        });
      });
  }, [user]);

  const inviteLink = user
    ? `${window.location.origin}/auth?ref=${user.id}`
    : window.location.origin;

  const shareText = "Join me on Connect — come see what's happening!";

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Connect', text: shareText, url: inviteLink });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`${shareText} ${inviteLink}`);
    setCopied(true);
    toast.success('Invite link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${inviteLink}`)}`;
    window.open(url, '_blank');
  };

  return (
    <AppLayout>
      <PageHeader title="Invite Friends" subtitle="Bring your people onto Connect" showBack />

      <div className="px-4 py-6 space-y-5">
        <Card className="p-6 text-center bg-gradient-primary text-primary-foreground shadow-primary">
          <Users className="w-10 h-10 mx-auto mb-3" />
          <h2 className="text-lg font-bold">Invite friends to join</h2>
          <p className="text-sm opacity-90 mt-1">
            Share your link — anyone who signs up through it joins your circle here.
          </p>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <p className="text-xl font-bold">{stats.joined}</p>
            <p className="text-xs text-muted-foreground">Signed up</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold">{stats.rewarded}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </Card>
          <Card className="p-3 text-center">
            <p className="text-xl font-bold">{stats.points}</p>
            <p className="text-xs text-muted-foreground">Points earned</p>
          </Card>
        </div>

        <Card className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground">Your invite link</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-xl bg-muted px-3 py-2.5 text-sm truncate">{inviteLink}</div>
            <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={handleCopy}>
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </Card>

        <div className="space-y-3">
          <Button onClick={handleShare} className="w-full h-12 rounded-xl bg-gradient-primary shadow-primary">
            <Share2 className="w-4 h-4 mr-2" /> Share Invite Link
          </Button>
          <p className="text-xs text-center text-muted-foreground -mt-1">
            Opens your phone's share menu — pick contacts, WhatsApp, SMS, or anywhere else
          </p>

          <Button onClick={handleWhatsAppShare} variant="outline" className="w-full h-12 rounded-xl">
            <MessageCircle className="w-4 h-4 mr-2" /> Share via WhatsApp
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground px-4">
          Connect can't read your phone's contact list directly — sharing through your phone's
          own share menu is the safest way to reach the people you actually want to invite.
        </p>
      </div>
    </AppLayout>
  );
}
