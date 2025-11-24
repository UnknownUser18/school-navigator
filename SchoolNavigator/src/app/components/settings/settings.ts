import { Component, effect, signal } from '@angular/core';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faRotateBack, faWarning } from "@fortawesome/free-solid-svg-icons";
import { faMoon } from "@fortawesome/free-regular-svg-icons";
import { MapService } from "@services/map.service";

@Component({
  selector: 'app-settings',
  imports : [
    FaIconComponent
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {

  protected readonly success = signal<boolean | null>(null);

  protected readonly faArrowLeft = faArrowLeft;
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
  }

  protected resetData() {
    this.mapS.getAllPoints.subscribe(success => {
      this.success.set(success);
    });
  }
}
