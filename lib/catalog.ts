import { loadBundledCatalog } from "@steelmate/engine";

let cached: ReturnType<typeof loadBundledCatalog> | null = null;

export function getServerCatalog() {
  if (cached) return cached;
  cached = loadBundledCatalog();
  const expected = process.env.CATALOG_VERSION;
  if (expected && cached.catalogVersion !== expected) {
    console.warn(
      `CATALOG_VERSION env (${expected}) differs from engine bundle (${cached.catalogVersion})`,
    );
  }
  return cached;
}

export function requireCatalogVersion(): string {
  return process.env.CATALOG_VERSION ?? getServerCatalog().catalogVersion;
}
