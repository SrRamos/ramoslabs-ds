export const REGISTRY_DIR: string;
export const PRIMARY_PAIRS: Record<string, { at: string; platform: string }>;
export function plusSixMonths(date: string): string;
export function validateAtSupport(
  data: unknown,
  opts?: { fileName?: string },
): { path: string; message: string }[];
export function registryFiles(dir?: string): string[];
export function validateAtFile(file: string): { path: string; message: string }[];
