import { Directive, input } from '@angular/core';
import { Tooltip } from "@modules/tooltip/component/tooltip";

@Directive({
  selector : '[tooltip]',
  host : {
    '(click)': 'tooltip().createInfoTooltip($event)',
    '(touchstart)': 'tooltip().createInfoTooltip($event)',
  }
})
export class TooltipDirective {
  public tooltip = input.required<Tooltip>();

  constructor() { }
}
