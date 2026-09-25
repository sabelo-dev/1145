import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "chunk-reload-attempted";

/** True for the errors browsers raise when a lazily loaded chunk no longer exists. */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message);
}

/**
 * React.lazy that survives deploys: after a new release the old hashed chunk
 * files are gone, so a tab that loaded the previous version fails to open the
 * next page. We reload once to pick up the new build instead of crashing.
 */
export function lazyWithRetry<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const module = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return module;
    } catch (error) {
      if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return new Promise<{ default: T }>(() => {}); // wait for the reload
      }
      throw error;
    }
  });
}
