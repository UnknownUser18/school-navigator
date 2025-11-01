import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TooltipRegistry {
  public isTooltipOpen = signal(false);

  constructor() {}

  public registerTooltipOpen() {
    this.isTooltipOpen.set(true);
  }

  public registerTooltipClose() {
    this.isTooltipOpen.set(false);
  }
}
