import { Component, signal } from '@angular/core';
import { CoreShapeComponent, StageComponent } from "ng2-konva";
import ContainerConfig = Konva.ContainerConfig;
import Konva from "konva";
import { Point, Storey } from '@services/map';
import { Tooltip } from "@modules/tooltip/component/tooltip";
import { TooltipMapDirective } from "@modules/tooltip/directive/tooltip-map";

@Component({
  selector    : 'app-map',
  imports : [
    StageComponent,
    CoreShapeComponent,
    TooltipMapDirective,
    Tooltip,
  ],
  templateUrl : './map.html',
  styleUrl    : './map.scss',
})
export class Map {
  protected readonly mapConfig : ContainerConfig = {
    width  : 800,
    height : 600,
  };

  protected readonly mapImage = {
    image : new Image(),
    x     : 0,
    y     : 0,
  };

  protected readonly selectedPoint = signal<Point | null>(null);

  constructor() {
    this.mapImage.image.src = 'assets/mapImage.png';
  }

  public readonly points : Point[] = Array.from({ length : 15 }, (_, i) => {
    const x = Math.floor(Math.random() * 800) + 1;
    const y = Math.floor(Math.random() * 600) + 1;
    // isEmergencyExit: true dla co trzeciego punktu, reszta bez argumentu (false domyślnie)
    if (i % 3 === 0) {
      return new Point(i, x, y, Storey.FIRST, true);
    } else {
      return new Point(i, x, y, Storey.FIRST);
    }
  });
}

