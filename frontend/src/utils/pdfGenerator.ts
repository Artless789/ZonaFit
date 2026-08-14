import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { Invoice, InvoiceDetail } from '../types/invoice';
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
}

export const generateReceiptPDF = ({
  invoice,
  details,
  clientName = 'Consumidor Final',
  clientDocument = 'N/A',
  gymName = 'ZONAFIT',
  gymNit,
  gymPhone
}: GenerateReceiptProps) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter' // Or 'a5' based on preference for receipt
  });

  const pageWidth = doc.internal.pageSize.width;
  
  // Format numbers
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(price);
  };

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(gymName, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let yPos = 28;
  
  if (gymNit) {
    doc.text(`NIT: ${gymNit}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  if (gymPhone) {
    doc.text(`Tel: ${gymPhone}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  
  doc.text('COMPROBANTE DE VENTA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  // Invoice Info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Comprobante No:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, 50, yPos);
  
  doc.setFont('helvetica', 'bold');
  doc.text(`Fecha:`, 130, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(format(new Date(invoice.created_at), "dd 'de' MMMM 'de' yyyy, hh:mm a", { locale: es }), 145, yPos);
  
  yPos += 8;

  // Client Info
  doc.setFont('helvetica', 'bold');
  doc.text(`Cliente:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(clientName, 50, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Documento:`, 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(clientDocument, 50, yPos);

  yPos += 15;

  // Table
  const tableData = details.map(item => [
    `Producto #${item.product_id}`, // Since we don't have product name in InvoiceDetail we just put ID or map it if available. Wait, we don't have product_name in InvoiceDetailResponse? 
    // Ideally product_name should be there, but if it's not, we'll put the product ID for now. Let's assume we can pass productNames if available.
    // For now we will just use the product_id if name is not mapped.
    item.quantity.toString(),
    formatPrice(item.unit_price),
    formatPrice(item.subtotal)
  ]);

  (doc as any).autoTable({
    startY: yPos,
    head: [['Producto', 'Cant', 'Precio', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [41, 128, 185] },
    margin: { top: 10, left: 14, right: 14 },
    styles: { fontSize: 10, cellPadding: 3 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Totals
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 130, finalY);
  doc.text(formatPrice(invoice.subtotal), 170, finalY, { align: 'right' });
  
  if (invoice.discount > 0) {
    doc.text('Descuentos:', 130, finalY + 7);
    doc.text(`-${formatPrice(invoice.discount)}`, 170, finalY + 7, { align: 'right' });
  }

  if (invoice.tax > 0) {
    doc.text('Impuestos:', 130, finalY + (invoice.discount > 0 ? 14 : 7));
    doc.text(formatPrice(invoice.tax), 170, finalY + (invoice.discount > 0 ? 14 : 7), { align: 'right' });
  }

  const totalsY = finalY + (invoice.discount > 0 && invoice.tax > 0 ? 21 : (invoice.discount > 0 || invoice.tax > 0 ? 14 : 7));
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 130, totalsY);
  doc.text(formatPrice(invoice.total), 170, totalsY, { align: 'right' });

  // Status and Footer
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const endY = totalsY + 20;
  
  doc.text(`Estado: ${invoice.status}`, 14, endY);
  
  doc.setFont('helvetica', 'italic');
  doc.text('Gracias por su compra.', pageWidth / 2, endY + 15, { align: 'center' });
  doc.text('Este documento es un comprobante interno, no válido como factura electrónica.', pageWidth / 2, endY + 22, { align: 'center' });

  // Output
  doc.save(`${invoice.invoice_number}.pdf`);
};
