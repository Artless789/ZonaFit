import { useState, useMemo } from 'react';
import { Search, Receipt, Download } from 'lucide-react';
import type { Sale } from '@shared/types/sale';
import type { Client } from '@shared/types/client';
import type { Invoice } from '@shared/types/invoice';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@shared/ui/Table';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { Skeleton } from '@shared/ui/Skeleton';
import { Button } from '@shared/ui/Button';
import { useToast } from '@shared/ui/Toast';
import { useGymSettings } from '../../hooks/useGymSettings';
import { generateReceiptPDF } from '@shared/utils/pdfGenerator';
import { invoiceService } from '../../services/invoiceService';

interface SalesHistoryTableProps {
  sales: Sale[];
  clients: Client[];
  isLoading: boolean;
}

export function SalesHistoryTable({ sales, clients, isLoading }: SalesHistoryTableProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState<'ALL' | 'POS' | 'MEMBERSHIP'>('ALL');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;

  // Map clients for quick name lookup
  const clientMap = useMemo(() => {
    const map = new Map<number, Client>();
    clients.forEach((c) => map.set(c.id, c));
    return map;
  }, [clients]);

  const isMembershipRecord = (sale: Sale) =>
    Boolean(
      sale.is_membership_shadow ||
      sale.origin_type === 'MEMBERSHIP_CREDIT' ||
      (sale.notes && sale.notes.startsWith('Membresía #'))
    );

  // Filtered sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const isMem = isMembershipRecord(sale);
      if (originFilter === 'POS' && isMem) return false;
      if (originFilter === 'MEMBERSHIP' && !isMem) return false;

      const client = sale.client_id ? clientMap.get(sale.client_id) : null;
      const clientName = client?.full_name?.toLowerCase() || 'consumidor final mostrador';
      const saleId = String(sale.id);
      const notes = (sale.notes || '').toLowerCase();
      const search = searchTerm.toLowerCase();

      return clientName.includes(search) || saleId.includes(search) || notes.includes(search);
    });
  }, [sales, clientMap, searchTerm, originFilter]);

  const handleDownloadInvoice = async (sale: Sale) => {
    try {
      setDownloadingId(sale.id);
      // Fetch invoice associated with this sale
      const invoicesResponse = await invoiceService.getAll({ search: String(sale.id), limit: 10 });
      const invoice = invoicesResponse.items.find((inv: Invoice) => inv.sale_id === sale.id) || invoicesResponse.items[0];

      if (!invoice) {
        toast({
          type: 'warning',
          title: 'Comprobante no encontrado',
          message: 'No se encontró un comprobante fiscal asociado a esta venta.',
        });
        return;
      }

      const details = await invoiceService.getDetails(invoice.id);
      const client = sale.client_id ? clientMap.get(sale.client_id) : null;

      await generateReceiptPDF({
        invoice,
        details,
        clientName: invoice.client_name || client?.full_name || 'Consumidor Final',
        clientDocument: invoice.client_document || client?.document || 'N/A',
        gymName: gymSettings?.trade_name || gymSettings?.legal_name || 'Merwil ZonaFit',
        gymNit: gymSettings?.tax_id,
        gymPhone: gymSettings?.official_phone,
        gymAddress: gymSettings?.physical_address,
        gymCity: gymSettings?.city,
        paymentMethod: invoice.payment_method,
        receiptFooterNotes: gymSettings?.receipt_footer_notes,
      });

      toast({
        type: 'success',
        title: 'Comprobante Descargado',
        message: `Comprobante #${invoice.invoice_number} generado correctamente.`,
      });
    } catch {
      toast({
        type: 'error',
        title: 'Error de Descarga',
        message: 'No se pudo generar el archivo PDF del comprobante.',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search Bar & Origin Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <input
              type="text"
              placeholder="Buscar por ID, cliente o nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border-light bg-surface-panel/70 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filtrar por origen de registro"
            className="inline-flex rounded-xl border border-border-light bg-surface-panel/70 p-1 text-[11px] font-mono"
          >
            <button
              type="button"
              role="tab"
              aria-selected={originFilter === 'ALL'}
              onClick={() => setOriginFilter('ALL')}
              className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                originFilter === 'ALL' ? 'bg-white/15 text-text-primary font-semibold' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={originFilter === 'POS'}
              onClick={() => setOriginFilter('POS')}
              className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                originFilter === 'POS' ? 'bg-white/15 text-text-primary font-semibold' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Ventas POS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={originFilter === 'MEMBERSHIP'}
              onClick={() => setOriginFilter('MEMBERSHIP')}
              className={`rounded-lg px-2.5 py-1 transition-colors cursor-pointer ${
                originFilter === 'MEMBERSHIP' ? 'bg-white/15 text-text-primary font-semibold' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Crédito Membresía
            </button>
          </div>
        </div>

        <span className="font-mono text-xs text-text-muted">
          Mostrando {filteredSales.length} de {sales.length} registros
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border-light bg-surface-panel/60 shadow-subtle">
        {filteredSales.length === 0 ? (
          <div className="py-16 text-center text-text-muted">
            <Receipt className="mx-auto h-9 w-9 mb-2 opacity-25" />
            <p className="text-xs font-medium">No se encontraron ventas con los criterios ingresados.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-2xs uppercase">ID Venta</TableHead>
                <TableHead className="font-mono text-2xs uppercase">Fecha & Hora</TableHead>
                <TableHead className="font-mono text-2xs uppercase">Origen / Concepto</TableHead>
                <TableHead className="font-mono text-2xs uppercase">Cliente / Destino</TableHead>
                <TableHead className="font-mono text-2xs uppercase">Estado</TableHead>
                <TableHead className="text-right font-mono text-2xs uppercase">Total</TableHead>
                <TableHead className="text-right font-mono text-2xs uppercase">Comprobante</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.map((sale) => {
                const client = sale.client_id ? clientMap.get(sale.client_id) : null;
                const isCompleted = sale.status === 'COMPLETED';
                const isDownloading = downloadingId === sale.id;
                const isMem = isMembershipRecord(sale);

                return (
                  <TableRow key={sale.id} className="hover:bg-white/[0.02] transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-text-primary">
                      #{String(sale.id).padStart(4, '0')}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-text-muted">
                      {formatDate(sale.created_at)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {isMem ? (
                        <div className="flex flex-col gap-0.5">
                          <span
                            className="inline-flex w-fit items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300"
                            title="Registro interno contable asociado a una membresía con saldo a crédito"
                          >
                            Registro interno · Membresía
                          </span>
                          {sale.notes && (
                            <span className="font-mono text-[10px] text-text-muted truncate max-w-[200px]">
                              {sale.notes}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex w-fit items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                            Venta POS
                          </span>
                          {sale.notes && (
                            <span className="font-mono text-[10px] text-text-muted truncate max-w-[200px]">
                              {sale.notes}
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {client ? (
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary">{client.full_name}</span>
                          <span className="font-mono text-[10px] text-text-muted">{client.phone || client.document || 'Socio'}</span>
                        </div>
                      ) : (
                        <span className="text-text-muted italic">Venta Mostrador (General)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={isCompleted ? 'paid' : 'pending'}
                        label={isCompleted ? 'Completada' : sale.status}
                        mode="pill"
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-text-primary">
                      {formatCurrency(sale.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownloadInvoice(sale)}
                        disabled={isDownloading}
                        className="text-xs text-brand-primary hover:text-red-300 p-1.5 h-auto inline-flex items-center gap-1.5"
                        title="Descargar comprobante en PDF"
                      >
                        <Download size={13} className={isDownloading ? 'animate-bounce' : ''} />
                        <span className="hidden sm:inline">PDF</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
