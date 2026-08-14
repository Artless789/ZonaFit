import { useState, useRef, useEffect } from 'react';
import { Search, User as UserIcon } from 'lucide-react';
import { useClients } from '../../hooks/useClients';
import { useDebounce } from '../../hooks/useDebounce';
import { cn } from '../../utils/cn';
import type { Client } from '../../types/client';

interface ClientSearchComboboxProps {
  clients: Client[];
  selectedClientId?: number | null;
  onSelect: (clientId: number | null) => void;
  placeholder?: string;
  allowClear?: boolean;
}

export function ClientSearchCombobox({
  clients,
  selectedClientId,
  onSelect,
  placeholder = "Buscar cliente (Nombre o Documento)...",
  allowClear = true,
}: ClientSearchComboboxProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);
  const { query: clientsQuery } = useClients(1, 10, isOpen ? debouncedQuery : '', true);
  const activeClients = clientsQuery.data?.items || [];

  // Determine selected client by either passing it down, or looking up in the fetched list
  const selectedClient = clients.find(c => c.id === selectedClientId) || activeClients.find(c => c.id === selectedClientId) || null;

  useEffect(() => {
    if (selectedClient && !isOpen) {
      setQuery(selectedClient.full_name);
    }
  }, [selectedClient, isOpen]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (selectedClient) {
          setQuery(selectedClient.full_name);
        } else {
          setQuery('');
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedClient]);

  const filteredClients = activeClients;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-text-muted" />
        </div>
        <input
          type="text"
          className="w-full pl-10 pr-10 py-2 bg-bg-surface/50 border border-border-medium rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary transition-all text-text-primary placeholder:text-text-muted"
          placeholder={placeholder}
          value={isOpen ? query : (selectedClient ? selectedClient.full_name : query)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (e.target.value === '' && allowClear) {
              onSelect(null);
            }
          }}
          onClick={() => setIsOpen(true)}
        />
        {selectedClient && allowClear && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
              setQuery('');
              setIsOpen(true);
            }}
          >
            <span className="text-xs font-semibold">×</span>
          </button>
        )}
      </div>

      {isOpen && (
        <ul className="absolute z-[var(--z-dropdown)] mt-1 max-h-60 w-full overflow-auto rounded-xl bg-bg-elevated border border-border-light shadow-glass py-1 text-sm ring-1 ring-black/5 focus:outline-none">
          {clientsQuery.isLoading ? (
            <li className="relative cursor-default select-none py-2 px-4 text-text-muted text-center">
               Buscando...
             </li>
          ) : filteredClients.length === 0 ? (
            <li className="relative cursor-default select-none py-2 px-4 text-text-muted text-center">
              No se encontraron clientes.
            </li>
          ) : (
            filteredClients.map((client) => (
              <li
                key={client.id}
                className={cn(
                  "relative cursor-pointer select-none py-2 px-4 transition-colors",
                  selectedClientId === client.id ? "bg-brand-primary/10 text-brand-primary" : "hover:bg-bg-surface text-text-primary"
                )}
                onClick={() => {
                  onSelect(client.id);
                  setQuery(client.full_name);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserIcon size={14} className="opacity-50" />
                    <span className="font-medium truncate block">{client.full_name}</span>
                  </div>
                  <span className="text-xs text-text-muted bg-bg-surface/80 px-2 py-0.5 rounded-md border border-border-light">{client.document_type} {client.document}</span>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
