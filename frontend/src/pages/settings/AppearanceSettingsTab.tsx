import { GlassPanel } from '@shared/ui/GlassPanel';
import { useTheme } from '../../context/ThemeContext';
import { Moon, Sun, CheckCircle2, Monitor } from 'lucide-react';
import { cn } from '@shared/utils/cn';

export function AppearanceSettingsTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <GlassPanel
        index="01"
        eyebrow="SISTEMA VISUAL"
        title="Atmósfera Visual y Tema de la Terminal"
        description="Selecciona la experiencia visual para la terminal operativa. La preferencia se guarda en tu navegador y se sincroniza al instante."
        rounded="2xl"
        padding="md"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Option 1: Dark Cinematic (Recommended) */}
          <div
            onClick={() => setTheme('dark')}
            className={cn(
              'group relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 cursor-pointer select-none',
              theme === 'dark'
                ? 'border-brand-primary bg-gradient-to-b from-brand-primary/[0.08] to-surface-raised shadow-glow'
                : 'border-border-light bg-surface-base/50 hover:border-border-medium hover:bg-surface-raised/40'
            )}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                      theme === 'dark'
                        ? 'bg-brand-primary text-white shadow-xs'
                        : 'bg-surface-raised border border-border-light text-text-muted'
                    )}
                  >
                    <Moon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                      Dark Cinematic
                      <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-brand-primary/20 text-brand-primary border border-brand-primary/30">
                        Recomendado
                      </span>
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Contraste cinematográfico profundo para turnos prolongados.
                    </p>
                  </div>
                </div>

                {theme === 'dark' && (
                  <CheckCircle2 size={20} className="text-brand-primary shrink-0" />
                )}
              </div>

              {/* Theme Mockup Visual Preview */}
              <div className="w-full rounded-xl border border-white/10 bg-[#090d16] p-3 shadow-inner flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-red-500/80" />
                    <div className="size-2 rounded-full bg-amber-500/80" />
                    <div className="size-2 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                    ZONAFIT HUD
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="rounded-lg bg-zinc-900/90 border border-white/5 p-2 flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-zinc-500">INGRESOS</span>
                    <span className="text-xs font-bold font-mono text-emerald-400">$4.850.000</span>
                  </div>
                  <div className="rounded-lg bg-zinc-900/90 border border-white/5 p-2 flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-zinc-500">ACTIVOS</span>
                    <span className="text-xs font-bold font-mono text-zinc-200">142 clientes</span>
                  </div>
                  <div className="rounded-lg bg-zinc-900/90 border border-white/5 p-2 flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-zinc-500">ESTADO</span>
                    <span className="text-xs font-bold font-mono text-brand-primary">OPTIMO</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border-light/50 flex items-center justify-between text-xs">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                Fondo Carbón 0B0F17 · Acentos Neón
              </span>
              <button
                type="button"
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-colors',
                  theme === 'dark'
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-raised border border-border-light text-text-muted group-hover:text-text-primary'
                )}
              >
                {theme === 'dark' ? 'Activo' : 'Seleccionar'}
              </button>
            </div>
          </div>

          {/* Option 2: Light Mode */}
          <div
            onClick={() => setTheme('light')}
            className={cn(
              'group relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200 cursor-pointer select-none',
              theme === 'light'
                ? 'border-brand-primary bg-gradient-to-b from-brand-primary/[0.08] to-surface-raised shadow-glow'
                : 'border-border-light bg-surface-base/50 hover:border-border-medium hover:bg-surface-raised/40'
            )}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                      theme === 'light'
                        ? 'bg-brand-primary text-white shadow-xs'
                        : 'bg-surface-raised border border-border-light text-text-muted'
                    )}
                  >
                    <Sun size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-text-primary">Light Mode Editorial</h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Luminosidad alta con tipografía nítida para ambientes muy iluminados.
                    </p>
                  </div>
                </div>

                {theme === 'light' && (
                  <CheckCircle2 size={20} className="text-brand-primary shrink-0" />
                )}
              </div>

              {/* Theme Mockup Visual Preview */}
              <div className="w-full rounded-xl border border-slate-200 bg-white p-3 shadow-sm flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-red-400" />
                    <div className="size-2 rounded-full bg-amber-400" />
                    <div className="size-2 rounded-full bg-emerald-400" />
                  </div>
                  <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest">
                    ZONAFIT CLARO
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-1">
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-slate-500">INGRESOS</span>
                    <span className="text-xs font-bold font-mono text-emerald-600">$4.850.000</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-slate-500">ACTIVOS</span>
                    <span className="text-xs font-bold font-mono text-slate-800">142 clientes</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 flex flex-col gap-1">
                    <span className="text-[8px] font-mono text-slate-500">ESTADO</span>
                    <span className="text-xs font-bold font-mono text-rose-600">OPTIMO</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border-light/50 flex items-center justify-between text-xs">
              <span className="font-mono text-[10px] text-text-muted uppercase tracking-wider">
                Superficie Clara · Tipografía Nítida
              </span>
              <button
                type="button"
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-medium font-mono uppercase tracking-wider transition-colors',
                  theme === 'light'
                    ? 'bg-brand-primary text-white'
                    : 'bg-surface-raised border border-border-light text-text-muted group-hover:text-text-primary'
                )}
              >
                {theme === 'light' ? 'Activo' : 'Seleccionar'}
              </button>
            </div>
          </div>
        </div>

        {/* Persistence Notice */}
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl border border-border-light bg-surface-raised/40 text-xs text-text-muted mt-2">
          <Monitor size={16} className="text-brand-primary shrink-0" />
          <span>
            Tu selección se conserva en la clave local <code className="text-text-primary font-mono text-[11px] bg-surface-base px-1.5 py-0.5 rounded border border-border-light">zonafit-theme</code> para mantener la consistencia entre sesiones.
          </span>
        </div>
      </GlassPanel>
    </div>
  );
}
