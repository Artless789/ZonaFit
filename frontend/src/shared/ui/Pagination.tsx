import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const generatePages = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center space-x-1 mt-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Página anterior"
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border-medium bg-bg-surface text-text-muted transition-colors hover:bg-bg-surface-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <ChevronLeft size={16} />
      </button>

      {generatePages().map((p, i) =>
        p === '...' ? (
          <div key={`dots-${i}`} className="flex h-9 w-9 items-center justify-center text-text-muted">
            <MoreHorizontal size={16} />
          </div>
        ) : (
          <button
            key={`page-${p}`}
            onClick={() => onPageChange(p as number)}
            aria-label={`Página ${p}`}
            aria-current={page === p ? 'page' : undefined}
            className={`flex h-9 min-w-[2.25rem] px-2 items-center justify-center rounded-[var(--radius-md)] text-sm font-medium transition-colors ${
              page === p
                ? 'bg-brand-primary text-text-white shadow-sm border border-brand-primary'
                : 'border border-transparent bg-transparent text-text-muted hover:bg-bg-surface hover:text-text-primary hover:border-border-medium'
            }`}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Página siguiente"
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border-medium bg-bg-surface text-text-muted transition-colors hover:bg-bg-surface-hover hover:text-text-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
