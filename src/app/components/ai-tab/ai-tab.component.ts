import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';
import { AiService } from '../../services/ai.service';

@Component({
  selector: 'app-ai-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-tab.component.html'
})
export class AiTabComponent implements OnInit {
  foods: string[] = [];
  selectedFoods: Set<string> = new Set();
  suggestionText = 'Select one or more foods above, then click "Get suggestions".';
  suggestionLoading = false;
  chatText = 'Ask a question about your diet, nutrition goals, or food choices.';
  chatLoading = false;
  question = '';

  private allEntries: Record<string, unknown>[] = [];

  constructor(
    private supabase: SupabaseService,
    private ai: AiService
  ) {}

  async ngOnInit() {
    try {
      const entries = await this.supabase.getFoodEntriesByDate().catch(() => []);
      this.allEntries = entries ?? [];
      this.foods = [...new Set((entries ?? []).map((e: Record<string, unknown>) => e['name'] as string))];
    } catch {
      this.foods = [];
    }
  }

  toggleFood(name: string) {
    if (this.selectedFoods.has(name)) {
      this.selectedFoods.delete(name);
    } else {
      this.selectedFoods.add(name);
    }
    this.selectedFoods = new Set(this.selectedFoods);
  }

  async getSuggestions() {
    if (this.selectedFoods.size === 0) {
      this.suggestionText = 'Please select at least one food.';
      return;
    }
    this.suggestionLoading = true;
    this.suggestionText = '';
    try {
      const ctx = this.allEntries
        .map((e: Record<string, unknown>) => `${e['name']} (${e['calories']} kcal, ${e['meal']})`)
        .join(', ');
      const selected = [...this.selectedFoods].join(', ');
      const prompt = `The user has logged these foods today: ${ctx}. They want lower-calorie alternatives for: ${selected}. For each selected food, give 2–3 practical suggestions to reduce calories while keeping it satisfying. Format with the food name as a heading.`;
      this.suggestionText = await this.ai.callClaude(prompt);
    } catch {
      this.suggestionText = 'Error reaching AI service. Please try again.';
    } finally {
      this.suggestionLoading = false;
    }
  }

  async getWeeklyTip() {
    this.suggestionLoading = true;
    this.suggestionText = '';
    try {
      const entries = await this.supabase.getFoodEntriesInRange(
        this.supabase.daysAgoStr(6),
        this.supabase.todayStr()
      ).catch(() => []);
      const foods = (entries ?? [])
        .map((e: Record<string, unknown>) => `${e['name']} (${e['calories']} kcal)`)
        .join(', ') || 'nothing logged yet';
      const prompt = `The user ate these foods this week: ${foods}. Give 3 practical weekly nutrition tips based on their eating patterns. Be encouraging and specific.`;
      this.suggestionText = await this.ai.callClaude(prompt);
    } catch {
      this.suggestionText = 'Error reaching AI service. Please try again.';
    } finally {
      this.suggestionLoading = false;
    }
  }

  async askQuestion() {
    if (!this.question.trim()) return;
    this.chatLoading = true;
    this.chatText = '';
    try {
      const ctx = this.allEntries
        .map((e: Record<string, unknown>) => `${e['name']} (${e['calories']} kcal, ${e['meal']})`)
        .join(', ') || 'nothing logged today';
      const profile = await this.supabase.getProfile().catch(() => null);
      const budget = profile?.['daily_budget']
        ? `Daily calorie budget: ${profile['daily_budget']} kcal.`
        : '';
      const prompt = `Context: Today's food log: ${ctx}. ${budget}\n\nUser question: ${this.question.trim()}\n\nAnswer helpfully and concisely as a knowledgeable nutrition assistant.`;
      this.chatText = await this.ai.callClaude(prompt);
    } catch {
      this.chatText = 'Error reaching AI service. Please try again.';
    } finally {
      this.chatLoading = false;
    }
  }
}
