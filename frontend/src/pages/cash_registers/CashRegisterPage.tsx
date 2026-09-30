import { useState, useMemo } from 'react';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { useQuery } from '@tanstack/react-query';
import { cashRegisterService } from '../../services/cashRegisterService';
import { formatCurrency, formatDate } from '@shared/utils/formatters';
import { NumericInput } from '@shared/ui/NumericInput';
import { Button } from '@shared/ui/Button';
import { Select } from '@shared/ui/Select';
import { Modal } from '@shared/ui/Modal';
import { SectionEyebrow } from '@shared/ui/SectionEyebrow';
import { StatusBadge } from '@shared/ui/StatusBadge';
import { ActionGlowButton } from '@shared/ui/ActionGlowButton';
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
  ArrowDownRight,
  History,
  FileText,
  Lock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Receipt
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { CashRegister, PaymentMethodReconciliation } from '@shared/types/cash_register';

export const CashRegisterPage = () => {
  const { activeRegister, activeSummary, allRegisters, openRegister, closeRegister, createMovement } = useCashRegisters();

  const [currentTab, setCurrentTab] = useState<'shift' | 'history'>('shift');
  const [selectedHistoricalRegister, setSelectedHistoricalRegister] = useState<CashRegister | null>(null);

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
        return <Banknote className="text-emerald-400" size={16} />;
      case 'TRANSFER':
      case 'TRANSFERENCIA':
        return <ArrowLeftRight className="text-indigo-400" size={16} />;
      case 'CARD':
      case 'TARJETA':
        return <CreditCard className="text-amber-400" size={16} />;
      default:
        return <Wallet className="text-brand-primary" size={16} />;
    }
  };

  const handleOpen = async () => {
    try {
      await openRegister.mutateAsync({ opening_balance: openingBalance });
      toast.success('Caja abierta correctamente');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al abrir caja';
      toast.error(message);
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
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al cerrar caja';
      toast.error(message);
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
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Error al crear movimiento';
      toast.error(message);
    }
  };

  if (activeRegister.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-text-muted space-y-3">
        <Coins className="animate-bounce text-brand-primary" size={32} />
        <p className="text-sm font-mono tracking-wider uppercase text-text-secondary">Sincronizando estado de caja...</p>
      </div>
    );
  }

  const isOpen = !!activeRegister.data;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border-subtle pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <SectionEyebrow
              index="08"
              label="GESTIÓN FINANCIERA // CAJA & ARQUEO"
              title="Caja y Arqueo Diario"
            />
            {isOpen ? (
              <StatusBadge status="open" label="TURNO EN CURSO" mode="pill" size="sm" />
            ) : (
              <StatusBadge status="closed" label="CAJA CERRADA" mode="pill" size="sm" />
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Control de turno en efectivo, arqueo físico, conciliación de medios electrónicos y registro de novedades.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-surface-raised/70 rounded-xl p-1 border border-border-subtle shrink-0">
          <button
            type="button"
            onClick={() => setCurrentTab('shift')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              currentTab === 'shift'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Turno Actual
          </button>
          <button
            type="button"
            onClick={() => setCurrentTab('history')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'history'
                ? 'bg-brand-primary text-white shadow-xs'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <History size={13} />
            <span>Historial de Cierres</span>
          </button>
        </div>
      </div>

      {currentTab === 'history' ? (
        /* HISTORIAL DE TURNOS */
        <div className="rounded-2xl border border-border-subtle bg-surface-panel/90 p-0 overflow-hidden shadow-subtle backdrop-blur-md">
          <div className="p-4 border-b border-border-subtle flex items-center justify-between bg-surface-raised/40">
            <div>
              <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                <Receipt size={16} className="text-brand-primary" />
                <span>Auditoría de Turnos Anteriores</span>
              </h2>
              <p className="text-xs text-text-muted">Consulta turnos cerrados, diferencias de arqueo y notas de supervisión.</p>
            </div>
            {allRegisters.data && (
              <span className="text-xs font-mono text-text-muted bg-surface-base px-2.5 py-1 rounded-md border border-border-subtle">
                {allRegisters.data.length} Turnos registrados
              </span>
            )}
          </div>
          <div className="overflow-x-auto min-h-75">
            {allRegisters.isLoading ? (
              <div className="flex items-center justify-center h-48 text-text-muted text-sm font-mono">
                Cargando historial de cajas...
              </div>
            ) : !allRegisters.data || allRegisters.data.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-52 text-text-muted space-y-2">
                <History size={40} className="opacity-20" />
                <p className="text-sm font-medium">No hay turnos de caja registrados en el historial.</p>
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-text-muted uppercase bg-surface-raised/80 border-b border-border-subtle font-semibold tracking-wider font-mono">
                  <tr>
                    <th className="px-5 py-3.5">Turno</th>
                    <th className="px-5 py-3.5">Apertura</th>
                    <th className="px-5 py-3.5">Cierre</th>
                    <th className="px-5 py-3.5 text-right">Base</th>
                    <th className="px-5 py-3.5 text-right">Contado</th>
                    <th className="px-5 py-3.5 text-right">Diferencia</th>
                    <th className="px-5 py-3.5 text-center">Estado</th>
                    <th className="px-5 py-3.5">Notas de Cierre</th>
                    <th className="px-5 py-3.5 text-right">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {allRegisters.data.map((reg) => (
                    <tr key={reg.id} className="hover:bg-surface-panel-hover transition-colors">
                      <td className="px-5 py-3.5 font-mono text-text-secondary font-bold">#{reg.id}</td>
                      <td className="px-5 py-3.5 text-xs text-text-secondary font-mono">{formatDate(reg.opened_at)}</td>
                      <td className="px-5 py-3.5 text-xs text-text-secondary font-mono">{reg.closed_at ? formatDate(reg.closed_at) : 'En curso'}</td>
                      <td className="px-5 py-3.5 text-right text-text-primary font-mono font-medium">{formatCurrency(reg.opening_balance)}</td>
                      <td className="px-5 py-3.5 text-right text-text-primary font-mono font-medium">{reg.counted_balance !== null ? formatCurrency(reg.counted_balance) : '—'}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold">
                        {reg.difference !== null ? (
                          <span className={reg.difference === 0 ? 'text-emerald-400' : (reg.difference > 0 ? 'text-amber-400' : 'text-rose-400')}>
                            {reg.difference > 0 ? `+${formatCurrency(reg.difference)}` : formatCurrency(reg.difference)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <StatusBadge
                          status={reg.status === 'OPEN' ? 'open' : 'closed'}
                          size="sm"
                          mode="pill"
                          label={reg.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
                        />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-text-secondary max-w-xs truncate" title={reg.closing_notes || ''}>
                        {reg.closing_notes ? (
                          <span className="flex items-center gap-1.5">
                            <FileText size={13} className="text-brand-primary shrink-0" />
                            <span className="truncate">{reg.closing_notes}</span>
                          </span>
                        ) : (
                          <span className="text-text-muted italic">Sin novedades</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedHistoricalRegister(reg)}
                          className="px-3 py-1.5 text-xs font-semibold bg-surface-raised border border-border-medium rounded-lg hover:bg-surface-panel-hover transition-colors text-text-secondary cursor-pointer"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : !activeRegister.data ? (
        /* APERTURA DE CAJA - TERMINAL COMMAND */
        <div className="max-w-md mx-auto mt-6">
          <div className="rounded-2xl border border-border-subtle bg-surface-panel/95 backdrop-blur-xl p-8 shadow-elevated border-t-2 border-t-brand-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 rounded-full blur-2xl pointer-events-none" />

            <div className="text-center space-y-4 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center mx-auto text-brand-primary shadow-glow">
                <Banknote size={32} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-text-primary tracking-tight">Apertura de Turno de Caja</h2>
                <p className="text-xs text-text-secondary leading-relaxed">
                  No hay un turno activo. Define la base inicial de efectivo en caja para habilitar ventas en POS, suscripciones y recaudos.
                </p>
              </div>

              <div className="pt-2 text-left space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-muted font-mono">
                  Base Inicial (Efectivo Físico)
                </label>
                <NumericInput
                  placeholder="0"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(Number(e.target.value) || 0)}
                  min={0}
                />

                {/* Presets de base sugerida */}
                <div className="flex gap-2 pt-1">
                  {[50000, 100000, 200000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setOpeningBalance(preset)}
                      className="flex-1 py-1 text-[11px] font-mono text-text-muted bg-surface-base hover:bg-surface-raised border border-border-subtle rounded-md transition-colors cursor-pointer"
                    >
                      {formatCurrency(preset)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <ActionGlowButton
                  className="w-full text-sm font-bold py-2.5"
                  onClick={handleOpen}
                  disabled={openRegister.isPending}
                >
                  <Sparkles size={16} />
                  <span>{openRegister.isPending ? 'Abriendo Turno...' : 'Abrir Turno de Caja'}</span>
                </ActionGlowButton>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CAJA ABIERTA: DASHBOARD + ARQUEO + CONCILIACIÓN */
        <div className="space-y-6">
          {/* RESUMEN DEL TURNO (FINANCIAL KPI CARDS) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Estado */}
            <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-brand-primary">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">Turno Operativo</span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black text-brand-primary font-mono tracking-tight">EN LÍNEA</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-1 font-mono">
                  <Clock size={12} className="text-text-muted" />
                  <span>{formatDate(activeRegister.data.opened_at)}</span>
                </div>
              </div>
            </div>

            {/* Base Inicial */}
            <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-emerald-500">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">Base Inicial</span>
                <Wallet size={15} className="text-emerald-400" />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-text-primary font-mono">
                  {formatCurrency(openingBal)}
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">Fondo de apertura</p>
              </div>
            </div>

            {/* Entradas Efectivo */}
            <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-indigo-500">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">Entradas Efectivo</span>
                <ArrowUpRight size={16} className="text-emerald-400" />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-emerald-400 font-mono">
                  +{formatCurrency(cashIncomes)}
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">Ventas & abonos</p>
              </div>
            </div>

            {/* Salidas Efectivo */}
            <div className="rounded-xl border border-border-subtle bg-surface-panel/90 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-rose-500">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted font-mono">Salidas Efectivo</span>
                <ArrowDownRight size={16} className="text-rose-400" />
              </div>
              <div className="mt-2">
                <span className="text-xl font-bold text-rose-400 font-mono">
                  -{formatCurrency(cashOutcomes)}
                </span>
                <p className="text-[11px] text-text-muted mt-0.5">Gastos & retiros</p>
              </div>
            </div>

            {/* Efectivo Esperado */}
            <div className="rounded-xl border border-brand-primary/30 bg-surface-panel/95 p-4 shadow-subtle flex flex-col justify-between border-t-2 border-t-brand-primary relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-primary font-mono">Efectivo Esperado</span>
                <Coins size={16} className="text-brand-primary" />
              </div>
              <div className="mt-2">
                <span className="text-2xl font-black text-text-primary tracking-tight font-mono">
                  {formatCurrency(expectedCash)}
                </span>
                <p className="text-[11px] text-text-muted mt-0.5 font-mono">Base + Entradas - Salidas</p>
              </div>
            </div>
          </div>

          {/* MAIN GRID: MOVEMENTS (7 Cols) / ARQUEO & CONCILIACIÓN (5 Cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

            {/* LEFT COLUMN: MOVIMIENTOS DE CAJA (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-border-subtle bg-surface-panel/90 backdrop-blur-md p-5 shadow-subtle">
                <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-3">
                  <div>
                    <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                      <Banknote size={17} className="text-brand-primary" />
                      <span>Movimientos de Efectivo</span>
                    </h2>
                    <p className="text-xs text-text-muted">Flujo físico detallado dentro del turno</p>
                  </div>
                  <Button
                    size="sm"
                    variant={showMovementForm ? 'secondary' : 'primary'}
                    onClick={() => setShowMovementForm(!showMovementForm)}
                    className="flex items-center gap-1.5 cursor-pointer text-xs"
                  >
                    <Plus size={14} />
                    <span>{showMovementForm ? 'Cerrar' : 'Nuevo Movimiento'}</span>
                  </Button>
                </div>

                {/* Formulario de movimiento manual */}
                {showMovementForm && (
                  <div className="bg-surface-base p-4 rounded-xl border border-border-subtle mb-4 space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-2">
                      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">Registrar Flujo Manual</h3>
                      <span className="text-[11px] text-text-muted">Afecta el saldo de caja física</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de Movimiento</label>
                        <Select
                          value={movementType}
                          onChange={(e) => {
                            const val = e.target.value as 'IN' | 'OUT';
                            setMovementType(val);
                            setMovementCategory(val === 'IN' ? 'MANUAL_IN' : 'MANUAL_OUT');
                          }}
                          options={[
                            { value: 'IN', label: 'Entrada (+ Ingreso manual / Sencillo)' },
                            { value: 'OUT', label: 'Salida (- Gasto / Retiro / Compra)' },
                          ]}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1">Monto ($)</label>
                        <NumericInput
                          value={movementAmount}
                          onChange={(e) => setMovementAmount(Number(e.target.value) || 0)}
                          min={0}
                          placeholder="0"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-text-secondary mb-1">Concepto o Descripción</label>
                        <input
                          type="text"
                          className="flex h-9 w-full rounded-lg border border-border-medium bg-surface-panel px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:border-brand-primary focus-visible:ring-1 focus-visible:ring-brand-primary/30"
                          placeholder="Ej. Pago a proveedor de agua, compra de insumos, sencillo..."
                          value={movementDesc}
                          onChange={(e) => setMovementDesc(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1 border-t border-border-subtle">
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
                <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-base/60">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-surface-raised/80 text-text-muted text-[11px] uppercase border-b border-border-subtle font-semibold tracking-wider font-mono">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Hora</th>
                        <th className="px-4 py-2.5 font-semibold">Tipo</th>
                        <th className="px-4 py-2.5 font-semibold">Categoría</th>
                        <th className="px-4 py-2.5 font-semibold">Descripción</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-xs">
                      {activeMovements.data?.map((mov) => (
                        <tr key={mov.id} className="hover:bg-surface-panel-hover transition-colors">
                          <td className="px-4 py-3 text-text-secondary font-mono whitespace-nowrap">
                            {formatDate(mov.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded-full ${
                              mov.type === 'IN'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {mov.type === 'IN' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                              <span>{mov.type === 'IN' ? 'ENTRADA' : 'SALIDA'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {mov.category}
                          </td>
                          <td className="px-4 py-3 text-text-muted max-w-40 truncate" title={mov.description || ''}>
                            {mov.description || '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                            <span className={mov.type === 'IN' ? 'text-emerald-400' : 'text-rose-400'}>
                              {mov.type === 'IN' ? '+' : '-'}{formatCurrency(mov.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {(!activeMovements.data || activeMovements.data.length === 0) && (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-text-muted text-xs">
                            <Coins size={28} className="mx-auto opacity-20 mb-2" />
                            No hay movimientos de efectivo registrados en este turno.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: ARQUEO & CONCILIACIÓN (5 Cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl border border-border-subtle bg-surface-panel/95 backdrop-blur-md p-5 shadow-elevated space-y-5">

                {/* Header Cierre */}
                <div className="border-b border-border-subtle pb-3">
                  <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Coins size={18} className="text-brand-primary" />
                    <span>Arqueo & Conciliación de Turno</span>
                  </h2>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Verifica el efectivo físico y concilia medios electrónicos antes de cerrar.
                  </p>
                </div>

                {/* 1. ARQUEO DE EFECTIVO */}
                <div className="space-y-3 bg-surface-base/80 p-4 rounded-xl border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 font-mono">
                      <Banknote size={14} />
                      <span>1. Arqueo de Efectivo Físico</span>
                    </span>
                    <span className={`inline-flex items-center font-mono font-bold text-[10px] px-2 py-0.5 rounded-full ${
                      cashDiff === 0
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : (cashDiff > 0
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30')
                    }`}>
                      {cashDiff === 0 ? 'CUADRADO' : (cashDiff > 0 ? 'SOBRANTE' : 'FALTANTE')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] text-text-muted block font-mono">Efectivo Esperado</span>
                      <span className="text-base font-bold text-text-primary font-mono">
                        {formatCurrency(expectedCash)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-text-muted block font-mono">Diferencia</span>
                      <span className={`text-base font-bold font-mono ${cashDiff === 0 ? 'text-emerald-400' : (cashDiff > 0 ? 'text-amber-400' : 'text-rose-400')}`}>
                        {cashDiff > 0 ? `+${formatCurrency(cashDiff)}` : formatCurrency(cashDiff)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    <label className="block text-xs font-semibold text-text-primary mb-1">
                      Dinero Físico Contado en Caja ($)
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
                <div className="space-y-3 bg-surface-base/80 p-4 rounded-xl border border-border-subtle">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5 font-mono">
                      <CreditCard size={14} />
                      <span>2. Medios de Pago Electrónicos</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">
                    Verifica saldos en bancos o datáfonos para validar transacciones.
                  </p>

                  <div className="space-y-2.5 pt-1">
                    {reconciliationsList.map((item) => {
                      if (item.isCash) return null; // Cash is counted above
                      return (
                        <div
                          key={item.method}
                          className="p-3 bg-surface-panel/90 rounded-lg border border-border-subtle space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getMethodIcon(item.method)}
                              <span className="text-xs font-bold text-text-primary">
                                {item.label}
                              </span>
                            </div>
                            <span className={`inline-flex items-center font-mono font-bold text-[10px] px-2 py-0.5 rounded-full ${
                              item.diff === 0
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : (item.diff > 0
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/30')
                            }`}>
                              {item.diff === 0 ? 'CUADRADO' : (item.diff > 0 ? `+${formatCurrency(item.diff)}` : formatCurrency(item.diff))}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-text-muted text-[10px] block font-mono">Registrado ZonaFit</span>
                              <span className="font-semibold text-text-primary font-mono">
                                {formatCurrency(item.registered)}
                              </span>
                            </div>
                            <div>
                              <span className="text-text-muted text-[10px] block font-mono">Verificado Banco</span>
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
                      <p className="text-xs text-text-muted text-center py-2 italic font-mono">
                        No se registraron pagos electrónicos en este turno.
                      </p>
                    )}
                  </div>
                </div>

                {/* 3. RESUMEN FINAL & ESTADO GENERAL */}
                <div className="p-3.5 rounded-xl border border-border-subtle bg-surface-base/90 space-y-2.5 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Total Registrado Sistema:</span>
                    <span className="font-bold text-text-primary">{formatCurrency(totalRegistered)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Total Verificado Auditoría:</span>
                    <span className="font-bold text-text-primary">{formatCurrency(totalVerified)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
                    <span className="font-bold text-text-primary uppercase">Diferencia General:</span>
                    <span className={`text-base font-black ${totalDifference === 0 ? 'text-emerald-400' : (totalDifference > 0 ? 'text-amber-400' : 'text-rose-400')}`}>
                      {totalDifference > 0 ? `+${formatCurrency(totalDifference)}` : formatCurrency(totalDifference)}
                    </span>
                  </div>

                  {/* Alerta de Estado */}
                  <div className={`p-2.5 rounded-lg border text-xs font-sans flex items-start gap-2 ${
                    !hasDifferences
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  }`}>
                    {!hasDifferences ? (
                      <>
                        <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
                        <span className="font-medium">Todos los medios de pago y el efectivo físico están cuadrados.</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-400" />
                        <div>
                          <p className="font-semibold text-amber-300">Diferencias detectadas:</p>
                          <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[11px] text-amber-200/90 font-mono">
                            {reconciliationsList
                              .filter((r) => r.diff !== 0)
                              .map((r) => (
                                <li key={r.method}>
                                  {r.label}: {r.diff > 0 ? `+${formatCurrency(r.diff)} (Sobrante)` : `-${formatCurrency(Math.abs(r.diff))} (Faltante)`}
                                </li>
                              ))}
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Notas de Cierre */}
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-text-primary">
                    Notas y Observaciones de Cierre (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full rounded-lg border border-border-medium bg-surface-base px-3 py-2 text-xs text-text-primary focus-visible:outline-none focus-visible:border-brand-primary focus-visible:ring-1 focus-visible:ring-brand-primary/30 placeholder:text-text-muted"
                    placeholder="Justificación de novedades, justificaciones de diferencias..."
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                  />
                </div>

                {/* Botón de Cierre */}
                <Button
                  variant="danger"
                  className="w-full py-2.5 text-xs font-bold shadow-lg flex items-center justify-center gap-2"
                  onClick={handleClose}
                  disabled={closeRegister.isPending}
                >
                  <Lock size={14} />
                  <span>{closeRegister.isPending ? 'Cerrando Caja...' : 'Cerrar Turno de Caja'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Historical Register Detail Modal */}
      {selectedHistoricalRegister && (
        <Modal
          isOpen={!!selectedHistoricalRegister}
          onClose={() => setSelectedHistoricalRegister(null)}
          title={`Auditoría de Turno de Caja #${selectedHistoricalRegister.id}`}
        >
          <div className="space-y-4 text-sm font-sans">
            <div className="grid grid-cols-2 gap-3 bg-surface-base p-3.5 rounded-xl border border-border-subtle font-mono">
              <div>
                <span className="text-[10px] text-text-muted uppercase block">Apertura</span>
                <span className="text-xs font-semibold text-text-primary">{formatDate(selectedHistoricalRegister.opened_at)}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase block">Cierre</span>
                <span className="text-xs font-semibold text-text-primary">{selectedHistoricalRegister.closed_at ? formatDate(selectedHistoricalRegister.closed_at) : 'En curso'}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase block">Base Inicial</span>
                <span className="text-sm font-bold text-text-primary">{formatCurrency(selectedHistoricalRegister.opening_balance)}</span>
              </div>
              <div>
                <span className="text-[10px] text-text-muted uppercase block">Efectivo Contado</span>
                <span className="text-sm font-bold text-text-primary">{selectedHistoricalRegister.counted_balance !== null ? formatCurrency(selectedHistoricalRegister.counted_balance) : '—'}</span>
              </div>
            </div>

            {selectedHistoricalRegister.difference !== null && (
              <div className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-surface-base font-mono">
                <span className="text-xs font-semibold text-text-secondary uppercase">Diferencia Final:</span>
                <span className={`text-base font-black ${selectedHistoricalRegister.difference === 0 ? 'text-emerald-400' : (selectedHistoricalRegister.difference > 0 ? 'text-amber-400' : 'text-rose-400')}`}>
                  {selectedHistoricalRegister.difference > 0 ? `+${formatCurrency(selectedHistoricalRegister.difference)}` : formatCurrency(selectedHistoricalRegister.difference)}
                </span>
              </div>
            )}

            {/* Notas y Observaciones de Cierre */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5 font-mono">
                <FileText size={13} className="text-brand-primary" />
                <span>Notas y Observaciones de Cierre</span>
              </span>
              <div className="p-3 bg-surface-base rounded-lg border border-border-subtle text-xs text-text-primary min-h-16 whitespace-pre-wrap leading-relaxed">
                {selectedHistoricalRegister.closing_notes || 'No se registraron notas en este turno.'}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
