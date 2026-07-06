import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  /** Current 1-indexed page */
  page: number;
  totalPages: number;
  /** Builds the href for a given page, e.g. (p) => `/?my=${p}#your-interviews` */
  hrefForPage: (page: number) => string;
}

/** Compact page numbers with ellipsis: 1 … 4 [5] 6 … 12 */
function pageItems(page: number, totalPages: number): (number | "…")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const items: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) items.push("…");
    items.push(sorted[i]);
  }
  return items;
}

const Pagination = ({ page, totalPages, hrefForPage }: PaginationProps) => {
  if (totalPages <= 1) return null;

  const linkClass =
    "inline-flex size-9 items-center justify-center rounded-full text-sm text-soft transition-colors duration-200 hover:bg-hover hover:text-strong";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={linkClass} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(linkClass, "pointer-events-none opacity-30")}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </span>
      )}

      {pageItems(page, totalPages).map((item, index) =>
        item === "…" ? (
          <span key={`gap-${index}`} className="px-1 text-sm text-faint">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefForPage(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              linkClass,
              item === page && "bg-[var(--cta-bg)] text-[var(--cta-fg)] hover:bg-[var(--cta-bg)] hover:text-[var(--cta-fg)]"
            )}
          >
            {item}
          </Link>
        )
      )}

      {page < totalPages ? (
        <Link href={hrefForPage(page + 1)} className={linkClass} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(linkClass, "pointer-events-none opacity-30")}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      )}
    </nav>
  );
};

export default Pagination;
