import { Component } from '@angular/core';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faLocationPin, faSearch } from "@fortawesome/free-solid-svg-icons";
import { RouterLink } from "@angular/router";

@Component({
  selector: 'app-home',
  imports : [
    FaIconComponent,
    RouterLink
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {

  protected readonly faLocationPin = faLocationPin;
  protected readonly faSearch = faSearch;
}
