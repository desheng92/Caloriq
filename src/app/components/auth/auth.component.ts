import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth.component.html'
})
export class AuthComponent {
  mode: 'signin' | 'signup' = 'signin';
  email = '';
  password = '';
  errorMessage = '';
  loading = false;

  constructor(private supabase: SupabaseService) {}

  switchMode(mode: 'signin' | 'signup') {
    this.mode = mode;
    this.errorMessage = '';
  }

  async submit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    try {
      if (this.mode === 'signup') {
        await this.supabase.signUp(this.email, this.password);
      } else {
        await this.supabase.signIn(this.email, this.password);
      }
    } catch (e: unknown) {
      this.errorMessage = e instanceof Error ? e.message : 'Authentication failed.';
    } finally {
      this.loading = false;
    }
  }
}
