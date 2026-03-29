import { Component, EventEmitter, HostListener, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiService, ScanItem } from '../../services/ai.service';
import { LogStateService } from '../../services/log-state.service';

@Component({
  selector: 'app-scan-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './scan-modal.component.html'
})
export class ScanModalComponent {
  @Output() close = new EventEmitter<void>();

  scanImageBase64: string | null = null;
  scanImageMime = 'image/jpeg';
  previewUrl: string | null = null;
  selectedMeal = 'Breakfast';
  scanResults: ScanItem[] = [];
  scanTotal = 0;
  loading = false;
  errorMessage = '';
  isDragOver = false;

  constructor(
    private ai: AiService,
    private logState: LogStateService
  ) {}

  @HostListener('document:keydown.escape')
  closeOnEsc() {
    this.close.emit();
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.processFile(input.files[0]);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave() {
    this.isDragOver = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragOver = false;
    if (event.dataTransfer?.files[0]) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Please upload an image file.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.errorMessage = 'Image must be under 5 MB.';
      return;
    }
    this.scanImageMime = file.type;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      this.scanImageBase64 = result.split(',')[1];
      this.previewUrl = result;
      this.scanResults = [];
      this.errorMessage = '';
    };
    reader.readAsDataURL(file);
  }

  clearImage() {
    this.scanImageBase64 = null;
    this.previewUrl = null;
    this.scanResults = [];
    this.errorMessage = '';
  }

  async runScan() {
    if (!this.scanImageBase64) return;
    this.loading = true;
    this.scanResults = [];
    this.errorMessage = '';
    try {
      const parsed = await this.ai.scanImage(this.scanImageBase64, this.scanImageMime);
      const items = parsed.items || [];
      if (!items.length) {
        this.errorMessage = 'No food items detected. Try a clearer photo.';
        return;
      }
      this.scanResults = items.map(item => ({ ...item, added: false }));
      this.scanTotal = items.reduce((s, i) => s + i.calories, 0);
    } catch {
      this.errorMessage = 'Could not parse AI response or error reaching service. Please try again.';
    } finally {
      this.loading = false;
    }
  }

  async addItem(item: ScanItem, index: number) {
    await this.logState.addEntry({
      name: item.name,
      calories: item.calories,
      meal: this.selectedMeal,
      portion: item.portion,
      source: 'ai_scan'
    });
    this.scanResults[index] = { ...item, added: true };
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  confidenceColor(c: string): string {
    if (c === 'high') return 'var(--accent)';
    if (c === 'medium') return 'var(--amber)';
    return 'var(--muted)';
  }
}
