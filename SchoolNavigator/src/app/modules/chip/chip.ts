import { Component, input } from '@angular/core';

@Component({
  selector: 'chip',
  imports: [],
  templateUrl: './chip.html',
  styleUrl: './chip.scss',
  host : {
    '[class.selected]' : 'isSelected()'
  }
})
export class Chip {
  public readonly isSelected = input.required<boolean>();
}
