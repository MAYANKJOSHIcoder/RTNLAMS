import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LogIn, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Inline validation on blur per ui-ux-pro-max; labels for a11y per skill
const schema = z.object({
  email: z.string().email('Enter a valid email').trim().min(1, 'Email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormData = z.infer<typeof schema>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPw, setShowPw] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormData) => {
    const res = await login(data.email, data.password);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Welcome back');
    // Return to the deep link that triggered the login, if any
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from && from !== '/login' ? from : '/dashboard');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-black border border-white/20 rounded-lg mb-3">
            <LogIn className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900"><Link to="/" className="cursor-pointer hover:text-white transition-colors">RTNLAMS</Link></h1>
          <p className="text-sm text-slate-500 mt-1">Government of India</p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-6 shadow-sm space-y-5"
          noValidate
        >
          <h2 className="text-lg font-semibold text-slate-900">Sign in to your account</h2>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email address <span className="text-red-600">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="officer@gov.in"
              className={`w-full h-11 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8] focus:border-[#38bdf8] ${errors.email ? 'border-red-500' : 'border-slate-300'}`}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-xs text-red-600 mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password <span className="text-red-600">*</span>
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                className={`w-full h-11 px-3 pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8] focus:border-[#38bdf8] ${errors.password ? 'border-red-500' : 'border-slate-300'}`}
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-700 cursor-pointer"
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p id="password-error" role="alert" className="text-xs text-red-600 mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-white text-black rounded-md text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-[#38bdf8] focus:ring-offset-2"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-slate-600">
            Don’t have an account?{' '}
            <Link to="/register" className="text-[#38bdf8] font-medium hover:underline">
              Create account
            </Link>
          </p>
        </form>

        <p className="text-center text-xs text-slate-400 mt-4">Secure government portal • Session timeout 30 min</p>
      </div>
    </div>
  );
}
