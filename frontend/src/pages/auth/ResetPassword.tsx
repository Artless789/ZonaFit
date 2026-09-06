import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Card } from '@shared/ui/Card';
import { authService } from '../../services/authService';

type ResetState = 'INITIAL' | 'LOADING' | 'VALID' | 'INVALID' | 'USED' | 'EXPIRED' | 'SUCCESS';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<ResetState>('INITIAL');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('INVALID');
      return;
    }

    const validateToken = async () => {
      try {
        setStatus('LOADING');
        const response = await authService.validateResetToken(token);
        setEmail(response.email);
        setStatus('VALID');
      } catch (err: any) {
        const errorMsg = err.response?.data?.error?.message || err.response?.data?.detail || 'El enlace no es válido.';
        if (errorMsg.includes('utilizado')) {
          setStatus('USED');
        } else if (errorMsg.includes('expirado')) {
          setStatus('EXPIRED');
        } else {
          setStatus('INVALID');
        }
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('Por favor, completa ambos campos.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await authService.resetPassword(token!, password);
      setStatus('SUCCESS');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.detail || 'Error al restablecer la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (status === 'INITIAL' || status === 'LOADING') {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
          <p className="mt-4 text-text-muted">Verificando enlace...</p>
        </div>
      );
    }

    if (status === 'SUCCESS') {
      return (
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-success mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">
            ¡Contraseña restablecida!
          </h3>
          <p className="text-sm text-text-muted mb-6">
            Tu contraseña ha sido actualizada exitosamente.
          </p>
          <Link
            to="/login"
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-[0_0_20px_rgba(33,150,243,0.3)] text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 transition-all duration-200"
          >
            Ir a Iniciar Sesión
          </Link>
        </div>
      );
    }

    if (status === 'INVALID' || status === 'USED' || status === 'EXPIRED') {
      return (
        <div className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-danger mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Enlace inválido
          </h3>
          <p className="text-sm text-text-muted mb-6">
            {status === 'EXPIRED' && 'Este enlace de recuperación ha expirado.'}
            {status === 'USED' && 'Este enlace ya fue utilizado anteriormente.'}
            {status === 'INVALID' && 'El enlace de recuperación es inválido o está dañado.'}
          </p>
          <Link
            to="/forgot-password"
            className="w-full flex justify-center py-2.5 px-4 border border-white/10 rounded-xl shadow-sm text-sm font-medium text-text-primary bg-bg-surface/50 hover:bg-bg-surface transition-all duration-200 mb-3"
          >
            Solicitar nuevo enlace
          </Link>
          <Link
            to="/login"
            className="text-sm font-medium text-brand-secondary hover:text-brand-primary transition-colors"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      );
    }

    return (
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-2 bg-brand-primary/10 rounded-full mb-3">
            <Lock className="h-6 w-6 text-brand-primary" />
          </div>
          <p className="text-sm text-text-muted">
            Restableciendo contraseña para <br />
            <strong className="text-text-primary">{email}</strong>
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start">
            <AlertCircle className="h-5 w-5 text-danger mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
            Nueva contraseña
          </label>
          <div className="mt-1 relative rounded-xl shadow-sm group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-text-muted group-focus-within:text-brand-primary transition-colors" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full pl-10 px-4 py-3 bg-bg-surface border border-border-strong rounded-[var(--radius-md)] text-text-primary placeholder-text-muted focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all duration-200"
              placeholder="Mínimo 8 caracteres"
            />
          </div>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-1.5">
            Confirmar contraseña
          </label>
          <div className="mt-1 relative rounded-xl shadow-sm group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Lock className="h-5 w-5 text-text-muted group-focus-within:text-brand-primary transition-colors" />
            </div>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="block w-full pl-10 px-4 py-3 bg-bg-surface border border-border-strong rounded-[var(--radius-md)] text-text-primary placeholder-text-muted focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all duration-200"
              placeholder="Confirmar nueva contraseña"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-[0_0_20px_rgba(33,150,243,0.3)] text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 hover:shadow-[0_0_25px_rgba(33,150,243,0.5)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary focus:ring-offset-bg-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Guardando...' : 'Restablecer contraseña'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-bg-base relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-radial from-brand-primary/10 via-bg-base to-bg-base"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-brand-secondary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob animation-delay-2000"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center mb-6 relative">
          <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-150 -z-10 opacity-50 pointer-events-none"></div>
          <img 
            src="/logo.png" 
            alt="ZonaFit Logo Oficial" 
            className="w-20 object-contain drop-shadow-lg relative z-10"
            style={{ aspectRatio: '1664/1776' }}
          />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-text-primary tracking-tight">
          Crea tu nueva contraseña
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card variant="glass" padding="xl" className="shadow-2xl">
          {renderContent()}
        </Card>
      </div>
    </div>
  );
}
