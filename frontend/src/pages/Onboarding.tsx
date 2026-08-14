import { Select } from '../components/shared/Select';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../components/shared/Button';
import { GlassCard } from '../components/shared/GlassCard';
import { ActionGlowButton } from '../components/shared/ActionGlowButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/shared/Toast';
import { gymSettingsService } from '../services/gymSettingsService';
import { subscriptionService } from '../services/subscriptionService';
import { ErrorState } from '../components/shared/ErrorState';
import { Building, Settings, ChevronRight, ChevronLeft, Globe, DollarSign, Zap, Clock } from 'lucide-react';
import type { GymSettingsUpdate } from '../types/gymSettings';

export function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<GymSettingsUpdate>({});

  // Redirigir si ya completó onboarding
  useEffect(() => {
    if (user?.onboarding_completed) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const { data: settings, isLoading: isLoadingSettings, isError } = useQuery({
    queryKey: ['gymSettings'],
    queryFn: gymSettingsService.getSettings,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        legal_name: settings.legal_name,
        trade_name: settings.trade_name,
        tax_id: settings.tax_id,
        tax_regime: settings.tax_regime || '',
        official_phone: settings.official_phone,
        official_email: settings.official_email,
        physical_address: settings.physical_address,
        city: settings.city,
        country: settings.country,
        currency: settings.currency,
        timezone: settings.timezone,
        default_tax_percentage: settings.default_tax_percentage,
      });
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: gymSettingsService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gymSettings'] });
    },
  });

  const startSubMutation = useMutation({
    mutationFn: subscriptionService.startSubscription,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mySubscription'] });
    }
  });

  const completeMutation = useMutation({
    mutationFn: gymSettingsService.completeOnboarding,
    onError: (error: any) => {
      toast({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.detail || 'No se pudo completar la configuración.'
      });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      try {
        await updateMutation.mutateAsync(formData);
        setCurrentStep(2);
      } catch (err: any) {
        toast({
          type: 'error',
          title: 'Error guardando datos',
          message: err.response?.data?.detail || 'Verifica los campos obligatorios.'
        });
      }
    } else if (currentStep === 2) {
      try {
        await updateMutation.mutateAsync(formData);
        setCurrentStep(3);
      } catch (err: any) {
        toast({
          type: 'error',
          title: 'Error guardando datos',
          message: err.response?.data?.detail || 'Verifica los campos obligatorios.'
        });
      }
    }
  };

  const handleFinish = async (intent: 'TRIAL' | 'PURCHASE') => {
    try {
      await startSubMutation.mutateAsync({ intent });
      await completeMutation.mutateAsync();
      if (intent === 'PURCHASE') {
        window.location.href = '/subscription/checkout';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Error',
        message: err.response?.data?.detail || 'Ocurrió un error al iniciar tu suscripción.'
      });
    }
  };

  if (isLoadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-transparent font-sans">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-muted">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-transparent font-sans">
        <ErrorState 
          title="Error al cargar la configuración"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['gymSettings'] })}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 lg:p-8 font-sans">
      <div className="w-full max-w-3xl relative z-10 animate-fade-in-up">
        
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-6 relative">
            <div className="absolute inset-0 bg-white/10 blur-[60px] rounded-full scale-150 -z-10 opacity-30 pointer-events-none"></div>
            <img 
              src="/logo.png" 
              alt="ZonaFit Logo Oficial" 
              className="w-16 object-contain drop-shadow-lg relative z-10"
              style={{ aspectRatio: '1664/1776' }}
            />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight drop-shadow-md">
            Bienvenido, {user?.full_name?.split(' ')[0] || 'Propietario'}
          </h1>
          <p className="text-text-secondary mt-1 text-sm font-medium">Configuremos tu gimnasio para comenzar</p>
        </div>

        <GlassCard className="overflow-hidden">
          {/* Progress Indicator */}
          <div className="px-8 pt-8 pb-4 border-b border-border-light/30">
            <div className="flex items-center justify-between max-w-lg mx-auto relative">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border-strong -z-10 -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-0 h-0.5 bg-brand-primary -z-10 -translate-y-1/2 transition-all duration-500" style={{ width: currentStep === 3 ? '100%' : currentStep === 2 ? '50%' : '0%' }}></div>
              
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= 1 ? 'bg-brand-primary text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-surface-darker text-text-muted border border-border-strong'}`}>
                1
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= 2 ? 'bg-brand-primary text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-surface-darker text-text-muted border border-border-strong'}`}>
                2
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentStep >= 3 ? 'bg-brand-primary text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-surface-darker text-text-muted border border-border-strong'}`}>
                3
              </div>
            </div>
            <div className="flex justify-between max-w-lg mx-auto mt-3 text-xs font-medium text-text-muted">
              <span className={currentStep >= 1 ? 'text-white' : ''}>Comercial</span>
              <span className={currentStep >= 2 ? 'text-white' : ''}>Operativo</span>
              <span className={currentStep >= 3 ? 'text-white' : ''}>Suscripción</span>
            </div>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                      <Building size={20} className="text-brand-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Información Comercial</h3>
                      <p className="text-text-muted text-sm">Datos públicos y de contacto de tu negocio</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Nombre Comercial</label>
                      <input
                        type="text"
                        name="trade_name"
                        value={formData.trade_name || ''}
                        onChange={handleChange}
                        className="w-full bg-surface-dark border border-border-strong rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Razón Social</label>
                      <input
                        type="text"
                        name="legal_name"
                        value={formData.legal_name || ''}
                        onChange={handleChange}
                        className="w-full bg-surface-dark border border-border-strong rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Identificación Fiscal (NIT/RUT)</label>
                      <input
                        type="text"
                        name="tax_id"
                        value={formData.tax_id || ''}
                        onChange={handleChange}
                        className="w-full bg-surface-dark border border-border-strong rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Teléfono de Contacto</label>
                      <input
                        type="text"
                        name="official_phone"
                        value={formData.official_phone || ''}
                        onChange={handleChange}
                        className="w-full bg-surface-dark border border-border-strong rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Dirección Física</label>
                      <input
                        type="text"
                        name="physical_address"
                        value={formData.physical_address || ''}
                        onChange={handleChange}
                        className="w-full bg-surface-dark border border-border-strong rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-6">
                    <Button onClick={handleNext} disabled={updateMutation.isPending} className="flex items-center px-6">
                      Continuar <ChevronRight size={18} className="ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                      <Settings size={20} className="text-brand-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Ajustes Operativos</h3>
                      <p className="text-text-muted text-sm">Configuración regional y facturación</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">
                        <Globe size={14} className="inline mr-1" /> Ciudad
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city || ''}
                        onChange={handleChange}
                        className="w-full bg-surface-dark border border-border-strong rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-brand-primary transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">País</label>
                      <Select
                        name="country"
                        value={formData.country || ''}
                        onChange={handleChange}
                        
                      >
                        <option value="Colombia">Colombia</option>
                        <option value="México">México</option>
                        <option value="Perú">Perú</option>
                        <option value="Chile">Chile</option>
                        <option value="Argentina">Argentina</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">
                        <DollarSign size={14} className="inline mr-1" /> Moneda Base
                      </label>
                      <Select
                        name="currency"
                        value={formData.currency || ''}
                        onChange={handleChange}
                        
                      >
                        <option value="COP">COP - Peso Colombiano</option>
                        <option value="MXN">MXN - Peso Mexicano</option>
                        <option value="PEN">PEN - Sol Peruano</option>
                        <option value="CLP">CLP - Peso Chileno</option>
                        <option value="USD">USD - Dólar Estadounidense</option>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1.5 uppercase">Zona Horaria</label>
                      <Select
                        name="timezone"
                        value={formData.timezone || ''}
                        onChange={handleChange}
                        
                      >
                        <option value="America/Bogota">America/Bogota</option>
                        <option value="America/Mexico_City">America/Mexico_City</option>
                        <option value="America/Lima">America/Lima</option>
                        <option value="America/Santiago">America/Santiago</option>
                        <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex justify-between pt-6 border-t border-border-light/20 mt-8">
                    <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex items-center px-6">
                      <ChevronLeft size={18} className="mr-2" /> Atrás
                    </Button>
                    <ActionGlowButton onClick={handleNext} disabled={updateMutation.isPending} className="flex items-center px-8">
                      Continuar <ChevronRight size={18} className="ml-2" />
                    </ActionGlowButton>
                  </div>
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  <div className="flex flex-col items-center justify-center text-center mb-8">
                    <div className="w-16 h-16 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 mb-4 shadow-[0_0_30px_rgba(220,38,38,0.3)]">
                      <Zap size={32} className="text-brand-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">¿Cómo quieres comenzar?</h3>
                    <p className="text-text-muted text-base max-w-md mx-auto">Selecciona tu intención para empezar a disfrutar de ZonaFit en tu gimnasio.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                    <div 
                      className="bg-surface-dark border border-border-strong hover:border-brand-primary/50 hover:bg-surface-dark/80 rounded-xl p-6 cursor-pointer transition-all duration-300 flex flex-col items-center text-center group"
                      onClick={() => handleFinish('TRIAL')}
                    >
                      <div className="w-12 h-12 rounded-full bg-surface-darker flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <Clock size={24} className="text-brand-primary" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Probar gratis</h4>
                      <p className="text-sm text-text-muted mb-6 flex-grow">Explora la plataforma completa y todos los planes durante 14 días sin compromiso.</p>
                      <Button variant="outline" className="w-full group-hover:bg-brand-primary/10 group-hover:text-brand-primary group-hover:border-brand-primary/50 transition-colors pointer-events-none">
                        Iniciar Prueba
                      </Button>
                    </div>

                    <div 
                      className="bg-gradient-to-br from-brand-primary/20 to-surface-dark border border-brand-primary/40 hover:border-brand-primary rounded-xl p-6 cursor-pointer transition-all duration-300 flex flex-col items-center text-center group relative overflow-hidden"
                      onClick={() => handleFinish('PURCHASE')}
                    >
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-primary/20 rounded-full blur-2xl"></div>
                      <div className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                        <DollarSign size={24} className="text-brand-primary" />
                      </div>
                      <h4 className="text-xl font-bold text-white mb-2">Comprar ahora</h4>
                      <p className="text-sm text-text-muted mb-6 flex-grow">Activa tu plan preferido inmediatamente y obtén acceso total permanente.</p>
                      <ActionGlowButton className="w-full pointer-events-none">
                        Elegir Plan
                      </ActionGlowButton>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
