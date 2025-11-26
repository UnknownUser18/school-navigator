import { Component, inject, PLATFORM_ID } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faCalendarAlt, faHome, faMap } from "@fortawesome/free-regular-svg-icons";
import { faCog } from "@fortawesome/free-solid-svg-icons";
import { MatRipple } from "@angular/material/core";
import { isPlatformBrowser } from "@angular/common";


@Component({
  selector    : 'app-root',
  imports : [
    RouterLink,
    RouterLinkActive,
    FaIconComponent,
    RouterOutlet,
    MatRipple,
  ],
  templateUrl : './app.html',
  styleUrl    : './app.scss'
})
export class App {
  private platformId = inject(PLATFORM_ID);

  protected readonly faHome = faHome;
  protected readonly faCalendarAlt = faCalendarAlt;
  protected readonly faCog = faCog;
  protected readonly faMap = faMap;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const theme = localStorage.getItem('theme');
      document.body.classList.toggle('dark-theme', theme === 'dark');
    }
  }
}
