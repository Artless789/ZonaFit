import { ShieldCheck } from 'lucide-react';
import { Button } from '@shared/ui/Button';
import { useNavigate } from 'react-router-dom';

export function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg-screen flex flex-col pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto w-full bg-bg-surface border border-border-light rounded-3xl p-8 sm:p-12 shadow-glass relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4 text-brand-primary mb-6">
            <ShieldCheck size={32} />
            <h1 className="text-3xl font-bold text-text-primary">Política de Privacidad</h1>
          </div>

          <div className="prose prose-invert prose-brand max-w-none text-text-secondary space-y-6">
            <p>
              En <strong>ZonaFit</strong>, nos tomamos muy en serio la privacidad y seguridad de los datos. Esta política explica de forma clara cómo manejamos la información en nuestra plataforma SaaS, respetando la separación de responsabilidades entre nosotros como proveedores tecnológicos y los gimnasios como administradores de datos.
            </p>

            <div className="bg-bg-elevated border border-border-medium rounded-xl p-6">
              <h3 className="text-xl font-semibold text-text-primary mb-4">1. Roles sobre los Datos</h3>
              <ul className="space-y-3 list-disc pl-5">
                <li><strong className="text-text-primary">ZonaFit (Proveedor):</strong> Actuamos como plataforma tecnológica. Aseguramos la infraestructura, pero no tomamos decisiones comerciales sobre los datos de los clientes finales.</li>
                <li><strong className="text-text-primary">El Gimnasio (Administrador):</strong> Es el dueño y responsable legal de los datos operativos de sus clientes, membresías y ventas registradas en la plataforma.</li>
                <li><strong className="text-text-primary">Cliente Final:</strong> Persona natural cuyos datos son gestionados directamente por el Gimnasio al que asiste.</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold text-text-primary mt-8 mb-4">2. Qué información procesamos</h3>
            <p>La información almacenada en ZonaFit se divide en:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Datos de la Cuenta (Gimnasios):</strong> Nombre, correo, teléfono, identificaciones tributarias y credenciales cifradas (hash).</li>
              <li><strong>Datos de Clientes del Gimnasio:</strong> Nombre, documento, teléfono, fotografía (opcional), historial de pagos y compras. Toda esta información pertenece exclusivamente al gimnasio que la registra y está protegida por aislamiento de inquilinos (Multi-Tenant).</li>
              <li><strong>Información de Pagos:</strong> No almacenamos números de tarjeta de crédito ni información bancaria completa. Utilizamos proveedores tokenizados como Wompi para las transacciones.</li>
              <li><strong>Datos Técnicos:</strong> Logs de auditoría, direcciones IP por seguridad, e información de sesión (JWT) estrictamente necesaria para la operación técnica.</li>
            </ul>

            <h3 className="text-xl font-semibold text-text-primary mt-8 mb-4">3. Seguridad y Retención</h3>
            <p>
              Toda la comunicación ocurre sobre canales cifrados (HTTPS). Empleamos políticas estrictas de control de acceso y partición de datos (RLS) en la base de datos para garantizar que ningún gimnasio pueda acceder a la información de otro.
            </p>
            <p>
              Los datos se retienen mientras la cuenta del gimnasio se mantenga activa o hasta que el administrador decida eliminarlos, sujeto a las retenciones legales aplicables de comprobantes y logs de auditoría de seguridad.
            </p>

            <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-6 mt-8">
              <p className="text-brand-primary text-sm">
                <strong>Aviso Importante:</strong> El presente texto es un modelo de referencia sobre la arquitectura técnica y privacidad de datos de la plataforma. Su validez jurídica final, así como el cumplimiento estricto con normativas (GDPR, CCPA, Ley de Protección de Datos de jurisdicciones específicas) se encuentra sujeto a revisión legal profesional.
              </p>
            </div>
          </div>

          <div className="pt-8 flex justify-end">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Volver
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
