'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  itemsPerPage: number;
}

export default function Pagination({
  currentPage, totalPages, onPageChange, totalItems, itemsPerPage
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem   = Math.min(currentPage * itemsPerPage, totalItems);

  const btnBase = `
    flex items-center justify-center rounded-md border border-nx-line bg-white p-1.5
    text-nx-text-muted transition-colors
    hover:bg-nx-surface-muted hover:text-nx-ink
    disabled:cursor-not-allowed disabled:opacity-30
    dark:border-nx-line-dark dark:bg-nx-surface-dark dark:hover:bg-nx-line-dark dark:hover:text-white
  `;

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-nx-surface-muted px-5 py-3 dark:border-nx-line-dark sm:flex-row">
      <p className="text-[12px] text-nx-text-muted dark:text-nx-text-subtle">
        Showing <span className="font-medium text-nx-ink dark:text-white">{startItem}–{endItem}</span>{' '}
        of <span className="font-medium text-nx-ink dark:text-white">{totalItems}</span> records
      </p>

      <div className="flex items-center gap-1">
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={btnBase}>
          <ChevronsLeft size={14} />
        </button>
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className={btnBase}>
          <ChevronLeft size={14} />
        </button>

        <div className="mx-1 flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if      (totalPages <= 5)              pageNum = i + 1;
            else if (currentPage <= 3)             pageNum = i + 1;
            else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
            else                                   pageNum = currentPage - 2 + i;

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`flex h-7 w-7 items-center justify-center rounded-md text-[12px] font-medium transition-colors ${
                  currentPage === pageNum
                    ? 'bg-nx-accent text-white'
                    : 'text-nx-text-muted hover:bg-nx-surface-muted hover:text-nx-ink dark:text-nx-text-subtle dark:hover:bg-nx-line-dark dark:hover:text-white'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className={btnBase}>
          <ChevronRight size={14} />
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={currentPage === totalPages} className={btnBase}>
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
