# MERWIL ZONAFIT — PRODUCT & FEATURE GAP ANALYSIS

> **Documento:** Auditoría Funcional, Análisis de Brechas y Roadmap Estratégico de Producto  
> **Fecha:** 29 de Septiembre de 2026  
> **Sistema:** Merwil ZonaFit / MerwilFit  
> **Entorno:** Producción / Core SaaS  
> **Objetivo:** Radiografía técnica y funcional exhaustiva del software actual, análisis de mercado competitivo y propuesta estructurada de evolución hacia ZonaFit V2.

---

## 1. Estado actual del producto

Merwil ZonaFit es una solución SaaS vertical para la gestión operativa y financiera de gimnasios y centros de acondicionamiento físico. El software cuenta con una base sólida, moderna y de grado de producción:

- **Backend:** FastAPI (Python 3.14), SQLAlchemy 2.0, PostgreSQL con Row Level Security (RLS) multi-tenant nativo por `gym_id`, migraciones Alembic, autenticación JWT con Refresh Tokens rotativos y almacenamiento híbrido DB-Cache para multimedia.
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4 con sistema de diseño espacial (Spatial SaaS V2 / Liquid Glass), TanStack React Query v5, PWA (Progressive Web App) con Service Worker y soporte offline selectivo.
- **Finanzas y POS:** Control estricto de Caja (aperturas, cierres arqueados con desglose multimoneda/transferencias, notas de cierre), POS de inventario con ventas de contado y a crédito, Cuentas por Cobrar (cartera con abonos transaccionales) y emisión de Comprobantes Internos en PDF.
- **Suscripciones de Plataforma:** Módulo Superadmin con pasarela Wompi para suscripciones SaaS de los gimnasios clientes, planes y control de periodos de prueba (*Trial*).

**Diagnóstico General de Madurez:**
El core administrativo-financiero (Caja, POS, Clientes, Membresías, Cobranza) está consolidado y probado (359/359 tests pasando). Sin embargo, el producto se encuentra actualmente concentrado en la **gestión hacia adentro (staff/recepción)** y presenta una brecha importante en la **gestión hacia afuera (fidelización, retención, experiencia del socio y control de accesos)**.

---

## 2. Funcionalidades actuales verificadas [COMPLETA]

Todas las funcionalidades listadas a continuación fueron verificadas en código de punta a punta: Base de Datos $\rightarrow$ Backend $\rightarrow$ API $\rightarrow$ Frontend $\rightarrow$ Usuario.

1. **Gestión de Clientes 360°:**
   - Alta con validación de documento único por gimnasio (`uq_client_gym_document`).
   - Edición de información, notas operativas internas y número de WhatsApp con normalización `+57`.
   - Carga y visualización de fotografía de perfil con almacenamiento binario en PostgreSQL (`BYTEA`) y caché local auto-regenerable.
   - Drawer de Cliente 360° con 3 pestañas: Resumen (estado actual), Historial de Membresías y Resumen Financiero consolidado.
   - Importación masiva de clientes desde archivos Excel (`.xlsx`) con previsualización, detección de duplicados y asignación de grupo de WhatsApp.
2. **Catálogo de Planes y Membresías:**
   - Creación de planes de membresía con nombre, descripción, precio y duración en días (`duration_days`).
   - Asignación de membresías con fecha de inicio, fecha de fin calculada automáticamente, precio base, descuento monetario y precio final.
   - Soporte para campo libre de entrenador asignado (`trainer_name`).
3. **Punto de Venta (POS) e Inventario:**
   - Categorías de productos y catálogo con SKU, precio de costo, precio de venta, stock actual y stock mínimo.
   - Carrito POS interactivo con búsqueda en vivo, selector de cliente y cálculo automático de totales.
   - Ventas de Contado (efectivo, tarjeta, transferencia) con decremento atómico de inventario.
   - Ventas a Crédito con generación automática de registro en Cuentas por Cobrar (`accounts_receivables`) y cálculo de saldos.
4. **Cuentas por Cobrar (Cartera / Créditos):**
   - Panel dedicado con métricas de Cartera Total, Cartera Vencida y Clientes Morosos.
   - Tabla paginada y filtrable de créditos pendientes con cálculo dinámico de días de mora.
   - Drawer de detalle del crédito con historial de abonos y modal transaccional de pagos (`POST /accounts-receivables/{id}/pay`).
   - Integración automática con movimientos de Caja al recibir abonos.
5. **Caja y Control de Efectivo:**
   - Apertura obligatoria de caja con balance inicial.
   - Bloqueo de apertura duplicada (solo una caja activa por gimnasio).
   - Registro automático de movimientos de caja por ventas POS, membresías y abonos de cartera.
   - Cierre de caja con balance contado, conciliación de pagos (efectivo, transferencias, datáfono), cálculo de diferencia (cuadre/faltante/sobrante) y almacenamiento persistente de `closing_notes`.
   - Historial de cierres de caja con consulta retrospectiva.
6. **Comprobantes de Pago (Invoices):**
   - Generación automática de comprobante interno consecutivo al completar una venta o cobro de membresía.
   - Generación de PDF en el navegador vía `jspdf` y `jspdf-autotable` con datos fiscales del gimnasio, desglose de ítems, totales y notas legales.
7. **Comunicaciones y WhatsApp:**
   - Pestaña de Grupos de WhatsApp con administración de enlaces de invitación comunitarios por gimnasio.
   - Integración nativa con WhatsApp Web (`https://web.whatsapp.com/send` / `https://wa.me/`) mediante `useWhatsAppWeb`.
   - Plantillas predefinidas y personalizadas para Vencimiento de Membresía, Membresía Vencida, Cobro de Cartera, Pago Recibido y Bienvenida.
   - Registro en auditoría al disparar un mensaje de comunicación.
8. **Seguridad, Personal y Auditoría:**
   - Gestión de empleados y usuarios del gimnasio con roles `OWNER`, `ADMIN`, `STAFF`.
   - Log de auditoría inmutable (`audit_logs`) que registra creación, actualización y borrado de recursos con IP, usuario y payload.
   - Configuración institucional del gimnasio (NIT, régimen, teléfonos, dirección, notas de pie de recibo).
9. **Superadmin y Facturación SaaS de la Plataforma:**
   - Panel de control para el dueño de Merwil ZonaFit para monitorear gimnasios registrados, métricas agregadas y suscripciones.
   - Pasarela de pagos Wompi integrada con Webhook de confirmación de eventos (`APPROVED`, `DECLINED`) y cálculo de firmas de integridad HMAC SHA-256.

---

## 3. Funcionalidades parciales [PARCIAL]

Funcionalidades que operan pero tienen limitaciones funcionales o técnicas que impiden considerarlas completas:

1. **Dashboard Empresarial:**
   - *Lo que tiene:* KPIs diarios de ventas, ingresos mensuales, clientes activos, cartera pendiente y lista de membresías por vencer (7 días). Drawer de detalle de ingresos con desglose por concepto y método de pago.
   - *Lo que le falta:* No registra egresos ni gastos operativos (arriendo, servicios, nómina), por lo que no puede calcular margen ni utilidad neta. No incluye gráficas de tendencia histórica anual ni cohortes de retención de clientes.
2. **Entrenadores / Asignación de Personal:**
   - *Lo que tiene:* Campo de texto plano `trainer_name` en la tabla `memberships` y visualización en tarjetas/drawers.
   - *Lo que le falta:* No existe una entidad `Trainer` o relación con la tabla `users`. No permite calcular comisiones por entrenador, ni filtrar reportes por entrenador, ni asignar límites de clientes por entrenador.
3. **Control de Membresías y Vigencias:**
   - *Lo que tiene:* Fecha de inicio y fin fijas basadas en `duration_days`.
   - *Lo que le falta:* No contempla pausas, extensiones por fuerza mayor ni congelamientos automáticos.
4. **Comunicaciones:**
   - *Lo que tiene:* Disparo semi-manual abriendo una ventana de WhatsApp Web con texto pre-formateado.
   - *Lo que le falta:* No cuenta con un worker programado en segundo plano (cron/daemon) que envíe notificaciones automáticas desatendidas a las 8:00 AM mediante la API Oficial de WhatsApp Cloud/Meta.

---

## 4. Funcionalidades backend sin UI [BACKEND SIN UI]

Funcionalidades que están completamente programadas, migradas y probadas en el backend, pero **no tienen ninguna página, tabla o botón en el frontend**:

1. **Módulo Completo de Reportes Analíticos (`/reports/*`):**
   - `GET /reports/sales`: Reporte general de ventas totales e ingresos acumulados.
   - `GET /reports/sales-by-date`: Ventas agrupadas por rango de fechas personalizadas.
   - `GET /reports/sales-by-client`: Ranking de clientes por volumen de compras y dinero gastado.
   - `GET /reports/top-products`: Ranking de productos más vendidos en unidades e ingresos.
   - `GET /reports/low-stock`: Alerta de productos con stock por debajo del mínimo configurado.
   - `GET /reports/payments-by-method`: Desglose financiero por medios de pago.
   - `GET /reports/memberships-expiring`: Listado parametrizable de membresías por vencer a $N$ días.
   - *Estado:* En el backend existe el router [`reports.py`](file:///C:/Dev/ZonaFit/backend/app/routers/reports.py) y el servicio [`report_service.py`](file:///C:/Dev/ZonaFit/backend/app/services/report_service.py). En el frontend **no existe la ruta `/reports` ni enlace en la barra de navegación lateral**.
2. **Kardex y Movimientos de Inventario (`/inventory-movements`):**
   - El modelo [`inventory_movement.py`](file:///C:/Dev/ZonaFit/backend/app/models/inventory_movement.py) y el router [`inventory_movements.py`](file:///C:/Dev/ZonaFit/backend/app/routers/inventory_movements.py) permiten registrar entradas de mercancía, salidas, ajustes de inventario y motivos de merma.
   - *Estado:* El frontend solo muestra el stock actual en `InventoryTable.tsx`, sin permitir ver el historial de entradas/salidas ni registrar compras a proveedores.
3. **Filtros Avanzados de Auditoría:**
   - El backend soporta filtrado de logs por rango de fechas, usuario específico y entidad afectada. El frontend solo expone una tabla cronológica simple.

---

## 5. Funcionalidades UI sin backend [UI SIN BACKEND]

Componentes visuales o mockups en el frontend que no tienen persistencia real ni soporte en API:

1. **Modo Demo Interceptor (`frontend/src/demo/`):**
   - Simula generación de métricas de reportes y compras ficticias en memoria para usuarios no registrados en la landing page.
2. **Promociones y Descuentos en POS:**
   - La interfaz del POS tiene capacidad de mostrar campos de descuento, pero el motor de promociones automáticas por reglas de negocio no existe en el backend.

---

## 6. Investigación de mercado

Análisis comparativo de plataformas de gestión fitness en Latinoamérica y Colombia:

| Producto | Funcionalidad Clave | Qué resuelve | ¿ZonaFit la tiene? | Dificultad Estimada | Valor Potencial |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GymFlow** | Control de acceso por código QR dinámico desde celular del socio | Elimina torniquetes costosos y agiliza recepción en horas pico | **NO** | Media | **Muy Alto** |
| **GymFlow** | Automatización de recordatorios de vencimiento vía WhatsApp | Recupera entre un 15% y 25% de socios antes de que venzan (afirmación comercial del proveedor) | **Parcial** (Manual) | Baja | **Muy Alto** |
| **GymGestión** | Builder visual de rutinas y ejercicios para el cliente | Aumenta el valor percibido del gimnasio y el engagement del entrenador | **NO** | Alta | **Medio** |
| **GymGestión** | Débito recurrente automático con pasarelas locales | Reduce la morosidad y elimina la necesidad de cobrar presencialmente | **NO** (Solo SaaS interno) | Alta | **Alto** |
| **Trainingym** | Algoritmo predictivo de abandono (*Churn Alert*) basado en asistencia | Detecta socios en riesgo cuando bajan su frecuencia semanal | **NO** | Media | **Muy Alto** |
| **Trainingym** | App del socio con reserva de clases dirigidas y aforo | Controla la sobrepoblación en salas de spinning o pilates | **NO** | Alta | **Medio** |
| **GridPOS (Col)** | Sistema POS integrado con facturación POS y tirilla rápida | Rapidez extrema en mostrador para venta de bebidas y suplementos | **SÍ** (Consolidado) | Ya implementado | Core |
| **GridPOS (Col)** | Cobranza de cartera con link de pago WhatsApp | Facilita que el socio pague su deuda desde casa sin ir al gym | **Parcial** | Media | **Alto** |
| **ProGym Cloud** | Integración con molinetes / torniquetes físicos y biometría | Control estricto anti-fraude en gimnasios de alto tráfico | **NO** | Muy Alta (Hardware) | **Bajo** (Gama alta) |
| **Crossfy** | Gestión de cupos por clase con lista de espera automática | Elimina la gestión caótica de reservas en grupos de chat | **NO** | Media-Alta | **Medio** |

---

## 7. Matriz completa de gaps

| Área Funcional | Estado Actual ZonaFit | Qué falta para completar | Valor Negocio | Complejidad | Dependencias Clave |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **A. CRM / Leads** | `[NO EXISTE]` | Tabla `leads`, embudo de estados, botón "Convertir a Cliente" | **Alto** | Media | `clients` |
| **B. Asistencia / Check-in** | `[NO EXISTE]` | Tabla `attendances`, validación de entrada, widget recepción | **Muy Alto** | Baja-Media | `clients`, `memberships` |
| **C. Centro de Renovaciones** | `[PARCIAL]` | Vista unificada de vencimientos con acciones masivas WhatsApp | **Muy Alto** | Baja | `memberships`, `communications` |
| **D. Reservas y Clases** | `[NO EXISTE]` | Módulos de clases, instructores, cupos y reservas | **Medio** | Alta | `users`, `clients` |
| **E. Retención / Churn** | `[NO EXISTE]` | Regla determinística de score de riesgo (asistencia + días fin) | **Muy Alto** | Baja | Asistencia (Área B) |
| **F. Portal del Socio** | `[NO EXISTE]` | Vista PWA móvil para cliente (QR, carnet, estado cuenta) | **Muy Alto** | Media | Auth Cliente, Área B |
| **G. Dashboard Empresarial** | `[PARCIAL]` | Módulo de egresos/gastos y exponer los reportes ocultos | **Alto** | Baja-Media | `/reports/*` existentes |
| **H. Entrenadores / Rutinas** | `[NO EXISTE]` | Catálogo de entrenadores y asignación de rutinas básicas | **Medio** | Alta | `users`, Portal Socio |
| **I. Control Acceso QR** | `[NO EXISTE]` | Generador de QR para socio y lector con webcam en recepción | **Muy Alto** | Baja-Media | Área B |
| **J. Congelamientos** | `[NO EXISTE]` | Tabla `membership_freezes` y extensión automática de `end_date` | **Alto** | Baja | `memberships` |
| **K. Referidos** | `[NO EXISTE]` | Campo `referred_by_client_id` y cupón de descuento automático | **Medio-Alto**| Baja | `clients`, `memberships` |
| **L. Fidelización / Puntos** | `[NO EXISTE]` | Rachas de asistencia y mensajes de logro automáticos | **Bajo-Medio**| Media | Área B |
| **M. Facturación Electrónica**| `[NO EXISTE]` | Integración API con Proveedor Tecnológico DIAN (Factus/Siigo)| **Medio** | Alta | `invoices`, `gym_settings` |
| **N. Mantenimiento Equipos** | `[NO EXISTE]` | Registro de máquinas y alertas de lubricación/reparación | **Bajo** | Baja | Ninguna |
| **O. Multi-Sede** | `[PARCIAL]` | Concepto de `Branch` dentro de un mismo `gym_id` | **Medio** | Muy Alta | Arquitectura Multi-tenant |
| **P. IA Administrativa** | `[NO EXISTE]` | Generación asistida de copies de reenganche para WhatsApp | **Medio** | Baja | `communications` |

---

## 8. CRM / Leads

### Diagnóstico
En la base de datos actual no existe el concepto de prospecto. La tabla `clients` exige obligatoriamente número de documento de identidad (`document`), tipo de documento y nombre completo, además de imponer una restricción única por gimnasio.
En el mundo real, un lead que escribe por Instagram o WhatsApp solo entrega su nombre y número telefónico. Intentar registrarlo como cliente falla inmediatamente por restricciones de base de datos.

### Qué falta
1. Modelo `Lead` con: `id`, `gym_id`, `full_name`, `phone`, `email`, `source` (`WHATSAPP`, `INSTAGRAM`, `FACEBOOK`, `WALK_IN`, `REFERRAL`), `status` (`NUEVO`, `CONTACTADO`, `VISITA_AGENDADA`, `CLASE_CORTESIA`, `CONVERTIDO`, `DESCARTADO`), `notes`, `next_contact_date`, `created_at`.
2. Pipeline Kanban o vista de embudo en frontend.
3. Botón de 1-clic: **"Convertir a Cliente"**, que abre el formulario de registro de cliente con los datos ya pre-rellenados.

---

## 9. Asistencia / Check-in

### Diagnóstico
La política de privacidad y los términos de servicio ya contemplan el tratamiento de datos para el *control de asistencia*, pero no existe tabla en la base de datos, ni endpoints, ni interfaz de registro.

### Qué podemos construir sin hardware especializado
Un sistema de check-in 100% digital basado en navegador:
1. **En Recepción (Modo Kiosco / Mostrador):**
   - Campo numérico gigante de digitación rápida de documento de identidad (`Enter` para marcar entrada).
   - Opcionalmente, activación de la cámara de la tablet/computador usando la librería nativa del navegador `html5-qrcode` para escanear el carnet del socio.
2. **Validación Instantánea en Servidor (`POST /attendances/check-in`):**
   - Consulta el estado de la membresía del cliente:
     - **VERDE:** Membresía Activa. Muestra en pantalla grande la foto del cliente, su nombre, plan y días restantes.
     - **AMARILLO:** Membresía por vencer en $\le 3$ días o saldo pendiente de cartera. Muestra alerta amigable y permite pasar.
     - **ROJO:** Membresía Vencida o Inexistente. Emite sonido de bloqueo y ofrece al recepcionista un botón directo para **"Renovar Membresía"**.
3. **Métricas en Vivo:**
   - Contador de aforo en tiempo real (personas que ingresaron en las últimas 2 horas).
   - Detección de horas pico para sugerir al dueño horarios de refuerzo de entrenadores.

---

## 10. Renovaciones

### Diagnóstico
ZonaFit cuenta actualmente con todas las piezas clave dispersas:
- El dashboard lista las 10 membresías que vencen en los próximos 7 días.
- El servicio oculto `/reports/memberships-expiring` permite listar vencimientos a $N$ días.
- Existen plantillas de WhatsApp para vencimiento próximo y vencimiento expirado.

### Qué nos separa de un verdadero "Renewal Center"
Falta únicamente la **pantalla integradora**:
Una pestaña dedicada en el módulo de Membresías llamada **"Centro de Renovaciones"** con filtros segmentados:
- Vencen hoy (Acción urgente).
- Vencen en 3 días (Recordatorio preventivo).
- Vencieron hace menos de 7 días (Recuperación caliente).
- Vencieron hace más de 30 días (Campaña de reactivación con descuento).

Cada fila con botón de acción directa: **"Enviar WhatsApp de Renovación"** y **"Renovar Ahora"** (abre el drawer precargado con el plan anterior del cliente).

---

## 11. Reservas y Clases

### Diagnóstico
Inexistente en la versión actual. Solo existe el atributo libre `trainer_name` en la membresía.

### Análisis de Necesidad
- Para un gimnasio convencional de pesas y cardio de musculación libre, las reservas no son críticas.
- Para estudios de spinning, crossfit, yoga o pilates, la reserva con aforo es el núcleo de su negocio.
- **Recomendación:** No construir reservas complejas en la primera etapa. Un gimnasio tradicional no necesita forzar a sus socios a reservar hora para entrenar pecho y bíceps.

---

## 12. Retención / Clientes en Riesgo (Churn)

### Diagnóstico y Algoritmo Determinístico (Sin IA)
No se requiere inteligencia artificial costosa para predecir el abandono en un gimnasio. El comportamiento del socio sigue reglas determinísticas muy claras.

Una vez implementada la tabla de Asistencias (Punto 9), el sistema puede calcular automáticamente el **Índice de Riesgo de Abandono (0 - 100)**:

$$\text{Riesgo} = (\text{Días sin asistir} \times 4) + (\text{Días restantes} \le 5 ? 30 : 0) + (\text{Tiene mora} ? 20 : 0)$$

**Segmentación Automática:**
1. **Riesgo Alto (Score > 70):** Cliente con membresía activa que lleva más de 12 días sin asistir.
2. **Riesgo Medio (Score 40-70):** Cliente cuya asistencia cayó de 4 días/semana a 1 día/semana en el último mes.
3. **Alerta de Primer Mes:** Cliente nuevo que pagó su primer mes y no regresó después de la primera semana.

**Acción Comercial:**
El recepcionista ve una tarjeta en el dashboard: *"6 clientes en riesgo de abandono"* con un botón para enviar un mensaje empático por WhatsApp: *"¡Hola Carlos! Te hemos extrañado en el gimnasio esta semana. ¿Todo bien con tus entrenamientos? ¡Te esperamos hoy!"*.

---

## 13. Portal / App del Socio ("Socio ZonaFit")

### Diagnóstico
ZonaFit ya es una PWA completamente instalable en Android e iOS (`vite-plugin-pwa`, iconos, manifiesto, Service Worker). Sin embargo, hoy en día solo la utiliza el administrador o recepcionista.

### Evolución hacia la Experiencia del Cliente Final
Sin necesidad de crear una aplicación nativa en React Native ni pagar cuentas de desarrollador de Apple/Google, la PWA actual puede alojar una ruta pública autenticada `/socio`:
- **Acceso Simple:** El cliente ingresa con su Documento y su Celular (sin contraseñas complejas que olvidar).
- **Funcionalidades del Carnet Digital:**
  - Código QR individual para presentar en recepción al entrar.
  - Estado visible de su membresía: *"Plan Mensual — Vence en 14 días"*.
  - Historial de pagos y botón para ver/descargar sus comprobantes en PDF.
  - Estado de cuenta (si tiene saldo pendiente de un producto o crédito).
  - Enlace al grupo oficial de WhatsApp del gimnasio.

---

## 14. Dashboard Empresarial

### Diagnóstico
El dashboard actual es visualmente atractivo y rápido, pero está incompleto a nivel empresarial porque **solo conoce los ingresos y desconoce los egresos**.

### Qué falta para convertirlo en una herramienta de dirección
1. **Módulo de Gastos / Egresos Rápidos:**
   - Registrar salidas de dinero no asociadas a inventario (pago de servicios públicos, mantenimiento de una máquina, compra de elementos de aseo, nómina).
2. **Exponer los Reportes Backend Ocultos:**
   - Conectar los endpoints ya programados de `/reports/top-products`, `/reports/sales-by-date` y `/reports/low-stock` en pestañas gráficas dentro de una nueva página de Reportes.
3. **Centro de Oportunidades Diarias:**
   - Un panel lateral en el Dashboard que condense las acciones del día:
     - $N$ membresías vencen en los próximos 3 días.
     - $M$ clientes con cartera vencida en mora.
     - $P$ productos con inventario crítico.

---

## 15. Entrenadores / Rutinas

### Diagnóstico
Actualmente solo existe `trainer_name` como texto libre.

### Análisis de Viabilidad
- Implementar un creador completo de rutinas con catálogo de 500 ejercicios y videos en 3D es una tarea de alta complejidad (3 a 5 meses) que compite con apps especializadas como Hevy, Strava o MyFitnessPal.
- **Recomendación:** Mantener el foco de ZonaFit en la administración, asistencia y facturación del negocio. Si se desea evolucionar esta área, empezar únicamente con **Ficha Antropométrica / Medidas Corporales** (peso, estatura, % grasa, fecha de evaluación) que el entrenador pueda registrarle al socio cada mes.

---

## 16. Control de Acceso QR

### Arquitectura Técnica Propuesta (100% Web / Cero Hardware Adicional)

```
[ Celular del Socio ]                     [ Tablet / PC Recepción ]
        │                                             │
   PWA / Socio                               Pantalla Mostrador
        │                                             │
   Muestra QR:                                 Lector de Cámara
   token = HMAC(client_id, fecha, secret)             │
        │                                             ▼
        └──────────────── Escaneo ───────────────► Valida QR
                                                      │
                                                      ▼
                                            POST /attendances/check-in
                                                      │
                                           ┌──────────┴──────────┐
                                           ▼                     ▼
                                      [ VÁLIDO ]            [ INVÁLIDO ]
                                      Pantalla Verde        Pantalla Roja
                                      Foto + Bienvenida     Alerta Vencido
```

- **Ventajas:** Costo de hardware cero. Utiliza las tablets o celulares viejos que cualquier gimnasio ya tiene en recepción.

---

## 17. Congelamiento de Membresías (Freezes)

### Diagnóstico
No existe soporte en la base de datos. Cuando un cliente se enferma o viaja, el administrador tiene que calcular mentalmente los días y modificar manualmente la fecha de fin en la base de datos.

### Diseño Técnico Requerido
- Tabla `membership_freezes`:
  - `id`, `gym_id`, `membership_id`, `start_date`, `end_date`, `days_frozen`, `reason`, `created_by`.
- Lógica de negocio:
  - Al congelar, la membresía pasa a estado `FROZEN`.
  - Al reanudar (o al cumplirse la fecha fin del congelamiento), el sistema calcula:
    $$\text{end\_date}_{\text{nuevo}} = \text{end\_date}_{\text{original}} + \text{días congelados}$$
  - Durante el congelamiento, el check-in bloquea el acceso con mensaje: *"Membresía pausada por viaje/incapacidad"*.

---

## 18. Referidos

### Diagnóstico
Falta total de trazabilidad de quién trajo a quién.

### Implementación Quick Win
1. Agregar columna `referred_by_client_id` (ForeignKey opcional a `clients.id`) en la tabla `clients`.
2. En el formulario de nuevo cliente: campo opcional *"¿Quién te recomendó?"* con buscador inteligente.
3. Regla de negocio: Al primer pago del nuevo cliente, acreditar automáticamente un descuento o cupón de \$10.000 COP en la próxima renovación del socio que refirió.

---

## 19. Fidelización

### Análisis Crítico
Los sistemas de puntos por cada peso gastado generan confusión en gimnasios pequeños y rara vez se canjean.
**Alternativa de Alto Impacto:**
Fidelización por **Rachas y Frecuencia de Asistencia**:
- *"¡Felicitaciones Juan! Completaste 12 asistencias este mes. Tienes 10% de descuento en tu próxima renovación"*.
- Totalmente automatizable a través de plantillas de WhatsApp sin crear monedas virtuales complejas.

---

## 20. Facturación electrónica Colombia (DIAN)

### Distinción Fundamental
1. **Comprobante Interno / Ticket POS (Lo que ZonaFit ya tiene):**
   - Válido legalmente en Colombia para negocios no responsables de IVA (Régimen Simple de Tributación de bajo tope o personas naturales no obligadas a facturar electrónicamente).
   - Genera tirilla/recibo con NIT, nombre comercial, consecutivo interno, detalle de productos y métodos de pago.
2. **Factura Electrónica de Venta (FEV con validación previa DIAN):**
   - Requisito legal para gimnasios constituidos como S.A.S. o personas naturales que superen los topes de ingresos brutos de la DIAN (3.500 UVT).
   - Requiere generación de XML UBL 2.1, firma digital con certificado, cálculo de código CUFE, código QR tributario y transmisión vía Web Service a los servidores de la DIAN.

### Recomendación Estratégica
**NO construir un software de facturación electrónica propio desde cero.** La normativa DIAN cambia constantemente y exige pólizas y certificaciones complejas.
La solución estándar de la industria es integrarse vía API REST con un **Proveedor Tecnológico Autorizado (PT)** colombiano de bajo costo como **Factus**, **Siigo** o **Alegra**. ZonaFit simplemente envía los datos del comprobante y recibe el PDF oficial con el CUFE listo para entregar al cliente.

---

## 21. Mantenimiento de Equipos

### Diagnóstico y Recomendación
- No existe en el sistema.
- **Recomendación:** **NO construir todavía.** El 95% de los gimnasios independientes gestiona sus máquinas con un técnico de confianza local bajo demanda. Un módulo de órdenes de trabajo de mantenimiento preventivo solo agregaría ruido y complejidad al menú para una función que rara vez se actualizaría.

---

## 22. Multi-sede

### Diagnóstico
- **Multi-tenant actual:** Cada gimnasio es un universo cerrado con su propio `gym_id`.
- **Multi-sede real:** Una misma empresa dueña de 3 sedes físicas (ej. Sede Poblado, Sede Laureles, Sede Envigado).
  - Requiere que un socio pueda tener una membresía *All Access* y registrar asistencia en cualquiera de las 3 sedes.
  - La caja y el inventario deben operar de forma independiente por sede física.
  - El dueño debe poder ver un reporte de ventas consolidado de toda la marca o filtrado por sede.
- **Veredicto:** Arquitectónicamente viable en el futuro creando la entidad `branches` (`sedes`), pero debe postergarse hasta que el producto consolide su cuota de mercado en gimnasios mono-sede.

---

## 23. IA Administrativa

### Dónde SÍ aporta valor y dónde NO
- **NO usar IA para:** Arqueo de caja, cálculo de cartera, listado de vencimientos o facturación. Esos procesos deben ser 100% determinísticos, auditables y exactos.
- **SÍ usar IA para:**
  1. **Copilot de Mensajería WhatsApp:** Un botón que genere mensajes hiperpersonalizados para cobrar o recuperar clientes según el historial del socio.
  2. **Resumen Ejecutivo para el Dueño:** Una tarjeta generada los lunes a primera hora: *"Esta semana ingresaron \$4.200.000 COP (+12%), se renovaron 18 membresías y 5 clientes entraron en zona de riesgo. Tu producto estrella fue Agua Cristal"*.

---

## 24. Quick Wins (Top 10 de Inmediata Implementación)

Funcionalidades de muy alto valor para el cliente, que reutilizan la arquitectura existente, requieren poco código y cero hardware:

| # | Quick Win | Qué resuelve | Código / Reutilización |
| :--- | :--- | :--- | :--- |
| **1** | **Conectar Módulo de Reportes Ocultos** | Expone los 7 endpoints de `/reports/*` que ya existen en el backend en una pantalla visual con tablas y filtros. | 100% Backend ya listo. Solo crear página en frontend. |
| **2** | **Kardex / Historial de Inventario** | Permite ver entradas, salidas y motivos de ajuste de stock usando `/inventory-movements`. | Backend ya terminado. Solo agregar modal/tabla en Ventas. |
| **3** | **Centro de Renovaciones Unificado** | Agrupa en una pestaña todos los clientes por vencer (3 días, hoy, vencidos) con botón de 1-clic a WhatsApp. | Reutiliza `Membership` + `CommunicationService`. |
| **4** | **Check-in Rápido por Documento** | Pantalla en recepción para digitar cédula y validar en 1 segundo si la membresía está al día con foto grande. | Nueva tabla simple `attendances` + endpoint ligero. |
| **5** | **Congelamiento Simple de Membresías** | Permite pausar una membresía por incapacidad médica y corre automáticamente la fecha de fin. | Nueva tabla `membership_freezes` + extensión en días. |
| **6** | **Registro Rápido de Egresos de Caja** | Permite registrar salidas de dinero de la caja menor (aseo, compras de mostrador) para cuadre real. | Reutiliza tabla `cash_movements` (tipo `EXPENSE`). |
| **7** | **Buscador de Cliente en Recepción con Acceso Rápido** | Modal global accesible con atajo de teclado (`Ctrl + K`) para buscar cualquier cliente por nombre/cédula. | Componente `ClientSearchCombobox` ya existe. |
| **8** | **Campo de Referido en Alta de Clientes** | Añadir `referred_by_client_id` para saber qué socios son los mejores embajadores del gimnasio. | 1 columna en `clients` + selector en drawer. |
| **9** | **Exportación a Excel de Ventas y Clientes** | Descarga en `.xlsx` de la lista de clientes filtrada y de las ventas del mes para el contador. | Reutiliza librería de exportación de clientes. |
| **10**| **Alertas de Stock Bajo en Dashboard** | Tarjeta roja en el dashboard cuando un producto llegue a su mínimo configurado. | Endpoint `/reports/low-stock` ya existe. |

---

## 25. Funcionalidades estratégicas (Ventaja Competitiva)

1. **Control de Acceso QR sin Hardware (PWA Kiosco):**
   Permite a cualquier gimnasio mediano o de barrio tener control de acceso de nivel cadena internacional usando solo un teléfono celular o tablet en la pared, ahorrándose millones de pesos en molinetes y software propietario.
2. **Algoritmo de Detección Temprana de Churn (Retención Proactiva):**
   Ningún software local en Colombia le avisa al dueño qué clientes llevan 10 días sin venir antes de que se venza su mes. Atacar el abandono antes del vencimiento duplica la tasa de retención.
3. **Carnet Digital del Socio (PWA Socio):**
   Genera estatus y sentido de pertenencia en los miembros del gimnasio, eliminando carnets de plástico o papelitos sellados.

---

## 26. NO construir todavía

Funcionalidades que añaden fricción, alta complejidad técnica o escaso retorno de inversión en este momento:

1. **Integración con Hardware de Torniquetes / Molinetes Propietarios:** Requiere drivers locales en C++, comunicación serial/TCP-IP con placas chinas y soporte técnico presencial costoso.
2. **Motor Completo de Rutinas y Ejercicios 3D:** Altísimo costo de desarrollo; los clientes prefieren ver videos en Instagram/TikTok o usar apps dedicadas de entrenamiento.
3. **Facturación Electrónica DIAN Directa (Sin Proveedor Tecnológico):** Riesgo legal y tributario inmenso. Solo debe abordarse mediante API con un proveedor certificado.
4. **Gamificación Compleja de Puntos y Canjes:** Poca tracción en el segmento objetivo; los dueños no tienen tiempo de configurar catálogos de premios.
5. **Módulo de Mantenimiento de Maquinaria:** Distrae del flujo de caja, cobranza y fidelización.

---

## 27. Propuesta ZonaFit V2 (Roadmap Estructurado)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            ROADMAP ZONAFIT V2                               │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│ FASE 1: QUICK WINS   │ FASE 2: CORE VALUE   │ FASE 3: STRATEGIC DIFFERENTIATION│
│ (Semanas 1 - 2)      │ (Semanas 3 - 6)      │ (Meses 2 - 3)                 │
├──────────────────────┼──────────────────────┼───────────────────────────────┤
│ • Página de Reportes │ • Asistencia y       │ • Portal del Socio PWA        │
│   (Consumir API)     │   Check-in (Cédula)  │   (Carnet Digital + QR)       │
│ • Centro de          │ • Lector QR Kiosco   │ • Churn Score / Retención     │
│   Renovaciones       │   con Cámara         │   Automatizada                │
│ • Kardex Inventario  │ • Congelamiento de   │ • CRM de Prospectos / Leads   │
│ • Egresos en Caja    │   Membresías         │ • Enlaces de Pago Cartera     │
│ • Stock Bajo Alertas │ • Sistema Referidos  │   (Wompi Checkout para Gym)   │
└──────────────────────┴──────────────────────┴───────────────────────────────┘
```

---

## 28. Top funcionalidades recomendadas para investigar/construir primero

Para iniciar la ejecución de ZonaFit V2, estas son las 3 funcionalidades principales con su ficha técnica detallada:

### Ficha 1: Centro de Renovaciones Unificado
- **Qué problema resuelve:** El recepcionista no sabe a quién cobrarle hoy ni a quién llamar; pierde clientes porque se acuerda de ellos semanas después de que se vencieron.
- **Qué tenemos actualmente:** Modelos de membresía con fechas de fin, plantillas de WhatsApp listas y endpoint oculto de vencimientos.
- **Qué falta:** Pestaña en frontend con filtros de vencimiento y botón de acción en 1 clic.
- **Backend requerido:** Ya está listo al 90% (`/reports/memberships-expiring` o query optimizada en `memberships.py`).
- **Frontend requerido:** Sub-vista en `MembershipsPage.tsx` con tabs: *Hoy*, *Próximos 3 días*, *Vencidos recientes*.
- **Migración requerida:** Ninguna.
- **Complejidad:** **Baja**.
- **Valor Potencial:** **Muy Alto** (Impacto financiero directo en caja desde el día 1).

### Ficha 2: Control de Asistencia y Check-in Digital
- **Qué problema resuelve:** El gimnasio no sabe quién entra, entran personas con membresías vencidas y no se conoce la frecuencia real de los socios.
- **Qué tenemos actualmente:** Foto de perfil del cliente, documento de identidad único y validación de vigencia de membresía.
- **Qué falta:** Tabla `attendances`, endpoint `POST /attendances/check-in` y pantalla de mostrador para recepción.
- **Backend requerido:** Modelo `Attendance` con `client_id`, `gym_id`, `check_in_at`, `status`.
- **Frontend requerido:** Pantalla modal/vista de recepción con teclado numérico grande y visualización instantánea del estado del socio.
- **Migración requerida:** 1 migración Alembic sencilla.
- **Complejidad:** **Media-Baja**.
- **Valor Potencial:** **Muy Alto** (Cierra la fuga de dinero por personas entrenando gratis).

### Ficha 3: Activación del Módulo de Reportes Ocultos
- **Qué problema resuelve:** El dueño del gimnasio no sabe cuáles son sus productos más vendidos, quiénes son sus mejores clientes ni cómo se distribuyen sus ventas en el tiempo.
- **Qué tenemos actualmente:** 7 endpoints analíticos completamente operativos y probados en el backend.
- **Qué falta:** Nueva página `/reports` en el frontend enlazada en la barra de navegación lateral con gráficos sencillos y tablas descriptivas.
- **Backend requerido:** Cero (ya está implementado y probado en `report_service.py`).
- **Frontend requerido:** Componente `ReportsPage.tsx` con pestañas: *Ventas por Período*, *Top Productos*, *Alertas de Stock*, *Comportamiento de Clientes*.
- **Migración requerida:** Ninguna.
- **Complejidad:** **Baja**.
- **Valor Potencial:** **Alto** (Aporta valor directivo inmediato sin tocar la base de datos).
