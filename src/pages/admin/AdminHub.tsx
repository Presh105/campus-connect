// AdminHub.tsx — one page that manages everything new in the Connet app:
// top-ups, disputes, settings (price per km etc.), driver applications, lodges, restaurants,
// support requests and Earn Hub tasks. Add it to your website at src/pages/admin/AdminHub.tsx.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const db: any = supabase;
const naira = (n: any) => '₦' + Number(n || 0).toLocaleString();
const when = (s: string) => new Date(s).toLocaleString();

async function names(ids: string[]) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (!uniq.length) return {} as Record<string, any>;
  const { data } = await db.from('profiles').select('user_id, full_name, system_id').in('user_id', uniq);
  const m: Record<string, any> = {};
  (data || []).forEach((p: any) => (m[p.user_id] = p));
  return m;
}
const who = (m: Record<string, any>, id: string) => (m[id] ? `${m[id].full_name}${m[id].system_id ? ' · ' + m[id].system_id : ''}` : id?.slice(0, 8));

async function call(fn: string, args: any, okMsg = 'Done') {
  const { error } = await db.rpc(fn, args);
  if (error) { toast.error(error.message); return false; }
  toast.success(okMsg);
  return true;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

function Link({ url, label }: { url?: string | null; label: string }) {
  if (!url) return null;
  return <a href={url} target="_blank" rel="noreferrer" className="text-primary underline text-xs mr-3">{label}</a>;
}

/* ---------------- Top-ups ---------------- */
function TopUps() {
  const [rows, setRows] = useState<any[]>([]);
  const [nm, setNm] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data } = await db.from('topup_requests').select('*').order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
    setNm(await names((data || []).map((r: any) => r.user_id)));
  }, []);
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [load]);
  const decide = async (id: string, approve: boolean) => {
    if (approve && !confirm('Confirm you have received this money in your bank account?')) return;
    if (await call('admin_decide_topup', { _id: id, _approve: approve, _note: notes[id] || null }, approve ? 'Balance credited' : 'Rejected')) load();
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Check your bank app first. Approve only when the money is really in your account — approving adds the amount to the user's balance.</p>
      {rows.length === 0 && <Empty text="No top-up requests yet." />}
      {rows.map((r) => (
        <Card key={r.id} className={`p-3 space-y-2 ${r.status === 'pending' ? 'border-primary border-2' : ''}`}>
          <div className="flex justify-between gap-2">
            <div><p className="font-semibold text-sm">{r.payer_name || who(nm, r.user_id)}</p><p className="text-lg font-bold">{naira(r.amount)}</p></div>
            <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'outline'}>
              {r.status === 'started' ? 'waiting: user has not tapped "I have deposited"' : r.status === 'pending' ? 'USER SAYS PAID: check bank' : r.status}
            </Badge>
          </div>
          <div className="text-xs space-y-0.5 bg-muted/40 rounded p-2">
            <p><b>ID:</b> {String(r.user_id).slice(0, 8).toUpperCase()} <span className="text-muted-foreground">({r.user_id})</span></p>
            <p><b>Phone:</b> {r.payer_phone || '-'}</p>
            <p><b>Paid from:</b> {r.payer_bank || '-'} / {r.payer_account_name || '-'} / {r.payer_account_number || '-'}</p>
            {r.payer_account_name && r.payer_name && r.payer_account_name.trim().toLowerCase() !== r.payer_name.trim().toLowerCase() && (
              <p className="text-amber-600 font-semibold">Account name is different from the user's name. Check carefully.</p>
            )}
          </div>
          {r.note && <p className="text-xs">Note: {r.note}</p>}
          <Link url={r.proof_url} label="View payment proof" />
          <p className="text-[10px] text-muted-foreground">Started {when(r.created_at)}{r.paid_at ? ` · tapped paid ${when(r.paid_at)}` : ''}</p>
          {(r.status === 'pending' || r.status === 'expired') && (
            <>
              <Input placeholder="Note to user (optional)" value={notes[r.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => decide(r.id, true)}>Credit balance</Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => decide(r.id, false)}>Reject</Button>
              </div>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Disputes ---------------- */
function Disputes() {
  const [rows, setRows] = useState<any[]>([]);
  const [esc, setEsc] = useState<Record<string, any>>({});
  const [nm, setNm] = useState<Record<string, any>>({});
  const [amt, setAmt] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data } = await db.from('disputes').select('*').order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
    const ids = (data || []).map((d: any) => d.escrow_id);
    if (ids.length) {
      const { data: e } = await db.from('escrows').select('*').in('id', ids);
      const m: Record<string, any> = {};
      (e || []).forEach((x: any) => (m[x.id] = x));
      setEsc(m);
    }
    setNm(await names((data || []).flatMap((d: any) => [d.opened_by, d.against])));
  }, []);
  useEffect(() => { load(); }, [load]);
  const resolve = async (d: any, resolution: 'release' | 'refund' | 'split') => {
    const e = esc[d.escrow_id];
    let pay: number | null = null;
    if (resolution === 'split') {
      pay = parseInt(amt[d.id] || '', 10);
      if (!pay || pay <= 0 || (e && pay >= e.amount)) return toast.error('For a split, type how much goes to the receiver (more than 0 and less than the total).');
    }
    const text = resolution === 'release' ? 'Pay the receiver (seller / restaurant / driver) the full amount?' : resolution === 'refund' ? 'Refund the full amount to the buyer / rider?' : `Give ${naira(pay)} to the receiver and the rest back to the buyer?`;
    if (!confirm(text)) return;
    if (await call('admin_resolve_dispute', { _dispute_id: d.id, _resolution: resolution, _payee_amount: pay, _note: notes[d.id] || null }, 'Dispute resolved')) load();
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Frozen money stays frozen until you decide. Talk to both people in chat first, then choose.</p>
      {rows.length === 0 && <Empty text="No disputes." />}
      {rows.map((d) => {
        const e = esc[d.escrow_id];
        return (
          <Card key={d.id} className="p-3 space-y-2">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold text-sm capitalize">{e?.kind || d.kind} dispute · {e ? naira(e.amount) : ''}</p>
                <p className="text-xs">Opened by: {who(nm, d.opened_by)}</p>
                <p className="text-xs">Against: {who(nm, d.against)}</p>
              </div>
              <Badge variant={d.status === 'open' ? 'destructive' : 'default'}>{d.status}{d.resolution ? ` · ${d.resolution}` : ''}</Badge>
            </div>
            <p className="text-sm bg-muted rounded-lg p-2">{d.reason}</p>
            <Link url={d.evidence_url} label="View evidence" />
            <p className="text-[10px] text-muted-foreground">{when(d.created_at)}</p>
            {d.status === 'open' ? (
              <>
                <Input placeholder="Split: amount for the receiver (₦)" inputMode="numeric" value={amt[d.id] || ''} onChange={(e2) => setAmt((a) => ({ ...a, [d.id]: e2.target.value }))} />
                <Textarea rows={2} placeholder="Note both people will see (optional)" value={notes[d.id] || ''} onChange={(e2) => setNotes((n) => ({ ...n, [d.id]: e2.target.value }))} />
                <div className="grid grid-cols-3 gap-2">
                  <Button size="sm" onClick={() => resolve(d, 'release')}>Pay receiver</Button>
                  <Button size="sm" variant="outline" onClick={() => resolve(d, 'refund')}>Refund buyer</Button>
                  <Button size="sm" variant="secondary" onClick={() => resolve(d, 'split')}>Split</Button>
                </div>
              </>
            ) : d.admin_note ? <p className="text-xs italic">"{d.admin_note}"</p> : null}
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- Settings ---------------- */
function Settings() {
  const [rows, setRows] = useState<any[]>([]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data } = await db.from('app_settings').select('*').order('key');
    setRows(data || []);
    const v: Record<string, string> = {};
    (data || []).forEach((r: any) => (v[r.key] = r.value));
    setVals(v);
  }, []);
  useEffect(() => { load(); }, [load]);
  const save = async (key: string) => {
    const { error } = await db.from('app_settings').update({ value: vals[key], updated_at: new Date().toISOString() }).eq('key', key);
    if (error) toast.error(error.message); else toast.success('Saved');
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Change a number, then tap Save. The transport price per kilometre is the first one.</p>
      {rows.map((r) => (
        <Card key={r.key} className="p-3 space-y-2">
          <p className="text-sm font-medium">{r.label || r.key}</p>
          <div className="flex gap-2">
            <Input value={vals[r.key] ?? ''} inputMode="decimal" onChange={(e) => setVals((v) => ({ ...v, [r.key]: e.target.value }))} />
            <Button size="sm" onClick={() => save(r.key)}>Save</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Drivers ---------------- */
function Drivers() {
  const [rows, setRows] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data } = await db.from('driver_applications').select('*').order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, approve: boolean) => {
    if (await call('admin_decide_driver', { _id: id, _approve: approve, _note: notes[id] || null }, approve ? 'Driver approved' : 'Rejected')) load();
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Meet or call the applicant first. Approving lets them go online and receive ride requests.</p>
      {rows.length === 0 && <Empty text="No driver applications." />}
      {rows.map((a) => (
        <Card key={a.id} className="p-3 space-y-2">
          <div className="flex justify-between">
            <div>
              <p className="font-semibold text-sm">{a.full_name} · {a.phone}</p>
              <p className="text-xs capitalize">{a.vehicle_type} {a.vehicle_desc ? '· ' + a.vehicle_desc : ''}</p>
              <p className="text-xs">Plate: {a.plate_number || '-'} · Licence: {a.license_number || '-'}</p>
            </div>
            <Badge variant={a.status === 'approved' ? 'default' : a.status === 'rejected' ? 'destructive' : 'outline'}>{a.status}</Badge>
          </div>
          {a.note && <p className="text-xs">Note: {a.note}</p>}
          <Link url={a.photo_url} label="Driver photo" />
          <Link url={a.vehicle_photo_url} label="Vehicle photo" />
          {a.status === 'pending' && (
            <>
              <Input placeholder="Note (optional)" value={notes[a.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => decide(a.id, true)}>Approve</Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => decide(a.id, false)}>Reject</Button>
              </div>
            </>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Lodges + restaurants ---------------- */
function Places({ table, title }: { table: 'lodges' | 'restaurants'; title: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data } = await db.from(table).select('*').order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
  }, [table]);
  useEffect(() => { load(); }, [load]);
  const set = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await db.from(table).update({ status, admin_note: notes[id] || null }).eq('id', id);
    if (error) toast.error(error.message); else { toast.success(status === 'approved' ? 'Approved' : 'Rejected'); load(); }
  };
  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">{title}</h3>
      {rows.length === 0 && <Empty text="Nothing submitted yet." />}
      {rows.map((r) => (
        <Card key={r.id} className="p-3 space-y-2">
          <div className="flex justify-between">
            <div>
              <p className="font-semibold text-sm">{r.name}</p>
              <p className="text-xs">{r.address}</p>
              {r.price != null && <p className="text-xs">{naira(r.price)} / {r.price_period}</p>}
              {r.phone && <p className="text-xs">Phone: {r.phone}</p>}
              <p className="text-xs">{r.lat != null ? `Location saved (${Number(r.lat).toFixed(3)}, ${Number(r.lng).toFixed(3)})` : 'No GPS location'}</p>
            </div>
            <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'outline'}>{r.status}</Badge>
          </div>
          {r.description && <p className="text-xs bg-muted rounded p-2">{r.description}</p>}
          {Array.isArray(r.images) && r.images.map((u: string, i: number) => <Link key={i} url={u} label={`Photo ${i + 1}`} />)}
          <Link url={r.logo_url} label="Logo" />
          {r.status !== 'approved' && (
            <>
              <Input placeholder="Note (optional)" value={notes[r.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => set(r.id, 'approved')}>Approve</Button>
                {r.status === 'pending' && <Button size="sm" variant="destructive" className="flex-1" onClick={() => set(r.id, 'rejected')}>Reject</Button>}
              </div>
            </>
          )}
          {r.status === 'approved' && <Button size="sm" variant="outline" onClick={() => set(r.id, 'rejected')}>Take down</Button>}
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Support requests ---------------- */
function Support() {
  const [rows, setRows] = useState<any[]>([]);
  const [nm, setNm] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data } = await db.from('support_requests').select('*').order('created_at', { ascending: false }).limit(100);
    setRows(data || []);
    setNm(await names((data || []).map((r: any) => r.user_id)));
  }, []);
  useEffect(() => { load(); }, [load]);
  const decide = async (id: string, approve: boolean) => {
    if (await call('admin_decide_support', { _id: id, _approve: approve, _note: notes[id] || null }, approve ? 'Approved — people can donate' : 'Rejected')) load();
  };
  const close = async (id: string) => { if (await call('close_support_request', { _id: id }, 'Closed')) load(); };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Check the proof carefully. After you approve, donations go straight into the person's balance.</p>
      {rows.length === 0 && <Empty text="No support requests." />}
      {rows.map((r) => (
        <Card key={r.id} className="p-3 space-y-2">
          <div className="flex justify-between">
            <div>
              <p className="font-semibold text-sm">{r.title}</p>
              <p className="text-xs">By {who(nm, r.user_id)} · needs {naira(r.amount_needed)} · raised {naira(r.raised)}</p>
            </div>
            <Badge variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'outline'}>{r.status}</Badge>
          </div>
          <p className="text-sm bg-muted rounded p-2 whitespace-pre-wrap">{r.story}</p>
          <Link url={r.proof_url} label="View proof" />
          <Link url={r.image_url} label="View photo" />
          {r.status === 'pending' && (
            <>
              <Input placeholder="Note (optional)" value={notes[r.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))} />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => decide(r.id, true)}>Approve</Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => decide(r.id, false)}>Reject</Button>
              </div>
            </>
          )}
          {r.status === 'approved' && <Button size="sm" variant="outline" onClick={() => close(r.id)}>Close request</Button>}
        </Card>
      ))}
    </div>
  );
}

/* ---------------- Earn Hub ---------------- */
function Earn() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [nm, setNm] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [f, setF] = useState({ title: '', description: '', instructions: '', link_url: '', reward: '', evidence_type: 'image', max_completions: '', per_user_limit: '1' });
  const load = useCallback(async () => {
    const [t, s] = await Promise.all([
      db.from('earn_tasks').select('*').order('created_at', { ascending: false }).limit(100),
      db.from('earn_submissions').select('*, earn_tasks(title, reward)').order('created_at', { ascending: false }).limit(150),
    ]);
    setTasks(t.data || []);
    setSubs(s.data || []);
    setNm(await names((s.data || []).map((x: any) => x.user_id)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const reward = parseInt(f.reward, 10);
    if (!f.title.trim() || !reward) return toast.error('Add a title and a reward');
    const { error } = await db.from('earn_tasks').insert({
      title: f.title.trim(), description: f.description.trim() || null, instructions: f.instructions.trim() || null,
      link_url: f.link_url.trim() || null, reward, evidence_type: f.evidence_type,
      max_completions: f.max_completions ? parseInt(f.max_completions, 10) : null,
      per_user_limit: parseInt(f.per_user_limit, 10) || 1,
    });
    if (error) return toast.error(error.message);
    toast.success('Task created');
    setF({ title: '', description: '', instructions: '', link_url: '', reward: '', evidence_type: 'image', max_completions: '', per_user_limit: '1' });
    load();
  };
  const toggle = async (t: any) => { await db.from('earn_tasks').update({ is_active: !t.is_active }).eq('id', t.id); load(); };
  const decide = async (id: string, approve: boolean) => {
    if (await call('admin_decide_submission', { _id: id, _approve: approve, _note: notes[id] || null }, approve ? 'Approved and paid' : 'Rejected')) load();
  };
  const pending = subs.filter((s) => s.status === 'pending');
  const done = subs.filter((s) => s.status !== 'pending');
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="space-y-4">
      <Card className="p-3 space-y-2">
        <h3 className="font-semibold text-sm">Create a task</h3>
        <Input placeholder="Title" value={f.title} onChange={(e) => set('title', e.target.value)} />
        <Textarea rows={2} placeholder="Short description" value={f.description} onChange={(e) => set('description', e.target.value)} />
        <Textarea rows={3} placeholder="Step-by-step instructions" value={f.instructions} onChange={(e) => set('instructions', e.target.value)} />
        <Input placeholder="Link to open (optional)" value={f.link_url} onChange={(e) => set('link_url', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Reward (₦)" inputMode="numeric" value={f.reward} onChange={(e) => set('reward', e.target.value)} />
          <select className="border rounded-md px-2 text-sm bg-background" value={f.evidence_type} onChange={(e) => set('evidence_type', e.target.value)}>
            <option value="image">Proof: screenshot/photo</option>
            <option value="link">Proof: link</option>
            <option value="text">Proof: text</option>
            <option value="any">Proof: any</option>
          </select>
          <Input placeholder="Max people (blank = unlimited)" inputMode="numeric" value={f.max_completions} onChange={(e) => set('max_completions', e.target.value)} />
          <Input placeholder="Times per person" inputMode="numeric" value={f.per_user_limit} onChange={(e) => set('per_user_limit', e.target.value)} />
        </div>
        <Button onClick={create}>Publish task</Button>
      </Card>

      <h3 className="font-semibold text-sm">Proofs waiting ({pending.length})</h3>
      {pending.length === 0 && <Empty text="Nothing to review." />}
      {pending.map((s) => (
        <Card key={s.id} className="p-3 space-y-2">
          <p className="font-semibold text-sm">{s.earn_tasks?.title} · {naira(s.earn_tasks?.reward)}</p>
          <p className="text-xs">By {who(nm, s.user_id)}</p>
          {s.evidence_text && <p className="text-sm bg-muted rounded p-2 break-words">{s.evidence_text}</p>}
          {s.evidence_url && <a href={s.evidence_url} target="_blank" rel="noreferrer"><img src={s.evidence_url} alt="proof" className="max-h-64 rounded-lg border" /></a>}
          <Input placeholder="Note (optional)" value={notes[s.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))} />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => decide(s.id, true)}>Approve & pay</Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => decide(s.id, false)}>Reject</Button>
          </div>
        </Card>
      ))}

      <h3 className="font-semibold text-sm">Your tasks</h3>
      {tasks.map((t) => (
        <Card key={t.id} className="p-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{t.title}</p>
            <p className="text-xs text-muted-foreground">{naira(t.reward)} · {t.evidence_type}</p>
          </div>
          <Button size="sm" variant={t.is_active ? 'outline' : 'default'} onClick={() => toggle(t)}>{t.is_active ? 'Pause' : 'Activate'}</Button>
        </Card>
      ))}

      <h3 className="font-semibold text-sm">Decided ({done.length})</h3>
      {done.slice(0, 30).map((s) => (
        <p key={s.id} className="text-xs text-muted-foreground">{s.earn_tasks?.title} · {who(nm, s.user_id)} · {s.status}</p>
      ))}
    </div>
  );
}


/* ---------------- User tasks and videos (review + refunds) ---------------- */
function UserCampaigns() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [vids, setVids] = useState<any[]>([]);
  const [pend, setPend] = useState<Record<string, number>>({});
  const [nm, setNm] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const { data: t } = await db.from('earn_tasks').select('*').eq('is_user_task', true).order('created_at', { ascending: false }).limit(100);
    const { data: v } = await db.from('user_videos').select('*').order('created_at', { ascending: false }).limit(100);
    setTasks(t || []); setVids(v || []);
    const ids = (t || []).map((x: any) => x.id);
    if (ids.length) {
      const { data: s } = await db.from('earn_submissions').select('task_id').in('task_id', ids).eq('status', 'pending');
      const m: Record<string, number> = {};
      (s || []).forEach((x: any) => (m[x.task_id] = (m[x.task_id] || 0) + 1));
      setPend(m);
    }
    setNm(await names([...(t || []).map((x: any) => x.created_by), ...(v || []).map((x: any) => x.owner_id)]));
  }, []);
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);
  const act = async (fn: string, id: string, approve: boolean, msg: string) => {
    if (!approve && !(notes[id] || '').trim() && fn.includes('review') && !confirm('Reject without a note? The user will not know what to change. Tip: write what to fix first.')) return;
    if (await call(fn, { _id: id, _approve: approve, _note: notes[id] || null }, msg)) load();
  };
  const Box = ({ x, kind }: { x: any; kind: 'task' | 'video' }) => {
    const owner = kind === 'task' ? x.created_by : x.owner_id;
    const rf = kind === 'task' ? 'admin_decide_task_refund' : 'admin_decide_video_refund';
    const rv = kind === 'task' ? 'admin_review_task' : 'admin_review_video';
    return (
      <Card className={`p-3 space-y-2 ${x.review_status === 'pending' || x.refund_requested ? 'border-primary border-2' : ''}`}>
        <div className="flex justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{x.title}</p>
            <p className="text-xs text-muted-foreground">by {who(nm, owner)}</p>
          </div>
          <Badge variant={x.review_status === 'approved' ? 'default' : x.review_status === 'rejected' ? 'destructive' : 'outline'}>{x.review_status}</Badge>
        </div>
        {x.description && <p className="text-xs">{x.description}</p>}
        {x.instructions && <p className="text-xs whitespace-pre-wrap"><b>Rules:</b> {x.instructions}</p>}
        {x.link_url && <Link url={x.link_url} label="Task link" />}
        {x.url && <Link url={x.url} label="Open video" />}
        <p className="text-xs"><b>{naira(x.reward)}</b> each × {kind === 'task' ? x.max_completions : x.max_views} = <b>{naira(x.budget)}</b> total{kind === 'video' ? ` · watch ${x.required_seconds}s` : ` · proof: ${x.evidence_type}`}</p>
        {x.review_status !== 'pending' && x.review_status !== 'rejected' && <p className="text-xs">Left in budget: {naira(x.budget_left)}{kind === 'video' ? ` · watched ${x.views_count}` : ` · pending proofs: ${pend[x.id] || 0}`}</p>}
        {x.review_note && <p className="text-xs text-muted-foreground">Your note: {x.review_note}</p>}
        {x.review_status === 'pending' && (
          <>
            <Textarea placeholder="Note to the user (what to change: price, rules unclear...)" value={notes[x.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [x.id]: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => { if (confirm(`Approve? ${naira(x.budget)} will be taken from the user's balance.`)) act(rv, x.id, true, 'Approved: budget taken'); }}>Approve</Button>
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => act(rv, x.id, false, 'Rejected, user sees your note')}>Reject</Button>
            </div>
          </>
        )}
        {x.refund_requested && (
          <>
            <p className="text-xs font-semibold text-amber-600">Refund requested: {naira(x.budget_left)} unspent.{kind === 'task' && pend[x.id] ? ` ${pend[x.id]} proof(s) still unchecked: wait before approving.` : ''}</p>
            <Input placeholder="Note (optional)" value={notes[x.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [x.id]: e.target.value }))} />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1" onClick={() => { if (confirm(`Return ${naira(x.budget_left)} to the user?`)) act(rf, x.id, true, 'Refund sent'); }}>Approve refund</Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => act(rf, x.id, false, 'Refund declined')}>Decline</Button>
            </div>
          </>
        )}
        <p className="text-[10px] text-muted-foreground">{when(x.created_at)}</p>
      </Card>
    );
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Users post tasks and videos with a budget. Approve to take the budget from their balance (they must have enough). Reject with a note so they can edit and resend. Refunds of unspent money only happen when you approve them here.</p>
      <h3 className="font-semibold text-sm">Tasks ({tasks.length})</h3>
      {tasks.length === 0 && <Empty text="No user tasks yet." />}
      {tasks.map((x) => <Box key={x.id} x={x} kind="task" />)}
      <h3 className="font-semibold text-sm">Videos ({vids.length})</h3>
      {vids.length === 0 && <Empty text="No user videos yet." />}
      {vids.map((x) => <Box key={x.id} x={x} kind="video" />)}
    </div>
  );
}

export default function AdminHub() {
  const { isAdmin, loading } = useAdmin();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) navigate('/'); }, [isAdmin, loading, navigate]);
  if (loading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }
  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="App Hub" subtitle="Wallet, transport, places, support, tasks" showBack />
      <div className="px-4 py-4">
        <Tabs defaultValue="topups">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="topups">Top-ups</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="lodges">Lodges</TabsTrigger>
            <TabsTrigger value="food">Restaurants</TabsTrigger>
            <TabsTrigger value="support">Support</TabsTrigger>
            <TabsTrigger value="earn">Earn tasks</TabsTrigger>
            <TabsTrigger value="campaigns">User tasks &amp; videos</TabsTrigger>
          </TabsList>
          <TabsContent value="topups"><TopUps /></TabsContent>
          <TabsContent value="disputes"><Disputes /></TabsContent>
          <TabsContent value="settings"><Settings /></TabsContent>
          <TabsContent value="drivers"><Drivers /></TabsContent>
          <TabsContent value="lodges"><Places table="lodges" title="Lodges" /></TabsContent>
          <TabsContent value="food"><Places table="restaurants" title="Restaurants" /></TabsContent>
          <TabsContent value="support"><Support /></TabsContent>
          <TabsContent value="earn"><Earn /></TabsContent>
          <TabsContent value="campaigns"><UserCampaigns /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
