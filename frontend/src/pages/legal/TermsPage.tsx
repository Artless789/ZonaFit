import { FileSignature } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { useNavigate } from 'react-router-dom';

export function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg-screen flex flex-col pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto w-full bg-bg-surface border border-border-light rounded-3xl p-8 sm:p-12 shadow-glass relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 space-y-8">
          <div className="flex items-center gap-4 text-brand-primary mb-6">
            <FileSignature size={32} />
            <h1 className="text-3xl font-bold text-text-primary">Términos y Condiciones</h1>
          </div>

          <div className="prose prose-invert prose-brand max-w-none text-text-secondary space-y-6">
            <p>
              Bienvenido a <strong>ZonaFit</strong>. Los siguientes Términos y Condiciones regulan el uso de nuestra plataforma y los servicios de software administrativo (SaaS) proporcionados a gimnasios y centros deportivos.
            </p>

            <h3 className="text-xl font-semibold text-text-primary mt-8 mb-4">1. Uso del Servicio</h3>
            <p>
              ZonaFit otorga una licencia limitada, no exclusiva y revocable para utilizar el software con el fin de administrar su gimnasio. El usuario (Gimnasio) se compromete a no utilizar el sistema para fines ilícitos, fraudulentos o que violen derechos de terceros.
            </p>

            <h3 className="text-xl font-semibold text-text-primary mt-8 mb-4">2. Responsabilidades de la Cuenta</h3>
            <p>
              El usuario <strong>OWNER</strong> o <strong>ADMIN</strong> es responsable de mantener la confidencialidad de sus credenciales de acceso. Cualquier acción realizada bajo su cuenta, incluyendo la asignación de roles <strong>STAFF</strong>, será responsabilidad exclusiva del Gimnasio. Recomendamos el uso de contraseñas fuertes y reportar cualquier acceso no autorizado inmediatamente.
            </p>

            <h3 className="text-xl font-semibold text-text-primary mt-8 mb-4">3. Suscripción y Pagos</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>Ofrecemos un período de prueba gratuito aplicable a los nuevos registros.</li>
              <li>Finalizado este período, el servicio requerirá una suscripción activa y pagada a través de los canales autorizados.</li>
              <li>ZonaFit se reserva el derecho de suspender el acceso si se detectan cobros fallidos o incumplimientos de pago.</li>
              <li>Puede cancelar su suscripción en cualquier momento, pero no se realizarán reembolsos por períodos ya facturados o parcialmente utilizados.</li>
            </ul>

            <h3 className="text-xl font-semibold text-text-primary mt-8 mb-4">4. Disponibilidad del Servicio</h3>
            <p>
              Haremos todos los esfuerzos comercialmente razonables para mantener el software operativo el 99.9% del tiempo. Sin embargo, ZonaFit no asume responsabilidad por interrupciones temporales causadas por mantenimiento, fallos de proveedores de internet u otros eventos de fuerza mayor.
            </p>

            <div className="bg-brand-primary/10 border border-brand-primary/20 rounded-xl p-6 mt-8">
              <p className="text-brand-primary text-sm">
                <strong>Aviso Legal Pendiente:</strong> Las presentes cláusulas son un documento de referencia técnica para preparar la plataforma y evidenciar las capacidades de arquitectura comercial (suscripciones, cancelación, limitaciones). Las condiciones comerciales exactas, políticas de devolución y responsabilidades civiles deben pasar por <strong>revisión jurídica formal</strong> en la jurisdicción aplicable antes de producción.
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
