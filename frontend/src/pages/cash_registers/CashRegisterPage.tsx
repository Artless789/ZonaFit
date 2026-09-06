import { useState, useMemo, useEffect } from 'react';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { useQuery } from '@tanstack/react-query';
import { cashRegisterService } from '../../services/cashRegisterService';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { NumericInput } from '@shared/ui/NumericInput';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';
import { Select } from '@shared/ui/Select';
import { 
  Banknote, 
  CreditCard, 
  ArrowLeftRight, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { PaymentMethodReconciliation } from '@shared/types/cash_register';

export const CashRegisterPage = () => {
  const { activeRegister, activeSummary, openRegister, closeRegister, createMovement } = useCashRegisters();
  
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [countedCash, setCountedCash] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');
  
  // Custom verified amounts per payment method
  const [verifiedAmounts, setVerifiedAmounts] = useState<Record<string, number>>({});
  
  // Manual movement form state
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');
  const [movementCategory, setMovementCategory] = useState('MANUAL_IN');
  const [movementDesc, setMovementDesc] = useState('');
  const [showMovementForm, setShowMovementForm] = useState(false);

  const activeId = activeRegister.data?.id;

  const activeMovements = useQuery({
    queryKey: ['cash-movements', activeId],
    queryFn: () => cashRegisterService.getMovements(activeId!),
    enabled: !!activeId,
  });

  const summary = activeSummary.data;

  // Expected Cash calculation
  const openingBal = summary?.opening_balance ?? Number(activeRegister.data?.opening_balance || 0);
  const cashIncomes = summary?.cash_incomes ?? (activeMovements.data?.filter(m => m.type === 'IN').reduce((acc, m) => acc + Number(m.amount), 0) || 0);
  const cashOutcomes = summary?.cash_outcomes ?? (activeMovements.data?.filter(m => m.type === 'OUT').reduce((acc, m) => acc + Number(m.amount), 0) || 0);
  const expectedCash = summary?.expected_cash ?? (openingBal + cashIncomes - cashOutcomes);
  const cashDiff = countedCash - expectedCash;

  // Payment methods list
  const paymentMethods = useMemo(() => {
    return summary?.payment_methods || [
      { method: 'CASH', label: 'Efectivo', registered_amount: cashIncomes }
    ];
  }, [summary, cashIncomes]);

  // Sync initial verified amounts when summary loads
  useEffect(() => {
    if (paymentMethods.length > 0) {
      setVerifiedAmounts((prev) => {
        const next = { ...prev };
        paymentMethods.forEach((pm) => {
          if (pm.method !== 'CASH' && next[pm.method] === undefined) {
            next[pm.method] = pm.registered_amount;
          }
        });
        return next;
      });
    }
  }, [paymentMethods]);

  // Total reconciliations
  const reconciliationsList = useMemo(() => {
    return paymentMethods.map((pm) => {
      const isCash = pm.method === 'CASH';
      const registered = isCash ? expectedCash : pm.registered_amount;
      const verified = isCash ? countedCash : (verifiedAmounts[pm.method] ?? pm.registered_amount);
      const diff = verified - registered;
      const status = diff === 0 ? 'CUADRADO' : (diff > 0 ? 'SOBRANTE' : 'FALTANTE');
      return {
        method: pm.method,
        label: pm.label,
        registered,
        verified,
        diff,
        status,
        isCash,
      };
    });
  }, [paymentMethods, expectedCash, countedCash, verifiedAmounts]);

  const totalRegistered = useMemo(() => {
    return reconciliationsList.reduce((acc, r) => acc + r.registered, 0);
  }, [reconciliationsList]);

  const totalVerified = useMemo(() => {
    return reconciliationsList.reduce((acc, r) => acc + r.verified, 0);
  }, [reconciliationsList]);

  const totalDifference = totalVerified - totalRegistered;
  const hasDifferences = reconciliationsList.some((r) => r.diff !== 0);

  const getMethodIcon = (method: string) => {
    switch (method.toUpperCase()) {
      case 'CASH':
        return <Banknote className="text-emerald-400" size={18} />;
      case 'TRANSFER':
      case 'TRANSFERENCIA':
        return <ArrowLeftRight className="text-indigo-400" size={18} />;
      case 'CARD':
      case 'TARJETA':
        return <CreditCard className="text-amber-400" size={18} />;
      default:
        return <Wallet className="text-brand-primary" size={18} />;
    }
  };

  const handleOpen = async () => {
    try {
      await openRegister.mutateAsync({ opening_balance: openingBalance });
      toast.success('Caja abierta correctamente');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Error al abrir caja');
    }
  };

  const handleClose = async () => {
    if (!activeId) return;

    const payloadReconciliations: PaymentMethodReconciliation[] = reconciliationsList.map((r) => ({
      method: r.method,
      registered_amount: r.registered,
      verified_amount: r.verified,
      difference: r.diff,
      status: r.status,
    }));

    try {
      await closeRegister.mutateAsync({
        registerId: activeId,
        data: {
          counted_balance: countedCash,
          closing_notes: closingNotes.trim() || undefined,
          reconciliations: payloadReconciliations,
        },
      });
      toast.success('Caja cerrada y conciliada correctamente');
      setCountedCash(0);
      setClosingNotes('');
      setVerifiedAmounts({});
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Error al cerrar caja');
    }
  };

  const handleCreateMovement = async () => {
    if (movementAmount <= 0) {
      toast.error('El monto debe ser mayor a cero.');
      return;
    }
    try {
      await createMovement.mutateAsync({
        amount: movementAmount,
        type: movementType,
        category: movementCategory,
        description: movementDesc.trim() || undefined,
      });
      toast.success('Movimiento registrado');
      setShowMovementForm(false);
      setMovementAmount(0);
      setMovementDesc('');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Error al crear movimiento');
    }
  };

  if (activeRegister.isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-text-muted">
        Cargando estado de caja...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Caja y Conciliación</h1>
          <p className="text-sm text-text-secondary">
            Control de turno, arqueo de efectivo y conciliación de medios de pago.
          </p>
        </div>
      </div>

      {!activeRegister.data ? (
        /* APERTURA DE CAJA */
        <div className="rounded-2xl border border-border-light bg-bg-surface/50 backdrop-blur-md max-w-md mx-auto mt-10 p-8 shadow-glass">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mx-auto text-brand-primary shadow-glow">
              <Banknote size={32} />
            </div>
            <h2 className="text-xl font-bold text-text-primary">Apertura de Caja</h2>
            <p className="text-sm text-text-secondary">
              No hay ninguna caja abierta actualmente. Ingresa la base inicial en efectivo para iniciar el turno.
            </p>

            <div className="mt-6 text-left">
              <label className="block text-xs font-semibold uppercase text-text-muted mb-1">
                Base Inicial (Efectivo)
              </label>
              <NumericInput
                placeholder="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                min={0}
              />
            </div>

            <Button
              className="w-full mt-6"
              onClick={handleOpen}
              disabled={openRegister.isPending}
            >
              {openRegister.isPending ? 'Abriendo...' : 'Abrir Turno de Caja'}
            </Button>
          </div>
        </div>
      ) : (
        /* CAJA ABIERTA: DASHBOARD + ARQUEO + CONCILIACIÓN */
        <div className="space-y-6">
          {/* RESUMEN DEL TURNO (KPI CARDS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Estado */}
            <div className="rounded-2xl border border-border-light bg-bg-surface/50 backdrop-blur-md p-4 shadow-glass border-t-4 border-t-brand-primary flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-text-muted">Estado</span>
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2">
                <span className="text-lg font-bold text-brand-primary">ABIERTA</span>
                <div className="flex items-center gap-1 text-[11px] text-text-muted mt-1">
                  <Clock size={12} />
                  <span>{formatDate(activeRegister.data.opened_at)}</span>
                </div>
              </div>
            </div>

            {/* Base Inicial */}
            <div className="rounded-2xl border border-border-light bg-bg-surface/50 backdrop-blur-md p-4 shadow-glass border-t-4 border-t-emerald-500 flex flex-col justify-between">
              <span className="text-xs font-semibold uppercase text-text-muted">Base Inicial</span>
              <div className="mt-2">
                <span className="text-xl font-bold text-text-primary">
                  {formatCurrency(openingBal)}
                </span>
                <p className="text-[11px] text-text-muted mt-1">Fondo de apertura</p>
              </div>
            </div>

            {/* Entradas Efectivo */}
            <div className="rounded-2xl border border-border-light bg-bg-surface/50 backdrop-blur-md p-4 shadow-glass border-t-4 border-t-indigo-500 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-text-muted">Entradas Efectivo</span>
                <ArrowUpRight size={16} className="text-emerald-400" />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-emerald-400">
                  +{formatCurrency(cashIncomes)}
                </span>
                <p className="text-[11px] text-text-muted mt-1">Ventas & abonos en efectivo</p>
              </div>
            </div>

            {/* Salidas Efectivo */}
            <div className="rounded-2xl border border-border-light bg-bg-surface/50 backdrop-blur-md p-4 shadow-glass border-t-4 border-t-rose-500 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-text-muted">Salidas Efectivo</span>
                <ArrowDownRight size={16} className="text-rose-400" />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-rose-400">
                  -{formatCurrency(cashOutcomes)}
                </span>
                <p className="text-[11px] text-text-muted mt-1">Gastos & retiros manuales</p>
              </div>
            </div>

            {/* Efectivo Esperado */}
            <div className="rounded-2xl border border-brand-primary/30 bg-bg-surface/60 backdrop-blur-md p-4 shadow-glow flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-brand-primary">Efectivo Esperado</span>
                <Coins size={16} className="text-brand-primary" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-text-primary">
                  {formatCurrency(expectedCash)}
                </span>
                <p className="text-[11px] text-text-muted mt-1">Base + Entradas - Salidas</p>
              </div>
            </div>
          </div>

          {/* MAIN GRID: LEFT (MOVEMENTS) / RIGHT (ARQUEO & RECONCILIATION) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: CASH MOVEMENTS (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="rounded-2xl border border-border-light bg-bg-surface/40 backdrop-blur-md p-6 shadow-glass">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-text-primary">Movimientos de Efectivo</h2>
                    <p className="text-xs text-text-muted">Registro detallado de dinero físico en caja</p>
                  </div>
                  <Button
                    size="sm"
                    variant={showMovementForm ? 'secondary' : 'primary'}
                    onClick={() => setShowMovementForm(!showMovementForm)}
                    className="flex items-center gap-1.5"
                  >
                    <Plus size={16} />
                    <span>{showMovementForm ? 'Cerrar' : 'Nuevo Movimiento'}</span>
                  </Button>
                </div>

                {/* Formulario de movimiento manual */}
                {showMovementForm && (
                  <div className="bg-bg-elevated/60 p-4 rounded-xl border border-border-medium mb-4 space-y-4 animate-in fade-in duration-200">
                    <h3 className="text-sm font-semibold text-text-primary">Registrar Movimiento Manual</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
                        <Select
                          value={movementType}
                          onChange={(e) => {
                            const val = e.target.value as 'IN' | 'OUT';
                            setMovementType(val);
                            setMovementCategory(val === 'IN' ? 'MANUAL_IN' : 'MANUAL_OUT');
                          }}
                          options={[
                            { value: 'IN', label: 'Entrada (Ingreso manual / Sencillo)' },
                            { value: 'OUT', label: 'Salida (Gasto / Retiro de efectivo)' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Monto</label>
                        <NumericInput
                          value={movementAmount}
                          onChange={(e) => setMovementAmount(Number(e.target.value) || 0)}
                          min={0}
                          placeholder="0"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-text-secondary mb-1">Descripción</label>
                        <input
                          type="text"
                          className="flex h-10 w-full rounded-xl border border-border-medium bg-bg-surface/60 px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
                          placeholder="Ej. Pago a proveedor, Compra de insumos, Sencillo..."
                          value={movementDesc}
                          onChange={(e) => setMovementDesc(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="secondary" size="sm" onClick={() => setShowMovementForm(false)}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleCreateMovement} disabled={createMovement.isPending}>
                        {createMovement.isPending ? 'Guardando...' : 'Guardar Movimiento'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tabla de movimientos */}
                <div className="overflow-x-auto rounded-xl border border-border-medium bg-bg-surface/20">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-bg-surface/80 text-text-muted text-xs uppercase border-b border-border-light">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Hora</th>
                        <th className="px-4 py-3 font-semibold">Tipo</th>
                        <th className="px-4 py-3 font-semibold">Categoría</th>
                        <th className="px-4 py-3 font-semibold">Descripción</th>
                        <th className="px-4 py-3 font-semibold text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-light/60">
                      {activeMovements.data?.map((mov) => (
                        <tr key={mov.id} className="hover:bg-bg-surface/40 transition-colors">
                          <td className="px-4 py-3 text-xs text-text-secondary whitespace-nowrap">
                            {formatDate(mov.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={mov.type === 'IN' ? 'success' : 'danger'}>
                              {mov.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-text-primary">
                            {mov.category}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-muted max-w-45 truncate" title={mov.description || ''}>
                            {mov.description || '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                            <span className={mov.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}>
                              {mov.type === 'IN' ? '+' : '-'}{formatCurrency(mov.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!activeMovements.data || activeMovements.data.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-text-muted text-xs">
                            No hay movimientos de efectivo registrados en este turno.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: CIERRE, ARQUEO & CONCILIACIÓN (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-border-light bg-bg-surface/50 backdrop-blur-md p-6 shadow-glass space-y-6">
                
                {/* Header Cierre */}
                <div className="border-b border-border-light pb-4">
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Coins size={20} className="text-brand-primary" />
                    <span>Cierre y Conciliación</span>
                  </h2>
                  <p className="text-xs text-text-secondary mt-1">
                    Verifica el efectivo físico y concilia los medios de pago electrónicos.
                  </p>
                </div>

                {/* 1. ARQUEO DE EFECTIVO */}
                <div className="space-y-3 bg-bg-elevated/40 p-4 rounded-xl border border-border-light">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Banknote size={14} />
                      <span>1. Arqueo de Efectivo</span>
                    </span>
                    <Badge variant={cashDiff === 0 ? 'success' : (cashDiff > 0 ? 'warning' : 'danger')}>
                      {cashDiff === 0 ? 'CUADRADO' : (cashDiff > 0 ? 'SOBRANTE' : 'FALTANTE')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-text-muted block">Efectivo Esperado</span>
                      <span className="text-base font-bold text-text-primary">
                        {formatCurrency(expectedCash)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-muted block">Diferencia</span>
                      <span className={`text-base font-bold ${cashDiff === 0 ? 'text-emerald-400' : (cashDiff > 0 ? 'text-amber-400' : 'text-rose-400')}`}>
                        {cashDiff > 0 ? `+${formatCurrency(cashDiff)}` : formatCurrency(cashDiff)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Dinero Físico Contado en Caja
                    </label>
                    <NumericInput
                      placeholder="0"
                      value={countedCash}
                      onChange={(e) => setCountedCash(Number(e.target.value) || 0)}
                      min={0}
                    />
                  </div>
                </div>

                {/* 2. CONCILIACIÓN POR MEDIO DE PAGO */}
                <div className="space-y-3 bg-bg-elevated/40 p-4 rounded-xl border border-border-light">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                      <CreditCard size={14} />
                      <span>2. Conciliación de Medios de Pago</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Verifica saldos en bancos o datáfonos.
                  </p>

                  <div className="space-y-3 pt-1">
                    {reconciliationsList.map((item) => {
                      if (item.isCash) return null; // Cash is already counted above
                      return (
                        <div
                          key={item.method}
                          className="p-3 bg-bg-surface/70 rounded-xl border border-border-medium space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getMethodIcon(item.method)}
                              <span className="text-xs font-bold text-text-primary">
                                {item.label}
                              </span>
                            </div>
                            <Badge variant={item.diff === 0 ? 'success' : (item.diff > 0 ? 'warning' : 'danger')}>
                              {item.diff === 0 ? 'CUADRADO' : (item.diff > 0 ? `+${formatCurrency(item.diff)}` : formatCurrency(item.diff))}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-text-muted text-[10px] block">Registrado ZonaFit</span>
                              <span className="font-semibold text-text-primary">
                                {formatCurrency(item.registered)}
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted text-[10px] block">Verificado (Banco/Datáfono)</span>
                              <NumericInput
                                value={item.verified}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setVerifiedAmounts((prev) => ({
                                    ...prev,
                                    [item.method]: val,
                                  }));
                                }}
                                min={0}
                                placeholder="0"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {reconciliationsList.filter(r => !r.isCash).length === 0 && (
                      <p className="text-xs text-text-muted text-center py-2">
                        No se registraron pagos electrónicos (tarjetas/transferencias) en este turno.
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. RESUMEN FINAL & ESTADO GENERAL */}
                <div className="p-4 rounded-xl border border-border-medium bg-bg-surface/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Total Registrado:</span>
                    <span className="text-sm font-bold text-text-primary">{formatCurrency(totalRegistered)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-secondary">Total Verificado:</span>
                    <span className="text-sm font-bold text-text-primary">{formatCurrency(totalVerified)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border-light">
                    <span className="text-xs font-bold text-text-primary">Diferencia General:</span>
                    <span className={`text-base font-extrabold ${totalDifference === 0 ? 'text-emerald-400' : (totalDifference > 0 ? 'text-amber-400' : 'text-rose-400')}`}>
                      {totalDifference > 0 ? `+${formatCurrency(totalDifference)}` : formatCurrency(totalDifference)}
                    </span>
                  </div>

                  {/* Alerta de Estado */}
                  <div className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                    !hasDifferences 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    {!hasDifferences ? (
                      <>
                        <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                        <span>✓ Todos los medios de pago y el efectivo físico están cuadrados.</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">⚠️ Diferencias detectadas:</p>
                          <ul className="list-disc list-inside mt-1 space-y-0.5">
                            {reconciliationsList
                              .filter((r) => r.diff !== 0)
                              .map((r) => (
                                <li key={r.method}>
                                  {r.label}: {r.diff > 0 ? `+$${formatCurrency(r.diff)} (Sobrante)` : `-$${formatCurrency(Math.abs(r.diff))} (Faltante)`}
                                </li>
                              ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Notas de Cierre */}
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-1">
                    Notas de Cierre (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full rounded-xl border border-border-medium bg-bg-surface/60 px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
                    placeholder="Justificación de novedades, faltantes o sobrantes..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                  />
                </div>

                {/* Botón de Cierre */}
                <Button
                  variant="danger"
                  className="w-full py-3 text-sm font-bold shadow-lg"
                  onClick={handleClose}
                  disabled={closeRegister.isPending}
                >
                  {closeRegister.isPending ? 'Cerrando Caja...' : 'Cerrar Turno de Caja'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

