import { ShieldCheck, Server, Users, CheckCircle2 } from 'lucide-react';
import { LegalHeader } from './LegalHeader';

export function PrivacyPage() {
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
                <ShieldCheck size={14} />
                <span>POLÍTICA OFICIAL DE TRATAMIENTO DE DATOS PERSONALES</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
                Política de Privacidad
              </h1>
              <p className="text-sm text-text-muted mt-2">
                Plataforma Merwil ZonaFit • Última actualización: Septiembre de 2026 • Ámbito: SaaS B2B y Aplicación Web
              </p>
            </div>

            {/* Content Body */}
            <div className="space-y-10 text-text-secondary leading-relaxed text-sm sm:text-base">
              
              {/* 1. Identificación y Alcance */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">1.</span> Identificación de la Plataforma y Alcance
                </h2>
                <p>
                  La presente Política de Tratamiento de Datos Personales regula la recolección, almacenamiento, uso, circulación y protección de la información tratada a través de la plataforma de software como servicio (SaaS) y aplicación web progresiva (PWA) denominada <strong>Merwil ZonaFit</strong> (disponible en el dominio oficial <span className="text-brand-primary font-mono">https://merwilzonafit.com</span>), operada por <strong>Merwil Company</strong> (en adelante, «Merwil ZonaFit» o la «Plataforma»).
                </p>
                <p>
                  Esta política aplica a todos los usuarios del software, incluidos los propietarios y administradores de gimnasios, clubes deportivos y centros de acondicionamiento físico (los «Gimnasios» o «Suscriptores»), sus colaboradores autorizados, así como a los datos personales de clientes finales que sean registrados en la plataforma en el marco de la prestación del servicio.
                </p>
              </section>

              {/* 2. Roles Jurídicos */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">2.</span> Roles y Responsabilidades respecto de los Datos
                </h2>
                <p>
                  Conforme a la legislación aplicable en la República de Colombia (Ley Estatutaria 1581 de 2012, Decreto 1377 de 2013 y normas concordantes), el tratamiento de datos en un modelo de Software as a Service (SaaS) B2B opera bajo una estricta delimitación de responsabilidades:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-5 rounded-2xl bg-bg-elevated/70 border border-border-medium space-y-2">
                    <div className="flex items-center gap-2 text-brand-primary font-semibold text-sm">
                      <Users size={16} />
                      <span>El Gimnasio (Responsable del Tratamiento)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-text-muted">
                      El Gimnasio o centro deportivo es el <strong>Responsable del Tratamiento</strong> de los datos personales de sus propios clientes, miembros, prospectos y empleados. Es quien decide sobre la recolección de dichos datos, determina las finalidades comerciales y contractuales, y tiene la obligación legal de recabar la autorización previa, expresa e informada de los titulares antes de incorporarlos a la plataforma.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-bg-elevated/70 border border-border-medium space-y-2">
                    <div className="flex items-center gap-2 text-brand-primary font-semibold text-sm">
                      <Server size={16} />
                      <span>Merwil ZonaFit (Encargado del Tratamiento)</span>
                    </div>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Merwil ZonaFit actúa principalmente como <strong>Encargado del Tratamiento</strong> respecto de las bases de datos de clientes y transacciones alojadas por los gimnasios. La plataforma procesa dichos datos exclusivamente por cuenta y en nombre del Gimnasio para proveer la infraestructura de software. Con respecto a los datos de registro, facturación de suscripciones y credenciales de los administradores del gimnasio, Merwil ZonaFit actúa como Responsable.
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. Categorías de Datos */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">3.</span> Categorías de Datos Tratados en el Sistema
                </h2>
                <p>
                  En cumplimiento del principio de minimización de datos, la plataforma recopila y almacena únicamente la información técnica y operativa estrictamente necesaria para la prestación del servicio:
                </p>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base">A. Datos de los Gimnasios y Cuentas de Acceso</h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Nombre comercial, razón social, número de identificación tributaria (NIT o cédula de ciudadanía), dirección física, teléfono corporativo, correo electrónico oficial, nombre completo del titular de la cuenta y usuarios designados (roles: OWNER, ADMIN, TRAINER, etc.), y credenciales de acceso almacenadas exclusivamente mediante funciones resumen criptográficas irreversibles con salting (bcrypt).
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base">B. Datos de Clientes Registrados por los Gimnasios</h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Nombres y apellidos, tipo y número de documento de identidad, teléfono celular de contacto, correo electrónico (opcional), notas operativas internas, estado y vigencia de membresías contratadas en el gimnasio, registro de asistencias y fotografía de perfil (opcional) utilizada exclusivamente por el gimnasio para validación de identidad en recepción.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base">C. Datos de Pagos y Transacciones Financieras</h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      <strong>Suscripciones a Merwil ZonaFit:</strong> Los pagos por el uso del software se procesan mediante pasarelas de pago certificadas (Wompi / Bancolombia). Merwil ZonaFit <strong>nunca almacena, transmite ni tiene acceso a números completos de tarjetas de crédito o débito, fechas de expiración ni códigos de seguridad CVV/CVC</strong>. Únicamente se conservan referencias de transacción, identificador de proveedor, estado del pago, fecha y monto.
                    </p>
                    <p className="text-xs sm:text-sm text-text-muted">
                      <strong>Pagos Internos del Gimnasio:</strong> La plataforma permite registrar de forma administrativa los pagos efectuados por los afiliados directamente en el establecimiento (método utilizado: efectivo, transferencia bancaria, etc., valor y fecha) con fines de control contable y emisión de recibos internos.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base">D. Datos Técnicos, de Seguridad y Auditoría</h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Direcciones IP de conexión para mitigación de ataques y control de seguridad, marcas temporales de eventos, registros de auditoría interna (<code className="text-xs font-mono text-brand-primary">audit_logs</code>: usuario que realizó la acción, entidad afectada, valores modificados y fecha/hora), identificadores técnicos de sesión (tokens de acceso efímeros JWT en memoria y refresh tokens almacenados en cookies seguras con atributo <code className="text-xs font-mono text-brand-primary">HttpOnly</code>).
                    </p>
                  </div>
                </div>
              </section>

              {/* 4. Integración Meta / WhatsApp */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">4.</span> Integración con Meta Platforms y WhatsApp Business Cloud API
                </h2>
                <p>
                  Merwil ZonaFit opera en calidad de <strong>Proveedor Tecnológico Independiente (Independent Tech Provider)</strong>. Cada gimnasio suscriptor que decida utilizar la funcionalidad de mensajería empresarial conecta su propia Cuenta de WhatsApp Business (WABA) y su propio número telefónico mediante el mecanismo oficial de registro integrado (Meta Embedded Signup) o mediante credenciales de API autorizadas:
                </p>

                <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                  <li>
                    <strong>Titularidad de la Cuenta:</strong> El Gimnasio es el titular exclusivo de su cuenta de WhatsApp Business, de su número telefónico y de la relación comercial directa con Meta Platforms, Inc. y con los destinatarios de los mensajes.
                  </li>
                  <li>
                    <strong>Cifrado de Credenciales:</strong> Los tokens de acceso y credenciales de integración de Meta se almacenan estrictamente cifrados en la base de datos de la plataforma mediante algoritmos de cifrado simétrico robusto (Fernet / AES).
                  </li>
                  <li>
                    <strong>Finalidad Exclusiva de Notificaciones Transaccionales:</strong> La integración está diseñada para el envío de notificaciones operativas configuradas por el gimnasio (tales como confirmaciones de pago, recibos, recordatorios de vencimiento de membresía y avisos de bienvenida). La plataforma no se utiliza para el envío de spam ni comunicaciones masivas no autorizadas.
                  </li>
                  <li>
                    <strong>Tratamiento de Mensajes y Webhooks:</strong> Merwil ZonaFit procesa eventos técnicos de estado de entrega transmitidos por Meta a través de webhooks seguros validados por firma criptográfica HMAC-SHA256 (<code className="text-xs font-mono text-brand-primary">X-Hub-Signature-256</code>). La plataforma únicamente actualiza el estado de entrega del mensaje (enviado, entregado, leído o fallido) y el nivel de calidad del número. <strong>Merwil ZonaFit no almacena ni monitorea conversaciones personales de chat ni recopila el contenido de comunicaciones privadas de los usuarios finales</strong>.
                  </li>
                  <li>
                    <strong>Desconexión y Revocación:</strong> El gimnasio puede desvincular su cuenta de WhatsApp en cualquier momento desde el panel de configuración de la plataforma, o revocar el acceso a Merwil ZonaFit directamente desde su panel de Meta Business Suite.
                  </li>
                </ul>
              </section>

              {/* 5. Finalidades del Tratamiento */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">5.</span> Finalidades del Tratamiento
                </h2>
                <p>La información tratada por Merwil ZonaFit tiene como finalidades exclusivas:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {[
                    'Suministrar, operar, mantener y optimizar el software SaaS y sus herramientas de gestión.',
                    'Autenticar usuarios, administrar sesiones y aplicar controles de acceso según el rol.',
                    'Gestionar el cobro, facturación y renovación de las suscripciones de los gimnasios.',
                    'Ejecutar las órdenes de envío de notificaciones y recordatorios emitidas por el gimnasio.',
                    'Monitorear la estabilidad técnica, prevenir accesos no autorizados y resolver incidentes.',
                    'Cumplir con las obligaciones legales, contables y tributarias vigentes.',
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-bg-elevated/40 border border-border-light text-xs sm:text-sm">
                      <CheckCircle2 size={16} className="text-brand-primary shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-text-muted pt-2">
                  <strong>Compromiso de No Comercialización:</strong> Merwil ZonaFit no vende, no alquila, no cede ni comercializa datos personales con terceros para fines publicitarios, mercadeo ajeno o elaboración de perfiles con propósitos comerciales externos.
                </p>
              </section>

              {/* 6. Bases Legales */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">6.</span> Base Jurídica y Principios del Tratamiento
                </h2>
                <p>
                  El tratamiento de datos se fundamenta en: (i) la relación contractual de prestación de servicios de software SaaS establecida con los gimnasios suscriptores; (ii) el consentimiento previo e informado que cada gimnasio debe recabar de sus clientes y personal; y (iii) el cumplimiento de obligaciones legales de carácter contable y fiscal.
                </p>
                <p>
                  Toda operación se rige por los principios rectores de legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad consagrados en el artículo 4 de la Ley 1581 de 2012 de Colombia.
                </p>
              </section>

              {/* 7. Seguridad y Aislamiento Multi-Tenant */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">7.</span> Seguridad de la Información y Aislamiento Multi-Tenant
                </h2>
                <p>
                  Merwil ZonaFit implementa salvaguardas técnicas, humanas y organizativas orientadas a proteger la confidencialidad, integridad y disponibilidad de la información:
                </p>
                <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                  <li><strong>Aislamiento Lógico por Inquilino (Multi-Tenancy con RLS):</strong> La base de datos PostgreSQL implementa políticas de seguridad a nivel de fila (Row Level Security - RLS). Cada consulta se ejecuta vinculada al identificador único de inquilino (<code className="text-xs font-mono text-brand-primary">gym_id</code>), impidiendo de manera estructural que un gimnasio pueda acceder o visualizar información de otro.</li>
                  <li><strong>Cifrado en Tránsito:</strong> Todas las comunicaciones entre navegadores, aplicaciones móviles y nuestros servidores operan obligatoriamente bajo canales cifrados mediante protocolo HTTPS / TLS.</li>
                  <li><strong>Cifrado en Reposo de Datos Sensibles:</strong> Las credenciales externas (tokens de WhatsApp/Meta) se cifran antes de su almacenamiento en base de datos. Las contraseñas de usuario son sometidas a funciones resumen hash criptográficas de una sola vía (bcrypt).</li>
                  <li><strong>Control de Sesión Robusto:</strong> Los tokens de acceso JWT se manejan en memoria del cliente para mitigar riesgos de robo por XSS, y las cookies de renovación cuentan con banderas de protección <code className="text-xs font-mono text-brand-primary">HttpOnly</code>, <code className="text-xs font-mono text-brand-primary">Secure</code> y restricciones de sitio cruzado (<code className="text-xs font-mono text-brand-primary">SameSite</code>).</li>
                </ul>
              </section>

              {/* 8. Conservación y Eliminación */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">8.</span> Conservación y Eliminación de Información
                </h2>
                <p>
                  Los datos se conservan mientras la suscripción del gimnasio se mantenga activa y durante el tiempo razonablemente necesario para las finalidades autorizadas.
                </p>
                <p>
                  Ante la solicitud de eliminación o cancelación de una cuenta, o cuando un gimnasio desactive a un cliente:
                </p>
                <ul className="space-y-2 list-disc pl-5 text-xs sm:text-sm">
                  <li>Las fotografías de perfil y credenciales se suprimen definitivamente del sistema de almacenamiento activo.</li>
                  <li>Los registros vinculados a facturas, comprobantes de pago de membresías, movimientos de caja e historial de auditoría de seguridad se conservarán bloqueados y archivados durante los plazos legalmente exigidos por el Código de Comercio y el Estatuto Tributario de Colombia para atención de eventuales requerimientos de autoridades judiciales o fiscales.</li>
                </ul>
              </section>

              {/* 9. Derechos de los Titulares */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">9.</span> Derechos de los Titulares de los Datos
                </h2>
                <p>De acuerdo con el marco legal colombiano de Habeas Data, todo titular de datos tiene derecho a:</p>
                <ul className="space-y-1.5 list-disc pl-5 text-xs sm:text-sm">
                  <li>Conocer, actualizar y rectificar sus datos personales frente a los Responsables y Encargados.</li>
                  <li>Solicitar prueba de la autorización otorgada, salvo cuando la ley la exceptúe expresamente.</li>
                  <li>Ser informado sobre el uso que se ha dado a sus datos personales.</li>
                  <li>Presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por presuntas infracciones a la ley.</li>
                  <li>Revocar la autorización y/o solicitar la supresión del dato cuando en el tratamiento no se respeten los principios y derechos constitucionales y legales.</li>
                  <li>Acceder de forma gratuita a sus datos personales que hayan sido objeto de tratamiento.</li>
                </ul>
              </section>

              {/* 10. Procedimiento para Ejercer Derechos */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">10.</span> Procedimiento para Ejercer los Derechos
                </h2>
                
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border-medium space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base">A. Para Clientes y Usuarios Finales del Gimnasio</h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Dado que el <strong>Gimnasio</strong> es el Responsable directo del Tratamiento de sus datos personales, cualquier solicitud de consulta, actualización, rectificación o supresión debe dirigirse en primer lugar ante la administración del gimnasio donde se encuentre registrado. Si el gimnasio requiere soporte técnico para ejecutar la solicitud, coordinará con Merwil ZonaFit.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border-medium space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base">B. Para Administradores de Gimnasios y Usuarios de la Plataforma</h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Los administradores pueden actualizar la información de su establecimiento directamente en el módulo de Configuración de la plataforma. Para solicitudes formales de supresión de cuenta o consultas de privacidad, pueden escribir al correo oficial: <span className="text-brand-primary font-medium">soporte@merwilzonafit.com</span> o consultar las instrucciones detalladas en nuestra página pública de <a href="/data-deletion" className="text-brand-primary underline hover:text-brand-primary/80">Eliminación de Datos</a>.
                    </p>
                  </div>
                </div>
              </section>

              {/* 11. Terceros Proveedores */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">11.</span> Terceros Proveedores y Servicios Conectados
                </h2>
                <p>
                  Para la adecuada prestación del servicio, Merwil ZonaFit se apoya en proveedores de tecnología que actúan bajo estrictas cláusulas de confidencialidad y seguridad:
                </p>
                <ul className="space-y-1.5 list-disc pl-5 text-xs sm:text-sm">
                  <li><strong>Proveedores de Infraestructura en la Nube:</strong> Servicios de alojamiento seguro de base de datos PostgreSQL y servidores de aplicación.</li>
                  <li><strong>Meta Platforms, Inc. / WhatsApp LLC:</strong> Provisión de la infraestructura de conectividad de WhatsApp Business Cloud API cuando el gimnasio activa la integración.</li>
                  <li><strong>Wompi (Bancolombia):</strong> Procesamiento y pasarela de pagos de las suscripciones a la plataforma.</li>
                </ul>
              </section>

              {/* 12. Modificaciones */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">12.</span> Modificaciones a la Política de Privacidad
                </h2>
                <p>
                  Merwil ZonaFit se reserva el derecho de modificar o actualizar esta política para reflejar cambios legales, técnicos o mejoras operativas del servicio. Cualquier actualización será publicada oportunamente en esta misma URL indicando la fecha de la última revisión.
                </p>
              </section>

              {/* 13. Contacto */}
              <section className="space-y-3 border-t border-border-light/80 pt-6">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">13.</span> Canales Oficiales de Contacto
                </h2>
                <p>
                  Para resolver inquietudes, ejercer sus derechos de Habeas Data o solicitar aclaraciones respecto a esta Política de Privacidad, puede comunicarse a través de los siguientes canales oficiales:
                </p>
                <div className="p-4 rounded-xl bg-bg-elevated/70 border border-border-medium space-y-1 text-xs sm:text-sm">
                  <p><strong className="text-text-primary">Plataforma:</strong> Merwil ZonaFit (operada por Merwil Company)</p>
                  <p><strong className="text-text-primary">Sitio Web Oficial:</strong> https://merwilzonafit.com</p>
                  <p><strong className="text-text-primary">Correo de Soporte y Privacidad:</strong> soporte@merwilzonafit.com</p>
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
