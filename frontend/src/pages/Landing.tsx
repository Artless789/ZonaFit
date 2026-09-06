import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '../services/subscriptionService';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@shared/ui/Button';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { useAuth } from '../context/AuthContext';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { 
  Users, 
  CreditCard, 
  Package, 
  Settings, 
  ShieldCheck, 
  Layers, 
  LogIn, 
  Play, 
  Download, 
  Smartphone, 
  Monitor, 
  Apple, 
  CheckCircle2, 
  Menu, 
  X, 
  FileText, 
  MessageSquare, 
  Coins 
} from 'lucide-react';

export function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isInstallable, isInstalled, platform, installPWA } = usePWAInstall();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedInstallPlatform, setSelectedInstallPlatform] = useState<'desktop' | 'android' | 'ios'>(
    platform === 'ios' ? 'ios' : platform === 'android' ? 'android' : 'desktop'
  );

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['availablePlans'],
    queryFn: subscriptionService.getPlans
  });

  const handleSelectPlan = (planId?: number) => {
    if (planId) {
      navigate(isAuthenticated ? `/subscription/checkout?planId=${planId}` : `/register?planId=${planId}`);
    } else {
      navigate(isAuthenticated ? '/subscription/checkout' : '/register');
    }
  };

  const handleInstallClick = async () => {
    if (isInstallable) {
      await installPWA();
    } else if (isInstalled) {
      window.location.assign('/app/dashboard');
    } else {
      // Scroll to install guide
      document.getElementById('install-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const features = [
    { 
      icon: <Users size={24} className="text-brand-primary" />, 
      title: 'Gestión y Foto de Clientes', 
      desc: 'Control integral de afiliados, registro documental y captura de fotos de perfil autorizadas.' 
    },
    { 
      icon: <CreditCard size={24} className="text-brand-primary" />, 
      title: 'Membresías y Planes', 
      desc: 'Planes configurables por días, cálculo automático de vigencias, precios históricos protegidos y control de abonos.' 
    },
    { 
      icon: <Coins size={24} className="text-brand-primary" />, 
      title: 'Caja y Turnos', 
      desc: 'Control estricto de efectivo físico, transferencias, arqueos y cierres de turno por operador.' 
    },
    { 
      icon: <Package size={24} className="text-brand-primary" />, 
      title: 'POS e Inventario', 
      desc: 'Punto de venta ágil para productos físicos, control de stock mínimo y categorización.' 
    },
    { 
      icon: <FileText size={24} className="text-brand-primary" />, 
      title: 'Comprobantes y Facturación PDF', 
      desc: 'Generación instantánea de comprobantes oficiales y recibos en formato PDF estándar.' 
    },
    { 
      icon: <MessageSquare size={24} className="text-brand-primary" />, 
      title: 'WhatsApp Business Cloud API', 
      desc: 'Notificaciones automáticas y alertas transaccionales directas al móvil del afiliado.' 
    },
    { 
      icon: <Settings size={24} className="text-brand-primary" />, 
      title: 'Configuración de Sede y Marca', 
      desc: 'Personalización de logotipo, moneda local, régimen tributario y datos fiscales del gimnasio.' 
    },
    { 
      icon: <ShieldCheck size={24} className="text-brand-primary" />, 
      title: 'Multi-Tenant y Auditoría', 
      desc: 'Aislamiento seguro de datos por sede y registro inmutable de trazabilidad operativa.' 
    }
  ];

  const benefits = [
    { title: 'Centralización Total', desc: 'Todo tu negocio opera desde una única fuente de verdad con sincronización instantánea.' },
    { title: 'Multi-Tenant Nativo', desc: 'Aislamiento absoluto de información financiera y operativa para tu gimnasio.' },
    { title: 'Ahorro de Tiempo', desc: 'Procesos administrativos de membresías y caja reducidos a un par de clics.' },
    { title: 'Tecnología PWA Multiplataforma', desc: 'Accede e instala ZonaFit en computadores de escritorio, tablets y teléfonos móviles.' }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: "spring" as const, stiffness: 100, damping: 20 }
    }
  };

  return (
    <div className="min-h-screen bg-transparent relative z-10 overflow-hidden font-sans">
      {/* Premium Video Background */}
      <div className="fixed inset-0 z-[-10] w-full h-full overflow-hidden bg-bg-page">
        <video 
          autoPlay 
          muted 
          loop 
          playsInline
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          poster="/logo.png"
        >
          <source src="/videos/landing-bg.mp4" type="video/mp4" />
        </video>
        {/* Cinematic Overlays */}
        <div className="absolute inset-0 bg-black/85 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-brand-primary/15 backdrop-blur-[2px]"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-bg-page/90 via-transparent to-bg-page"></div>
      </div>

      {/* Header */}
      <header className="absolute top-0 w-full p-4 sm:p-6 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ZonaFit Logo" className="w-10 object-contain drop-shadow-md" style={{ aspectRatio: '1664/1776' }} />
            <span className="text-xl font-bold text-white tracking-tight">ZONAFIT</span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/demo')} className="flex items-center gap-2 border-brand-primary text-brand-primary hover:bg-brand-primary/10">
              <Play size={16} fill="currentColor" />
              Explorar Demo
            </Button>
            <Button variant="ghost" onClick={() => handleInstallClick()} className="flex items-center gap-2 text-text-primary hover:text-brand-primary">
              <Download size={16} />
              {isInstalled ? 'App Instalada' : 'Instalar App'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/login')} className="flex items-center gap-2">
              <LogIn size={18} />
              Iniciar sesión
            </Button>
            <ActionGlowButton onClick={() => handleSelectPlan()} className="px-5 py-2 text-sm font-semibold h-10">
              Comenzar
            </ActionGlowButton>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ActionGlowButton onClick={() => handleSelectPlan()} className="px-3 py-1.5 text-xs font-semibold h-9">
              Comenzar
            </ActionGlowButton>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-text-primary hover:text-brand-primary bg-bg-surface/60 rounded-xl border border-border-light"
              aria-label="Abrir menú"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden mt-3 p-4 bg-bg-surface/95 backdrop-blur-xl border border-border-light rounded-2xl shadow-xl flex flex-col gap-3"
            >
              <Button variant="outline" onClick={() => { setMobileMenuOpen(false); navigate('/demo'); }} className="w-full justify-center gap-2 border-brand-primary text-brand-primary">
                <Play size={16} fill="currentColor" />
                Explorar Demo
              </Button>
              <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); handleInstallClick(); }} className="w-full justify-center gap-2 text-text-primary">
                <Download size={16} />
                {isInstalled ? 'App Instalada' : 'Instalar App (PWA)'}
              </Button>
              <Button variant="ghost" onClick={() => { setMobileMenuOpen(false); navigate('/login'); }} className="w-full justify-center gap-2">
                <LogIn size={18} />
                Iniciar sesión
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 px-4 flex flex-col items-center justify-center min-h-[85vh] text-center">
        <div className="absolute inset-0 bg-brand-primary/20 blur-[120px] rounded-full scale-150 -z-10 opacity-30 pointer-events-none max-w-lg mx-auto top-20"></div>
        
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-4xl mx-auto"
        >
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/15 border border-brand-primary/30 text-brand-primary text-sm font-medium mb-6 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse shadow-[0_0_8px_rgba(220,38,38,0.8)]"></span>
            Plataforma SaaS & PWA para Gimnasios
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-4xl sm:text-6xl md:text-7xl font-bold text-white tracking-tight leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] mb-6">
            Gestiona tu gimnasio.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-brand-primary-hover to-red-400">Todo en un solo lugar.</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="text-base sm:text-lg md:text-xl text-text-secondary max-w-2xl mx-auto font-medium mb-10 leading-relaxed drop-shadow-md">
            La herramienta definitiva para la gestión operativa, financiera y administrativa de centros fitness. Membresías, caja, ventas, fotos, WhatsApp y facturación PDF en una sola App.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <ActionGlowButton onClick={() => handleSelectPlan()} className="w-full sm:w-auto px-8 h-14 text-base font-bold shadow-[0_8px_30px_rgba(220,38,38,0.4)]">
              Probar gratis
            </ActionGlowButton>
            <Button onClick={() => navigate('/demo')} variant="outline" className="w-full sm:w-auto h-14 px-8 text-base font-semibold border-brand-primary text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 backdrop-blur-md transition-colors flex items-center gap-2 justify-center">
              <Play size={18} fill="currentColor" />
              Explorar ZonaFit Demo
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Potencia Operativa</h2>
            <p className="text-text-secondary max-w-2xl mx-auto">Controla todos los aspectos de tu gimnasio con módulos especializados diseñados para la máxima eficiencia diaria.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feat, idx) => (
              <motion.div 
                key={idx} 
                initial={{ opacity: 0, y: 30 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true, margin: "-50px" }} 
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-6 h-full flex flex-col hover:border-brand-primary/40 hover:bg-glass-highlight/5 transition-all group shadow-glass-up">
                  <div className="w-12 h-12 rounded-xl bg-glass-overlay border border-border-light flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all">
                    {feat.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feat.title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed flex-grow">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* P3.2, P3.3, P3.4 — PWA App Download / Installation Section */}
      <section id="install-section" className="py-24 px-4 relative bg-surface-darker/60 border-y border-border-light/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/30 text-brand-primary text-xs font-semibold mb-3">
              <Smartphone size={14} />
              Aplicación Multiplataforma
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Lleva ZonaFit a todos tus dispositivos</h2>
            <p className="text-text-secondary max-w-2xl mx-auto">
              ZonaFit funciona como una Progressive Web App (PWA) de alto rendimiento. Instálala en tu computador o teléfono móvil para un acceso rápido y sin descargas pesadas.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* CTA Card */}
            <div className="lg:col-span-5 flex flex-col gap-6 p-8 rounded-2xl bg-bg-surface/60 border border-border-light shadow-glass">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center">
                  <img src="/logo.png" alt="ZonaFit App" className="w-10 object-contain" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-text-primary">ZonaFit App</h3>
                  <span className="text-xs text-brand-primary font-medium">Sistema de Gestión para Gimnasios</span>
                </div>
              </div>

              <p className="text-sm text-text-secondary leading-relaxed">
                Disfruta de una experiencia fluida a pantalla completa, inicio rápido desde tu escritorio o pantalla de inicio, y sincronización en tiempo real.
              </p>

              <div className="flex flex-col gap-3">
                {isInstallable ? (
                  <ActionGlowButton onClick={handleInstallClick} className="w-full h-12 flex items-center justify-center gap-2 text-base font-bold">
                    <Download size={18} />
                    Instalar ZonaFit en este dispositivo
                  </ActionGlowButton>
                ) : isInstalled ? (
                  <Button onClick={() => window.location.assign('/app/dashboard')} className="w-full h-12 flex items-center justify-center gap-2 bg-success/20 text-success border border-success/30 hover:bg-success/30 font-bold">
                    <CheckCircle2 size={18} />
                    Aplicación Instalada (Abrir App)
                  </Button>
                ) : (
                  <ActionGlowButton onClick={() => window.location.assign('/app/dashboard')} className="w-full h-12 flex items-center justify-center gap-2 text-base font-bold">
                    <Monitor size={18} />
                    Abrir App en el Navegador
                  </ActionGlowButton>
                )}
              </div>
            </div>

            {/* Installation Step-by-Step Guide */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center gap-2 p-1 bg-bg-surface border border-border-light rounded-xl max-w-md">
                <button
                  onClick={() => setSelectedInstallPlatform('desktop')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    selectedInstallPlatform === 'desktop' ? 'bg-bg-elevated text-brand-primary shadow-xs' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Monitor size={14} />
                  Escritorio (PC/Mac)
                </button>
                <button
                  onClick={() => setSelectedInstallPlatform('android')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    selectedInstallPlatform === 'android' ? 'bg-bg-elevated text-brand-primary shadow-xs' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Smartphone size={14} />
                  Android
                </button>
                <button
                  onClick={() => setSelectedInstallPlatform('ios')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    selectedInstallPlatform === 'ios' ? 'bg-bg-elevated text-brand-primary shadow-xs' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Apple size={14} />
                  iOS (iPhone)
                </button>
              </div>

              <div className="p-6 rounded-2xl bg-bg-surface/40 border border-border-light flex flex-col gap-4">
                {selectedInstallPlatform === 'desktop' && (
                  <div className="space-y-3 text-sm text-text-secondary">
                    <h4 className="text-text-primary font-semibold flex items-center gap-2">
                      <Monitor size={16} className="text-brand-primary" />
                      Instalación en Google Chrome / Microsoft Edge (Windows & Mac)
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 pl-1">
                      <li>Abre <strong>ZonaFit</strong> en tu navegador compatible.</li>
                      <li>Haz clic en el ícono de instalación <span className="text-brand-primary font-mono font-bold">⊕</span> ubicado a la derecha en la barra de direcciones, o abre el menú de opciones (<span className="font-mono">⋮</span>).</li>
                      <li>Selecciona <strong>"Instalar ZonaFit"</strong> y confirma en el cuadro de diálogo.</li>
                      <li>¡Listo! ZonaFit se abrirá en su propia ventana dedicada como aplicación de escritorio.</li>
                    </ol>
                  </div>
                )}

                {selectedInstallPlatform === 'android' && (
                  <div className="space-y-3 text-sm text-text-secondary">
                    <h4 className="text-text-primary font-semibold flex items-center gap-2">
                      <Smartphone size={16} className="text-brand-primary" />
                      Instalación en Android (Google Chrome)
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 pl-1">
                      <li>Abre <strong>ZonaFit</strong> desde Chrome en tu teléfono.</li>
                      <li>Toca el menú de tres puntos (<span className="font-mono">⋮</span>) en la esquina superior derecha.</li>
                      <li>Selecciona la opción <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</li>
                      <li>Confirma la instalación. El acceso directo aparecerá en tu menú de aplicaciones.</li>
                    </ol>
                  </div>
                )}

                {selectedInstallPlatform === 'ios' && (
                  <div className="space-y-3 text-sm text-text-secondary">
                    <h4 className="text-text-primary font-semibold flex items-center gap-2">
                      <Apple size={16} className="text-brand-primary" />
                      Instalación en iPhone / iPad (Safari)
                    </h4>
                    <ol className="list-decimal list-inside space-y-2 pl-1">
                      <li>Abre <strong>ZonaFit</strong> en el navegador <strong>Safari</strong> de tu dispositivo iOS.</li>
                      <li>Toca el botón <strong>Compartir</strong> (el ícono de un cuadrado con una flecha hacia arriba <span className="font-mono">⎘</span>) en la barra inferior.</li>
                      <li>Desplázate hacia abajo y selecciona <strong>"Agregar al inicio"</strong> (<span className="font-mono">➕</span>).</li>
                      <li>Toca <strong>"Agregar"</strong> en la esquina superior derecha para finalizar.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-4 relative bg-surface-darker/50">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight">Por qué elegir <span className="text-brand-primary">ZonaFit</span></h2>
              <p className="text-text-secondary mb-8 text-lg">Hemos diseñado una plataforma que entiende la realidad operativa de los gimnasios modernos, eliminando la fricción diaria de la administración.</p>
              
              <div className="space-y-6">
                {benefits.map((benefit, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="mt-1 w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center shrink-0">
                      <Layers size={14} className="text-brand-primary" />
                    </div>
                    <div>
                      <h4 className="text-white font-semibold mb-1">{benefit.title}</h4>
                      <p className="text-text-muted text-sm">{benefit.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-brand-primary/10 blur-[80px] rounded-full"></div>
              <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-2 border-brand-primary/20 overflow-hidden relative z-10 aspect-video flex items-center justify-center bg-surface-dark/80">
                <img src="/logo.png" alt="Plataforma" className="w-32 opacity-80" />
                <div className="absolute bottom-4 left-4 right-4 h-24 bg-gradient-to-t from-surface-dark to-transparent"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-4 relative text-center">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Planes Comerciales</h2>
          <p className="text-text-secondary mb-12">Impulsa tu gimnasio con nuestra tecnología.</p>
          
          {isLoadingPlans ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <div className="h-96 bg-glass-overlay animate-pulse rounded-2xl"></div>
               <div className="h-96 bg-glass-overlay animate-pulse rounded-2xl"></div>
               <div className="h-96 bg-glass-overlay animate-pulse rounded-2xl"></div>
            </div>
          ) : plans && plans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-8 border-brand-primary/20 hover:border-brand-primary/50 transition-colors flex flex-col h-full">
                  <div className="mb-4">
                    <span className="px-3 py-1 bg-brand-primary/20 text-brand-primary text-xs font-bold rounded-full mb-4 inline-block">
                      {plan.billing_interval === 'YEARLY' ? 'Anual' : 'Mensual'}
                    </span>
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  </div>
                  <div className="flex items-baseline mb-4">
                    <span className="text-4xl font-black text-brand-primary tracking-tight">
                      ${plan.price.toLocaleString()}
                    </span>
                    <span className="text-text-muted ml-2">{plan.currency}</span>
                  </div>
                  {plan.description && (
                    <p className="text-text-secondary text-sm mb-8 flex-grow">{plan.description}</p>
                  )}
                  <div className="mt-auto">
                    <ActionGlowButton onClick={() => handleSelectPlan(plan.id)} className="w-full">
                      Comenzar ahora
                    </ActionGlowButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 max-w-md mx-auto p-8 border-brand-primary/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <div className="px-3 py-1 bg-brand-primary/20 text-brand-primary text-xs font-bold rounded-full">BETA</div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Acceso Temprano</h3>
              <div className="text-brand-primary text-4xl font-black tracking-tight mb-4">Próximamente</div>
              <p className="text-text-muted text-sm mb-8">Nuestros planes se están configurando. Durante la fase beta el acceso requiere registro manual.</p>
              <ActionGlowButton onClick={() => handleSelectPlan()} className="w-full">
                Únete a la lista
              </ActionGlowButton>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 relative">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-5xl mx-auto text-center"
        >
          <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 p-12 md:p-16 border-brand-primary/30 bg-gradient-to-br from-glass-overlay to-brand-primary/10 shadow-glass-large overflow-hidden relative">
            <div className="absolute inset-0 bg-brand-primary/5 backdrop-blur-[1px]"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 drop-shadow-md">Empieza a gestionar tu gimnasio con ZonaFit</h2>
              <p className="text-lg text-text-secondary mb-10 max-w-2xl mx-auto drop-shadow-sm">Únete a la plataforma tecnológica que transformará la manera en la que operas tu negocio fitness.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <ActionGlowButton onClick={() => handleSelectPlan()} className="w-full sm:w-auto px-8 h-14 text-lg font-bold shadow-[0_0_40px_rgba(220,38,38,0.5)] hover:shadow-[0_0_60px_rgba(220,38,38,0.7)] transition-shadow">
                  Crear mi gimnasio
                </ActionGlowButton>
                <Button onClick={() => navigate('/demo')} variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-semibold border-brand-primary text-brand-primary hover:bg-brand-primary/10 transition-colors flex items-center justify-center gap-2">
                  <Play size={18} fill="currentColor" />
                  Ver Demo
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-light bg-surface-darker pt-16 pb-8 px-4 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <img src="/logo.png" alt="ZonaFit Logo" className="w-8 object-contain" />
              <span className="text-lg font-bold text-white tracking-tight">ZONAFIT</span>
            </div>
            <p className="text-text-muted text-sm max-w-md">
              Software integral (SaaS & PWA) para la administración y operación de centros de acondicionamiento físico.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Plataforma</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><button onClick={() => navigate('/login')} className="hover:text-brand-primary transition-colors">Iniciar sesión</button></li>
              <li><button onClick={() => navigate('/register')} className="hover:text-brand-primary transition-colors">Crear gimnasio</button></li>
              <li><button onClick={() => handleInstallClick()} className="hover:text-brand-primary transition-colors">Descargar App</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-4">
              <li>
                <Link to="/terms" className="text-text-muted hover:text-brand-primary transition-colors text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-brand-primary transition-colors"></span>
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-text-muted hover:text-brand-primary transition-colors text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-brand-primary transition-colors"></span>
                  Política de privacidad
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto text-center text-xs text-text-muted pt-8 border-t border-border-light/50">
          &copy; {new Date().getFullYear()} ZonaFit. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
