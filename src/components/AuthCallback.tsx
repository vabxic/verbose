import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );
        
        if (error) {
          console.error('Auth callback error:', error);
        }
      } catch (error) {
        console.error('Error handling auth callback:', error);
      } finally {
        // Redirect to home page after processing
        navigate('/', { replace: true });
      }
    };

    handleAuthCallback();
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
