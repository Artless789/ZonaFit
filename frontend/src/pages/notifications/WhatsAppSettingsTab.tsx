import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Phone,
  RefreshCw,
  Send,
  Trash2,
  ShieldCheck,
  Building2,
  Key,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  whatsappService,
  type WhatsAppIntegration,
  type WhatsAppMetaConfig,
  type WhatsAppConnectRequest,
} from '../../services/whatsappService';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { Skeleton } from '@shared/ui/Skeleton';
import { useToast } from '@shared/ui/Toast';
import { cn } from '@shared/utils/cn';

declare global {
  interface Window {
    fbAsyncInit?: () => void;
    FB?: any;
  }
}

interface WhatsAppSettingsTabProps {
  onStatusChanged?: () => void;
}

export function WhatsAppSettingsTab({ onStatusChanged }: WhatsAppSettingsTabProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [integration, setIntegration] = useState<WhatsAppIntegration | null>(null);
  const [metaConfig, setMetaConfig] = useState<WhatsAppMetaConfig | null>(null);

  // Embedded Signup SDK state
  const [isConnectingMeta, setIsConnectingMeta] = useState(false);

  // Manual configuration drawer / collapse
  const [showManualForm, setShowManualForm] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [manualForm, setManualForm] = useState<WhatsAppConnectRequest>({
    phone_number_id: '',
    access_token: '',
    waba_id: '',
    business_id: '',
    display_phone_number: '',
    verified_name: '',
  });

  // Test Message state
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('¡Hola! Este es un mensaje de prueba enviado desde ZonaFit.');
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Disconnect modal / state
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Fetch integration and meta config
  const loadData = async () => {
    try {
      setLoading(true);
      const [integData, configData] = await Promise.all([
        whatsappService.getIntegration(),
        whatsappService.getMetaConfig(),
      ]);
      setIntegration(integData);
      setMetaConfig(configData);
    } catch {
      toast({
        type: 'error',
        title: 'Error de carga',
        message: 'No se pudo cargar la configuración de WhatsApp.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Initialize Facebook SDK for Embedded Signup
  useEffect(() => {
    if (!metaConfig?.app_id) return;

    // Listen for Meta message events containing WABA and Phone IDs
    const handleFbMessage = (event: MessageEvent) => {
      if (!event.origin.includes('facebook.com') && !event.origin.includes('meta.com')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            const { phone_number_id, waba_id } = data.data || {};
            sessionStorage.setItem('wa_embedded_phone_number_id', phone_number_id || '');
            sessionStorage.setItem('wa_embedded_waba_id', waba_id || '');
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    window.addEventListener('message', handleFbMessage);

    // If FB is already loaded
    if (window.FB) {
      try {
        window.FB.init({
          appId: metaConfig.app_id,
          cookie: true,
          xfbml: false,
          version: metaConfig.api_version || 'v22.0',
        });
      } catch {
        // ignore init errors
      }
      return () => window.removeEventListener('message', handleFbMessage);
    }

    // Load FB SDK script
    window.fbAsyncInit = () => {
      window.FB.init({
        appId: metaConfig.app_id,
        cookie: true,
        xfbml: false,
        version: metaConfig.api_version || 'v22.0',
      });
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/es_LA/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      window.removeEventListener('message', handleFbMessage);
    };
  }, [metaConfig]);

  // Launch Meta Embedded Signup Popup
  const handleLaunchEmbeddedSignup = () => {
    if (!metaConfig?.is_configured) {
      toast({
        type: 'warning',
        title: 'Configuración pendiente',
        message: 'Las credenciales maestras de Meta (App ID / Config ID) deben configurarse en el servidor.',
      });
      setShowManualForm(true);
      return;
    }

    if (!window.FB) {
      toast({
        type: 'error',
        title: 'SDK no disponible',
        message: 'El SDK de Meta aún no ha terminado de cargar. Reintenta en unos segundos.',
      });
      return;
    }

    setIsConnectingMeta(true);

    window.FB.login(
      async (response: any) => {
        if (response.authResponse?.code) {
          const code = response.authResponse.code;
          const phone_number_id = sessionStorage.getItem('wa_embedded_phone_number_id') || undefined;
          const waba_id = sessionStorage.getItem('wa_embedded_waba_id') || undefined;

          try {
            const newInteg = await whatsappService.connectEmbeddedSignup({
              code,
              phone_number_id,
              waba_id,
            });
            setIntegration(newInteg);
            sessionStorage.removeItem('wa_embedded_phone_number_id');
            sessionStorage.removeItem('wa_embedded_waba_id');
            toast({
              type: 'success',
              title: '¡WhatsApp Conectado!',
              message: `Tu número de WhatsApp ${newInteg.display_phone_number || ''} quedó vinculado exitosamente.`,
            });
            if (onStatusChanged) onStatusChanged();
          } catch (err: any) {
            toast({
              type: 'error',
              title: 'Error de vinculación',
              message: err.response?.data?.detail || 'No se pudo completar el registro de WhatsApp con Meta.',
            });
          } finally {
            setIsConnectingMeta(false);
          }
        } else {
          setIsConnectingMeta(false);
          toast({
            type: 'info',
            title: 'Registro cancelado',
            message: 'No se completó la autorización de Meta WhatsApp.',
          });
        }
      },
      {
        config_id: metaConfig.config_id,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
        },
      }
    );
  };

  // Submit Manual Credentials
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.phone_number_id.trim() || !manualForm.access_token.trim()) {
      toast({
        type: 'warning',
        title: 'Campos requeridos',
        message: 'Phone Number ID y Access Token son obligatorios.',
      });
      return;
    }

    try {
      setIsSavingManual(true);
      const newInteg = await whatsappService.connectManual(manualForm);
      setIntegration(newInteg);
      setShowManualForm(false);
      toast({
        type: 'success',
        title: 'Conexión Exitosa',
        message: 'Las credenciales de WhatsApp fueron guardadas y cifradas de forma segura.',
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Error al conectar',
        message: err.response?.data?.detail || 'No fue posible validar las credenciales.',
      });
    } finally {
      setIsSavingManual(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    try {
      setIsDisconnecting(true);
      await whatsappService.disconnect();
      setIntegration(null);
      setShowDisconnectConfirm(false);
      toast({
        type: 'info',
        title: 'WhatsApp Desconectado',
        message: 'La línea de WhatsApp de tu gimnasio fue desconectada correctamente.',
      });
      if (onStatusChanged) onStatusChanged();
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Error al desconectar',
        message: err.response?.data?.detail || 'Ocurrió un error al desconectar la cuenta.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  // Send Test Message
  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast({
        type: 'warning',
        title: 'Número requerido',
        message: 'Ingresa un número de teléfono celular con WhatsApp (ej. 3001234567).',
      });
      return;
    }

    try {
      setIsSendingTest(true);
      await whatsappService.sendTestMessage({
        to_phone: testPhone.trim(),
        message: testMsg.trim(),
      });
      toast({
        type: 'success',
        title: 'Mensaje Enviado',
        message: `Se envió el mensaje de prueba a ${testPhone}. Revisa la aplicación de WhatsApp.`,
      });
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Error al enviar mensaje',
        message: err.response?.data?.detail || 'No se pudo entregar el mensaje de prueba.',
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const isConnected = !!(integration && integration.is_active && integration.status === 'CONNECTED');

  const getQualityBadge = (rating?: string | null) => {
    switch (rating?.toUpperCase()) {
      case 'GREEN':
        return { label: 'Calidad Alta (Verde)', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
      case 'YELLOW':
        return { label: 'Calidad Media (Amarillo)', class: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
      case 'RED':
        return { label: 'Calidad Baja (Rojo)', class: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
      default:
        return { label: 'En Evaluación', class: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* ── CARD PRINCIPAL: ESTADO DE CONEXIÓN ────────────────────────── */}
      {isConnected ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6 md:p-8 backdrop-blur-sm relative overflow-hidden shadow-glass">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-xl font-bold text-text-primary">Línea Oficial Conectada</h3>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                    CONECTADO
                  </span>
                  {integration?.quality_rating && (
                    <span
                      className={cn(
                        'px-2.5 py-0.5 text-xs font-semibold rounded-full border',
                        getQualityBadge(integration.quality_rating).class
                      )}
                    >
                      {getQualityBadge(integration.quality_rating).label}
                    </span>
                  )}
                </div>
                <p className="text-text-secondary text-sm mt-1">
                  Tu gimnasio está listo para enviar notificaciones automáticas y recibos de pago a los clientes.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border-light/60">
                  <div className="flex items-center gap-2">
                    <Phone size={16} className="text-text-muted" />
                    <span className="text-xs text-text-muted">Número:</span>
                    <span className="text-sm font-semibold text-text-primary">
                      {integration?.display_phone_number || integration?.phone_number_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-text-muted" />
                    <span className="text-xs text-text-muted">Nombre:</span>
                    <span className="text-sm font-semibold text-text-primary">
                      {integration?.verified_name || 'Nombre comercial'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-text-muted" />
                    <span className="text-xs text-text-muted">ID Teléfono:</span>
                    <span className="text-xs font-mono text-text-secondary">
                      {integration?.phone_number_id}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start md:self-center">
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-2"
              >
                <Trash2 size={16} />
                <span>Desconectar</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border-light bg-bg-surface/60 p-6 md:p-8 backdrop-blur-sm relative overflow-hidden shadow-glass">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/30 text-brand-primary text-xs font-semibold mb-4">
              <ShieldCheck size={14} /> Meta Verified Embedded Signup
            </div>
            <h2 className="text-2xl font-bold text-text-primary">Conecta tu WhatsApp Business</h2>
            <p className="text-text-secondary text-sm mt-2 leading-relaxed">
              Integra tu propia línea de WhatsApp oficial con Meta Cloud API. Cada gimnasio opera de forma aislada,
              segura y con sus propias cuotas. No necesitas servidores intermedios ni configuraciones complejas.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button
                onClick={handleLaunchEmbeddedSignup}
                disabled={isConnectingMeta}
                className="px-6 py-3.5 rounded-xl font-semibold text-sm bg-[#25D366] hover:bg-[#20bd5a] text-zinc-950 flex items-center gap-3 transition-all duration-200 shadow-lg shadow-[#25D366]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnectingMeta ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Conectando con Meta...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                    </svg>
                    <span>Conectar con WhatsApp</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setShowManualForm(!showManualForm)}
                className="px-4 py-3 rounded-xl font-medium text-sm border border-border-medium hover:border-text-secondary text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
              >
                <Key size={16} />
                <span>Configuración Avanzada (Token Manual)</span>
                {showManualForm ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORMULARIO MANUAL (EXPANDIBLE) ─────────────────────────── */}
      {showManualForm && !isConnected && (
        <div className="rounded-2xl border border-border-light bg-bg-surface p-6 md:p-8 shadow-glass animate-in fade-in duration-200">
          <div className="flex items-center gap-3 mb-4">
            <Key size={20} className="text-brand-primary" />
            <h3 className="text-lg font-bold text-text-primary">Conexión Manual con Meta Cloud API</h3>
          </div>
          <p className="text-text-secondary text-xs mb-6">
            Si ya cuentas con un <strong>Phone Number ID</strong> y un <strong>System User Access Token</strong> de Meta
            Business Manager, ingrésalos aquí. Tu token se almacenará con cifrado Fernet de grado bancario.
          </p>

          <form onSubmit={handleSaveManual} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Phone Number ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="ej. 104598272901234"
                  value={manualForm.phone_number_id}
                  onChange={(e) => setManualForm({ ...manualForm, phone_number_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border-medium text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  WhatsApp Business Account ID (WABA ID)
                </label>
                <input
                  type="text"
                  placeholder="ej. 109283746592812"
                  value={manualForm.waba_id || ''}
                  onChange={(e) => setManualForm({ ...manualForm, waba_id: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border-medium text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Permanent Access Token (Meta Graph API) <span className="text-rose-400">*</span>
              </label>
              <input
                type="password"
                placeholder="EAAG..."
                value={manualForm.access_token}
                onChange={(e) => setManualForm({ ...manualForm, access_token: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border-medium text-text-primary text-sm focus:outline-none focus:border-brand-primary font-mono text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Número Visible (Display Phone)
                </label>
                <input
                  type="text"
                  placeholder="+57 300 123 4567"
                  value={manualForm.display_phone_number || ''}
                  onChange={(e) => setManualForm({ ...manualForm, display_phone_number: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border-medium text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Nombre Verificado (Verified Name)
                </label>
                <input
                  type="text"
                  placeholder="ej. Power Gym"
                  value={manualForm.verified_name || ''}
                  onChange={(e) => setManualForm({ ...manualForm, verified_name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg-elevated border border-border-medium text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <ActionGlowButton type="submit" disabled={isSavingManual}>
                {isSavingManual ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>Guardar y Cifrar Credenciales</span>
                  </>
                )}
              </ActionGlowButton>
              <button
                type="button"
                onClick={() => setShowManualForm(false)}
                className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SECCIÓN DE PRUEBA DE ENVÍO (SOLO SI ESTÁ CONECTADO) ─────── */}
      {isConnected && (
        <div className="rounded-2xl border border-border-light bg-bg-surface p-6 md:p-8 shadow-glass">
          <div className="flex items-center gap-3 mb-2">
            <Send size={20} className="text-brand-primary" />
            <h3 className="text-lg font-bold text-text-primary">Prueba de Envío en Vivo</h3>
          </div>
          <p className="text-text-secondary text-xs mb-6">
            Envía un mensaje de texto de prueba para verificar que la plantilla y la conexión con Meta estén operando
            correctamente.
          </p>

          <form onSubmit={handleSendTestMessage} className="space-y-4 max-w-xl">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Número de Celular Destino (Colombia o Internacional)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="3001234567"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-bg-elevated border border-border-medium text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                  required
                />
                <Phone size={16} className="absolute left-3.5 top-3 text-text-muted" />
              </div>
              <p className="text-text-muted text-[11px] mt-1">
                No necesitas incluir el código de país para números colombianos (ej. 300 123 4567 se normaliza automáticamente).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                Mensaje de Prueba
              </label>
              <textarea
                rows={2}
                value={testMsg}
                onChange={(e) => setTestMsg(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-bg-elevated border border-border-medium text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
              />
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={isSendingTest}
                className="px-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isSendingTest ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Enviar Mensaje de Prueba</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── MODAL DE CONFIRMACIÓN DE DESCONEXIÓN ───────────────────── */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-bg-surface border border-border-medium rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <AlertCircle size={24} />
              <h4 className="text-lg font-bold text-text-primary">¿Desconectar WhatsApp?</h4>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">
              Al desconectar la línea, tu gimnasio dejará de enviar notificaciones automáticas y recibos de pago por
              WhatsApp hasta que vuelvas a vincular una cuenta.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={isDisconnecting}
                className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="px-5 py-2 text-sm font-semibold rounded-xl bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Desconectando...</span>
                  </>
                ) : (
                  <span>Sí, Desconectar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
