import { cn } from "@/lib/utils";

interface CategoryAverage {
  name: string;
  average: number;
  sessions: number;
}

interface CategoryBarsProps {
  categories: CategoryAverage[];
  weakest: string | null;
}

/**
 * Horizontal single-hue bars for category averages (magnitude on a
 * shared 0–100 scale). Direct end labels; the weakest category gets a
 * text callout, not a recolor.
 */
const CategoryBars = ({ categories, weakest }: CategoryBarsProps) => {
  return (
    <div className="flex flex-col gap-4">
      {categories.map((category) => (
        <div key={category.name}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm font-medium text-strong">
              {category.name}
              {category.name === weakest && (
                <span className="ml-2 rounded-full border border-accent/25 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                  Focus area
                </span>
              )}
            </p>
            <p className="text-sm tabular-nums text-faint">
              <span className={cn("font-semibold text-strong")}>
                {category.average}
              </span>
              /100
            </p>
          </div>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-raise"
            role="progressbar"
            aria-valuenow={category.average}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${category.name} average score`}
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${Math.min(100, Math.max(0, category.average))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CategoryBars;
