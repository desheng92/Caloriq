import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { LogStateService } from '../../services/log-state.service';

interface MealGroup {
  meal: string;
  subtotal: number;
  items: Record<string, unknown>[];
}

@Component({
  selector: 'app-log-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './log-tab.component.html'
})
export class LogTabComponent implements OnInit {
  @Output() openScan = new EventEmitter<void>();

  entries: Record<string, unknown>[] = [];
  todayCal = 0;
  remainCal: number | null = null;
  remainCalClass = 'stat-val';
  weekCal = 0;
  avgCal: number | string = '—';
  mealGroups: MealGroup[] = [];

  foodName = '';
  foodCal: number | null = null;
  foodMeal = 'Breakfast';
  loading = false;

  constructor(
    private supabase: SupabaseService,
    public logState: LogStateService
  ) {}

  ngOnInit() {
    this.logState.entries$.subscribe(entries => {
      this.entries = entries;
      this.todayCal = entries.reduce((s, e) => s + (e['calories'] as number), 0);
      this.computeMealGroups(entries);
    });
    this.logState.refresh();
    this.loadStats();
  }

  async loadStats() {
    try {
      const profile = await this.supabase.getProfile().catch(() => null);
      const budget = profile?.['daily_budget'] as number | undefined;
      if (budget) {
        const rem = budget - this.todayCal;
        this.remainCal = rem;
        this.remainCalClass = 'stat-val ' + (rem >= 0 ? 'green' : 'red');
      }

      const weekly = await this.supabase.getWeeklySummary(7).catch(() => []);
      const weekTotal = (weekly ?? []).reduce((s: number, d: Record<string, unknown>) => s + (d['total_calories'] as number || 0), 0);
      const weekDays = (weekly ?? []).length || 1;
      this.weekCal = weekTotal;
      this.avgCal = Math.round(weekTotal / weekDays);
    } catch {
      // silently ignore
    }
  }

  computeMealGroups(entries: Record<string, unknown>[]) {
    const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    this.mealGroups = meals
      .map(meal => ({
        meal,
        items: entries.filter(e => e['meal'] === meal),
        subtotal: entries
          .filter(e => e['meal'] === meal)
          .reduce((s, e) => s + (e['calories'] as number), 0)
      }))
      .filter(g => g.items.length > 0);
  }

  async addFood() {
    if (!this.foodName.trim() || !this.foodCal || this.foodCal < 0) {
      alert('Please enter a food name and calorie count.');
      return;
    }
    this.loading = true;
    try {
      await this.logState.addEntry({
        name: this.foodName.trim(),
        calories: this.foodCal,
        meal: this.foodMeal
      });
      this.foodName = '';
      this.foodCal = null;
      await this.loadStats();
    } finally {
      this.loading = false;
    }
  }

  async deleteFood(id: string) {
    await this.logState.deleteEntry(id);
    await this.loadStats();
  }
}
