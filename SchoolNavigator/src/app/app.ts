import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faCalendarAlt, faHome, faMap } from "@fortawesome/free-regular-svg-icons";
import { faCog } from "@fortawesome/free-solid-svg-icons";
import { MatRipple } from "@angular/material/core";


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
  protected readonly faHome = faHome;
  protected readonly faCalendarAlt = faCalendarAlt;
  protected readonly faCog = faCog;
  protected readonly faMap = faMap;
}
