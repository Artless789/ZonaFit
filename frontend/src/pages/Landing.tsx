import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { subscriptionService } from '../services/subscriptionService';
import { motion } from 'framer-motion';
import { Button } from '../components/shared/Button';
import { ActionGlowButton } from '../components/shared/ActionGlowButton';
import { GlassCard } from '../components/shared/GlassCard';
import { Users, CreditCard, Package, BarChart3, Settings, ShieldCheck, Zap, Layers, Bell, LogIn, Play } from 'lucide-react';

export function Landing() {
  const navigate = useNavigate();

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['availablePlans'],
    queryFn: subscriptionService.getPlans
  });

  const features = [
    { icon: <Users size={24} className="text-brand-primary" />, title: 'Gestión de Clientes', desc: 'Control completo de afiliados, historial y asistencia.' },
    { icon: <CreditCard size={24} className="text-brand-primary" />, title: 'Membresías', desc: 'Administra planes, fechas de corte y renovaciones.' },
    { icon: <Package size={24} className="text-brand-primary" />, title: 'Inventario', desc: 'Control de stock y categorías de productos físicos.' },
    { icon: <Zap size={24} className="text-brand-primary" />, title: 'Punto de Venta', desc: 'Módulo POS integrado para ventas rápidas de productos.' },
    { icon: <BarChart3 size={24} className="text-brand-primary" />, title: 'Reportes y Finanzas', desc: 'Facturación y detalle de operaciones contables.' },
    { icon: <Bell size={24} className="text-brand-primary" />, title: 'Notificaciones', desc: 'Centro de notificaciones y alertas automáticas.' },
    { icon: <Settings size={24} className="text-brand-primary" />, title: 'Configuración de Tenant', desc: 'Personaliza la información legal y visual de tu gimnasio.' },
    { icon: <ShieldCheck size={24} className="text-brand-primary" />, title: 'Auditoría', desc: 'Registro inmutable de acciones críticas del sistema.' }
  ];

  const benefits = [
    { title: 'Centralización Total', desc: 'Todo tu negocio opera desde una única fuente de verdad.' },
    { title: 'Multi-Tenant Nativo', desc: 'Aislamiento seguro de datos para tu gimnasio.' },
    { title: 'Ahorro de Tiempo', desc: 'Procesos administrativos reducidos a un par de clics.' },
    { title: 'Escalabilidad', desc: 'Preparado para crecer contigo a medida que expandes tus sedes.' }
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
      <header className="absolute top-0 w-full p-6 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="ZonaFit Logo" className="w-10 object-contain drop-shadow-md" style={{ aspectRatio: '1664/1776' }} />
            <span className="text-xl font-bold text-white tracking-tight">ZONAFIT</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/demo')} className="hidden sm:flex items-center gap-2 border-brand-primary text-brand-primary hover:bg-brand-primary/10">
              <Play size={16} fill="currentColor" />
              Explorar Demo
            </Button>
            <Button variant="ghost" onClick={() => navigate('/login')} className="hidden sm:flex items-center gap-2">
              <LogIn size={18} />
              Iniciar sesión
            </Button>
            <ActionGlowButton onClick={() => navigate('/register')} className="px-5 py-2 text-sm font-semibold h-10">
              Comenzar
            </ActionGlowButton>
          </div>
        </div>
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
            Plataforma SaaS para Gimnasios
          </motion.div>
          
          <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-bold text-white tracking-tight leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)] mb-6">
            Gestiona tu gimnasio.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-primary via-brand-primary-hover to-red-400">Todo en un solo lugar.</span>
          </motion.h1>
          
          <motion.p variants={itemVariants} className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto font-medium mb-10 leading-relaxed drop-shadow-md">
            La herramienta definitiva para la gestión operativa, financiera y administrativa de centros de acondicionamiento físico.
          </motion.p>

          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <ActionGlowButton onClick={() => navigate('/register')} className="w-full sm:w-auto px-8 h-14 text-base font-bold shadow-[0_8px_30px_rgba(220,38,38,0.4)]">
              Probar gratis
            </ActionGlowButton>
            <Button onClick={() => navigate('/demo')} variant="outline" className="w-full sm:w-auto h-14 px-8 text-base font-semibold border-brand-primary text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 backdrop-blur-md transition-colors flex items-center gap-2 justify-center">
              <Play size={18} fill="currentColor" />
              Explorar ZonaFit
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 relative">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Potencia Operativa</h2>
            <p className="text-text-secondary max-w-2xl mx-auto">Controla todos los aspectos de tu gimnasio con módulos especializados diseñados para la máxima eficiencia.</p>
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
                <GlassCard className="p-6 h-full flex flex-col hover:border-brand-primary/40 hover:bg-glass-highlight/5 transition-all group shadow-glass-up">
                  <div className="w-12 h-12 rounded-xl bg-glass-overlay border border-border-light flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(220,38,38,0.3)] transition-all">
                    {feat.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feat.title}</h3>
                  <p className="text-text-muted text-sm leading-relaxed flex-grow">{feat.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
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
              <GlassCard className="p-2 border-brand-primary/20 overflow-hidden relative z-10 aspect-video flex items-center justify-center bg-surface-dark/80">
                <img src="/logo.png" alt="Plataforma" className="w-32 opacity-80" />
                <div className="absolute bottom-4 left-4 right-4 h-24 bg-gradient-to-t from-surface-dark to-transparent"></div>
              </GlassCard>
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
                <GlassCard key={plan.id} className="p-8 border-brand-primary/20 hover:border-brand-primary/50 transition-colors flex flex-col h-full">
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
                    <ActionGlowButton onClick={() => navigate('/register')} className="w-full">
                      Comenzar ahora
                    </ActionGlowButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          ) : (
            <GlassCard className="max-w-md mx-auto p-8 border-brand-primary/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                <div className="px-3 py-1 bg-brand-primary/20 text-brand-primary text-xs font-bold rounded-full">BETA</div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Acceso Temprano</h3>
              <div className="text-brand-primary text-4xl font-black tracking-tight mb-4">Próximamente</div>
              <p className="text-text-muted text-sm mb-8">Nuestros planes se están configurando. Durante la fase beta el acceso requiere registro manual.</p>
              <ActionGlowButton onClick={() => navigate('/register')} className="w-full">
                Únete a la lista
              </ActionGlowButton>
            </GlassCard>
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
          <GlassCard className="p-12 md:p-16 border-brand-primary/30 bg-gradient-to-br from-glass-overlay to-brand-primary/10 shadow-glass-large overflow-hidden relative">
            <div className="absolute inset-0 bg-brand-primary/5 backdrop-blur-[1px]"></div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 drop-shadow-md">Empieza a gestionar tu gimnasio con ZonaFit</h2>
              <p className="text-lg text-text-secondary mb-10 max-w-2xl mx-auto drop-shadow-sm">Únete a la plataforma tecnológica que transformará la manera en la que operas tu negocio fitness.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <ActionGlowButton onClick={() => navigate('/register')} className="w-full sm:w-auto px-8 h-14 text-lg font-bold shadow-[0_0_40px_rgba(220,38,38,0.5)] hover:shadow-[0_0_60px_rgba(220,38,38,0.7)] transition-shadow">
                  Crear mi gimnasio
                </ActionGlowButton>
                <Button onClick={() => navigate('/demo')} variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-semibold border-brand-primary text-brand-primary hover:bg-brand-primary/10 transition-colors flex items-center justify-center gap-2">
                  <Play size={18} fill="currentColor" />
                  Ver Demo
                </Button>
              </div>
            </div>
          </GlassCard>
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
              Software integral (SaaS) para la administración y operación de centros de acondicionamiento físico.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Plataforma</h4>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><button onClick={() => navigate('/login')} className="hover:text-brand-primary transition-colors">Iniciar sesión</button></li>
              <li><button onClick={() => navigate('/register')} className="hover:text-brand-primary transition-colors">Crear gimnasio</button></li>
              <li><a href="#" className="hover:text-brand-primary transition-colors">Características</a></li>
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
              <li>
                <a href="#" className="text-text-muted hover:text-brand-primary transition-colors text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-brand-primary transition-colors"></span>
                  Uso de cookies
                </a>
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
