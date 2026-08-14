// @ts-nocheck
import { Select } from '../../components/shared/Select';
import React, { useState } from 'react';
import { useCashRegisters } from '../../hooks/useCashRegisters';
import { useQuery } from '@tanstack/react-query';
import { cashRegisterService } from '../../services/cashRegisterService';
import { Card, Title, Text, Metric, Flex, Grid, TextInput, NumberInput } from '@tremor/react';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PlusIcon, BanknotesIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { GlassCard } from '../../components/shared/GlassCard';
import { Button } from '../../components/shared/Button';
import { Badge } from '../../components/shared/Badge';

export const CashRegisterPage = () => {
  const { activeRegister, allRegisters, openRegister, closeRegister, createMovement } = useCashRegisters();
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [countedBalance, setCountedBalance] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');
  
  const [movementAmount, setMovementAmount] = useState<number>(0);
  const [movementType, setMovementType] = useState<'IN'|'OUT'>('IN');
  const [movementCategory, setMovementCategory] = useState('MANUAL_IN');
  const [movementDesc, setMovementDesc] = useState('');
  const [showMovementForm, setShowMovementForm] = useState(false);

  const activeId = activeRegister.data?.id;

  const activeMovements = useQuery({
    queryKey: ['cash-movements', activeId],
    queryFn: () => cashRegisterService.getMovements(activeId!),
    enabled: !!activeId,
  });

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
    try {
      await closeRegister.mutateAsync({ registerId: activeId, data: { counted_balance: countedBalance, closing_notes: closingNotes } });
      toast.success('Caja cerrada correctamente');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Error al cerrar caja');
    }
  };

  const handleCreateMovement = async () => {
    try {
      await createMovement.mutateAsync({
        amount: movementAmount,
        type: movementType,
        category: movementCategory,
        description: movementDesc,
      });
      toast.success('Movimiento registrado');
      setShowMovementForm(false);
      setMovementAmount(0);
      setMovementDesc('');
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Error al crear movimiento');
    }
  };

  if (activeRegister.isLoading) return <div>Cargando...</div>;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <Title className="text-2xl font-bold text-text-primary">Caja</Title>
          <Text className="text-text-secondary">Gestiona la apertura, cierre y movimientos de dinero físico.</Text>
        </div>
      </div>

      {!activeRegister.data ? (
        <GlassCard className="max-w-md mx-auto mt-10 p-6">
          <div className="text-center space-y-4">
            <BanknotesIcon className="w-16 h-16 mx-auto text-text-muted" />
            <Title className="text-text-primary">Apertura de Caja</Title>
            <Text className="text-text-secondary">No hay ninguna caja abierta. Ingresa el saldo inicial para comenzar.</Text>
            
            <div className="mt-4">
              <NumberInput 
                placeholder="Saldo inicial" 
                value={openingBalance} 
                onValueChange={setOpeningBalance} 
                min={0}
                icon={BanknotesIcon}
              />
            </div>
            
            <Button className="w-full mt-4" onClick={handleOpen} disabled={openRegister.isPending}>
              Abrir Caja
            </Button>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          <Grid numItems={1} numItemsSm={2} numItemsLg={4} className="gap-6">
            <GlassCard className="p-4 border-t-4 border-t-brand-primary">
              <Text className="text-text-secondary">Estado</Text>
              <Metric className="text-brand-primary">ABIERTA</Metric>
              <Text className="text-xs text-text-muted mt-2">
                Desde: {formatDate(activeRegister.data.opened_at)}
              </Text>
            </GlassCard>
            <GlassCard className="p-4 border-t-4 border-t-emerald-500">
              <Text className="text-text-secondary">Base Inicial</Text>
              <Metric className="text-text-primary">{formatCurrency(activeRegister.data.opening_balance)}</Metric>
            </GlassCard>
            <GlassCard className="p-4 border-t-4 border-t-indigo-500">
              <Text className="text-text-secondary">Total Entradas</Text>
              <Metric className="text-text-primary">{formatCurrency(activeMovements.data?.filter(m => m.type==='IN').reduce((a,b)=>a+b.amount,0) || 0)}</Metric>
            </GlassCard>
            <GlassCard className="p-4 border-t-4 border-t-rose-500">
              <Text className="text-text-secondary">Total Salidas</Text>
              <Metric className="text-text-primary">{formatCurrency(activeMovements.data?.filter(m => m.type==='OUT').reduce((a,b)=>a+b.amount,0) || 0)}</Metric>
            </GlassCard>
          </Grid>

          <Grid numItems={1} numItemsLg={3} className="gap-6">
            <GlassCard className="col-span-2 p-6">
              <Flex className="mb-4">
                <Title className="text-text-primary">Movimientos de Hoy</Title>
                <Button size="sm" onClick={() => setShowMovementForm(!showMovementForm)}>
                  <PlusIcon className="w-4 h-4 mr-2 inline-block"/> Nuevo Movimiento
                </Button>
              </Flex>

              {showMovementForm && (
                <div className="bg-bg-surface p-4 rounded-lg border border-border-medium mb-4 space-y-4">
                  <Grid numItems={1} numItemsSm={2} className="gap-4">
                    <div>
                      <Text className="mb-1">Tipo</Text>
                      <Select 
                        
                        value={movementType}
                        onChange={(e) => {
                          const val = e.target.value as 'IN'|'OUT';
                          setMovementType(val);
                          setMovementCategory(val === 'IN' ? 'MANUAL_IN' : 'MANUAL_OUT');
                        }}
                      >
                        <option value="IN">Entrada (Ingreso)</option>
                        <option value="OUT">Salida (Gasto/Retiro)</option>
                      </Select>
                    </div>
                    <div>
                      <Text className="mb-1">Monto</Text>
                      <NumberInput 
                        value={movementAmount} 
                        onValueChange={setMovementAmount} 
                        min={0}
                      />
                    </div>
                    <div className="col-span-2">
                      <Text className="mb-1">Descripción</Text>
                      <TextInput 
                        placeholder="Ej. Pago a proveedor, Sencillo..." 
                        value={movementDesc}
                        onChange={(e) => setMovementDesc(e.target.value)}
                      />
                    </div>
                  </Grid>
                  <Flex className="justify-end space-x-2">
                    <Button variant="secondary" onClick={() => setShowMovementForm(false)}>Cancelar</Button>
                    <Button onClick={handleCreateMovement} disabled={createMovement.isPending}>Guardar</Button>
                  </Flex>
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border border-border-medium">
                <table className="w-full">
                  <thead className="bg-bg-surface/80">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Hora</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Categoría</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">Descripción</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wider">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {activeMovements.data?.map((mov) => (
                      <tr key={mov.id} className="hover:bg-bg-surface/40 transition-colors">
                        <td className="px-4 py-3 text-sm text-text-primary">{formatDate(mov.created_at)}</td>
                        <td className="px-4 py-3 text-sm">
                          <Badge variant={mov.type === 'IN' ? 'success' : 'danger'}>
                            {mov.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-primary">{mov.category}</td>
                        <td className="px-4 py-3 text-sm text-text-primary">{mov.description || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          <span className={mov.type === 'IN' ? 'text-success' : 'text-danger'}>
                            {mov.type === 'IN' ? '+' : '-'}{formatCurrency(mov.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {activeMovements.data?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-sm text-center text-text-muted py-4">No hay movimientos registrados.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            <GlassCard className="flex flex-col h-full p-6">
              <Title className="mb-4 text-text-primary">Cierre de Caja</Title>
              <div className="space-y-4 flex-grow">
                <div>
                  <Text className="mb-1 text-text-muted">Saldo Esperado en Sistema</Text>
                  <Metric className="text-text-primary">
                    {formatCurrency(
                      activeRegister.data.opening_balance + 
                      (activeMovements.data?.filter(m => m.type==='IN').reduce((a,b)=>a+b.amount,0) || 0) -
                      (activeMovements.data?.filter(m => m.type==='OUT').reduce((a,b)=>a+b.amount,0) || 0)
                    )}
                  </Metric>
                </div>
                
                <div className="border-t border-border-light pt-4 mt-4">
                  <Text className="mb-1 font-medium text-text-primary">Dinero Físico Contado</Text>
                  <NumberInput 
                    value={countedBalance}
                    onValueChange={setCountedBalance}
                    min={0}
                    placeholder="¿Cuánto dinero hay en caja?"
                  />
                </div>

                <div>
                  <Text className="mb-1 font-medium text-text-primary">Notas de Cierre (Opcional)</Text>
                  <TextInput 
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Justificación de faltantes/sobrantes..."
                  />
                </div>
              </div>
              
              <div className="mt-6">
                <Button 
                  variant="danger" 
                  className="w-full" 
                  onClick={handleClose} 
                  disabled={closeRegister.isPending}
                >
                  Cerrar Caja
                </Button>
              </div>
            </GlassCard>
          </Grid>
        </div>
      )}
    </div>
  );
};
