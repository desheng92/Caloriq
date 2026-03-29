import { Injectable } from '@angular/core';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;
  session$ = new BehaviorSubject<Session | null>(null);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

    // Initialize session from existing session
    this.supabase.auth.getSession().then(({ data }) => {
      this.session$.next(data.session);
    });

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session$.next(session);
    });
  }

  // ---- AUTH ----

  async signUp(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  async getCurrentUser() {
    const { data: { user } } = await this.supabase.auth.getUser();
    return user;
  }

  // ---- PROFILES ----

  async getProfile() {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  }

  async updateProfile(updates: Record<string, unknown>) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async setDailyBudget(calories: number) {
    return this.updateProfile({ daily_budget: calories });
  }

  // ---- FOOD ENTRIES ----

  async addFoodEntry({ name, calories, meal, date, portion = null, source = 'manual' }: {
    name: string;
    calories: number;
    meal: string;
    date?: string;
    portion?: string | null;
    source?: string;
  }) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('food_entries')
      .insert({
        user_id: user.id,
        name,
        calories,
        meal,
        date: date || new Date().toISOString().slice(0, 10),
        portion,
        source,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getFoodEntriesByDate(date?: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const targetDate = date || new Date().toISOString().slice(0, 10);

    const { data, error } = await this.supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', targetDate)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async getFoodEntriesInRange(from: string, to: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  }

  async deleteFoodEntry(id: string) {
    const { error } = await this.supabase
      .from('food_entries')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ---- DAILY SUMMARY ----

  async getDailySummary(from: string, to: string) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('daily_summary')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: false });

    if (error) throw error;
    return data;
  }

  async getWeeklySummary(days = 7) {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    return this.getDailySummary(from, to);
  }

  // ---- MEAL PLANS ----

  async saveMealPlan({ type, calorie_budget, preferences, plan_content }: {
    type: string;
    calorie_budget: number;
    preferences: string;
    plan_content: string;
  }) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('meal_plans')
      .insert({ user_id: user.id, type, calorie_budget, preferences, plan_content })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMealPlans(limit = 10) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('meal_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // ---- HELPERS ----

  todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  daysAgoStr(n: number): string {
    return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }
}
