import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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

  // If already logged in on initial load, redirect based on role or selected plan
  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      if (user.role === 'SUPERADMIN') {
        window.location.replace('/superadmin');
      } else if (!user.onboarding_completed) {
        window.location.replace('/onboarding');
      } else if (planId) {
        window.location.replace(`/subscription/checkout?planId=${planId}`);
      } else if (redirect) {
        window.location.replace(redirect);
      } else {
        window.location.replace('/app/dashboard');
      }
    }
  }, [isAuthenticated, user, isLoading, planId, redirect]);

  if (isAuthenticated && user && !isLoading) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    
    try {
      const profile = await login({ username: email.trim().toLowerCase(), password });
      toast({ type: 'success', title: 'Bienvenido', message: 'Inicio de sesión exitoso.' });
      
      if (profile.role === 'SUPERADMIN') {
        window.location.replace('/superadmin');
      } else if (!profile.onboarding_completed) {
        window.location.replace('/onboarding');
      } else if (planId) {
        window.location.replace(`/subscription/checkout?planId=${planId}`);
      } else if (redirect) {
        window.location.replace(redirect);
      } else {
        window.location.replace('/app/dashboard');
      }
    } catch (error: any) {
      const status = error.response?.status;
      const backendDetail = 
        error.response?.data?.detail || 
        error.response?.data?.error?.message || 
        error.response?.data?.message || 
        error.userMessage;

      if (status === 429) {
        toast({ 
          type: 'error', 
          title: 'Límite de Intentos Excedido', 
          message: backendDetail || 'Demasiadas solicitudes. Por favor, espera un momento antes de volver a intentar.' 
        });
      } else if (!error.response || error.code === 'ECONNABORTED') {
        toast({ 
          type: 'error', 
          title: 'Error de Conexión', 
          message: 'No pudimos conectar con el servidor o el tiempo de espera se agotó. Por favor, verifica tu conexión.' 
        });
      } else if (status === 401) {
        toast({ 
          type: 'error', 
          title: 'Error de Autenticación', 
          message: backendDetail || 'Correo o contraseña incorrectos. Por favor, intenta de nuevo.' 
        });
      } else if (status === 403) {
        toast({ 
          type: 'error', 
          title: 'Acceso Denegado', 
          message: backendDetail || 'Tu cuenta se encuentra inactiva o restringida. Contacta al administrador.' 
        });
      } else {
        toast({ 
          type: 'error', 
          title: 'Error de Inicio de Sesión', 
          message: backendDetail || 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.' 
        });
      }
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <Input 
              label="Contraseña" 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
