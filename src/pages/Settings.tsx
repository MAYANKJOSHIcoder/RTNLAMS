import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useUpdateProfile } from '../hooks/useProfile';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { supabase, isSupabaseConfigured } from '../lib/supabase/client';
import { Lock } from 'lucide-react';
import { formatAadhaar } from '../lib/utils/helpers';

export default function Settings() {
  const { user, profile } = useAuth();
  const updateProfile = useUpdateProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [pw, setPw] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = () => {
    if (!fullName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    updateProfile.mutate({ full_name: fullName.trim(), phone: phone.trim() || null });
  };

  const savePassword = async () => {
    if (pw.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (pw !== pwConfirm) {
      toast.error('Passwords do not match');
      return;
    }
    if (!isSupabaseConfigured()) {
      toast.error('Supabase not configured');
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSavingPw(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPw('');
    setPwConfirm('');
    toast.success('Password updated');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">{user?.email ?? 'Signed in'}</p>
      </div>

      {/* Profile */}
      <section className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
        <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91…" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Role</label>
            <div className="flex items-center gap-2 h-10 px-3 border border-slate-300 rounded-md text-sm capitalize bg-white/[0.02] text-slate-500">
              <Lock size={12} /> {profile?.role?.replace('_', ' ') ?? '—'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Aadhaar</label>
            <div className="flex items-center gap-2 h-10 px-3 border border-slate-300 rounded-md text-sm bg-white/[0.02] text-slate-500">
              <Lock size={12} /> {profile?.aadhaar ? formatAadhaar(profile.aadhaar) : 'Not linked'}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">Role and Aadhaar are managed by an administrator.</p>

        <Button onClick={saveProfile} loading={updateProfile.isPending}>Save Profile</Button>
      </section>

      {/* Password */}
      <section className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Change Password</h2>
        <Input label="New password" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Input label="Confirm new password" type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
        <Button variant="secondary" onClick={savePassword} loading={savingPw} disabled={!pw && !pwConfirm}>
          Update Password
        </Button>
      </section>
    </div>
  );
}
