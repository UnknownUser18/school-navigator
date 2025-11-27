import { Component, effect, input, output, signal, viewChild } from '@angular/core';
import { Floors, Point } from "@services/map.service";
import { CoreShapeComponent, NgKonvaEventObject, StageComponent } from "ng2-konva";
import { TooltipMapDirective } from "@modules/tooltip/directive/tooltip-map";
import { Tooltip } from "@modules/tooltip/component/tooltip";

@Component({
  selector    : 'map-container',
  imports     : [
    CoreShapeComponent,
    StageComponent,
    TooltipMapDirective,
    Tooltip
  ],
  templateUrl : './map-container.html',
  styleUrl    : './map-container.scss',
})
export class MapContainer {
  private lastPinchDistance : number | null = null;
  private lastPinchScale : number | null = null;

  protected readonly map = viewChild.required<StageComponent>('map');
  protected readonly layer = viewChild.required<CoreShapeComponent>('layer')
  protected readonly selectedPoint = signal<Point | null>(null);
  protected readonly window = window;

  protected readonly mapImage = {
    image : new Image(),
    x     : 0,
    y     : 0,
  };

  public readonly selectedFloor = input.required<Floors>();
  public readonly shownParameters = input.required<boolean>();
  public readonly points = input<Point[] | null>(null);
  public readonly path = input<number[] | null>(null);
  public readonly position = input<{ x : number; y : number } | null>(null);

  public readonly startingPoint = output<Point>();
  public readonly destinationPoint = output<Point>();

  constructor() {
    const mapImageRecord : Record<Floors, string> = {
      [Floors.UNDERGROUND] : 'Underground',
      [Floors.GROUND]      : 'Ground',
      [Floors.FIRST]       : 'First',
      [Floors.SECOND]      : 'Second',
      [Floors.THIRD]       : 'Third',
    };

    effect(() => {
      this.selectedFloor();
      this.mapImage.image.src = `assets/maps/${ mapImageRecord[this.selectedFloor()] }.png`;
    });

    effect(() => {
      this.position();
      if (this.position() === null) return;

      const x = this.position()?.x ?? 0;
      const y = this.position()?.y ?? 0;

      if (!this.map().getStage()) return;
      this.layer().getStage().position({ x : -x + this.map().getStage().width() / 2, y : -y + this.map().getStage().height() / 2 })
    });
  }

  private changeScale(direction : -1 | 1) {
    const scaleBy = 1.05;

    const oldScale = this.map().getStage().scaleX();
    const pointer = this.map().getStage().getPointerPosition()!;

    const mousePointTo = {
      x : (pointer.x - this.map().getStage().x()) / oldScale,
      y : (pointer.y - this.map().getStage().y()) / oldScale,
    };

    // Limit zoom scale
    let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
    newScale = Math.max(0.1, Math.min(4, newScale));

    this.map().getStage().scale({ x : newScale, y : newScale });

    const newPos = {
      x : pointer.x - mousePointTo.x * newScale,
      y : pointer.y - mousePointTo.y * newScale,
    };
    this.map().getStage().position(newPos);
  }

  private getPinchDistance(event : TouchEvent) : number {
    const [touch1, touch2] = [event.touches[0], event.touches[1]];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  protected mouseZoom(ngEvent : NgKonvaEventObject<WheelEvent> | WheelEvent) {

    let direction : -1 | 1;
    if ('event' in ngEvent) {
      ngEvent.event.evt.preventDefault();
      direction = ngEvent.event.evt.deltaY > 0 ? -1 : 1;
    } else {
      ngEvent.preventDefault();
      direction = ngEvent.deltaY > 0 ? -1 : 1;
    }
    this.changeScale(direction);
  }

  protected onPinchStart(event : NgKonvaEventObject<TouchEvent> | TouchEvent) {
    if ('event' in event) {
      event.event.evt.preventDefault();
      if (event.event.evt.touches.length === 2) {
        this.lastPinchDistance = this.getPinchDistance(event.event.evt);
        this.lastPinchScale = this.map().getStage().scaleX();
      }
    } else if (event.touches.length === 2) {
      this.lastPinchDistance = this.getPinchDistance(event);
      this.lastPinchScale = this.map().getStage().scaleX();
    }
  }

  protected onPinchMove(event : NgKonvaEventObject<TouchEvent> | TouchEvent) {
    if ('event' in event) {
      if (event.event.evt.touches.length === 2 && this.lastPinchDistance !== null && this.lastPinchScale !== null) {
        event.event.evt.preventDefault();
        const newDist = this.getPinchDistance(event.event.evt);
        let scale = (newDist / this.lastPinchDistance) * this.lastPinchScale;
        scale = Math.max(0.5, Math.min(4, scale));
        this.map().getStage().scale({ x : scale, y : scale });
      }
      return;
    }
    if (event.touches.length === 2 && this.lastPinchDistance !== null && this.lastPinchScale !== null) {
      event.preventDefault();
      const newDist = this.getPinchDistance(event);
      let scale = (newDist / this.lastPinchDistance) * this.lastPinchScale;
      scale = Math.max(0.5, Math.min(4, scale));
      this.map().getStage().scale({ x : scale, y : scale });
    }
  }

  protected onPinchEnd(event : NgKonvaEventObject<TouchEvent> | TouchEvent) {
    if ('event' in event) {
      if (event.event.evt.touches.length < 2) {
        this.lastPinchDistance = null;
        this.lastPinchScale = null;
      }
      return;
    }
    if (event.touches.length < 2) {
      this.lastPinchDistance = null;
      this.lastPinchScale = null;
    }
  }
}
