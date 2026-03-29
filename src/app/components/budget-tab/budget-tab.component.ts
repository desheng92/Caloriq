import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { AiService } from '../../services/ai.service';

interface WeeklyRow {
  label: string;
  total: number;
  pct: number;
  colorClass: string;
  budget: number | null;
}

@Component({
  selector: 'app-budget-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budget-tab.component.html'
})
export class BudgetTabComponent implements OnInit {
  dailyBudget: number | null = null;
  todayTotal = 0;
  budgetRemaining: number | string = '—';
  budgetRemainingColor = 'inherit';
  pct = 0;
  pctLabel = '—';
  barColorClass = 'fill-green';
  bpBudgetLabel = 'Not set';

  weeklyRows: WeeklyRow[] = [];

  planBudget: number | null = null;
  planPrefs = '';
  planResponse = 'Set a calorie budget and preferences, then generate a personalised meal plan.';
  planLoading = false;

  constructor(
    private supabase: SupabaseService,
    private ai: AiService
  ) {}

  async ngOnInit() {
    await this.loadData();
  }

  async loadData() {
    try {
      const profile = await this.supabase.getProfile().catch(() => null);
      if (profile?.['daily_budget']) {
        this.dailyBudget = profile['daily_budget'] as number;
      }

      const entries = await this.supabase.getFoodEntriesByDate().catch(() => []);
      this.todayTotal = (entries ?? []).reduce((s: number, e: Record<string, unknown>) => s + (e['calories'] as number || 0), 0);

      this.recalcProgress();

      const weekly = await this.supabase.getWeeklySummary(7).catch(() => []);
      const today = this.supabase.todayStr();
      const dayMap: Record<string, number> = {};
      (weekly ?? []).forEach((d: Record<string, unknown>) => {
        dayMap[d['date'] as string] = d['total_calories'] as number || 0;
      });

      this.weeklyRows = [];
      for (let i = 6; i >= 0; i--) {
        const d = this.supabase.daysAgoStr(i);
        const total = dayMap[d] || 0;
        const pct = this.dailyBudget ? Math.min(100, Math.round(total / this.dailyBudget * 100)) : 0;
        const colorClass = pct > 100 ? 'fill-red' : pct > 80 ? 'fill-amber' : 'fill-green';
        const label = d === today ? 'Today' : this.supabase.formatDate(d).split(',')[0];
        this.weeklyRows.push({ label, total, pct, colorClass, budget: this.dailyBudget });
      }
    } catch {
      // silently ignore
    }
  }

  recalcProgress() {
    if (this.dailyBudget) {
      this.bpBudgetLabel = this.dailyBudget.toLocaleString() + ' kcal';
      const rem = this.dailyBudget - this.todayTotal;
      this.budgetRemaining = (rem >= 0 ? '+' : '') + rem.toLocaleString() + ' kcal';
      this.budgetRemainingColor = rem >= 0 ? 'var(--accent)' : 'var(--accent2)';
      this.pct = Math.min(100, Math.round(this.todayTotal / this.dailyBudget * 100));
      this.pctLabel = this.pct + '% of daily budget used';
      this.barColorClass = this.pct < 75 ? 'fill-green' : this.pct < 100 ? 'fill-amber' : 'fill-red';
    } else {
      this.bpBudgetLabel = 'Not set';
      this.budgetRemaining = '—';
      this.pctLabel = '—';
      this.pct = 0;
      this.barColorClass = 'fill-green';
    }
  }

  async saveBudget() {
    if (!this.dailyBudget) return;
    try {
      await this.supabase.setDailyBudget(this.dailyBudget);
      await this.loadData();
    } catch {
      // silently ignore
    }
  }

  async generateDayPlan() {
    const budget = this.planBudget || this.dailyBudget || 2000;
    const prefs = this.planPrefs || 'no restrictions';
    this.planLoading = true;
    this.planResponse = '';
    try {
      const prompt = `Create a detailed 1-day meal plan with exactly ${budget} calories. Preferences: ${prefs}. Include Breakfast, Lunch, Dinner, and one Snack. For each meal list the foods, portion sizes, and approximate calorie count. End with a brief total.`;
      const response = await this.ai.callClaude(prompt);
      this.planResponse = response;
      await this.supabase.saveMealPlan({
        type: 'day',
        calorie_budget: Number(budget),
        preferences: prefs,
        plan_content: response
      }).catch(() => {});
    } catch {
      this.planResponse = 'Error reaching AI service. Please try again.';
    } finally {
      this.planLoading = false;
    }
  }

  async generateWeekPlan() {
    const budget = this.planBudget || this.dailyBudget || 2000;
    const prefs = this.planPrefs || 'no restrictions';
    this.planLoading = true;
    this.planResponse = '';
    try {
      const prompt = `Create a 7-day meal plan targeting ${budget} calories per day. Preferences: ${prefs}. For each day (Monday–Sunday), list the meals at a high level with approximate calorie counts. Show daily totals.`;
      const response = await this.ai.callClaude(prompt);
      this.planResponse = response;
      await this.supabase.saveMealPlan({
        type: 'week',
        calorie_budget: Number(budget),
        preferences: prefs,
        plan_content: response
      }).catch(() => {});
    } catch {
      this.planResponse = 'Error reaching AI service. Please try again.';
    } finally {
      this.planLoading = false;
    }
  }
}
