import { useEffect, useState } from 'react';
// router not used directly
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Award, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const THRESHOLD = 1000;

export default function Withdraw() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ bank_name: '', account_number: '', account_name: '' });
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const points = profile?.points || 0;
  const eligible = points >= THRESHOLD;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('withdrawal_requests' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }) as any;
      setHistory(data || []);
    })();
  }, [user]);

  const [amount, setAmount] = useState('');
  const amt = Math.floor(Number(amount) || 0);
  const amountError =
    amount === '' ? '' :
    amt < THRESHOLD ? `Minimum withdrawal is ₦${THRESHOLD}` :
    amt > points ? 'That is more than your balance' : '';
  const canSubmit = amt >= THRESHOLD && amt <= points && !busy;

  const loadHistory = async () => {
    if (!user) return;
    const { data } = await supabase.from('withdrawal_requests' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }) as any;
    setHistory(data || []);
  };

  const submit = async () => {
    if (!user || !eligible) return;
    if (!canSubmit) { toast.error(amountError || `Enter an amount of at least ₦${THRESHOLD}`); return; }
    if (!form.bank_name || !form.account_number || !form.account_name) { toast.error('Fill all bank details'); return; }
    setBusy(true);
    // The database checks the balance and deducts the points in one safe step
    const { error } = await (supabase as any).rpc('request_withdrawal', {
      _amount: amt,
      _bank_name: form.bank_name.trim(),
      _account_number: form.account_number.trim(),
      _account_name: form.account_name.trim(),
    });
    if (error) { toast.error(error.message || 'Failed to submit'); setBusy(false); return; }
    await refreshProfile();
    toast.success('Withdrawal request submitted! Admin will credit you shortly.');
    setForm({ bank_name: '', account_number: '', account_name: '' });
    setAmount('');
    await loadHistory();
    setBusy(false);
  };

  return (
    <AppLayout>
      <PageHeader title="Withdraw" subtitle="Cash out your earnings" showBack />
      
      <div className="px-4 py-4 space-y-4">
        <Card className="p-4 bg-gradient-to-br from-warning/20 to-primary/10">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">Available balance</p>
              <p className="text-2xl font-bold">₦{points}</p>
              <p className="text-[11px] text-muted-foreground">Withdrawal threshold: ₦{THRESHOLD}</p>
            </div>
          </div>
        </Card>

        {!eligible ? (
          <Alert><AlertDescription className="text-sm">You need at least ₦{THRESHOLD} to withdraw. Keep posting, voting + commenting to earn more!</AlertDescription></Alert>
        ) : (
          <Card className="p-4 space-y-3">
            <div className="space-y-2">
              <Label>Amount to withdraw (₦)</Label>
              <div className="flex gap-2">
                <Input type="text" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value.replace(/\D/g, ''))} placeholder={`Minimum ₦${THRESHOLD}`} className="rounded-xl" />
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAmount(String(points))}>Max</Button>
              </div>
              {amountError && <p className="text-xs text-destructive">{amountError}</p>}
              <p className="text-[11px] text-muted-foreground">Available: ₦{points} · Minimum: ₦{THRESHOLD}</p>
            </div>
            <h3 className="font-semibold flex items-center gap-2"><Wallet className="w-4 h-4" /> Bank Account Details</h3>
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="e.g. GTBank" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Account Number</Label>
              <Input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value.replace(/\D/g, '') }))} placeholder="0123456789" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Account Name</Label>
              <Input value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="As it appears on your bank" className="rounded-xl" />
            </div>
            <Button onClick={submit} disabled={!canSubmit} className="w-full rounded-xl">{busy ? 'Submitting…' : amt >= THRESHOLD ? `Withdraw ₦${amt}` : 'Enter amount to withdraw'}</Button>
          </Card>
        )}

        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-muted-foreground">History</h3>
          {history.length === 0 && <p className="text-xs text-muted-foreground">No withdrawals yet.</p>}
          {history.map(h => (
            <Card key={h.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">₦{h.points} → {h.bank_name}</p>
                <p className="text-xs text-muted-foreground">{h.account_number} · {h.account_name}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleString()}</p>
              </div>
              <Badge variant={h.status === 'paid' ? 'default' : h.status === 'rejected' ? 'destructive' : 'outline'}>{h.status}</Badge>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
