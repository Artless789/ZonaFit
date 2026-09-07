import { FileText } from 'lucide-react';
import { LegalHeader } from './LegalHeader';

export function TermsPage() {
  return (
    <div className="min-h-screen bg-bg-screen flex flex-col text-text-primary">
      <LegalHeader />

      <main className="flex-1 py-10 sm:py-14 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto w-full bg-bg-surface border border-border-light rounded-3xl p-6 sm:p-12 shadow-glass relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

          <div className="relative z-10 space-y-10">
            {/* Header Title & Meta */}
            <div className="border-b border-border-light/80 pb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20 mb-4">
                <FileText size={14} />
                <span>CONTRATO DE SERVICIO SAAS Y CONDICIONES DE USO</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
                Términos y Condiciones
              </h1>
              <p className="text-sm text-text-muted mt-2">
                Merwil ZonaFit • Última actualización: Septiembre de 2026 • Regulado bajo las leyes de la República de Colombia
              </p>
            </div>

            {/* Content Body */}
            <div className="space-y-10 text-text-secondary leading-relaxed text-sm sm:text-base">

              {/* 1. Objeto */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">1.</span> Objeto del Servicio y Aceptación
                </h2>
                <p>
                  Los presentes Términos y Condiciones regulan el acceso, registro, suscripción y uso de la plataforma de software como servicio (SaaS) y aplicación web progresiva (PWA) denominada <strong>Merwil ZonaFit</strong> (accesible a través de <span className="text-brand-primary font-mono">https://merwilzonafit.com</span>), operada por <strong>Merwil Company</strong> (en adelante, «Merwil ZonaFit» o la «Plataforma»).
                </p>
                <p>
                  El registro en la plataforma, la activación de cuentas o el uso continuado de cualquiera de sus módulos implica la aceptación expresa, voluntaria y sin reservas de la totalidad de las cláusulas aquí estipuladas. Si no está de acuerdo con estos términos, debe abstenerse de acceder o utilizar la plataforma.
                </p>
              </section>

              {/* 2. Definiciones */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">2.</span> Definiciones
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm pt-1">
                  <div className="p-3.5 rounded-xl bg-bg-elevated/50 border border-border-light">
                    <strong className="text-text-primary block mb-1">Merwil ZonaFit / Proveedor:</strong>
                    Entidad desarrolladora y proveedora de la infraestructura tecnológica del software en la nube.
                  </div>
                  <div className="p-3.5 rounded-xl bg-bg-elevated/50 border border-border-light">
                    <strong className="text-text-primary block mb-1">Gimnasio / Suscriptor:</strong>
                    Persona natural o jurídica que contrata el servicio para la gestión operativa y comercial de su centro deportivo.
                  </div>
                  <div className="p-3.5 rounded-xl bg-bg-elevated/50 border border-border-light">
                    <strong className="text-text-primary block mb-1">Usuario Autorizado:</strong>
                    Colaborador, entrenador o administrador al que el Suscriptor otorga credenciales de acceso bajo un rol específico.
                  </div>
                  <div className="p-3.5 rounded-xl bg-bg-elevated/50 border border-border-light">
                    <strong className="text-text-primary block mb-1">Cliente Final:</strong>
                    Persona natural afiliada o usuaria del Gimnasio cuyos datos operativos son administrados por este a través del software.
                  </div>
                </div>
              </section>

              {/* 3. Registro y Cuentas */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">3.</span> Registro de Cuentas y Credenciales de Acceso
                </h2>
                <p>
                  Para acceder a la plataforma, el Suscriptor debe completar el proceso de registro proporcionando información verídica, exacta y actualizada sobre su establecimiento y su representante legal.
                </p>
                <p>
                  El Suscriptor es el único custodio y responsable de mantener la estricta confidencialidad de sus credenciales (usuario y contraseña). Cualquier acción, modificación o transacción efectuada dentro de la plataforma mediante las cuentas asignadas a su gimnasio (roles OWNER, ADMIN, TRAINER, etc.) será imputable directa y exclusivamente al Suscriptor.
                </p>
                <p>
                  El Suscriptor se compromete a notificar a Merwil ZonaFit de inmediato ante cualquier indicio de uso no autorizado, extravío o vulneración de seguridad de sus credenciales.
                </p>
              </section>

              {/* 4. Uso Permitido */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">4.</span> Licencia de Uso y Finalidades Permitidas
                </h2>
                <p>
                  Merwil ZonaFit otorga al Suscriptor una licencia de uso de software en modalidad SaaS no exclusiva, intransferible, no sublicenciable y revocable durante el período de vigencia de su suscripción o período de prueba activo.
                </p>
                <p>
                  La licencia se concede con el fin exclusivo de administrar las operaciones comerciales del gimnasio: control de clientes, venta y vigencia de membresías, gestión de caja e inventario, registro de asistencias y envío de notificaciones operativas a sus clientes autorizados.
                </p>
              </section>

              {/* 5. Usos Prohibidos */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">5.</span> Usos Prohibidos
                </h2>
                <p>Queda terminantemente prohibido al Suscriptor y a sus usuarios autorizados:</p>
                <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                  <li>Utilizar el software para actividades ilícitas, fraudulentas, engañosas o contrarias a las leyes de la República de Colombia.</li>
                  <li>Intentar descompilar, aplicar ingeniería inversa, desensamblar, modificar o intentar descubrir el código fuente de la plataforma.</li>
                  <li>Vulnerar, poner a prueba o intentar burlar los controles de seguridad, mecanismos de autenticación o el aislamiento lógico multi-tenant (Row Level Security - RLS).</li>
                  <li>Utilizar la integración de mensajería (WhatsApp / Meta) para el envío de comunicaciones masivas no solicitadas (spam), publicidad engañosa o mensajes que contravengan las Políticas de Comercio y de Mensajería de WhatsApp de Meta Platforms, Inc.</li>
                  <li>Subarrendar, vender, revender, ceder o compartir el acceso a la plataforma con terceros ajenos a la operación legítima del gimnasio suscriptor.</li>
                </ul>
              </section>

              {/* 6. Responsabilidad sobre Datos del Gimnasio */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">6.</span> Responsabilidad sobre los Datos Introducidos por el Gimnasio
                </h2>
                <p>
                  El Gimnasio declara y garantiza que cuenta con todas las autorizaciones legales previas, expresas e informadas de sus clientes finales y empleados para recopilar, almacenar y tratar sus datos personales en la plataforma Merwil ZonaFit, conforme al Régimen General de Protección de Datos Personales de Colombia (Ley 1581 de 2012).
                </p>
                <p>
                  El Gimnasio mantendrá indemne a Merwil ZonaFit, sus administradores y colaboradores frente a cualquier sanción, multa administrativa, reclamación judicial o extrajudicial motivada por la falta de autorización o por el uso indebido de los datos personales ingresados por el Gimnasio en la plataforma.
                </p>
              </section>

              {/* 7. Arquitectura Multi-Tenant */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">7.</span> Arquitectura Multi-Tenancy y Aislamiento de la Información
                </h2>
                <p>
                  Merwil ZonaFit opera bajo una arquitectura multi-tenant con aislamiento riguroso en base de datos. Cada gimnasio posee un entorno lógico aislado identificado por un <code className="text-xs font-mono text-brand-primary">gym_id</code> y gobernado por políticas a nivel de fila (RLS) en PostgreSQL.
                </p>
                <p>
                  Ningún gimnasio tiene acceso ni visibilidad sobre los datos de clientes, tarifas, ventas, inventarios ni configuraciones de otros gimnasios alojados en la plataforma.
                </p>
              </section>

              {/* 8. Planes y Suscripciones */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">8.</span> Planes Comerciales, Períodos de Prueba y Suscripciones
                </h2>
                <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                  <li><strong>Período de Prueba (Trial):</strong> Los nuevos registros pueden acceder a un período de evaluación gratuito sin costo. Al finalizar dicho plazo, el acceso operativo continuado requerirá la contratación de un plan comercial activo.</li>
                  <li><strong>Modalidades de Suscripción:</strong> La plataforma pone a disposición planes comerciales periódicos (mensual, semestral, anual o planes vitalicios según la oferta vigente publicada en el módulo de facturación).</li>
                  <li><strong>Moneda e Impuestos:</strong> Los precios se estipulan en pesos colombianos (COP) o en la moneda explícitamente indicada en la interfaz, e incluyen o desglosan los impuestos legalmente aplicables.</li>
                </ul>
              </section>

              {/* 9. Facturación y Pagos Wompi */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">9.</span> Facturación, Pasarela de Pagos (Wompi) e Impago
                </h2>
                <p>
                  El pago de las suscripciones a Merwil ZonaFit se procesa a través de la pasarela de pagos <strong>Wompi</strong> (Bancolombia). Al suministrar un medio de pago, el Suscriptor autoriza los cargos correspondientes al plan seleccionado.
                </p>
                <p>
                  <strong>Consecuencias del Impago:</strong> Si el cobro de la suscripción no puede completarse o expira el período de vigencia sin renovación, el sistema suspenderá temporalmente el acceso a los módulos operativos (clientes, ventas, facturas, notificaciones), preservando el acceso al módulo de configuración y pagos para que el Suscriptor pueda regularizar su situación.
                </p>
                <p>
                  <strong>Política de No Reembolso:</strong> Los cobros por suscripción devengados y facturados no son reembolsables en caso de cancelación anticipada voluntaria o por períodos parciales no utilizados, sin perjuicio de los derechos legales irrenunciables previstos en la legislación de protección al consumidor.
                </p>
              </section>

              {/* 10. Integraciones de Terceros */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">10.</span> Integraciones con Servicios de Terceros
                </h2>
                
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border-medium space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base">Meta Platforms / WhatsApp Business Cloud API</h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      La vinculación de WhatsApp se realiza bajo los términos, políticas de uso y tarifas de conversación establecidas directamente por Meta Platforms, Inc. El Suscriptor es el único titular de su cuenta WABA y de su número de teléfono. Merwil ZonaFit actúa únicamente como facilitador tecnológico y no asume responsabilidad por suspensiones, penalizaciones de calidad o bloqueos de cuenta dictados por Meta debido a conductas del Suscriptor. Tampoco se garantiza la entrega de mensajes en casos de fallas masivas de la red de Meta.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border-medium space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base">Pasarelas de Pago Bancarias (Wompi)</h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Las transacciones monetarias están sujetas a las condiciones de seguridad, validaciones de fraude y disponibilidad operativa de la pasarela y las entidades financieras involucradas.
                    </p>
                  </div>
                </div>
              </section>

              {/* 11. Disponibilidad */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">11.</span> Disponibilidad del Servicio y Mantenimiento
                </h2>
                <p>
                  Merwil ZonaFit implementa mejores esfuerzos técnicos y operacionales comercialmente razonables para procurar la disponibilidad continua y la estabilidad del software.
                </p>
                <p>
                  No obstante, por tratarse de un servicio en la nube que depende de redes de internet, centros de datos y proveedores externos, <strong>no se garantiza una disponibilidad ininterrumpida del 100% ni la ausencia absoluta de errores transitorios</strong>. Merwil ZonaFit podrá programar ventanas de mantenimiento técnico preventivo y actualizaciones de seguridad, procurando notificar previamente cuando sea factible.
                </p>
              </section>

              {/* 12. Propiedad Intelectual */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">12.</span> Propiedad Intelectual
                </h2>
                <p>
                  Todos los derechos de propiedad intelectual, marcas, logotipos, nombres comerciales, código fuente, algoritmos, arquitectura técnica, interfaces visuales y documentación de <strong>Merwil ZonaFit</strong> pertenecen de forma exclusiva a <strong>Merwil Company</strong>. La suscripción no otorga ningún derecho de propiedad ni titularidad sobre el software, sino una licencia de uso limitada.
                </p>
                <p>
                  El Suscriptor conserva en todo momento la propiedad exclusiva sobre sus propias marcas comerciales y sobre los datos operativos que introduzca en su espacio de inquilino.
                </p>
              </section>

              {/* 13. Suspensión y Terminación */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">13.</span> Suspensión y Terminación del Servicio
                </h2>
                <p>
                  Merwil ZonaFit podrá suspender o cancelar de forma inmediata el acceso a la cuenta del Suscriptor ante:
                </p>
                <ul className="space-y-1.5 list-disc pl-5 text-xs sm:text-sm">
                  <li>Incumplimiento grave o reiterado de los presentes Términos y Condiciones.</li>
                  <li>Mora o falta de pago de las tarifas de suscripción aplicables.</li>
                  <li>Uso de la plataforma para fines fraudulentos, actividades ilícitas o conductas que pongan en riesgo la seguridad de la infraestructura o de otros usuarios.</li>
                </ul>
              </section>

              {/* 14. Limitación de Responsabilidad */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">14.</span> Limitación de Responsabilidad
                </h2>
                <p>
                  Merwil ZonaFit provee una herramienta tecnológica de gestión operativa y no asume responsabilidad alguna por las decisiones comerciales, contables, tributarias, laborales o de control físico de acceso adoptadas por el Gimnasio.
                </p>
                <p>
                  En ningún caso Merwil ZonaFit será responsable por lucro cesante, pérdidas de ingresos, daño emergente indirecto o interrupción de negocios del Suscriptor derivados del uso o imposibilidad de uso del software. La responsabilidad máxima acumulada de Merwil ZonaFit frente al Suscriptor por cualquier concepto se limitará al monto total efectivamente pagado por el Suscriptor a la plataforma durante los últimos tres (3) meses de servicio anteriores al hecho generador del reclamo.
                </p>
              </section>

              {/* 15. Modificaciones */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">15.</span> Modificaciones a los Términos
                </h2>
                <p>
                  Merwil ZonaFit podrá revisar y modificar estos Términos y Condiciones en cualquier momento. Los cambios sustanciales serán informados a través de la plataforma o mediante correo electrónico. La continuidad en el uso del servicio tras la publicación de las modificaciones constituirá la plena aceptación de las mismas.
                </p>
              </section>

              {/* 16. Ley Aplicable */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">16.</span> Legislación Aplicable y Jurisdicción
                </h2>
                <p>
                  Estos Términos y Condiciones se rigen e interpretan conforme a las leyes de la República de Colombia. Cualquier diferencia o controversia que surja entre las partes se procurará resolver de común acuerdo en una etapa de arreglo directo no superior a treinta (30) días calendario. En caso de no alcanzarse acuerdo, la controversia se someterá a la jurisdicción ordinaria de los jueces de la República de Colombia.
                </p>
              </section>

              {/* 17. Contacto */}
              <section className="space-y-3 border-t border-border-light/80 pt-6">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">17.</span> Información de Contacto
                </h2>
                <p>
                  Para consultas, aclaraciones o soporte técnico en relación con los presentes Términos y Condiciones, puede dirigirse a:
                </p>
                <div className="p-4 rounded-xl bg-bg-elevated/70 border border-border-medium space-y-1 text-xs sm:text-sm">
                  <p><strong className="text-text-primary">Plataforma:</strong> Merwil ZonaFit (operada por Merwil Company)</p>
                  <p><strong className="text-text-primary">Sitio Web:</strong> https://merwilzonafit.com</p>
                  <p><strong className="text-text-primary">Correo de Contacto:</strong> soporte@merwilzonafit.com</p>
                  <p><strong className="text-text-primary">Jurisdicción:</strong> República de Colombia</p>
                </div>
              </section>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
