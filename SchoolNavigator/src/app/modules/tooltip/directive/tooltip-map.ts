import { Directive, input } from '@angular/core';
import { Tooltip } from "@modules/tooltip/component/tooltip";
import { NgKonvaEventObject } from "ng2-konva";

@Directive({
  selector : '[tooltipMap]',
  host     : {
    '(click)'      : 'createMapTooltip($event)',
    '(touchstart)' : 'createMapTooltip($event)',
  }
})
export class TooltipMapDirective {
  public tooltip = input.required<Tooltip>({ alias : 'tooltipMap' });

  constructor() { }

  /**
   * @method createMapTooltip
   * @description Invoke the tooltip creation for map elements.
   * @param event{unknown} - The event object from the click or touchstart event.
   * @note `event.event.evt` contains the original DOM event. It's using Ng2-Konva event structure.
   * @protected
   */
  protected createMapTooltip(event : unknown) {
    const interactionEvent = event as NgKonvaEventObject<MouseEvent | TouchEvent>;
    this.tooltip().createInfoTooltip(interactionEvent.event.evt);
  }
}
