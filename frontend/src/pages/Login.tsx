import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/shared/Input';
import { Button } from '../components/shared/Button';
import { GlassCard } from '../components/shared/GlassCard';
import { useToast } from '../components/shared/Toast';
export function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect based on role
  if (isAuthenticated && user) {
    if (user.role === 'SUPERADMIN') {
      return <Navigate to="/superadmin" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const profile = await login({ username: email, password });
      toast({ type: 'success', title: 'Bienvenido', message: 'Inicio de sesión exitoso.' });
      
      if (profile.role === 'SUPERADMIN') {
        navigate('/superadmin');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast({ 
        type: 'error', 
        title: 'Error de Autenticación', 
        message: error.response?.data?.message || 'Correo o contraseña incorrectos. Por favor, intenta de nuevo.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 relative z-10 overflow-hidden font-sans">

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        <GlassCard className="p-10 shadow-xl border-border-strong/10">
          
          {/* Official Logo Integration */}
          <div className="flex justify-center mb-8 relative">
            <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-150 -z-10 opacity-50 pointer-events-none"></div>
            <img 
              src="/logo.png" 
              alt="ZonaFit Logo Oficial" 
              className="w-24 object-contain drop-shadow-lg relative z-10"
              style={{ aspectRatio: '1664/1776' }}
            />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight mb-1.5">Centro de Operaciones</h1>
            <p className="text-text-muted text-sm font-medium">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <Input 
              label="Correo electrónico" 
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@ejemplo.com"
              required
              autoComplete="email"
            />
            <Input 
              label="Contraseña" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            <div className="flex justify-end mt-2 mb-4">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-brand-secondary hover:text-brand-primary transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button 
              type="submit" 
              size="lg" 
              variant="primary"
              className="w-full mt-4"
              isLoading={isLoading}
            >
              Iniciar Sesión
            </Button>
            
            <div className="text-center mt-4">
              <p className="text-text-muted text-sm">
                ¿No tienes cuenta?{' '}
                <button 
                  type="button"
                  onClick={() => navigate('/register')}
                  className="text-brand-primary font-medium hover:text-white transition-colors"
                >
                  Crear gimnasio
                </button>
              </p>
            </div>
          </form>
        </GlassCard>
      </motion.div>
    </div>
  );
}
