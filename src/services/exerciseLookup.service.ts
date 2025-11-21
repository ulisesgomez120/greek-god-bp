import databaseService from "@/services/database.service";
import type { Exercise } from "@/types";

class ExerciseLookupService {
  private cache: Map<string, { exerciseId: string; name: string; updatedAt: string }> = new Map();
  private isPreloaded = false;

  async preloadCache(options: { useCache?: boolean } = {}): Promise<void> {
    if (this.isPreloaded && options.useCache !== false) return;

    try {
      const exercises = await databaseService.getExercises({ useCache: options.useCache });
      for (const ex of exercises) {
        this.cache.set(ex.id, { exerciseId: ex.id, name: ex.name, updatedAt: new Date().toISOString() });
      }
      this.isPreloaded = true;
    } catch (err) {
      // don't throw - lookup failures shouldn't block the app, but log for diagnostics
      // eslint-disable-next-line no-console
      console.warn("ExerciseLookupService.preloadCache: failed to preload exercises", err);
    }
  }

  getName(exerciseId: string): string | null {
    const entry = this.cache.get(exerciseId);
    return entry ? entry.name : null;
  }

  invalidate(exerciseId?: string) {
    if (exerciseId) {
      this.cache.delete(exerciseId);
    } else {
      this.cache.clear();
      this.isPreloaded = false;
    }
  }

  async syncWithDb(): Promise<void> {
    // do a full refresh from DB
    this.invalidate();
    await this.preloadCache({ useCache: false });
  }
}

export const exerciseLookupService = new ExerciseLookupService();
export default exerciseLookupService;
