import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '@shared/ui/Card';
import { authService } from '../../services/authService';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu correo electrónico.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      // This will always return a generic success message
      await authService.forgotPassword(email);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || err.response?.data?.detail || 'Ocurrió un error al intentar enviar el correo de recuperación. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-bg-base relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-radial from-brand-primary/10 via-bg-base to-bg-base"></div>
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-primary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob"></div>
      <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-brand-secondary/20 rounded-full mix-blend-screen filter blur-[100px] opacity-50 animate-blob animation-delay-2000"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="flex justify-center mb-6 relative">
          <div className="absolute inset-0 bg-white/20 blur-xl rounded-full scale-150 -z-10 opacity-50 pointer-events-none"></div>
          <img 
            src="/logo.png" 
            alt="Merwil ZonaFit Logo Oficial" 
            className="w-20 object-contain drop-shadow-lg relative z-10"
            style={{ aspectRatio: '1664/1776' }}
          />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-text-primary tracking-tight">
          Recupera tu contraseña
        </h2>
        <p className="mt-2 text-center text-sm text-text-muted">
          Ingresa el correo asociado a tu cuenta
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Card variant="glass" padding="xl" className="shadow-2xl">
          {isSuccess ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success mb-4" />
              <h3 className="text-lg font-medium text-text-primary mb-2">
                Revisa tu correo
              </h3>
              <p className="text-sm text-text-muted mb-6">
                Si existe una cuenta asociada a <strong>{email}</strong>, recibirás instrucciones para recuperar tu contraseña en breve.
              </p>
              <Link
                to="/login"
                className="w-full flex justify-center py-2.5 px-4 border border-white/10 rounded-xl shadow-sm text-sm font-medium text-text-primary bg-bg-surface/50 hover:bg-bg-surface transition-all duration-200"
              >
                Volver a Iniciar Sesión
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-danger/10 border border-danger/20 rounded-xl p-4 flex items-start">
                  <AlertCircle className="h-5 w-5 text-danger mt-0.5 mr-3 flex-shrink-0" />
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-1.5">
                  Correo electrónico
                </label>
                <div className="mt-1 relative rounded-xl shadow-sm group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-text-muted group-focus-within:text-brand-primary transition-colors" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 px-4 py-3 bg-bg-surface border border-border-strong rounded-[var(--radius-md)] text-text-primary placeholder-text-muted focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all duration-200"
                    placeholder="usuario@gimnasio.com"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-[0_0_20px_rgba(33,150,243,0.3)] text-sm font-medium text-white bg-brand-primary hover:bg-brand-primary/90 hover:shadow-[0_0_25px_rgba(33,150,243,0.5)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary focus:ring-offset-bg-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Enviando...' : 'Enviar instrucciones'}
                </button>
              </div>

              <div className="flex items-center justify-center mt-6">
                <Link
                  to="/login"
                  className="flex items-center text-sm font-medium text-brand-secondary hover:text-brand-primary transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-1.5" />
                  Volver al inicio de sesión
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
