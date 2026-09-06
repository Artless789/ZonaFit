import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Card } from '@shared/ui/Card';
import { authService } from '../services/authService';
import { User, Mail, Lock, Building, Phone, MapPin, Map, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useToast } from '@shared/ui/Toast';

function getRegistrationErrorMessage(error: unknown): string {
  const responseData = (error as { response?: { data?: any } })?.response?.data;
  
  // Custom API wrapper format
  if (responseData?.error?.message && typeof responseData.error.message === 'string') {
    return responseData.error.message;
  }

  // Standard FastAPI format
  const detail = responseData?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((issue) => (
        issue && typeof issue === 'object' && 'msg' in issue
          ? String(issue.msg)
          : ''
      ))
      .filter(Boolean);

    if (messages.length > 0) return messages.join(' ');
  }

  return 'Ocurrió un error al registrar el gimnasio.';
}

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planId = searchParams.get('planId');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    owner_name: '',
    owner_email: '',
    owner_password: '',
    confirm_password: '',
    gym_name: '',
    gym_phone: '',
    gym_address: '',
    gym_city: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear specific error on type
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.owner_name) newErrors.owner_name = "El nombre es obligatorio";
    if (!formData.owner_email || !/^\S+@\S+\.\S+$/.test(formData.owner_email)) newErrors.owner_email = "Ingresa un correo válido";
    if (formData.owner_password.length < 8) newErrors.owner_password = "Mínimo 8 caracteres";
    if (formData.owner_password !== formData.confirm_password) newErrors.confirm_password = "Las contraseñas no coinciden";
    if (!formData.gym_name) newErrors.gym_name = "El nombre del gimnasio es obligatorio";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!termsAccepted) {
      toast({ type: 'error', title: 'Términos', message: 'Debes aceptar los términos y condiciones.' });
      return;
    }

    setIsLoading(true);
    try {
      await authService.register(formData);
      toast({ type: 'success', title: '¡Gimnasio Creado!', message: 'Serás redirigido al inicio de sesión.' });
      navigate(planId ? `/login?planId=${planId}` : '/login');
    } catch (error: unknown) {
      toast({ 
        type: 'error', 
        title: 'Error de Registro', 
        message: getRegistrationErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 lg:p-8 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl relative z-10"
      >
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6 relative">
            <div className="absolute inset-0 bg-white/10 blur-[80px] rounded-full scale-150 -z-10 opacity-30 pointer-events-none"></div>
            <img 
              src="/logo.png" 
              alt="ZonaFit Logo Oficial" 
              className="w-20 object-contain drop-shadow-lg relative z-10"
              style={{ aspectRatio: '1664/1776' }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">
            Crear tu <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary to-brand-secondary">Gimnasio</span>
          </h1>
          <p className="text-text-secondary mt-2 font-medium">Comienza a gestionar tu gimnasio con ZonaFit</p>
        </div>

        <Card variant="glass" padding="none" className="p-1 md:p-8 overflow-hidden relative">
          <form onSubmit={handleSubmit} className="p-6 md:p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-10">
              
              {/* Owner Block */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border-light/30 pb-3">
                  <div className="w-8 h-8 rounded bg-brand-primary/10 flex items-center justify-center">
                    <User size={18} className="text-brand-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-white tracking-wide">CUENTA DEL PROPIETARIO</h3>
                </div>
                
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Nombre Completo</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User size={16} className={errors.owner_name ? "text-brand-primary" : "text-text-muted"} />
                      </div>
                      <input
                        type="text"
                        name="owner_name"
                        required
                        placeholder="Ej. Juan Pérez"
                        value={formData.owner_name}
                        onChange={handleChange}
                        className={`w-full bg-surface-dark border ${errors.owner_name ? 'border-brand-primary' : 'border-border-strong'} rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors`}
                      />
                    </div>
                    {errors.owner_name && <p className="text-brand-primary text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12} /> {errors.owner_name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Correo Electrónico</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={16} className={errors.owner_email ? "text-brand-primary" : "text-text-muted"} />
                      </div>
                      <input
                        type="email"
                        name="owner_email"
                        required
                        placeholder="admin@ejemplo.com"
                        value={formData.owner_email}
                        onChange={handleChange}
                        className={`w-full bg-surface-dark border ${errors.owner_email ? 'border-brand-primary' : 'border-border-strong'} rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors`}
                      />
                    </div>
                    {errors.owner_email && <p className="text-brand-primary text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12} /> {errors.owner_email}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Contraseña</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={16} className={errors.owner_password ? "text-brand-primary" : "text-text-muted"} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="owner_password"
                        required
                        placeholder="••••••••"
                        value={formData.owner_password}
                        onChange={handleChange}
                        className={`w-full bg-surface-dark border ${errors.owner_password ? 'border-brand-primary' : 'border-border-strong'} rounded-lg pl-10 pr-10 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors`}
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.owner_password && <p className="text-brand-primary text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12} /> {errors.owner_password}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Confirmar Contraseña</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock size={16} className={errors.confirm_password ? "text-brand-primary" : "text-text-muted"} />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="confirm_password"
                        required
                        placeholder="••••••••"
                        value={formData.confirm_password}
                        onChange={handleChange}
                        className={`w-full bg-surface-dark border ${errors.confirm_password ? 'border-brand-primary' : 'border-border-strong'} rounded-lg pl-10 pr-10 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors`}
                      />
                    </div>
                    {errors.confirm_password && <p className="text-brand-primary text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12} /> {errors.confirm_password}</p>}
                  </div>
                </div>
              </div>

              {/* Gym Block */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 border-b border-border-light/30 pb-3">
                  <div className="w-8 h-8 rounded bg-brand-primary/10 flex items-center justify-center">
                    <Building size={18} className="text-brand-primary" />
                  </div>
                  <h3 className="text-base font-semibold text-white tracking-wide">INFORMACIÓN DEL GIMNASIO</h3>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Nombre Comercial</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building size={16} className={errors.gym_name ? "text-brand-primary" : "text-text-muted"} />
                      </div>
                      <input
                        type="text"
                        name="gym_name"
                        required
                        placeholder="Ej. Power Gym"
                        value={formData.gym_name}
                        onChange={handleChange}
                        className={`w-full bg-surface-dark border ${errors.gym_name ? 'border-brand-primary' : 'border-border-strong'} rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors`}
                      />
                    </div>
                    {errors.gym_name && <p className="text-brand-primary text-xs mt-1.5 flex items-center gap-1"><AlertCircle size={12} /> {errors.gym_name}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Teléfono Oficial</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone size={16} className="text-text-muted" />
                      </div>
                      <input
                        type="tel"
                        name="gym_phone"
                        placeholder="+57 300 000 0000"
                        value={formData.gym_phone}
                        onChange={handleChange}
                        className="w-full bg-surface-dark border border-border-strong rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Ciudad</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Map size={16} className="text-text-muted" />
                        </div>
                        <input
                          type="text"
                          name="gym_city"
                          placeholder="Ej. Bogotá"
                          value={formData.gym_city}
                          onChange={handleChange}
                          className="w-full bg-surface-dark border border-border-strong rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase tracking-wider">Dirección</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPin size={16} className="text-text-muted" />
                        </div>
                        <input
                          type="text"
                          name="gym_address"
                          placeholder="Av Principal #123"
                          value={formData.gym_address}
                          onChange={handleChange}
                          className="w-full bg-surface-dark border border-border-strong rounded-lg pl-10 pr-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-10 pt-8 border-t border-border-light/30 flex flex-col items-center">
              <div className="flex items-center space-x-2 bg-bg-screen/50 p-4 rounded-xl border border-border-light">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-5 h-5 rounded border-border-medium bg-bg-surface text-brand-primary focus:ring-brand-primary focus:ring-offset-bg-screen cursor-pointer"
                />
                <label htmlFor="terms" className="text-sm text-text-secondary select-none">
                  Acepto los{' '}
                  <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:text-brand-primary/80 transition-colors">
                    Términos y condiciones
                  </Link>
                  {' '}y la{' '}
                  <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:text-brand-primary/80 transition-colors">
                    Política de privacidad
                  </Link>
                  .
                </label>
              </div>

              <ActionGlowButton
                onClick={handleSubmit}
                className="w-full max-w-md h-14 text-base font-bold shadow-xl shadow-brand-primary/20"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Creando gimnasio...
                  </span>
                ) : (
                  'Crear mi gimnasio'
                )}
              </ActionGlowButton>
            </div>
          </form>
        </Card>

        <p className="text-center text-text-secondary mt-8 text-sm">
          ¿Ya tienes cuenta?{' '}
          <button 
            onClick={() => navigate(planId ? `/login?planId=${planId}` : '/login')}
            className="text-brand-primary hover:text-white font-medium transition-colors border-b border-transparent hover:border-brand-primary pb-0.5"
          >
            Inicia sesión aquí
          </button>
        </p>
      </motion.div>
    </div>
  );
}
