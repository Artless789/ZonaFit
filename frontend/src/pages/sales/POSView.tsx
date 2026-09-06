import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Search, Plus, Minus, X, CreditCard, ShoppingBag, Banknote, CalendarClock, Download, CheckCircle2, DollarSign } from 'lucide-react';
import type { Product } from '@shared/types/product';
import type { Category } from '@shared/types/category';
import type { Client } from '@shared/types/client';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
import { ClientSearchCombobox } from '@shared/ui/ClientSearchCombobox';
import { Input } from '@shared/ui/Input';
import { NumericInput } from '@shared/ui/NumericInput';
import { Select } from '@shared/ui/Select';
import { useToast } from '@shared/ui/Toast';
import { useSales } from '../../hooks/useSales';
import { useGymSettings } from '../../hooks/useGymSettings';
import { Modal } from '@shared/ui/Modal';
import { cn } from '@shared/utils/cn';
import { generateReceiptPDF } from '@shared/utils/pdfGenerator';
import type { Invoice } from '@shared/types/invoice';
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
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' }
];

export function POSView({ products, categories, clients }: POSViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { createMutation, createDetailMutation } = useSales();
  const { query: gymSettingsQuery } = useGymSettings();
  const gymSettings = gymSettingsQuery.data;

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | 'all'>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  
  // New State for Credit/Cash
  const [saleType, setSaleType] = useState<'CASH' | 'CREDIT'>('CASH');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [dueDate, setDueDate] = useState('');
  const [initialPaymentStr, setInitialPaymentStr] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);

  // Derived Data
  const activeProducts = products.filter(p => p.is_active);
  const activeCategories = categories.filter(c => c.is_active);
  const activeClients = clients.filter(c => c.is_active);

  const filteredProducts = useMemo(() => {
    return activeProducts.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            p.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [activeProducts, searchTerm, selectedCategory]);

  const cartTotal = cart.reduce((total, item) => total + ((Number(item.product.sale_price) || 0) * item.quantity), 0);
  
  const initialPaymentNum = initialPaymentStr ? parseFloat(initialPaymentStr.replace(/[^0-9.-]+/g, '')) || 0 : 0;
  const balanceDue = Math.max(0, cartTotal - initialPaymentNum);

  // Handlers
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast({ type: 'warning', title: 'Stock Insuficiente', message: 'No puedes agregar más unidades de las disponibles.' });
          return prev;
        }
        return prev.map(item => 
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      if (product.stock <= 0) {
        toast({ type: 'error', title: 'Sin Stock', message: 'Este producto está agotado.' });
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === productId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity < 1) return item; 
          if (newQuantity > item.product.stock) {
             toast({ type: 'warning', title: 'Stock Insuficiente' });
             return item;
          }
          return { ...item, quantity: newQuantity };
        }
        return item;
      });
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const formatPrice = (price: number | string) => {
    return formatCurrency(Number(price) || 0);
  };

  const handleCheckoutIntent = () => {
    if (cart.length === 0) return;

    if (saleType === 'CREDIT') {
      if (!selectedClientId) {
        toast({ type: 'error', title: 'Cliente Requerido', message: 'Selecciona un cliente para realizar una venta a crédito.' });
        return;
      }
      if (initialPaymentNum < 0 || initialPaymentNum > cartTotal) {
        toast({ type: 'error', title: 'Abono Inválido', message: 'El abono no puede superar el total de la venta.' });
        return;
      }
      if (initialPaymentNum > 0 && !paymentMethod) {
        toast({ type: 'error', title: 'Método Requerido', message: 'Indica el método de pago para el abono.' });
        return;
      }
      setIsConfirmModalOpen(true);
    } else {
      if (!paymentMethod) {
        toast({ type: 'error', title: 'Método Requerido', message: 'Indica el método de pago.' });
        return;
      }
      // Process CASH directly
      processSale();
    }
  };

  const processSale = async () => {
    try {
      // 1. Create Sale Header
      const sale = await createMutation.mutateAsync({
        client_id: selectedClientId ? Number(selectedClientId) : null,
        notes: notes || null,
      });

      // 2. Create Sale Details
      for (const item of cart) {
        await createDetailMutation.mutateAsync({
          sale_id: sale.id,
          product_id: item.product.id,
          quantity: item.quantity,
        });
      }

      // 3. Complete Sale with Transaction info
      // Actually, complete endpoint logic goes here
      // We need to call a complete mutation, wait, the `useSales` hook might not have `completeMutation`?
      // Ah, the plan states we use `POST /sales/{id}/complete`. I should add it to the `api` call directly if not in hook.
      // Wait, let's assume `useSales` has `completeMutation` or I will add it to the hook later or use `api.post`.
      // Let's use `api.post` for now or check if it's there. 
      // I will just use `fetch` or `axios` directly via the api client since I don't want to modify useSales if I don't have to.
      
      const { api } = await import('../../services/api');
      await api.post(`/sales/${sale.id}/complete`, {
        sale_type: saleType,
        payment_method: paymentMethod || null,
        due_date: saleType === 'CREDIT' && dueDate ? dueDate : null,
        initial_payment: saleType === 'CREDIT' ? initialPaymentNum : 0,
      });

      // 4. Create Invoice
      let createdInvoice = null;
      try {
        const { data } = await api.post<Invoice>('/invoices/', { sale_id: sale.id });
        createdInvoice = data;
      } catch (invoiceError) {
        toast({ type: 'warning', title: 'Venta Procesada', message: 'La venta se registró, pero no se pudo generar el comprobante automático.' });
      }

      // 5. Invalidate relevant queries so all views update reactively
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts_receivables'] });
      queryClient.invalidateQueries({ queryKey: ['cash_registers'] });
      queryClient.invalidateQueries({ queryKey: ['cash_movements'] });

      if (createdInvoice) {
        setCompletedInvoice(createdInvoice);
      } else {
        toast({ type: 'success', title: 'Venta Procesada', message: 'La venta ha sido registrada exitosamente.' });
        resetForm();
      }
      
    } catch (error: any) {
      const errorDetail = error?.response?.data?.detail || error?.response?.data?.error?.message || error?.message || 'No pudimos completar la venta. Inténtalo nuevamente.';
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
      
      const client = clients.find(c => c.id === completedInvoice.client_id);
      
      await generateReceiptPDF({
        invoice: completedInvoice,
        details,
        clientName: client?.full_name,
        clientDocument: client?.document,
        gymName: gymSettings?.trade_name || gymSettings?.legal_name || 'Merwil ZonaFit',
        gymNit: gymSettings?.tax_id,
        gymPhone: gymSettings?.official_phone,
        gymAddress: gymSettings?.physical_address,
        gymCity: gymSettings?.city,
        paymentMethod: completedInvoice.payment_method,
        receiptFooterNotes: gymSettings?.receipt_footer_notes,
      });
    } catch (err) {
      toast({ type: 'error', title: 'Error', message: 'No se pudo descargar el comprobante.' });
    }
  };

  const isCheckingOut = createMutation.isPending || createDetailMutation.isPending;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
        
        {/* LEFT COLUMN: Catalog */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 lg:col-span-7 xl:col-span-8 flex flex-col h-full overflow-hidden p-0">
          <div className="p-4 border-b border-border-light bg-bg-surface flex flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input 
                type="text" 
                placeholder="Buscar productos por nombre o SKU..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-md border border-border-medium bg-bg-page text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary transition-fast"
              />
            </div>
            
            {/* Category Chips */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('all')}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  selectedCategory === 'all' 
                    ? "bg-brand-primary text-text-white shadow-sm" 
                    : "bg-bg-page text-text-secondary hover:bg-border-light hover:text-text-primary border border-border-medium"
                )}
              >
                Todas
              </button>
              {activeCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                    selectedCategory === cat.id 
                      ? "bg-brand-primary text-text-white shadow-sm" 
                      : "bg-bg-page text-text-secondary hover:bg-border-light hover:text-text-primary border border-border-medium"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto p-4 bg-bg-page/50">
            {filteredProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted">
                <ShoppingBag size={48} className="mb-4 opacity-20" />
                <p>No se encontraron productos.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={product.stock <= 0}
                    className={cn(
                      "flex flex-col text-left bg-bg-surface border border-border-light rounded-xl p-4 transition-all hover:shadow-glass hover:-translate-y-1 group relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-brand-primary",
                      product.stock <= 0 && "opacity-50 grayscale cursor-not-allowed hover:shadow-none hover:translate-y-0"
                    )}
                  >
                    <div className="font-semibold text-text-primary mb-1 line-clamp-2 leading-tight">{product.name}</div>
                    <div className="text-xs text-text-muted font-mono mb-3">{product.sku}</div>
                    
                    <div className="mt-auto flex items-end justify-between w-full">
                      <span className="font-bold text-brand-primary">{formatPrice(product.sale_price)}</span>
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full",
                        product.stock > 0 ? "bg-bg-page text-text-secondary" : "bg-danger/10 text-danger"
                      )}>
                        {product.stock > 0 ? `${product.stock} disp.` : 'Agotado'}
                      </span>
                    </div>

                    {/* Hover Overlay indicating 'Add' */}
                    {product.stock > 0 && (
                      <div className="absolute inset-0 bg-brand-primary/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Plus className="text-brand-primary drop-shadow-md" size={32} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Cart & Checkout */}
        <div className="rounded-[var(--radius-xl)] border border-border-light bg-bg-surface/40 lg:col-span-5 xl:col-span-4 flex flex-col h-full overflow-hidden p-0 border-brand-primary/20 shadow-glass-large">
          
          {/* Sale Type Selector */}
          <div className="p-3 border-b border-border-light bg-bg-surface">
             <div className="bg-bg-page border border-border-medium p-1 rounded-lg flex relative">
                <div 
                  className="absolute inset-y-1 rounded-md bg-bg-elevated border border-border-medium shadow-sm transition-all duration-300 ease-out z-0"
                  style={{
                    width: 'calc(50% - 4px)',
                    left: saleType === 'CASH' ? '4px' : 'calc(50%)',
                  }}
                />
                
                <button
                  onClick={() => setSaleType('CASH')}
                  className={cn(
                    "relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
                    saleType === 'CASH' ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  <Banknote size={16} />
                  <span>Contado</span>
                </button>
                <button
                  onClick={() => setSaleType('CREDIT')}
                  className={cn(
                    "relative z-10 flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
                    saleType === 'CREDIT' ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                  )}
                >
                  <CalendarClock size={16} />
                  <span>Crédito</span>
                </button>
              </div>
          </div>

          {/* Client Selection */}
          <div className="p-4 border-b border-border-light bg-bg-surface space-y-3 relative z-[var(--z-dropdown)]">
            <label className="block text-sm font-medium text-text-secondary">
              Cliente {saleType === 'CREDIT' && <span className="text-danger">*</span>}
            </label>
            <ClientSearchCombobox
              clients={activeClients}
              selectedClientId={selectedClientId}
              onSelect={setSelectedClientId}
              placeholder={saleType === 'CASH' ? "Venta mostrador / General (Opcional)" : "Buscar cliente (Obligatorio)"}
              allowClear={true}
            />
            {saleType === 'CREDIT' && !selectedClientId && (
              <p className="text-xs text-danger flex items-center gap-1 mt-1">
                Las ventas a crédito requieren un cliente registrado.
              </p>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 bg-bg-surface flex flex-col gap-3 min-h-[150px]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-text-muted text-sm text-center px-4">
                <ShoppingCart size={32} className="mb-2 opacity-30" />
                <p>El carrito está vacío. Selecciona productos del catálogo.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product.id} className="flex flex-col gap-2 p-3 rounded-lg border border-border-medium bg-bg-page relative group">
                  <div className="flex justify-between items-start pr-6">
                    <span className="font-medium text-text-primary text-sm leading-tight">{item.product.name}</span>
                    <span className="font-semibold text-text-primary text-sm whitespace-nowrap ml-2">
                      {formatPrice(item.product.sale_price * item.quantity)}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-text-muted">{formatPrice(item.product.sale_price)} c/u</div>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-3 bg-bg-surface border border-border-medium rounded-md px-2 py-1">
                      <button 
                        onClick={() => updateQuantity(item.product.id, -1)}
                        disabled={item.quantity <= 1 || isCheckingOut}
                        className="text-text-muted hover:text-text-primary disabled:opacity-30"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, 1)}
                        disabled={item.quantity >= item.product.stock || isCheckingOut}
                        className="text-text-muted hover:text-text-primary disabled:opacity-30"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    disabled={isCheckingOut}
                    className="absolute top-2 right-2 text-text-muted opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger/10 p-1 rounded transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Dynamic Fields & Checkout Section */}
          <div className="p-4 border-t border-border-light bg-bg-page flex flex-col gap-4">
            
            {/* Options based on sale type */}
            {saleType === 'CREDIT' ? (
              <div className="grid grid-cols-2 gap-3 mb-2">
                <Input 
                  type="date"
                  label="Vencimiento (Opcional)"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={isCheckingOut}
                  className="w-full"
                />
                <NumericInput 
                  label="Abono Inicial (Opcional)"
                  placeholder="0"
                  leftIcon={<DollarSign size={16} />}
                  value={initialPaymentStr}
                  onChange={(e) => setInitialPaymentStr(e.target.value)}
                  disabled={isCheckingOut}
                  className="w-full"
                  max={cartTotal}
                />
              </div>
            ) : null}

            {/* Payment Method */}
            {(saleType === 'CASH' || (saleType === 'CREDIT' && initialPaymentNum > 0)) && (
               <Select
                 label="Método de Pago"
                 value={paymentMethod}
                 onChange={(e) => setPaymentMethod(e.target.value)}
                 options={PAYMENT_METHODS}
                 disabled={isCheckingOut}
               />
            )}

            <Input 
              placeholder="Notas de la venta (opcional)" 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isCheckingOut}
            />
            
            <div className="flex flex-col gap-1 mb-2">
              <div className="flex justify-between items-center text-text-secondary text-sm">
                <span>Subtotal</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
              {saleType === 'CREDIT' && (
                <>
                  <div className="flex justify-between items-center text-text-secondary text-sm">
                    <span>Abono Inicial</span>
                    <span className="text-brand-primary">{formatPrice(initialPaymentNum)}</span>
                  </div>
                  <div className="flex justify-between items-end mt-2 pt-2 border-t border-border-light">
                    <span className="text-text-primary font-medium">Saldo Pendiente</span>
                    <span className="text-xl font-bold text-text-primary">
                      {formatPrice(balanceDue)}
                    </span>
                  </div>
                </>
              )}
              {saleType === 'CASH' && (
                <div className="flex justify-between items-end mt-2 pt-2 border-t border-border-light">
                  <span className="text-text-primary font-medium">Total a Cobrar</span>
                  <span className="text-3xl font-bold text-text-primary tracking-tight">
                    {formatPrice(cartTotal)}
                  </span>
                </div>
              )}
            </div>
            
            <ActionGlowButton 
              onClick={handleCheckoutIntent}
              disabled={cart.length === 0 || isCheckingOut}
              isLoading={isCheckingOut}
              className="w-full py-4 text-lg"
            >
              <CreditCard className="mr-2" />
              {isCheckingOut ? 'Procesando...' : (saleType === 'CREDIT' ? 'Generar Crédito' : 'Procesar Venta')}
            </ActionGlowButton>
          </div>
        </div>

      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !isCheckingOut && setIsConfirmModalOpen(false)}
        title="Confirmar Venta a Crédito"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Al confirmar, se registrará una cuenta por cobrar a nombre del cliente.
          </p>
          
          <div className="bg-bg-page border border-border-medium rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Cliente:</span>
              <span className="font-medium text-text-primary">
                {clients.find(c => c.id === selectedClientId)?.full_name}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Vencimiento:</span>
              <span className="font-medium text-text-primary">{dueDate || 'Sin definir'}</span>
            </div>
            <div className="border-t border-border-light my-2"></div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Total Venta:</span>
              <span className="font-medium text-text-primary">{formatPrice(cartTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Abono Inicial:</span>
              <span className="font-medium text-brand-primary">{formatPrice(initialPaymentNum)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span className="text-text-primary">Saldo Pendiente:</span>
              <span className="text-danger">{formatPrice(balanceDue)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-light">
            <button
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isCheckingOut}
              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <ActionGlowButton
              onClick={processSale}
              isLoading={isCheckingOut}
            >
              Confirmar Venta
            </ActionGlowButton>
          </div>
        </div>
      </Modal>

      {/* Success & Invoice Modal */}
      <Modal
        isOpen={!!completedInvoice}
        onClose={() => {
          setCompletedInvoice(null);
          resetForm();
        }}
        title="Venta Registrada Exitosamente"
      >
        <div className="flex flex-col items-center justify-center space-y-6 py-4">
          <div className="h-20 w-20 bg-success/10 rounded-full flex items-center justify-center">
            <CheckCircle2 size={40} className="text-success" />
          </div>
          
          <div className="text-center">
            <h3 className="text-xl font-bold text-text-primary">¡Venta Completada!</h3>
            <p className="text-text-secondary mt-1">Se ha generado el comprobante <strong>{completedInvoice?.invoice_number}</strong></p>
          </div>

          <div className="flex flex-col w-full gap-3 mt-4">
            <ActionGlowButton 
              onClick={handleDownloadInvoice}
              className="w-full flex justify-center py-3"
            >
              <Download className="mr-2" size={18} />
              Descargar Comprobante PDF
            </ActionGlowButton>
            
            <button
              onClick={() => {
                setCompletedInvoice(null);
                resetForm();
              }}
              className="w-full py-3 text-sm font-medium text-text-secondary hover:text-text-primary bg-bg-surface hover:bg-bg-elevated border border-border-medium rounded-lg transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
