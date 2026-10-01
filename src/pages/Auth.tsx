import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Users, Zap, Info, Eye, EyeOff } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Referral link: /auth?ref=<referrer user id>. Remember it (in case the person
  // browses around before signing up) and open the sign-up form straight away.
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref && /^[0-9a-f-]{36}$/i.test(ref)) {
      localStorage.setItem('referral_code', ref);
      setIsLogin(false);
    }
  }, [searchParams]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email'); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else { toast.success('Password reset email sent! Check your inbox.'); setIsForgotPassword(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success('Welcome back!');
        navigate('/');
      } else {
        if (password !== confirmPassword) { toast.error('Passwords do not match'); setLoading(false); return; }
        if (!fullName.trim()) { toast.error('Please enter your full name'); setLoading(false); return; }
        if (!email.trim()) { toast.error('Please enter your email'); setLoading(false); return; }
        if (password.length < 6) { toast.error('Password must be at least 6 characters'); setLoading(false); return; }

        if (phoneNumber.trim()) {
          const { data: existingPhone } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone_number', phoneNumber.trim())
            .maybeSingle();
          if (existingPhone) { toast.error('This phone number is already registered.'); setLoading(false); return; }
        }

        const { error } = await signUp(email, password, fullName, phoneNumber, username, localStorage.getItem('referral_code'));
        if (error) throw error;
        localStorage.removeItem('referral_code');
        toast.success('Check your email to verify your account!');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Forgot password view
  if (isForgotPassword) {
    return (
      <div className="min-h-screen bg-gradient-card flex flex-col">
        <div className="relative px-6 pt-12 pb-8">
          <div className="absolute inset-0 bg-gradient-hero opacity-10" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-primary">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-foreground">Reset Password</h1>
                <p className="text-sm text-muted-foreground">Enter your email to recover your account</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 bg-card rounded-t-3xl shadow-elevated px-6 py-8">
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="resetEmail">Email</Label>
              <Input id="resetEmail" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-12" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-gradient-primary">
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setIsForgotPassword(false)}>
              Back to Sign In
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-card flex flex-col">
      <div className="relative px-6 pt-12 pb-8">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-primary">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Connect</h1>
              <p className="text-sm text-muted-foreground">Your community, connected</p>
            </div>
          </div>
          <div className="flex gap-4 mt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4 text-primary" /><span>Everyone welcome</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-card rounded-t-3xl shadow-elevated px-6 py-8 overflow-y-auto">
        <div className="flex gap-2 mb-6">
          <Button variant={isLogin ? "default" : "outline"} className="flex-1 rounded-xl" onClick={() => setIsLogin(true)}>Sign In</Button>
          <Button variant={!isLogin ? "default" : "outline"} className="flex-1 rounded-xl" onClick={() => setIsLogin(false)}>Sign Up</Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <Alert>
                <Info className="w-4 h-4" />
                <AlertDescription>
                  Just a few details to get you started — no ID or registration number needed.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input id="fullName" placeholder="Enter your full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="rounded-xl h-12" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username (optional)</Label>
                <Input id="username" placeholder="e.g., @janedoe" value={username} onChange={(e) => setUsername(e.target.value)} className="rounded-xl h-12" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number (optional)</Label>
                <Input id="phoneNumber" type="tel" placeholder="e.g., 08012345678" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="rounded-xl h-12" />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-12" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl h-12 pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`rounded-xl h-12 pr-10 ${confirmPassword && password !== confirmPassword ? 'border-destructive' : ''}`} />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-destructive">Passwords do not match</p>
              )}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-gradient-primary hover:opacity-90 shadow-primary font-semibold text-base">
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </Button>

          {isLogin && (
            <button type="button" onClick={() => setIsForgotPassword(true)} className="w-full text-center text-sm text-primary hover:underline mt-2">
              Forgot your password?
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
