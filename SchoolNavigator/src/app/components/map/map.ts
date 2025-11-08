import { Component, effect, signal } from '@angular/core';
import { CoreShapeComponent, StageComponent } from "ng2-konva";
import ContainerConfig = Konva.ContainerConfig;
import Konva from "konva";
import { MapService, Point, Floors } from '@services/map.service';
import { Tooltip } from "@modules/tooltip/component/tooltip";
import { TooltipMapDirective } from "@modules/tooltip/directive/tooltip-map";
import { Chip } from "@modules/chip/chip";
import { MatRipple } from "@angular/material/core";

@Component({
  selector    : 'app-map',
  imports : [
    StageComponent,
    CoreShapeComponent,
    TooltipMapDirective,
    Tooltip,
    Chip,
    MatRipple,
  ],
  templateUrl : './map.html',
  styleUrl    : './map.scss',
})
export class Map {
  protected readonly selectedStorey = signal<Floors>(Floors.THIRD);
  protected readonly points = signal<Point[] | null>(null);
  protected readonly selectedPoint = signal<Point | null>(null);

  protected readonly mapConfig : ContainerConfig = {
    width  : 800,
    height : 550,
  };

  protected readonly mapImage = {
    image : new Image(),
    x     : 0,
    y     : 0,
  };

  protected readonly storeys = [
    { label : 'Piwnica', value : Floors.UNDERGROUND, ariaLabel : 'Przejdź do piwnicy' },
    { label : 'Parter', value : Floors.GROUND, ariaLabel : 'Przejdź do parteru' },
    { label : 'Piętro 1', value : Floors.FIRST, ariaLabel : 'Przejdź do pierwszego piętra' },
    { label : 'Piętro 2', value : Floors.SECOND, ariaLabel : 'Przejdź do drugiego piętra' },
    { label : 'Piętro 3', value : Floors.THIRD, ariaLabel : 'Przejdź do trzeciego piętra' },
  ];


  constructor(private mapS : MapService) {
    this.mapImage.image.src = 'assets/mapImage.png';

    const mapImageRecord : Record<Floors, string> = {
      [Floors.UNDERGROUND] : 'Underground',
      [Floors.GROUND]      : 'Ground',
      [Floors.FIRST]       : 'First',
      [Floors.SECOND]      : 'Second',
      [Floors.THIRD]       : 'Third',
    };

    effect(() => {
      this.selectedStorey();
      this.mapImage.image.src = `assets/maps/${ mapImageRecord[this.selectedStorey()] }.png`;

      const pointsFromStorey = this.mapS.getPointsFromStorey(this.selectedStorey());

      // First get from cache or fetch from DB if not in cache
      this.points.set(pointsFromStorey);

      if (!pointsFromStorey) {
        this.mapS.getAllPoints.subscribe(() => {
          const pointsFromStoreyAfterFetch = this.mapS.getPointsFromStorey(this.selectedStorey());
          this.points.set(pointsFromStoreyAfterFetch);
        });
      }
    });
  }
}
