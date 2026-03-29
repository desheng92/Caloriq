// =============================================================
// supabase.js — Caloriq Backend
// All Supabase queries, auth, and data functions live here.
// Import this file in main.html via:
//   <script type="module" src="supabase.js"></script>
// =============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// -------------------------------------------------------------
// 1. CLIENT INITIALISATION
// -------------------------------------------------------------
const SUPABASE_URL  = 'https://sharzgzarilcaukbqmul.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNoYXJ6Z3phcmlsY2F1a2JxbXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTQ4MzYsImV4cCI6MjA5MDMzMDgzNn0.J1c4LlJ8Xgv-djo8QWxf9Q9s04v2qC8aY0tUGL7sm9A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);


// =============================================================
// 2. AUTH
// =============================================================

/**
 * Sign up a new user with email & password.
 * A profile row is auto-created by the database trigger.
 */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign in an existing user with email & password.
 */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * Sign in / sign up via magic link (passwordless).
 */
export async function signInWithMagicLink(email) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Returns the currently authenticated user, or null.
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Subscribe to auth state changes.
 * Callback receives (event, session).
 */
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}


// =============================================================
// 3. PROFILES
// =============================================================

/**
 * Fetch the profile for the currently signed-in user.
 */
export async function getProfile() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update profile fields (display_name, daily_budget, dietary_preferences).
 */
export async function updateProfile(updates) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update only the daily calorie budget.
 */
export async function setDailyBudget(calories) {
  return updateProfile({ daily_budget: calories });
}


// =============================================================
// 4. FOOD ENTRIES
// =============================================================

/**
 * Add a new food entry to the log.
 * @param {object} entry - { name, calories, meal, date?, portion?, source? }
 */
export async function addFoodEntry({ name, calories, meal, date, portion = null, source = 'manual' }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
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

/**
 * Fetch all food entries for a specific date (defaults to today).
 */
export async function getFoodEntriesByDate(date) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const targetDate = date || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', targetDate)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/**
 * Fetch food entries within a date range.
 * @param {string} from - ISO date string e.g. '2025-01-01'
 * @param {string} to   - ISO date string e.g. '2025-01-31'
 */
export async function getFoodEntriesInRange(from, to) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('food_entries')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Delete a food entry by its UUID.
 */
export async function deleteFoodEntry(id) {
  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', id);

  if (error) throw error;
}


// =============================================================
// 5. DAILY SUMMARY (via the database view)
// =============================================================

/**
 * Get the daily calorie summary for the current user for a date range.
 * Returns rows: { date, total_calories, entry_count, daily_budget, status }
 */
export async function getDailySummary(from, to) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('daily_summary')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get today's summary.
 */
export async function getTodaySummary() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await getDailySummary(today, today);
  return rows[0] || { total_calories: 0, entry_count: 0, daily_budget: null, status: 'no_budget' };
}

/**
 * Get the last N days of summaries (default: 7).
 */
export async function getWeeklySummary(days = 7) {
  const to   = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
  return getDailySummary(from, to);
}


// =============================================================
// 6. MEAL PLANS
// =============================================================

/**
 * Save an AI-generated meal plan.
 * @param {object} plan - { type: 'day'|'week', calorie_budget, preferences, plan_content }
 */
export async function saveMealPlan({ type, calorie_budget, preferences, plan_content }) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('meal_plans')
    .insert({ user_id: user.id, type, calorie_budget, preferences, plan_content })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch the most recent meal plans for the current user.
 * @param {number} limit - Max number of plans to retrieve (default 10)
 */
export async function getMealPlans(limit = 10) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('meal_plans')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

/**
 * Delete a meal plan by its UUID.
 */
export async function deleteMealPlan(id) {
  const { error } = await supabase
    .from('meal_plans')
    .delete()
    .eq('id', id);

  if (error) throw error;
}


// =============================================================
// 7. HELPER UTILITIES
// =============================================================

/**
 * Returns today's date as an ISO string (YYYY-MM-DD).
 */
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Formats a date string to a human-readable label (e.g. "Mon, 24 Mar").
 */
export function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-SG', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/**
 * Returns the ISO date string for N days ago.
 */
export function daysAgoStr(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}