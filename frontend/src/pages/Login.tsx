import { useState } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Input } from '@shared/ui/Input';
import { Button } from '@shared/ui/Button';
import { Card } from '@shared/ui/Card';
import { useToast } from '@shared/ui/Toast';

export function Login({ isApp = false }: { isApp?: boolean }) {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('planId');
  const redirect = searchParams.get('redirect');
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, redirect based on role or selected plan
  if (isAuthenticated && user) {
    if (user.role === 'SUPERADMIN') {
      if (isApp) {
        window.location.assign('/superadmin');
        return null;
      }
      return <Navigate to="/superadmin" replace />;
    }

    if (!user.onboarding_completed) {
      if (isApp) {
        window.location.assign('/onboarding');
        return null;
      }
      return <Navigate to="/onboarding" replace />;
    }
    
    // If a planId was selected, take user directly to checkout
    if (planId) {
      if (isApp) {
        window.location.assign(`/subscription/checkout?planId=${planId}`);
        return null;
      }
      return <Navigate to={`/subscription/checkout?planId=${planId}`} replace />;
    }

    if (redirect) {
      if (isApp) {
        window.location.assign(redirect);
        return null;
      }
      return <Navigate to={redirect} replace />;
    }

    // Normal user goes to App Dashboard
    if (!isApp) {
      window.location.assign('/app/dashboard');
      return null;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const profile = await login({ username: email.trim().toLowerCase(), password });
      toast({ type: 'success', title: 'Bienvenido', message: 'Inicio de sesión exitoso.' });
      
      if (profile.role === 'SUPERADMIN') {
        if (isApp) window.location.assign('/superadmin');
        else navigate('/superadmin');
      } else if (!profile.onboarding_completed) {
        if (isApp) window.location.assign('/onboarding');
        else navigate('/onboarding');
      } else if (planId) {
        // Redirigir al checkout con el plan seleccionado
        window.location.assign(`/subscription/checkout?planId=${planId}`);
      } else if (redirect) {
        window.location.assign(redirect);
      } else {
        if (!isApp) window.location.assign('/app/dashboard');
        else navigate('/dashboard');
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

  const goToRegister = () => {
    const target = planId ? `/register?planId=${planId}` : '/register';
    if (isApp) window.location.assign(target);
    else navigate(target);
  };

  const goToForgotPassword = () => {
    if (isApp) window.location.assign('/forgot-password');
    else navigate('/forgot-password');
  };

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4 relative z-10 overflow-hidden font-sans">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md z-10"
      >
        <Card variant="glass" padding="xl" className="shadow-xl">
          <div className="flex justify-center mb-8 relative">
            <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-150 -z-10 opacity-50 pointer-events-none"></div>
            <img 
              src="/logo.png" 
              alt="Merwil ZonaFit Logo Oficial" 
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
              <button
                type="button"
                onClick={goToForgotPassword}
                className="text-sm font-medium text-brand-secondary hover:text-brand-primary transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
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
                  onClick={goToRegister}
                  className="text-brand-primary font-medium hover:text-white transition-colors"
                >
                  Crear gimnasio
                </button>
              </p>
            </div>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
