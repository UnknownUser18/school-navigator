import { Component, effect, signal } from '@angular/core';
import { CoreShapeComponent, StageComponent } from "ng2-konva";
import ContainerConfig = Konva.ContainerConfig;
import Konva from "konva";
import { MapService, Point, Storey } from '@services/map.service';
import { Tooltip } from "@modules/tooltip/component/tooltip";
import { TooltipMapDirective } from "@modules/tooltip/directive/tooltip-map";
import { Chip } from "@modules/chip/chip";

@Component({
  selector    : 'app-map',
  imports     : [
    StageComponent,
    CoreShapeComponent,
    TooltipMapDirective,
    Tooltip,
    Chip,
  ],
  templateUrl : './map.html',
  styleUrl    : './map.scss',
})
export class Map {
  protected readonly selectedStorey = signal<Storey>(Storey.THIRD);
  protected readonly points = signal<Point[] | null>(null);
  protected readonly selectedPoint = signal<Point | null>(null);

  protected readonly mapConfig : ContainerConfig = {
    width  : 800,
    height : 600,
  };

  protected readonly mapImage = {
    image : new Image(),
    x     : 0,
    y     : 0,
  };

  protected readonly storeys = [
    { label : 'Piwnica', value : Storey.UNDERGROUND },
    { label : 'Parter', value : Storey.GROUND },
    { label : 'Pierwsze piętro', value : Storey.FIRST },
    { label : 'Drugie piętro', value : Storey.SECOND },
    { label : 'Trzecie piętro', value : Storey.THIRD }
  ];


  constructor(private mapS : MapService) {
    this.mapImage.image.src = 'assets/mapImage.png';
    effect(() => {
      this.selectedStorey();
      this.points.set(this.mapS.getPointsFromStorey(this.selectedStorey()));
      console.log(this.points());
    });
  }
}
