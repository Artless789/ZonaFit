import { useState, useMemo, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  ShoppingBag,
  Banknote,
  Smartphone,
  CalendarClock,
  Download,
  CheckCircle2,
  MessageCircle,
  AlertTriangle,
  RotateCcw,
  DollarSign,
  X,
} from 'lucide-react';
import type { Product } from '@shared/types/product';
import type { Category } from '@shared/types/category';
import type { Client } from '@shared/types/client';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { ClientSearchCombobox } from '@shared/ui/ClientSearchCombobox';
import { Input } from '@shared/ui/Input';
import { NumericInput } from '@shared/ui/NumericInput';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { useToast } from '@shared/ui/Toast';
import { useSales } from '../../hooks/useSales';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { useGymSettings } from '../../hooks/useGymSettings';
import { useWhatsAppWeb } from '@/hooks/useWhatsAppWeb';
import { Modal } from '@shared/ui/Modal';
import { cn } from '@shared/utils/cn';
import { generateReceiptPDF } from '@shared/utils/pdfGenerator';
import type { Invoice } from '@shared/types/invoice';
import type { Sale } from '@shared/types/sale';
import { formatCurrency } from '@shared/utils/formatters';

interface POSViewProps {
  products: Product[];
  categories: Category[];
  clients: Client[];
}

interface CartItem {
  product: Product;
  quantity: number;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Efectivo', icon: Banknote, desc: 'Dinero en caja' },
  { value: 'TRANSFER', label: 'Transferencia', icon: Smartphone, desc: 'Nequi / Bancolombia' },
  { value: 'CARD', label: 'Tarjeta', icon: CreditCard, desc: 'Datáfono / Débito' },
];

export function POSView({ products, categories, clients }: POSViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createMutation, createDetailMutation } = useSales();
  const { activeRegister } = useCashRegisters();
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;
  const { openWhatsAppModal, WhatsAppModalComponent } = useWhatsAppWeb();

  // Search input ref for quick keyboard access
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  // Sale Type & Payment State
  const [saleType, setSaleType] = useState<'CASH' | 'CREDIT'>('CASH');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [dueDate, setDueDate] = useState('');
  const [initialPaymentStr, setInitialPaymentStr] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Derived Data
  const activeProducts = useMemo(() => products.filter((p) => p.is_active), [products]);
  const activeCategories = useMemo(() => categories.filter((c) => c.is_active), [categories]);
  const activeClients = useMemo(() => clients.filter((c) => c.is_active), [clients]);

  // Category counts map
  const categoryCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    activeProducts.forEach((p) => {
      counts[p.category_id] = (counts[p.category_id] || 0) + 1;
    });
    return counts;
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    return activeProducts.filter((p) => {
      const search = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search) ||
        p.sku.toLowerCase().includes(search);
      const matchesCategory =
        selectedCategory === 'all' || p.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeProducts, searchTerm, selectedCategory]);

  const cartTotal = useMemo(() => {
    return cart.reduce(
      (total, item) => total + (Number(item.product.sale_price) || 0) * item.quantity,
      0
    );
  }, [cart]);

  const cartItemsCount = useMemo(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const initialPaymentNum = useMemo(() => {
    return initialPaymentStr
      ? parseFloat(initialPaymentStr.replace(/[^0-9.-]+/g, '')) || 0
      : 0;
  }, [initialPaymentStr]);

  const balanceDue = useMemo(() => {
    return Math.max(0, cartTotal - initialPaymentNum);
  }, [cartTotal, initialPaymentNum]);

  // Handlers
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({
            type: 'warning',
            title: 'Stock Insuficiente',
            message: `Solo hay ${product.stock} unidades disponibles en inventario.`,
          });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      if (product.stock <= 0) {
        toast({
          type: 'error',
          title: 'Sin Stock',
          message: 'Este producto está agotado en inventario.',
        });
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.product.id === productId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity < 1) return item;
          if (newQuantity > item.product.stock) {
            toast({
              type: 'warning',
              title: 'Límite de Stock',
              message: `Máximo ${item.product.stock} unidades disponibles.`,
            });
            return item;
          }
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleCheckoutIntent = () => {
    if (cart.length === 0) return;

    const requiresCash =
      (saleType === 'CASH' && paymentMethod === 'CASH') ||
      (saleType === 'CREDIT' && initialPaymentNum > 0 && paymentMethod === 'CASH');

    if (requiresCash && !activeRegister.data) {
      toast({
        type: 'error',
        title: 'Caja Cerrada',
        message:
          'Debes abrir una caja de turno antes de registrar ventas o abonos en efectivo.',
      });
      return;
    }

    if (saleType === 'CREDIT') {
      if (!selectedClientId) {
        toast({
          type: 'error',
          title: 'Cliente Requerido',
          message:
            'Debes seleccionar un cliente registrado para emitir una venta a crédito.',
        });
        return;
      }
      if (initialPaymentNum < 0 || initialPaymentNum > cartTotal) {
        toast({
          type: 'error',
          title: 'Abono Inválido',
          message: 'El abono inicial no puede superar el total de la venta.',
        });
        return;
      }
      if (initialPaymentNum > 0 && !paymentMethod) {
        toast({
          type: 'error',
          title: 'Método Requerido',
          message: 'Indica el método de pago utilizado para el abono inicial.',
        });
        return;
      }
      setIsConfirmModalOpen(true);
    } else {
      if (!paymentMethod) {
        toast({
          type: 'error',
          title: 'Método Requerido',
          message: 'Selecciona el método de pago para registrar la venta.',
        });
        return;
      }
      processSale();
    }
  };

  const processSale = async () => {
    try {
      const { api } = await import('../../services/api');

      // 1. Atomic Checkout Endpoint
      const checkoutResponse = await api.post<Sale>('/sales/checkout', {
        client_id: selectedClientId ? Number(selectedClientId) : null,
        notes: notes || null,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
        })),
        sale_type: saleType,
        payment_method: paymentMethod || null,
        due_date: saleType === 'CREDIT' && dueDate ? dueDate : null,
        initial_payment: saleType === 'CREDIT' ? initialPaymentNum : 0,
      });

      const sale = checkoutResponse.data;

      // 2. Automatic Receipt/Invoice Generation
      let createdInvoice = null;
      try {
        const { data } = await api.post<Invoice>('/invoices/', { sale_id: sale.id });
        createdInvoice = data;
      } catch {
        toast({
          type: 'warning',
          title: 'Venta Registrada',
          message:
            'La venta se completó, pero no se pudo generar el comprobante automático de inmediato.',
        });
      }

      // 3. Reactive Query Invalidation
      queryClient.invalidateQueries({ queryKey: ['sales'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['products'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['invoices'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['dashboard'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['accounts-receivables'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-registers'], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['cash-movements'], refetchType: 'all' });

      if (createdInvoice) {
        setCompletedInvoice(createdInvoice);
      } else {
        toast({
          type: 'success',
          title: 'Venta Exitosa',
          message: 'La transacción fue registrada correctamente.',
        });
        resetForm();
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { detail?: string; error?: { message?: string } } };
        message?: string;
      };
      const errorDetail =
        err?.response?.data?.detail ||
        err?.response?.data?.error?.message ||
        err?.message ||
        'No pudimos completar la venta. Inténtalo nuevamente.';
      toast({ type: 'error', title: 'Error en Checkout', message: errorDetail });
    }
  };

  const resetForm = () => {
    setCart([]);
    setSelectedClientId(null);
    setNotes('');
    setSaleType('CASH');
    setPaymentMethod('CASH');
    setDueDate('');
    setInitialPaymentStr('');
    setIsConfirmModalOpen(false);
  };

  const handleDownloadInvoice = async () => {
    if (!completedInvoice) return;
    try {
      const { invoiceService } = await import('../../services/invoiceService');
      const details = await invoiceService.getDetails(completedInvoice.id);

      const client = clients.find((c) => c.id === completedInvoice.client_id);

      await generateReceiptPDF({
        invoice: completedInvoice,
        details,
        clientName:
          completedInvoice.client_name || client?.full_name || 'Consumidor Final',
        clientDocument: completedInvoice.client_document || client?.document || 'N/A',
        gymName:
          gymSettings?.trade_name || gymSettings?.legal_name || 'Merwil ZonaFit',
        gymNit: gymSettings?.tax_id,
        gymPhone: gymSettings?.official_phone,
        gymAddress: gymSettings?.physical_address,
        gymCity: gymSettings?.city,
        paymentMethod: completedInvoice.payment_method,
        receiptFooterNotes: gymSettings?.receipt_footer_notes,
      });
    } catch {
      toast({
        type: 'error',
        title: 'Error de Descarga',
        message: 'No se pudo generar el comprobante PDF.',
      });
    }
  };

  const isCheckingOut = createMutation.isPending || createDetailMutation.isPending;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: PRODUCT CATALOG & FAST LOOKUP */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-[640px] lg:h-[720px] rounded-[24px] border border-border-subtle bg-surface-panel/90 shadow-subtle backdrop-blur-md overflow-hidden">
          {/* Top Search & Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-border-subtle bg-surface-panel/80 flex flex-col gap-3.5 shrink-0">
            {/* Search Input with Shortcut */}
            <div className="relative flex items-center">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"
                size={18}
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por nombre, SKU o código de barra... (Presiona '/' para buscar)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-11 pr-20 rounded-[var(--radius-md)] border border-border-medium bg-surface-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 transition-all font-sans"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="pointer-events-auto p-1 text-text-muted hover:text-text-primary rounded-full"
                  >
                    <X size={14} />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-surface-raised border border-border-subtle rounded">
                    /
                  </kbd>
                )}
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5',
                  selectedCategory === 'all'
                    ? 'bg-brand-primary text-white shadow-xs'
                    : 'bg-surface-raised text-text-muted hover:text-text-primary hover:bg-surface-panel-hover border border-border-subtle'
                )}
              >
                <span>Todas</span>
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                    selectedCategory === 'all'
                      ? 'bg-white/20 text-white'
                      : 'bg-surface-base text-text-muted'
                  )}
                >
                  {activeProducts.length}
                </span>
              </button>
              {activeCategories.map((cat) => {
                const count = categoryCounts[cat.id] || 0;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer flex items-center gap-1.5',
                      isSelected
                        ? 'bg-brand-primary text-white shadow-xs'
                        : 'bg-surface-raised text-text-muted hover:text-text-primary hover:bg-surface-panel-hover border border-border-subtle'
                    )}
                  >
                    <span>{cat.name}</span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded-full font-mono',
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-surface-base text-text-muted'
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Grid Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 bg-surface-base/40 custom-scrollbar">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-16 h-16 rounded-full bg-surface-raised flex items-center justify-center mb-3 text-text-muted border border-border-subtle">
                  <ShoppingBag size={28} className="opacity-40" />
                </div>
                <h4 className="text-base font-semibold text-text-primary mb-1">
                  No se encontraron productos
                </h4>
                <p className="text-xs text-text-secondary max-w-xs mb-4">
                  {searchTerm
                    ? `No hay coincidencias para "${searchTerm}". Intenta con otro término o limpia el filtro.`
                    : 'No hay productos disponibles en esta categoría.'}
                </p>
                {(searchTerm || selectedCategory !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedCategory('all');
                    }}
                    className="px-3.5 py-1.5 rounded-[var(--radius-md)] bg-surface-raised border border-border-medium text-xs font-semibold text-text-primary hover:bg-surface-panel-hover transition-colors cursor-pointer"
                  >
                    Restablecer filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {filteredProducts.map((product) => {
                  const isOutOfStock = product.stock <= 0;
                  const isLowStock = product.stock > 0 && product.stock <= (product.minimum_stock || 5);
                  const inCartItem = cart.find((i) => i.product.id === product.id);

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && addToCart(product)}
                      className={cn(
                        'group relative flex flex-col justify-between p-3.5 rounded-[20px] border transition-all duration-200 select-none text-left',
                        isOutOfStock
                          ? 'bg-surface-raised/40 border-border-subtle opacity-50 grayscale cursor-not-allowed'
                          : 'bg-surface-raised/70 border-border-subtle hover:border-brand-primary/50 hover:bg-surface-panel-hover hover:shadow-elevated hover:-translate-y-0.5 cursor-pointer',
                        inCartItem && 'ring-1 ring-brand-primary/40 border-brand-primary/40'
                      )}
                    >
                      {/* Product Header */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono text-[10px] text-text-muted tracking-wider uppercase truncate">
                            {product.sku || 'SIN-SKU'}
                          </span>
                          {/* Stock Badge */}
                          {isOutOfStock ? (
                            <StatusBadge status="danger" size="sm" label="Agotado" />
                          ) : isLowStock ? (
                            <StatusBadge
                              status="warning"
                              size="sm"
                              label={`${product.stock} disp.`}
                            />
                          ) : (
                            <StatusBadge
                              status="active"
                              size="sm"
                              label={`${product.stock} disp.`}
                            />
                          )}
                        </div>

                        {/* Product Title */}
                        <div className="font-semibold text-text-primary text-sm line-clamp-2 leading-tight mt-1 min-h-[2.5rem]">
                          {product.name}
                        </div>
                      </div>

                      {/* Product Footer / Price & Add */}
                      <div className="mt-3 pt-2.5 border-t border-border-subtle/70 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-text-muted uppercase font-mono">
                            Precio
                          </span>
                          <span className="text-sm sm:text-base font-extrabold font-mono text-brand-primary">
                            {formatCurrency(product.sale_price)}
                          </span>
                        </div>

                        {/* Add Button Indicator */}
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 shadow-xs cursor-pointer',
                            inCartItem
                              ? 'bg-brand-primary text-white scale-105'
                              : 'bg-surface-base group-hover:bg-brand-primary group-hover:text-white text-text-muted border border-border-subtle group-hover:border-brand-primary'
                          )}
                          title="Agregar al carrito"
                        >
                          {inCartItem ? (
                            <span className="text-xs font-bold font-mono">
                              {inCartItem.quantity}
                            </span>
                          ) : (
                            <Plus size={15} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: UNIFIED CART & CHECKOUT TERMINAL */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col rounded-[24px] border border-border-subtle bg-surface-panel/95 shadow-elevated backdrop-blur-md overflow-hidden">
          {/* Header & Cart Summary */}
          <div className="p-4 sm:p-5 border-b border-border-subtle bg-surface-panel/90 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                <ShoppingCart size={17} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Ticket de Venta
                </h3>
                <span className="text-[11px] text-text-muted">
                  {cartItemsCount} {cartItemsCount === 1 ? 'artículo' : 'artículos'} en cesta
                </span>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs font-medium text-text-muted hover:text-rose-400 transition-colors flex items-center gap-1 cursor-pointer py-1 px-2 rounded hover:bg-rose-500/10"
              >
                <Trash2 size={13} />
                <span>Vaciar</span>
              </button>
            )}
          </div>

          <div className="p-4 sm:p-5 flex flex-col gap-4.5">
            {/* Sale Type Selector (Contado / Crédito) */}
            <div className="bg-surface-base border border-border-subtle p-1 rounded-[var(--radius-lg)] flex relative">
              <div
                className="absolute inset-y-1 rounded-[var(--radius-md)] bg-surface-raised border border-border-medium shadow-elevated transition-all duration-200 ease-out z-0"
                style={{
                  width: 'calc(50% - 4px)',
                  left: saleType === 'CASH' ? '4px' : 'calc(50%)',
                }}
              />

              <button
                onClick={() => setSaleType('CASH')}
                className={cn(
                  'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer',
                  saleType === 'CASH'
                    ? 'text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <Banknote size={15} />
                <span>Contado</span>
              </button>
              <button
                onClick={() => setSaleType('CREDIT')}
                className={cn(
                  'relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer',
                  saleType === 'CREDIT'
                    ? 'text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                <CalendarClock size={15} />
                <span>Crédito (CxC)</span>
              </button>
            </div>

            {/* Client Selection */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  Cliente {saleType === 'CREDIT' && <span className="text-rose-400">*</span>}
                </label>
                {saleType === 'CREDIT' ? (
                  <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-wider bg-rose-500/10 px-1.5 py-0.5 rounded">
                    Obligatorio
                  </span>
                ) : (
                  <span className="text-[11px] text-text-muted font-normal">
                    Mostrador / Opcional
                  </span>
                )}
              </div>
              <ClientSearchCombobox
                clients={activeClients}
                selectedClientId={selectedClientId}
                onSelect={setSelectedClientId}
                placeholder={
                  saleType === 'CASH'
                    ? 'Consumidor Final (Opcional)'
                    : 'Buscar cliente para crédito (Obligatorio)...'
                }
                allowClear={true}
              />
            </div>

            {/* Cart Items List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                <span>Líneas de Compra</span>
                <span className="font-mono text-text-muted">{cart.length} líneas</span>
              </div>

              {cart.length === 0 ? (
                <div className="py-7 px-4 rounded-[var(--radius-lg)] border border-dashed border-border-subtle bg-surface-base/40 flex flex-col items-center justify-center gap-2 text-center">
                  <div className="w-10 h-10 rounded-full bg-surface-raised flex items-center justify-center text-text-muted">
                    <ShoppingCart size={18} className="opacity-50" />
                  </div>
                  <span className="text-xs font-medium text-text-primary">
                    La cesta está vacía
                  </span>
                  <span className="text-[11px] text-text-muted max-w-[220px]">
                    Selecciona productos del catálogo para comenzar a facturar.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-0.5">
                  {cart.map((item) => {
                    const lineTotal =
                      (Number(item.product.sale_price) || 0) * item.quantity;
                    return (
                      <div
                        key={item.product.id}
                        className="flex items-center justify-between p-2.5 rounded-[var(--radius-md)] border border-border-subtle bg-surface-base shadow-xs hover:border-border-medium transition-colors"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="font-semibold text-text-primary text-xs leading-snug truncate">
                            {item.product.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-mono mt-0.5">
                            <span>{formatCurrency(item.product.sale_price)} c/u</span>
                            <span>•</span>
                            <span className="text-[10px] text-text-secondary">
                              Stock: {item.product.stock}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Tactile Quantity Stepper */}
                          <div className="flex items-center gap-1 bg-surface-raised border border-border-subtle rounded-[var(--radius-sm)] p-0.5">
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, -1)}
                              disabled={item.quantity <= 1 || isCheckingOut}
                              className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-base disabled:opacity-30 cursor-pointer transition-colors"
                              title="Disminuir unidad"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="text-xs font-bold font-mono w-5 text-center text-text-primary">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(item.product.id, 1)}
                              disabled={
                                item.quantity >= item.product.stock || isCheckingOut
                              }
                              className="w-6 h-6 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-base disabled:opacity-30 cursor-pointer transition-colors"
                              title="Aumentar unidad"
                            >
                              <Plus size={11} />
                            </button>
                          </div>

                          {/* Line Subtotal */}
                          <span className="font-bold font-mono text-xs text-text-primary whitespace-nowrap min-w-16 text-right">
                            {formatCurrency(lineTotal)}
                          </span>

                          {/* Delete Item */}
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.id)}
                            disabled={isCheckingOut}
                            className="text-text-muted hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Remover producto"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dynamic Options: Payment Method & Credit Terms */}
            <div className="pt-2 border-t border-border-subtle space-y-3">
              {/* Payment Method Cards */}
              {(saleType === 'CASH' ||
                (saleType === 'CREDIT' && initialPaymentNum > 0)) && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    {saleType === 'CREDIT'
                      ? 'Método de Pago del Abono'
                      : 'Método de Pago'}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PAYMENT_METHODS.map((pm) => {
                      const Icon = pm.icon;
                      const isSelected = paymentMethod === pm.value;
                      return (
                        <button
                          key={pm.value}
                          type="button"
                          onClick={() => setPaymentMethod(pm.value)}
                          disabled={isCheckingOut}
                          className={cn(
                            'flex flex-col items-center justify-center p-2.5 rounded-[var(--radius-md)] border transition-all duration-200 cursor-pointer text-center',
                            isSelected
                              ? 'bg-brand-primary/10 border-brand-primary text-text-primary shadow-xs'
                              : 'bg-surface-base border-border-subtle text-text-muted hover:text-text-primary hover:bg-surface-raised'
                          )}
                        >
                          <Icon
                            size={18}
                            className={cn(
                              'mb-1',
                              isSelected ? 'text-brand-primary' : 'text-text-muted'
                            )}
                          />
                          <span className="text-xs font-semibold">{pm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cash Register Warning if Cash is selected and Register is Closed */}
              {paymentMethod === 'CASH' &&
                (saleType === 'CASH' ||
                  (saleType === 'CREDIT' && initialPaymentNum > 0)) &&
                !activeRegister.data && (
                  <div className="p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200/90 leading-relaxed">
                      <strong className="font-semibold block text-amber-300">
                        Caja de turno cerrada
                      </strong>
                      Debes abrir una caja de turno antes de cobrar o recibir abonos en
                      efectivo.
                    </div>
                  </div>
                )}

              {/* Credit Terms (Due Date & Initial Payment) */}
              {saleType === 'CREDIT' && (
                <div className="grid grid-cols-2 gap-3 p-3 rounded-[var(--radius-lg)] bg-surface-base/80 border border-border-subtle">
                  <Input
                    type="date"
                    label="Vencimiento"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    disabled={isCheckingOut}
                    className="w-full text-xs"
                  />
                  <NumericInput
                    label="Abono Inicial"
                    placeholder="0"
                    leftIcon={<DollarSign size={14} />}
                    value={initialPaymentStr}
                    onChange={(e) => setInitialPaymentStr(e.target.value)}
                    disabled={isCheckingOut}
                    className="w-full text-xs"
                    max={cartTotal}
                  />
                </div>
              )}

              {/* Sale Notes */}
              <Input
                placeholder="Observaciones o notas de la venta (opcional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isCheckingOut}
                className="text-xs"
              />
            </div>

            {/* Totals & Primary Action */}
            <div className="pt-3 border-t border-border-subtle space-y-3.5">
              <div className="space-y-1.5 bg-surface-base/70 p-3.5 rounded-[var(--radius-lg)] border border-border-subtle">
                <div className="flex justify-between items-center text-text-secondary text-xs">
                  <span>Subtotal Compra</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {formatCurrency(cartTotal)}
                  </span>
                </div>

                {saleType === 'CREDIT' && (
                  <>
                    <div className="flex justify-between items-center text-text-secondary text-xs">
                      <span>Abono Inicial Registrado</span>
                      <span className="font-mono font-semibold text-emerald-400">
                        - {formatCurrency(initialPaymentNum)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-border-subtle">
                      <span className="text-text-primary font-bold text-xs uppercase tracking-wider">
                        Saldo a Cobrar (CxC)
                      </span>
                      <span className="text-2xl font-black font-mono tracking-tight text-rose-400">
                        {formatCurrency(balanceDue)}
                      </span>
                    </div>
                  </>
                )}

                {saleType === 'CASH' && (
                  <div className="flex justify-between items-baseline pt-2 border-t border-border-subtle">
                    <span className="text-text-primary font-bold text-xs uppercase tracking-wider">
                      Total a Cobrar
                    </span>
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-text-primary">
                      {formatCurrency(cartTotal)}
                    </span>
                  </div>
                )}
              </div>

              {/* Primary Action Button */}
              <ActionGlowButton
                onClick={handleCheckoutIntent}
                disabled={cart.length === 0 || isCheckingOut}
                isLoading={isCheckingOut}
                className="w-full py-3.5 text-base font-bold shadow-md cursor-pointer"
              >
                <CreditCard className="mr-2" size={18} />
                {isCheckingOut
                  ? 'Procesando transacción...'
                  : saleType === 'CREDIT'
                  ? `Generar Crédito (${formatCurrency(cartTotal)})`
                  : `Cobrar ${formatCurrency(cartTotal)}`}
              </ActionGlowButton>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CREDIT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !isCheckingOut && setIsConfirmModalOpen(false)}
        title="Confirmar Venta a Crédito"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Se registrará una cuenta por cobrar en el módulo financiero y se descontarán
            las existencias de inventario de forma inmediata.
          </p>

          <div className="bg-surface-base border border-border-subtle rounded-[var(--radius-lg)] p-4 space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Cliente Deudor:</span>
              <span className="font-semibold text-text-primary">
                {clients.find((c) => c.id === selectedClientId)?.full_name || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Fecha de Vencimiento:</span>
              <span className="font-medium text-text-primary">
                {dueDate || 'Sin definir (Inmediato)'}
              </span>
            </div>
            <div className="border-t border-border-subtle my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Valor Total Venta:</span>
              <span className="font-mono font-semibold text-text-primary">
                {formatCurrency(cartTotal)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Abono Inicial Recibido:</span>
              <span className="font-mono font-semibold text-emerald-400">
                {formatCurrency(initialPaymentNum)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border-subtle">
              <span className="text-text-primary">Saldo Pendiente por Cobrar:</span>
              <span className="font-mono text-rose-400">
                {formatCurrency(balanceDue)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isCheckingOut}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <ActionGlowButton onClick={processSale} isLoading={isCheckingOut}>
              Confirmar Crédito
            </ActionGlowButton>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* SUCCESS & INVOICE RECEIPT MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!completedInvoice}
        onClose={() => {
          setCompletedInvoice(null);
          resetForm();
        }}
        title="Venta Registrada Exitosamente"
      >
        <div className="flex flex-col items-center justify-center space-y-5 py-4">
          {/* Animated Glow Icon */}
          <div className="h-16 w-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 shadow-glow-sm">
            <CheckCircle2 size={36} className="text-emerald-400" />
          </div>

          <div className="text-center">
            <h3 className="text-xl font-bold text-text-primary">
              ¡Transacción Completada!
            </h3>
            <p className="text-sm text-text-secondary mt-1">
              Comprobante de venta generado:{' '}
              <span className="font-mono font-bold text-brand-primary">
                {completedInvoice?.invoice_number}
              </span>
            </p>
            <div className="mt-2 text-2xl font-black font-mono text-text-primary">
              {formatCurrency(completedInvoice?.total || 0)}
            </div>
          </div>

          <div className="flex flex-col w-full gap-2.5 mt-2">
            <ActionGlowButton
              onClick={handleDownloadInvoice}
              className="w-full flex justify-center py-3 text-sm font-semibold"
            >
              <Download className="mr-2" size={17} />
              Descargar Comprobante PDF
            </ActionGlowButton>

            {completedInvoice?.client_id && (
              <button
                type="button"
                onClick={() => {
                  const client = clients.find(
                    (c) => c.id === completedInvoice.client_id
                  );
                  openWhatsAppModal({
                    client: {
                      id: completedInvoice.client_id!,
                      full_name: client
                        ? client.full_name
                        : `Cliente #${completedInvoice.client_id}`,
                      phone: client?.phone || null,
                    },
                    eventType: 'PAYMENT_RECEIVED',
                    eventLabel: 'Enviar comprobante',
                    contextData: {
                      invoice_number: completedInvoice.invoice_number,
                      amount: formatCurrency(completedInvoice.total),
                      payment_method: completedInvoice.payment_method || 'CASH',
                    },
                  });
                }}
                className="w-full py-2.5 px-4 rounded-[var(--radius-md)] font-semibold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <MessageCircle size={17} />
                <span>Enviar comprobante por WhatsApp</span>
              </button>
            )}

            <button
              onClick={() => {
                setCompletedInvoice(null);
                resetForm();
              }}
              className="w-full py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary bg-surface-raised hover:bg-surface-panel-hover border border-border-medium rounded-[var(--radius-md)] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <RotateCcw size={15} />
              <span>Nueva Venta</span>
            </button>
          </div>
        </div>
      </Modal>

      <WhatsAppModalComponent />
    </>
  );
}
