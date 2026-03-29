import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class LogStateService {
  private entriesSubject = new BehaviorSubject<Record<string, unknown>[]>([]);
  entries$ = this.entriesSubject.asObservable();

  constructor(private supabase: SupabaseService) {}

  async refresh() {
    try {
      const entries = await this.supabase.getFoodEntriesByDate();
      this.entriesSubject.next(entries ?? []);
    } catch {
      this.entriesSubject.next([]);
    }
  }

  async addEntry(payload: {
    name: string;
    calories: number;
    meal: string;
    date?: string;
    portion?: string | null;
    source?: string;
  }) {
    await this.supabase.addFoodEntry(payload);
    await this.refresh();
  }

  async deleteEntry(id: string) {
    await this.supabase.deleteFoodEntry(id);
    await this.refresh();
  }
}
