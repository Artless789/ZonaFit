import type { jsPDF as JsPDFInstance } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type AutoTableFn = (doc: JsPDFInstance, options: UserOptions) => void;

interface AutoTableModuleShape {
  default?: AutoTableFn;
  autoTable?: AutoTableFn;
}

const loadPdfModules = async () => {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const mod = autoTableModule as unknown as AutoTableModuleShape | AutoTableFn;
  const autoTable = (
    typeof mod === 'function'
      ? mod
      : mod.default || mod.autoTable || (mod as unknown as AutoTableFn)
  ) as AutoTableFn;
  return { jsPDF, autoTable };
};

export interface GenerateSubscriptionReceiptProps {
  payment: {
    id: number;
    reference: string;
    amount_in_cents: number;
    currency: string;
    status: string;
    created_at: string;
    provider_transaction_id?: string | null;
  };
  subscription?: {
    plan?: {
      name: string;
      billing_interval: string;
      price: number;
      currency: string;
      description?: string | null;
    } | null;
    starts_at?: string | null;
    ends_at?: string | null;
  } | null;
  gymName?: string;
  gymEmail?: string;
  ownerName?: string;
}

export const generateSubscriptionReceiptPDF = async ({
  payment,
  subscription,
  gymName = 'Gimnasio Registrado',
  gymEmail = 'contacto@gimnasio.com',
  ownerName = 'Propietario'
}: GenerateSubscriptionReceiptProps) => {
  const { jsPDF, autoTable } = await loadPdfModules();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.width;

  const formatPrice = (amountInCents: number, currency: string) => {
    const value = amountInCents / 100;
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: currency || 'COP',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getIntervalLabel = (interval?: string) => {
    switch (interval) {
      case 'MONTHLY': return 'Mensual (1 mes)';
      case 'BIMONTHLY': return 'Bimestral (2 meses)';
      case 'QUARTERLY': return 'Trimestral (3 meses)';
      case 'SEMIANNUAL': return 'Semestral (6 meses)';
      case 'YEARLY': return 'Anual (12 meses)';
      default: return interval || 'Período comercial';
    }
  };

  // 1. Encabezado de la Plataforma
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 38, 'F');

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('MERWIL ZONAFIT', 14, 18);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Plataforma SaaS de Gestión y Control de Acceso para Gimnasios', 14, 25);
  doc.text('Operado por Merwil Company • soporte@zonafit.co • www.zonafit.co', 14, 31);

  // Etiqueta de Tipo de Documento en cabecera
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(248, 113, 113); // red-400
  doc.text('RECIBO DE PAGO DE SUSCRIPCIÓN', pageWidth - 14, 20, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(`Ref: ${payment.reference}`, pageWidth - 14, 28, { align: 'right' });

  // 2. Información del Pago y del Gimnasio
  doc.setTextColor(30, 41, 59); // slate-800
  let y = 48;

  // Cuadro de Información de Facturación
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, y, pageWidth - 28, 36, 3, 3, 'FD');

  // Columna Izquierda: Datos del Gimnasio
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('CLIENTE / GIMNASIO', 20, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Nombre comercial:`, 20, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.text(`${gymName}`, 55, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.text(`Titular / Dueño:`, 20, y + 21);
  doc.text(`${ownerName}`, 55, y + 21);

  doc.text(`Correo electrónico:`, 20, y + 27);
  doc.text(`${gymEmail}`, 55, y + 27);

  // Columna Derecha: Datos de la Transacción
  const rightColX = pageWidth / 2 + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DETALLES DE LA TRANSACCIÓN', rightColX, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Fecha de pago:`, rightColX, y + 15);
  doc.setFont('helvetica', 'bold');
  doc.text(
    format(new Date(payment.created_at), "dd 'de' MMMM 'de' yyyy, hh:mm a", { locale: es }),
    rightColX + 30,
    y + 15
  );

  doc.setFont('helvetica', 'normal');
  doc.text(`Pasarela de pago:`, rightColX, y + 21);
  doc.text('Wompi Colombia (Bancolombia)', rightColX + 30, y + 21);

  doc.text(`ID Transacción Wompi:`, rightColX, y + 27);
  doc.setFont('helvetica', 'bold');
  doc.text(payment.provider_transaction_id || 'Verificado', rightColX + 38, y + 27);

  y += 44;

  // 3. Tabla de Conceptos
  const planName = subscription?.plan?.name || 'Suscripción ZonaFit Cloud';
  const planInterval = getIntervalLabel(subscription?.plan?.billing_interval);
  const formattedTotal = formatPrice(payment.amount_in_cents, payment.currency);

  autoTable(doc, {
    startY: y,
    head: [['Descripción del Servicio', 'Intervalo', 'Estado', 'Importe']],
    body: [
      [
        `${planName}\nAcceso completo a la plataforma SaaS, control de torniquetes, POS, alumnos y módulos administrativos.`,
        planInterval,
        payment.status === 'APPROVED' ? 'APROBADO' : payment.status,
        formattedTotal
      ]
    ],
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9.5
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 65, 85],
      cellPadding: 6
    },
    columnStyles: {
      0: { cellWidth: 95 },
      1: { cellWidth: 35 },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
    },
    theme: 'grid'
  });

  // 4. Totales y Sello de Aprobación
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finalY = (doc as any).lastAutoTable.finalY + 8;

  // Caja de Totales
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(pageWidth - 80, finalY, 66, 24, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal:', pageWidth - 75, finalY + 7);
  doc.text(formattedTotal, pageWidth - 18, finalY + 7, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Total Pagado:', pageWidth - 75, finalY + 16);
  doc.text(formattedTotal, pageWidth - 18, finalY + 16, { align: 'right' });

  // Sello visual "PAGADO"
  if (payment.status === 'APPROVED') {
    doc.setDrawColor(34, 197, 94); // emerald-500
    doc.setFillColor(240, 253, 244); // emerald-50
    doc.roundedRect(14, finalY, 55, 22, 2, 2, 'FD');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(22, 101, 52); // emerald-800
    doc.text('✓ PAGO APROBADO', 41.5, finalY + 10, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(21, 128, 61);
    doc.text('Verificado por pasarela Wompi', 41.5, finalY + 16, { align: 'center' });
  }

  // 5. Pie de página legal
  const footerY = doc.internal.pageSize.height - 22;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Este documento constituye un comprobante digital oficial de pago para la suscripción al servicio Merwil ZonaFit.',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  doc.text(
    'Para soporte técnico, dudas o facturación tributaria contáctenos en soporte@zonafit.co.',
    pageWidth / 2,
    footerY + 4.5,
    { align: 'center' }
  );

  // Descarga automática del archivo PDF
  const filename = `Comprobante_ZonaFit_${payment.reference}.pdf`;
  doc.save(filename);
};
