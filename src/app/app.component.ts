import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from './services/supabase.service';
import { AuthComponent } from './components/auth/auth.component';
import { LogTabComponent } from './components/log-tab/log-tab.component';
import { AiTabComponent } from './components/ai-tab/ai-tab.component';
import { BudgetTabComponent } from './components/budget-tab/budget-tab.component';
import { HistoryTabComponent } from './components/history-tab/history-tab.component';
import { ScanModalComponent } from './components/scan-modal/scan-modal.component';

type Tab = 'log' | 'ai' | 'budget' | 'history';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, AuthComponent, LogTabComponent, AiTabComponent, BudgetTabComponent, HistoryTabComponent, ScanModalComponent],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  session: import('@supabase/supabase-js').Session | null = null;
  activeTab: Tab = 'log';
  scanModalOpen = false;
  dateLabel = '';

  constructor(public supabase: SupabaseService) {}

  ngOnInit() {
    this.dateLabel = new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' });
    this.supabase.session$.subscribe(session => {
      this.session = session;
    });
  }

  setTab(tab: Tab) {
    this.activeTab = tab;
  }

  async signOut() {
    await this.supabase.signOut();
  }
}
