import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Firebase Auth handles state via onAuthStateChanged — just redirect home.
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="text-white text-center">
        <div className="w-10 h-10 border-2 border-white/20 border-t-white/80 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-white/70">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
