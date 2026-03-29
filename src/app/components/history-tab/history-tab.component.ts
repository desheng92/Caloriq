import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';

interface SummaryRow {
  date: string;
  formattedDate: string;
  foods: string;
  totalCalories: number;
  status: string;
  badgeClass: string;
  badgeLabel: string;
}

@Component({
  selector: 'app-history-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-tab.component.html'
})
export class HistoryTabComponent implements OnInit {
  activeFilter: 'week' | 'month' | 'all' = 'week';
  summaryRows: SummaryRow[] = [];
  stats = { total: 0, days: 0, avg: 0 as number | string, onBudget: 0 as number | string };

  constructor(private supabase: SupabaseService) {}

  ngOnInit() {
    this.loadHistory('week');
  }

  async setFilter(f: 'week' | 'month' | 'all') {
    this.activeFilter = f;
    await this.loadHistory(f);
  }

  async loadHistory(filter: 'week' | 'month' | 'all') {
    try {
      const today = this.supabase.todayStr();
      const from = filter === 'week'
        ? this.supabase.daysAgoStr(6)
        : filter === 'month'
        ? this.supabase.daysAgoStr(29)
        : '2000-01-01';

      const summary = await this.supabase.getDailySummary(from, today).catch(() => []);
      const entries = await this.supabase.getFoodEntriesInRange(from, today).catch(() => []);

      const total = (summary ?? []).reduce((s: number, d: Record<string, unknown>) => s + (d['total_calories'] as number || 0), 0);
      const numDays = (summary ?? []).length;
      const onBudget = (summary ?? []).filter((d: Record<string, unknown>) => d['status'] === 'on_target').length;

      this.stats = {
        total,
        days: numDays,
        avg: numDays ? Math.round(total / numDays) : '—',
        onBudget: numDays ? onBudget : '—'
      };

      const namesByDay: Record<string, string[]> = {};
      (entries ?? []).forEach((e: Record<string, unknown>) => {
        const d = e['date'] as string;
        if (!namesByDay[d]) namesByDay[d] = [];
        namesByDay[d].push(e['name'] as string);
      });

      this.summaryRows = (summary ?? []).map((d: Record<string, unknown>) => {
        const status = d['status'] as string;
        const foods = (namesByDay[d['date'] as string] || []).join(', ') || '—';
        let badgeClass = 'badge badge-amber';
        let badgeLabel = 'No budget set';
        if (status === 'on_target') { badgeClass = 'badge badge-green'; badgeLabel = 'On target'; }
        else if (status === 'over_budget') { badgeClass = 'badge badge-red'; badgeLabel = 'Over budget'; }

        return {
          date: d['date'] as string,
          formattedDate: this.supabase.formatDate(d['date'] as string),
          foods,
          totalCalories: d['total_calories'] as number,
          status,
          badgeClass,
          badgeLabel
        };
      });
    } catch {
      this.summaryRows = [];
    }
  }
}
