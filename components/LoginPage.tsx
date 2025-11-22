import React, { useState } from 'react';
import { PiggyBank, Wallet, LogIn, User } from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../firebase';

interface LoginPageProps {
  onGuestLogin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onGuestLogin }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    if (!auth || !googleProvider) {
      setError("Firebase 設定錯誤或無法連接。");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      // Auth state change in App.tsx will handle the redirect
    } catch (err: any) {
      console.error("Login Error:", err);
      setError("登入失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-purple-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-indigo-50 p-8 text-center border-b border-indigo-100">
          <div className="w-20 h-20 bg-white rounded-full shadow-lg mx-auto flex items-center justify-center mb-4">
             <PiggyBank size={40} className="text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-indigo-900 mb-2">Fun財成長</h1>
          <p className="text-indigo-600/80 font-medium">親子零用錢管理小幫手</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-3 px-4 bg-white border-2 border-gray-200 hover:bg-gray-50 hover:border-indigo-200 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-sm"
            >
              {loading ? (
                <span className="block w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
              ) : (
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
              )}
              使用 Google 帳號登入
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-400">或</span>
              </div>
            </div>

            <button
              onClick={onGuestLogin}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <User size={18} />
              離線試用 (資料僅存於本機)
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">
              {error}
            </div>
          )}

          <div className="text-center text-xs text-gray-400 mt-6">
            <p>登入即代表您同意雲端同步您的記帳資料</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;