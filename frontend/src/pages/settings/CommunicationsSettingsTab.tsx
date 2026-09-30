import { GlassPanel } from '@shared/ui/GlassPanel';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { Link } from 'react-router-dom';
import { 
  MessageCircle, 
  ShieldCheck, 
  Zap, 
  DollarSign, 
  ArrowUpRight, 
  BellRing,
  Smartphone
} from 'lucide-react';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';

export function CommunicationsSettingsTab() {
  const events = [
    {
      id: 'membership_expiry',
      title: 'Vencimiento de Membresía',
      description: 'Envía recordatorios automáticos de renovación con el monto y fecha exacta.',
      type: 'Recordatorio',
      badge: 'Automático',
    },
    {
      id: 'payment_receipt',
      title: 'Comprobante de Pago',
      description: 'Envía el recibo digital con el desglose del abono o pago completo de la cuota.',
      type: 'Financiero',
      badge: 'Transaccional',
    },
    {
      id: 'cxc_reminder',
      title: 'Cobro de Cuentas por Cobrar (CxC)',
      description: 'Recuerda saldos pendientes de crédito de manera cordial y directa.',
      type: 'Cobranza',
      badge: 'Operativo',
    },
    {
      id: 'client_welcome',
      title: 'Bienvenida al Gimnasio',
      description: 'Mensaje institucional de inicio con recomendaciones de entrenamiento.',
      type: 'Fidelización',
      badge: 'Relacional',
    },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Panel 1: Motor Directo WhatsApp */}
      <GlassPanel
        index="01"
        eyebrow="ARQUITECTURA DE MENSAJERÍA"
        title="WhatsApp Web Directo & Seguro"
        description="Sistema de mensajería nativo sin intermediarios costosos ni proveedores externos que comprometan la privacidad."
        action={
          <StatusBadge status="active" label="OPERATIVO // DIRECTO" mode="pill" size="sm" />
        }
        rounded="2xl"
        padding="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 text-xs">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold font-mono text-[11px] uppercase tracking-wider">
              <ShieldCheck size={16} />
              <span>Privacidad Total</span>
            </div>
            <p className="text-text-secondary leading-relaxed">
              Los mensajes se disparan desde tu navegador directo a WhatsApp Web. Ninguna conversación pasa por servidores de terceros.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border-light bg-surface-raised/40 text-xs">
            <div className="flex items-center gap-2 text-brand-primary font-semibold font-mono text-[11px] uppercase tracking-wider">
              <DollarSign size={16} />
              <span>Cero Costo Adicional</span>
            </div>
            <p className="text-text-secondary leading-relaxed">
              Sin tarifas por mensaje, sin suscripciones a APIs pagas como Twilio o Meta BSP. Envío 100% ilimitado con tu propia línea.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 p-4 rounded-xl border border-border-light bg-surface-raised/40 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-semibold font-mono text-[11px] uppercase tracking-wider">
              <Zap size={16} />
              <span>Plantillas Dinámicas</span>
            </div>
            <p className="text-text-secondary leading-relaxed">
              Sustitución en tiempo real de <code className="text-amber-300 font-mono text-[10px]">&#123;client_name&#125;</code>, <code className="text-amber-300 font-mono text-[10px]">&#123;plan_name&#125;</code> y fechas de vencimiento.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border-medium bg-surface-base/60 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <MessageCircle size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Gestión Centralizada de Plantillas y Difusión
              </p>
              <p className="text-xs text-text-muted">
                Personaliza los textos de cada evento y administra tus grupos de difusión.
              </p>
            </div>
          </div>

          <Link to="/notifications">
            <ActionGlowButton className="gap-2 shrink-0">
              <span>Ir a Comunicaciones</span>
              <ArrowUpRight size={15} />
            </ActionGlowButton>
          </Link>
        </div>
      </GlassPanel>

      {/* Panel 2: Eventos del Sistema Integrados */}
      <GlassPanel
        index="02"
        eyebrow="EVENTOS DEL FLUJO OPERATIVO"
        title="Canales de Notificación Activos"
        description="Eventos que cuentan con integración nativa para preparación y envío rápido de mensajes por WhatsApp."
        rounded="2xl"
        padding="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="flex items-start justify-between gap-3 p-4 rounded-xl border border-border-light bg-surface-raised/30 hover:border-border-medium transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-raised border border-border-light flex items-center justify-center shrink-0 mt-0.5">
                  <BellRing size={16} className="text-brand-primary" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-text-primary">{ev.title}</span>
                    <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-base border border-border-light text-text-muted">
                      {ev.badge}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {ev.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-3.5 rounded-xl border border-border-light bg-surface-base/40 text-xs text-text-muted mt-2">
          <div className="flex items-center gap-2">
            <Smartphone size={15} className="text-brand-primary" />
            <span>Compatible con WhatsApp Web en PC, Mac y navegadores móviles de tablet o celular.</span>
          </div>
          <Link
            to="/notifications"
            className="text-brand-primary hover:underline font-mono text-[11px] uppercase tracking-wider flex items-center gap-1"
          >
            <span>Ver historial</span>
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </GlassPanel>
    </div>
  );
}
