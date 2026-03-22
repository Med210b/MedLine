import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Eye, EyeOff, Camera, User as UserIcon, Lock, ShieldCheck } from 'lucide-react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const APP_LOGO = 'https://i.postimg.cc/hGWD8Fx8/wkx78803bxrmt0cx25brw9e388-result-0.jpg';

export default function Auth() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form Fields
  const [phone, setPhone] = useState<string | undefined>('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Avatar Upload
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!phone) {
      setError('Please enter a valid phone number.');
      setLoading(false);
      return;
    }

    // THE GENIUS TRICK: Map phone number to a hidden dummy email!
    const cleanPhone = phone.replace(/\s+/g, '');
    const dummyEmail = `${cleanPhone}@medline.app`;

    try {
      if (isSignUp) {
        // --- SIGN UP FLOW ---
        if (password !== confirmPassword) throw new Error('Passwords do not match!');
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        if (!name.trim() || !username.trim()) throw new Error('Name and Username are required.');
        if (!avatarFile) throw new Error('Please upload a profile picture.');

        // 1. Create account with Password (NO OTP REQUIRED)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: dummyEmail,
          password: password,
        });

        if (authError) {
          if (authError.message.includes('already registered')) {
            throw new Error('This phone number is already registered. Please log in.');
          }
          throw authError;
        }

        const user = authData.user;
        if (!user) throw new Error('Signup failed. Please try again.');

        // 2. Upload Avatar
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile);
        
        let publicAvatarUrl = '';
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          publicAvatarUrl = urlData.publicUrl;
        }

        // 3. Save User Data to Database
        const { error: dbError } = await supabase.from('users').insert([{
          id: user.id,
          phone: cleanPhone,
          name: name.trim(),
          username: username.trim(),
          avatar_url: publicAvatarUrl,
          is_online: true,
          last_seen: new Date().toISOString()
        }]);

        if (dbError) throw dbError;

        // Success! Go to chat. Session is auto-saved.
        navigate('/chat');

      } else {
        // --- LOG IN FLOW ---
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: dummyEmail,
          password: password,
        });

        if (loginError) {
          if (loginError.message.includes('Invalid login credentials')) {
            throw new Error('Incorrect phone number or password.');
          }
          throw loginError;
        }

        // Success! Supabase auto-remembers the session.
        navigate('/chat');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#f0f2f5] dark:bg-[#111b21] p-4 relative overflow-x-hidden">
      
      {/* EST Background Styling */}
      <div className="absolute top-0 left-0 w-full h-[30vh] bg-[#c62828] dark:bg-[#1a0a0a] z-0"></div>
      
      <div className="w-full max-w-md bg-white dark:bg-[#202c33] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] z-10 overflow-hidden relative mt-10 md:mt-0">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#c62828] to-[#b71c1c] p-6 text-center">
          <div className="w-20 h-20 mx-auto bg-white rounded-full p-1 shadow-lg mb-3">
             <img src={APP_LOGO} alt="MedLine Logo" className="w-full h-full rounded-full object-cover scale-[1.2]" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wide">MedLine Ultra</h1>
          <p className="text-white/80 text-sm mt-1">{isSignUp ? 'Create your account' : 'Welcome back'}</p>
        </div>

        <form onSubmit={handleAuth} className="p-6 sm:p-8 space-y-4">
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium text-center border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}

          {isSignUp && (
            <div className="flex flex-col items-center mb-6">
              <div 
                className="relative w-24 h-24 rounded-full bg-[#f0f2f5] dark:bg-[#111b21] border-2 border-dashed border-[#c62828] flex items-center justify-center cursor-pointer group overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="w-8 h-8 text-[#c62828] opacity-50 group-hover:opacity-100 transition-opacity" />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-bold uppercase">Upload</span>
                </div>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/*" className="hidden" />
              <p className="text-xs text-[#8696a0] mt-2 font-medium">Profile Picture (Required)</p>
            </div>
          )}

          {isSignUp && (
            <div className="flex space-x-3">
              <div className="flex-1 relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8696a0]" />
                <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full Name" className="pl-10 bg-[#f0f2f5] dark:bg-[#111b21] border-none h-12 rounded-xl focus-visible:ring-[#c62828]" />
              </div>
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8696a0] font-bold">@</span>
                <Input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="pl-8 bg-[#f0f2f5] dark:bg-[#111b21] border-none h-12 rounded-xl focus-visible:ring-[#c62828]" />
              </div>
            </div>
          )}

          <div className="relative">
            <PhoneInput
              international
              defaultCountry="AE"
              value={phone}
              onChange={setPhone}
              className="flex w-full bg-[#f0f2f5] dark:bg-[#111b21] border-none h-12 rounded-xl px-4 focus-within:ring-2 focus-within:ring-[#c62828] text-[#111b21] dark:text-white [&>input]:bg-transparent [&>input]:border-none [&>input]:outline-none"
              placeholder="Phone Number"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8696a0]" />
            <Input required type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="pl-10 pr-10 bg-[#f0f2f5] dark:bg-[#111b21] border-none h-12 rounded-xl focus-visible:ring-[#c62828]" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#c62828]">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>

          {isSignUp && (
            <div className="relative animate-in slide-in-from-top-2">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#8696a0]" />
              <Input required type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="pl-10 pr-10 bg-[#f0f2f5] dark:bg-[#111b21] border-none h-12 rounded-xl focus-visible:ring-[#c62828]" />
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" disabled={loading} className="w-full h-12 rounded-xl bg-[#fbc02d] hover:bg-[#f9a825] text-[#1a0a0a] font-extrabold text-lg shadow-md transition-all">
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Log In')}
            </Button>
          </div>
          
        </form>

        <div className="bg-[#f5f6f6] dark:bg-[#182229] p-4 text-center border-t border-[#e9edef] dark:border-[#222d34]">
          <p className="text-[14px] text-[#667781] dark:text-[#8696a0]">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <span onClick={toggleMode} className="text-[#c62828] dark:text-[#fbc02d] font-bold cursor-pointer hover:underline">
              {isSignUp ? 'Log in here' : 'Sign up now'}
            </span>
          </p>
        </div>

      </div>
    </div>
  );
}