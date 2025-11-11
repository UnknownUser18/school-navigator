import { Component, input } from '@angular/core';
import { MatRippleModule } from '@angular/material/core';

@Component({
  selector    : 'chip',
  imports     : [MatRippleModule],
  templateUrl : './chip.html',
  styleUrl    : './chip.scss',
  host        : {
    '[class.selected]' : 'isSelected()',
  }
})
export class Chip {
  public readonly isSelected = input.required<boolean>();
}
