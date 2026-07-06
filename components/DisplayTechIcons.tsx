import Image from "next/image";

import { cn, getTechLogos } from "@/lib/utils";

const DisplayTechIcons = async ({ techStack }: TechIconProps) => {
  const techIcons = await getTechLogos(techStack);

  return (
    <div className="icon-spread-group flex flex-row">
      {techIcons.slice(0, 3).map(({ tech, url }, index) => (
        <div
          key={`${tech}-${index}`}
          className={cn(
            "group/tech relative flex items-center justify-center rounded-full border border-hairline bg-surface-overlay p-2 transition-all duration-300 ease-in-out",
            index > 0 && "-ml-3"
          )}
        >
          {/* Tooltip — only for the hovered icon */}
          <span
            className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md border border-hairline bg-surface-overlay px-2 py-1 text-xs text-strong opacity-0 shadow-md transition-all duration-200 group-hover/tech:translate-y-0 group-hover/tech:opacity-100"
            role="tooltip"
          >
            {tech}
          </span>

          <Image
            src={url}
            alt={tech}
            width={100}
            height={100}
            className="size-5"
            unoptimized
          />
        </div>
      ))}
    </div>
  );
};

export default DisplayTechIcons;
