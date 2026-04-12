import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/login');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-20 left-20 w-96 h-96 bg-cyan-300 rounded-full blur-3xl animate-pulse-glow"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-400 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '0.75s' }}></div>
      </div>

      {/* Logo and Content */}
      <div className="relative z-10 text-center space-y-8 animate-fade-in">
        <div className="mb-8">
          <img 
            src="/clairvyn-logo.png" 
            alt="Clairvyn" 
            className="h-32 mx-auto drop-shadow-2xl"
          />
        </div>
        
        <div className="space-y-4">
          <h1 className="text-6xl font-bold tracking-tight">Clairvyn</h1>
          <p className="text-2xl font-light tracking-wide text-blue-100">
            Disrupting the Ordinary.
          </p>
        </div>

        {/* Loading indicator */}
        <div className="flex justify-center mt-12">
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-3 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

