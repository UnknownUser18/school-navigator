import { Component, effect, inject, PLATFORM_ID, signal } from '@angular/core';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faRotateBack, faWarning } from "@fortawesome/free-solid-svg-icons";
import { faMoon } from "@fortawesome/free-regular-svg-icons";
import { MapService } from "@services/map.service";
import { isPlatformBrowser } from "@angular/common";

@Component({
  selector: 'app-settings',
  imports : [
    FaIconComponent
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private platformId = inject(PLATFORM_ID);

  protected readonly success = signal<boolean | null>(null);

  protected readonly faMoon = faMoon;
  protected readonly faWarning = faWarning;
  protected readonly faRotateBack = faRotateBack;

  constructor(private mapS : MapService) {
    effect(() => {
      this.success();
      setTimeout(() => {
        this.success.set(null);
      }, 3000);
    });
  }

  protected toggleTheme() {
    document.body.classList.toggle('dark-theme');
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
    }
  }

  protected resetData() {
    this.mapS.getAllPoints.subscribe(success => {
      this.success.set(success); // For web, we show success directly
    });
  }
}
