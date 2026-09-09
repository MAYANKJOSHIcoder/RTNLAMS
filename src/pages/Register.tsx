import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const schema = z
  .object({
    full_name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Enter a valid email').trim().min(1, 'Email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string().min(1, 'Confirm your password'),
    cnic: z.string().trim().min(13, 'CNIC is required (13 digits, e.g. 35202-1234567-1)'),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match',
  });

type FormData = z.infer<typeof schema>;

export default function Register() {
  const { register: doRegister } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const {
    register: rhfReg,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { full_name: '', email: '', password: '', confirm_password: '', cnic: '' },
  });

  const onSubmit = async (data: FormData) => {
    const res = await doRegister({
      full_name: data.full_name,
      email: data.email,
      password: data.password,
      cnic: data.cnic,
    });
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Account created — please sign in');
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-black border border-white/20 rounded-lg mb-3">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">RTNLAMS • Government of India</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-[#0c0c0c] border border-slate-200 rounded-xl p-6 shadow-sm space-y-4" noValidate>
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">
              Full name <span className="text-red-600">*</span>
            </label>
            <input
              id="full_name"
              placeholder="Rajesh Kumar"
              className={`w-full h-11 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8] ${errors.full_name ? 'border-red-500' : 'border-slate-300'}`}
              aria-invalid={!!errors.full_name}
              {...rhfReg('full_name')}
            />
            {errors.full_name && <p role="alert" className="text-xs text-red-600 mt-1">{errors.full_name.message}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="rajesh@gov.in"
              className={`w-full h-11 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8] ${errors.email ? 'border-red-500' : 'border-slate-300'}`}
              {...rhfReg('email')}
            />
            {errors.email && <p role="alert" className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="cnic" className="block text-sm font-medium text-slate-700 mb-1">
              CNIC <span className="text-red-600">*</span>
            </label>
            <input
              id="cnic"
              placeholder="35202-1234567-1"
              className={`w-full h-11 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8] ${errors.cnic ? 'border-red-500' : 'border-slate-300'}`}
              aria-invalid={!!errors.cnic}
              {...rhfReg('cnic')}
            />
            {errors.cnic && <p role="alert" className="text-xs text-red-600 mt-1">{errors.cnic.message}</p>}
            <p className="text-xs text-slate-400 mt-1">Accounts register as citizens; staff roles (admin, field officer, auditor) are assigned by an administrator.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                Password <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={`w-full h-11 px-3 pr-10 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8] ${errors.password ? 'border-red-500' : 'border-slate-300'}`}
                  {...rhfReg('password')}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 cursor-pointer" aria-label="Toggle password">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p role="alert" className="text-xs text-red-600 mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-slate-700 mb-1">
                Confirm password <span className="text-red-600">*</span>
              </label>
              <input
                id="confirm_password"
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className={`w-full h-11 px-3 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8] ${errors.confirm_password ? 'border-red-500' : 'border-slate-300'}`}
                {...rhfReg('confirm_password')}
              />
              {errors.confirm_password && <p role="alert" className="text-xs text-red-600 mt-1">{errors.confirm_password.message}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 bg-white text-black rounded-md text-sm font-medium hover:bg-neutral-200 disabled:opacity-50 flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#38bdf8] focus:ring-offset-2"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already have an account? <Link to="/login" className="text-[#38bdf8] font-medium hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
