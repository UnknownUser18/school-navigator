import { Component, input, signal } from '@angular/core';
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: 'dropdown',
  imports : [
    FaIconComponent
  ],
  templateUrl: './dropdown.html',
  styleUrl: './dropdown.scss',
  host : {
  }
})
export class Dropdown {
  protected readonly isOpen = signal(false);

  protected readonly faChevronDown = faChevronDown;

  public readonly dropdownText = input.required<string>();
  public readonly secondaryText = input<string>('');

  protected toggleVisibility() {
    this.isOpen.set(!this.isOpen());
  }
}
