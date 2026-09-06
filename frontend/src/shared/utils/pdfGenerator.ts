import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, InvoiceDetail } from '@shared/types/invoice';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface GenerateReceiptProps {
  invoice: Invoice;
  details: InvoiceDetail[];
  clientName?: string;
  clientDocument?: string;
  gymName?: string;
  gymNit?: string | null;
  gymPhone?: string | null;
  gymAddress?: string | null;
  gymCity?: string | null;
  paymentMethod?: string;
  receiptFooterNotes?: string | null;
}

export const generateReceiptPDF = ({
  invoice,
  details,
  clientName = 'Consumidor Final',
  clientDocument = 'N/A',
  gymName = 'ZONAFIT',
  gymNit,
  gymPhone,
  gymAddress,
  gymCity,
  paymentMethod,
  receiptFooterNotes,
}: GenerateReceiptProps) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.width;
  
  // Format numbers
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method?.toUpperCase()) {
      case 'CASH': return 'Efectivo';
      case 'TRANSFER': return 'Transferencia';
      case 'CARD': return 'Tarjeta';
      default: return method || 'Efectivo';
    }
  };

  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(gymName, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let yPos = 24;
  
  if (gymNit) {
    doc.text(`NIT: ${gymNit}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4.5;
  }
  if (gymPhone || gymAddress || gymCity) {
    const contactParts = [
      gymAddress,
      gymCity,
      gymPhone ? `Tel: ${gymPhone}` : null
    ].filter(Boolean);
    if (contactParts.length > 0) {
      doc.text(contactParts.join(' • '), pageWidth / 2, yPos, { align: 'center' });
      yPos += 4.5;
    }
  }
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE DE VENTA', pageWidth / 2, yPos + 2, { align: 'center' });
  yPos += 10;

  // Invoice & Payment Info
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Comprobante No:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, 50, yPos);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha:`, 125, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(invoice.created_at), "dd 'de' MMMM 'de' yyyy, hh:mm a", { locale: es }), 140, yPos);
  
  yPos += 6;

  // Client Info
  doc.setFont('helvetica', 'bold');
  doc.text(`Cliente:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(clientName || 'Consumidor Final', 50, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text(`Método de Pago:`, 125, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(getPaymentMethodLabel(paymentMethod || invoice.payment_method), 155, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Documento:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(clientDocument || 'N/A', 50, yPos);

  yPos += 10;

  // Table
  const tableData = details.map(item => [
    item.product_name || `Producto #${item.product_id}`,
    item.quantity.toString(),
    formatPrice(Number(item.unit_price)),
    formatPrice(Number(item.subtotal))
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Producto / Concepto', 'Cant.', 'Precio Unitario', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185], fontSize: 9.5 },
    margin: { top: 10, left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : yPos + 40;

  // Totals
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 130, finalY);
  doc.text(formatPrice(Number(invoice.subtotal)), 185, finalY, { align: 'right' });
  
  let currentTotalsY = finalY;

  if (Number(invoice.discount) > 0) {
    currentTotalsY += 5.5;
    doc.text('Descuento:', 130, currentTotalsY);
    doc.text(`-${formatPrice(Number(invoice.discount))}`, 185, currentTotalsY, { align: 'right' });
  }

  if (Number(invoice.tax) > 0) {
    currentTotalsY += 5.5;
    doc.text('Impuestos:', 130, currentTotalsY);
    doc.text(formatPrice(Number(invoice.tax)), 185, currentTotalsY, { align: 'right' });
  }

  currentTotalsY += 6;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 130, currentTotalsY);
  doc.text(formatPrice(Number(invoice.total)), 185, currentTotalsY, { align: 'right' });

  // Status and Footer
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const endY = currentTotalsY + 16;
  
  doc.text(`Estado: ${invoice.status === 'ISSUED' ? 'EMITIDO / PAGADO' : invoice.status}`, 14, endY);
  
  doc.setFont('helvetica', 'italic');
  const notesText = receiptFooterNotes || '¡Gracias por entrenar con nosotros!';
  doc.text(notesText, pageWidth / 2, endY + 10, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Este documento es un comprobante interno, no válido como factura electrónica ante la autoridad tributaria.', pageWidth / 2, endY + 16, { align: 'center' });

  // Output
  doc.save(`${invoice.invoice_number}.pdf`);
};

export interface GenerateMembershipReceiptProps {
  receiptNumber: string;
  paymentDate: string | Date;
  clientName?: string;
  clientDocument?: string;
  clientPhone?: string;
  planName: string;
  durationDays?: number;
  startDate: string | Date;
  endDate: string | Date;
  totalPrice: number;
  paidAmount: number;
  pendingBalance: number;
  paymentMethod: string;
  gymName?: string;
  gymNit?: string | null;
  gymPhone?: string | null;
  gymAddress?: string | null;
  gymCity?: string | null;
  receiptFooterNotes?: string | null;
}

export const generateMembershipPaymentReceiptPDF = ({
  receiptNumber,
  paymentDate,
  clientName = 'Cliente ZonaFit',
  clientDocument = 'N/A',
  clientPhone,
  planName,
  durationDays,
  startDate,
  endDate,
  totalPrice,
  paidAmount,
  pendingBalance,
  paymentMethod,
  gymName = 'ZONAFIT',
  gymNit,
  gymPhone,
  gymAddress,
  gymCity,
  receiptFooterNotes,
}: GenerateMembershipReceiptProps) => {
  if (paidAmount <= 0) {
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.width;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getPaymentMethodLabel = (method?: string) => {
    switch (method?.toUpperCase()) {
      case 'CASH':
        return 'Efectivo';
      case 'TRANSFER':
        return 'Transferencia';
      case 'CARD':
        return 'Tarjeta';
      default:
        return method || 'Efectivo';
    }
  };

  const formatSafeDate = (d: string | Date, withTime = false) => {
    try {
      if (!d) return 'N/A';
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const [y, m, day] = d.split('-').map(Number);
        return format(new Date(y, m - 1, day), "dd 'de' MMMM 'de' yyyy", { locale: es });
      }
      const dateObj = typeof d === 'string' ? new Date(d) : d;
      return format(
        dateObj,
        withTime ? "dd 'de' MMMM 'de' yyyy, hh:mm a" : "dd 'de' MMMM 'de' yyyy",
        { locale: es }
      );
    } catch {
      return String(d);
    }
  };

  // 1. Header Gym Info
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(gymName, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  let yPos = 24;

  if (gymNit) {
    doc.text(`NIT: ${gymNit}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 4.5;
  }
  if (gymPhone || gymAddress || gymCity) {
    const contactParts = [gymAddress, gymCity, gymPhone ? `Tel: ${gymPhone}` : null].filter(
      Boolean
    );
    if (contactParts.length > 0) {
      doc.text(contactParts.join(' • '), pageWidth / 2, yPos, { align: 'center' });
      yPos += 4.5;
    }
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO DE PAGO DE MEMBRESÍA', pageWidth / 2, yPos + 2, { align: 'center' });
  yPos += 10;

  // 2. Receipt & Date Info
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Recibo No:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(receiptNumber, 45, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha Pago:`, 120, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(formatSafeDate(paymentDate, true), 145, yPos);

  yPos += 6;

  // 3. Client & Payment Method
  doc.setFont('helvetica', 'bold');
  doc.text(`Cliente:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(clientName, 45, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text(`Método de Pago:`, 120, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(getPaymentMethodLabel(paymentMethod), 150, yPos);

  yPos += 6;
  doc.setFont('helvetica', 'bold');
  doc.text(`Documento:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(clientDocument, 45, yPos);

  if (clientPhone) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Teléfono:`, 120, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(clientPhone, 145, yPos);
  }

  yPos += 8;

  // 4. Vigencia de Membresía
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(14, yPos, pageWidth - 28, 14, 2, 2, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Vigencia del Plan:`, 18, yPos + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Desde: ${formatSafeDate(startDate)}  -  Hasta: ${formatSafeDate(endDate)}${
      durationDays ? ` (${durationDays} días)` : ''
    }`,
    52,
    yPos + 5.5
  );

  yPos += 18;

  // 5. Table of Details
  const tableData = [
    [
      `Membresía - ${planName}`,
      formatSafeDate(startDate),
      formatSafeDate(endDate),
      formatPrice(totalPrice),
      formatPrice(paidAmount),
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Concepto / Plan', 'Fecha Inicio', 'Fecha Vencimiento', 'Valor Total', 'Valor Pagado']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185], fontSize: 9 },
    margin: { top: 10, left: 14, right: 14 },
    styles: { fontSize: 9, cellPadding: 3.5 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : yPos + 40;

  // 6. Summary Breakdown
  const summaryLabelX = 85;
  const summaryValueX = 185;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Membresía:', summaryLabelX, finalY);
  doc.text(formatPrice(totalPrice), summaryValueX, finalY, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Monto Pagado en esta Operación:', summaryLabelX, finalY + 6);
  doc.text(formatPrice(paidAmount), summaryValueX, finalY + 6, { align: 'right' });

  let balanceY = finalY + 12.5;
  doc.setFontSize(10);
  if (pendingBalance > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 30, 30);
    doc.text('Saldo Pendiente:', summaryLabelX, balanceY);
    doc.text(formatPrice(pendingBalance), summaryValueX, balanceY, { align: 'right' });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 150, 60);
    doc.text('Estado del Pago:', summaryLabelX, balanceY);
    doc.text('TOTALMENTE CANCELADO ($0)', summaryValueX, balanceY, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);

  // 7. Footer
  const endY = balanceY + 18;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  doc.setFont('helvetica', 'italic');
  const notesText = receiptFooterNotes || '¡Gracias por entrenar con nosotros!';
  doc.text(notesText, pageWidth / 2, endY + 8, { align: 'center' });
  doc.setFontSize(8);
  doc.text(
    'Este documento es un comprobante interno de pago, no constituye factura electrónica.',
    pageWidth / 2,
    endY + 14,
    { align: 'center' }
  );

  // 8. Output
  doc.save(`${receiptNumber}.pdf`);
};

