import { Trash2, CheckCircle2, MessageSquare, Lock, AlertCircle, FileText } from 'lucide-react';
import { LegalHeader } from './LegalHeader';

export function DataDeletionPage() {
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
                <Trash2 size={14} />
                <span>INSTRUCCIONES OFICIALES DE ELIMINACIÓN DE DATOS • DATA DELETION</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
                Instrucciones para la Eliminación de Datos
              </h1>
              <p className="text-sm text-text-muted mt-2">
                Merwil ZonaFit • Procedimiento oficial de supresión de datos conforme a las Políticas de Desarrolladores de Meta y el Régimen de Protección de Datos Personales
              </p>
            </div>

            {/* Content Body */}
            <div className="space-y-10 text-text-secondary leading-relaxed text-sm sm:text-base">

              {/* 1. Propósito */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">1.</span> Propósito y Alcance
                </h2>
                <p>
                  En cumplimiento de las políticas para desarrolladores de <strong>Meta Platforms, Inc.</strong> (aplicables a integraciones de WhatsApp Business Cloud API y Meta Embedded Signup) y de las normas de protección de datos personales aplicables en la República de Colombia (Ley 1581 de 2012 y Decreto 1377 de 2013), esta página informa de manera transparente cómo cualquier usuario, gimnasio o titular de datos puede solicitar la supresión de su información y la revocación de accesos en la plataforma <strong>Merwil ZonaFit</strong>.
                </p>
              </section>

              {/* 2. Quién puede solicitar la eliminación */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">2.</span> Quién Puede Solicitar la Eliminación de Datos
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-bg-elevated/70 border border-border-medium space-y-2">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base flex items-center gap-2">
                      <Lock size={16} className="text-brand-primary" />
                      Propietarios y Administradores de Gimnasios
                    </h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      El representante legal o titular de una cuenta suscriptora (rol OWNER) puede solicitar en cualquier momento la baja total de su gimnasio, la desconexión de servicios de terceros (como WhatsApp Business) y la eliminación de la base de datos operativa vinculada a su espacio de inquilino.
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-bg-elevated/70 border border-border-medium space-y-2">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base flex items-center gap-2">
                      <FileText size={16} className="text-brand-primary" />
                      Clientes Finales y Afiliados del Gimnasio
                    </h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      Dado que el <strong>Gimnasio</strong> es el <strong>Responsable del Tratamiento</strong> directo de los datos de sus afiliados, el cliente final debe presentar prioritariamente su solicitud de supresión ante la administración de su respectivo gimnasio. En caso de que el gimnasio no responda en los términos de ley o haya cesado actividades, el cliente podrá acudir a Merwil ZonaFit para intermediación técnica.
                    </p>
                  </div>
                </div>
              </section>

              {/* 3. Procedimiento Manual y Transparente */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">3.</span> Procedimiento de Solicitud Verificada
                </h2>
                <p>
                  Para salvaguardar la integridad de la información contable, fiscal y comercial de los centros deportivos y prevenir eliminaciones accidentales o malintencionadas por parte de terceros no autorizados, el borrado integral de cuentas no se realiza de forma automática instantánea mediante un botón público, sino a través de un <strong>procedimiento formal de solicitud manual y verificada</strong>.
                </p>

                <div className="space-y-3 pt-2">
                  <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-text-primary text-sm">Envío de la Solicitud por Correo Electrónico</h4>
                      <p className="text-xs sm:text-sm text-text-muted">
                        Remita un mensaje desde la dirección de correo electrónico registrada en la plataforma a la cuenta oficial de soporte: <span className="text-brand-primary font-medium">soporte@merwilzonafit.com</span> con el asunto: <strong>«Solicitud de Eliminación de Datos - [Nombre del Gimnasio o Titular]»</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-text-primary text-sm">Información Requerida para Validar la Identidad</h4>
                      <p className="text-xs sm:text-sm text-text-muted">
                        Para procesar su solicitud de forma segura, el mensaje debe contener los siguientes datos de verificación:
                      </p>
                      <ul className="list-disc pl-5 text-xs sm:text-sm text-text-muted space-y-1 pt-1">
                        <li>Nombre completo del titular o representante legal que realiza la petición.</li>
                        <li>Tipo y número de documento de identidad oficial.</li>
                        <li>Correo electrónico oficial vinculado a la cuenta en Merwil ZonaFit.</li>
                        <li>Nombre comercial y/o razón social del gimnasio.</li>
                        <li>Número de teléfono de contacto registrado en el sistema.</li>
                        <li>Descripción clara y precisa de los datos o servicios que solicita eliminar (ej. cancelación total de la cuenta del gimnasio, supresión de datos de cliente final, o revocación de tokens de WhatsApp).</li>
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/40 border border-border-light flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-brand-primary/20 text-brand-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-text-primary text-sm">Validación de Seguridad y Ejecución</h4>
                      <p className="text-xs sm:text-sm text-text-muted">
                        Nuestro equipo de soporte confirmará la coincidencia de los datos con los registros de la base de datos para corroborar la legitimidad de la solicitud y notificará la recepción dentro de las 48 horas hábiles siguientes.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* 4. Alcance: qué se elimina vs qué se conserva */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">4.</span> Alcance de la Eliminación y Retenciones Legales
                </h2>
                <p>
                  El proceso de supresión de datos diferencia claramente entre los datos de operación activa y aquellos que deben preservarse por mandato legal:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border-medium space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 size={16} />
                      <span>Datos que se Suprimen Definitivamente</span>
                    </div>
                    <ul className="space-y-1.5 list-disc pl-5 text-xs text-text-muted">
                      <li>Credenciales de acceso, contraseñas cifradas y sesiones activas.</li>
                      <li>Tokens de acceso y configuraciones de WhatsApp Business Cloud API.</li>
                      <li>Fotografías de perfil de clientes y logotipos almacenados en disco.</li>
                      <li>Perfiles de clientes inactivos y notas operativas que no estén vinculadas a comprobantes fiscales obligatorios.</li>
                      <li>Plantillas de notificaciones y configuraciones personalizadas del gimnasio.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border-medium space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                      <AlertCircle size={16} />
                      <span>Datos con Obligación de Conservación Legítima</span>
                    </div>
                    <ul className="space-y-1.5 list-disc pl-5 text-xs text-text-muted">
                      <li>Facturas, recibos de caja y comprobantes fiscales de transacciones efectivamente realizadas (conservación obligatoria según el Código de Comercio y Estatuto Tributario de Colombia).</li>
                      <li>Registros de cobros de suscripciones y pagos procesados por Wompi.</li>
                      <li>Trazas de auditoría de seguridad interna estrictamente necesarias para la prevención de fraude y respuesta ante incidentes.</li>
                    </ul>
                    <p className="text-[0.7rem] text-text-muted pt-1 italic">
                      * En estos casos, los datos son objeto de bloqueo técnico: quedan inaccesibles para fines operativos o comerciales y únicamente se conservan custodiados para atención de requerimientos de autoridades judiciales o tributarias durante los plazos legalmente fijados.
                    </p>
                  </div>
                </div>
              </section>

              {/* 5. Desconexión de WhatsApp / Meta */}
              <section className="space-y-4">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">5.</span> Desconexión Específica de Meta / WhatsApp Business
                </h2>
                <p>
                  Si el Gimnasio únicamente desea desconectar la integración de WhatsApp sin dar de baja su cuenta completa en Merwil ZonaFit, puede hacerlo de forma autónoma e inmediata mediante cualquiera de las siguientes dos opciones:
                </p>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border-light space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base flex items-center gap-2">
                      <MessageSquare size={16} className="text-brand-primary" />
                      Opción A: Desde el Panel de Merwil ZonaFit
                    </h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      1. Ingrese a la plataforma con una cuenta de rol Propietario (OWNER) o Administrador (ADMIN).<br />
                      2. Diríjase a la sección <strong>Configuración &gt; WhatsApp</strong>.<br />
                      3. Presione el botón <strong>«Desconectar Integración»</strong> y confirme la acción.<br />
                      4. El sistema invalidará inmediatamente el token de acceso, cambiará el estado de la integración a <code className="text-xs font-mono text-brand-primary">DISCONNECTED</code> y cesará todo envío de notificaciones.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-bg-elevated/50 border border-border-light space-y-1.5">
                    <h3 className="font-semibold text-text-primary text-sm sm:text-base flex items-center gap-2">
                      <Lock size={16} className="text-brand-primary" />
                      Opción B: Desde Meta Business Suite / Administrador Comercial de Meta
                    </h3>
                    <p className="text-xs sm:text-sm text-text-muted">
                      1. Inicie sesión en su panel de Meta Business Suite (<span className="font-mono text-xs text-brand-primary">business.facebook.com</span>).<br />
                      2. Diríjase a <strong>Configuración del Negocio &gt; Integraciones &gt; Apps Conectadas</strong>.<br />
                      3. Localice la aplicación de Merwil ZonaFit y seleccione <strong>«Revocar acceso»</strong> o <strong>«Eliminar»</strong>.<br />
                      4. Esto revocará de manera definitiva los permisos concedidos al token de acceso en los servidores de Meta.
                    </p>
                  </div>
                </div>
              </section>

              {/* 6. Plazos de Respuesta */}
              <section className="space-y-3">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">6.</span> Plazos de Respuesta y Notificación
                </h2>
                <ul className="space-y-1.5 list-disc pl-5 text-xs sm:text-sm">
                  <li><strong>Acuse de Recibo:</strong> Se enviará confirmación de recepción en un plazo máximo de dos (2) días hábiles posteriores al envío del correo.</li>
                  <li><strong>Trámite y Resolución:</strong> Conforme al artículo 15 de la Ley 1581 de 2012 de Colombia, las solicitudes de supresión de datos se resolverán en un término máximo de <strong>quince (15) días hábiles</strong> contados a partir del día siguiente a la recepción completa de la solicitud con los datos de validación requeridos.</li>
                  <li><strong>Constancia de Eliminación:</strong> Finalizado el procedimiento, se emitirá una constancia formal por correo electrónico confirmando la supresión o el bloqueo legal de los registros correspondientes.</li>
                </ul>
              </section>

              {/* 7. Contacto */}
              <section className="space-y-3 border-t border-border-light/80 pt-6">
                <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                  <span className="text-brand-primary">7.</span> Canal de Contacto Oficial para Asuntos de Privacidad
                </h2>
                <p>
                  Para cualquier consulta adicional relacionada con el tratamiento, supresión o seguridad de sus datos personales, puede contactar directamente a nuestro canal de soporte:
                </p>
                <div className="p-4 rounded-xl bg-bg-elevated/70 border border-border-medium space-y-1 text-xs sm:text-sm">
                  <p><strong className="text-text-primary">Plataforma:</strong> Merwil ZonaFit (operada por Merwil Company)</p>
                  <p><strong className="text-text-primary">Sitio Web:</strong> https://merwilzonafit.com</p>
                  <p><strong className="text-text-primary">Correo de Soporte y Privacidad:</strong> soporte@merwilzonafit.com</p>
                  <p><strong className="text-text-primary">Horario de Atención:</strong> Lunes a Viernes de 8:00 AM a 6:00 PM (UTC-5 / Hora de Colombia)</p>
                </div>
              </section>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
