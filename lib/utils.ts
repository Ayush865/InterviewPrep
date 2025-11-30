import { interviewCovers, mappings } from "@/constants";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const availableIcons = new Set([
  "amplify",
  "angular",
  "apollo",
  "aws",
  "azure",
  "babel",
  "backbone",
  "bitbucket",
  "bootstrap",
  "chai",
  "contentful",
  "cplusplus",
  "css3",
  "cypress",
  "digitalocean",
  "django",
  "docker",
  "ember",
  "express",
  "fastapi",
  "figma",
  "firebase",
  "flux",
  "gcp",
  "git",
  "github",
  "gitlab",
  "go",
  "graphql",
  "heroku",
  "html5",
  "java",
  "javascript",
  "jest",
  "jquery",
  "karma",
  "kubernetes",
  "less",
  "linux",
  "mocha",
  "mongodb",
  "mongoose",
  "mysql",
  "nestjs",
  "netlify",
  "nextjs",
  "nodejs",
  "npm",
  "nuxt",
  "parcel",
  "photoshop",
  "postgresql",
  "prisma",
  "python",
  "react",
  "redis",
  "redux",
  "rollup",
  "sass",
  "selenium",
  "spark",
  "springboot",
  "sqlite",
  "strapi",
  "tailwindcss",
  "typescript",
  "vercel",
  "vuejs",
  "vuex",
  "webpack",
  "wordpress",
  "yarn",
]);

const normalizeTechName = (tech: string) => {
  const key = tech.toLowerCase().replace(/\.js$/, "").replace(/\s+/g, "");
  return mappings[key as keyof typeof mappings] || key;
};

export const getTechLogos = async (techArray: string[]) => {
  return techArray.map((tech) => {
    const normalized = normalizeTechName(tech);
    const url = availableIcons.has(normalized)
      ? `/tech-icons/${normalized}.svg`
      : "/tech.svg";
    return { tech, url };
  });
};

export const getRandomInterviewCover = (seed?: string) => {
  // Use seed (like interviewId) to generate a deterministic index
  // This ensures server and client render the same image
  let randomIndex: number;
  
  if (seed) {
    // Convert seed to a number for deterministic randomness
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    randomIndex = Math.abs(hash) % interviewCovers.length;
  } else {
    randomIndex = Math.floor(Math.random() * interviewCovers.length);
  }
  
  return `/covers${interviewCovers[randomIndex]}`;
};
