import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error || !token) {
      navigate('/auth/login?error=google_failed', { replace: true });
      return;
    }

    login({
      token,
      user: {
        id: searchParams.get('userId'),
        name: searchParams.get('name'),
        email: searchParams.get('email'),
        role: searchParams.get('role'),
        tokenBalance: Number(searchParams.get('tokenBalance') || 0),
        isPremium: searchParams.get('isPremium') === 'true',
        googleVerified: searchParams.get('googleVerified') === 'true',
      },
    });

    navigate('/search', { replace: true });
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-white/60">Signing you in...</p>
      </div>
    </div>
  );
}
