import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange
}: DataTablePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t bg-card/50">
      <p className="text-xs text-muted-foreground font-medium">
        Showing <span className="text-foreground font-bold">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-foreground font-bold">{Math.min(currentPage * pageSize, totalItems)}</span> of <span className="text-foreground font-bold">{totalItems}</span> entries
      </p>
      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="h-8 px-3 text-[10px] uppercase font-black tracking-widest"
        >
          <ChevronLeft className="w-3 h-3 mr-1" /> Previous
        </Button>
        
        <div className="flex items-center gap-1">
          {[...Array(totalPages)].map((_, i) => {
            const pageNum = i + 1;
            // Logical page skipping for large sets
            if (
              pageNum === 1 || 
              pageNum === totalPages || 
              (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
            ) {
              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  className="h-8 w-8 p-0 text-[10px] font-black"
                  onClick={() => onPageChange(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            } else if (
              pageNum === currentPage - 2 || 
              pageNum === currentPage + 2
            ) {
              return <span key={pageNum} className="px-1 text-muted-foreground text-xs">...</span>;
            }
            return null;
          })}
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="h-8 px-3 text-[10px] uppercase font-black tracking-widest"
        >
          Next <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}
