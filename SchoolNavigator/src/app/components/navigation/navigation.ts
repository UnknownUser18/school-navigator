import { Component, signal } from '@angular/core';
import { Maneuver, Navigation } from "@services/navigation";
import { Floors } from "@services/map.service";
import { MapContainer } from "@components/map-container/map-container";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faArrowRight, faArrowUp, faStairs, faTimes } from "@fortawesome/free-solid-svg-icons";
import { MatRipple } from "@angular/material/core";
import { Router } from "@angular/router";
import { Chip } from "@modules/chip/chip";

@Component({
  selector    : 'app-navigation',
  imports : [
    MapContainer,
    FaIconComponent,
    MatRipple,
    Chip
  ],
  templateUrl : './navigation.html',
  styleUrl    : './navigation.scss',
})
export class NavigationComponent {
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faArrowRight = faArrowRight;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faStairs = faStairs;
  protected readonly faTimes = faTimes;

  protected readonly fullPath = signal<Maneuver[][] | null>(null); // For all floors
  protected readonly path = signal<number[] | null>(null); // For current floor
  protected readonly maneuvers = signal<Maneuver[] | null>(null); // For user display
  protected readonly currentFloor = signal<Floors>(Floors.GROUND);
  protected readonly hasPreviousStep = signal<boolean>(false);
  protected readonly hasNextStep = signal<boolean>(false);
  protected readonly currentManeuversIndex = signal<number>(0);
  protected readonly currentPosition = signal<{ x: number; y: number } | null>(null);

  constructor(private navigationS : Navigation, private router : Router) {
    const maneuvers = this.navigationS.getManuevers;
    const fullPath = this.navigationS.getNavigation;

    this.fullPath.set(fullPath);

    if (!fullPath || !maneuvers || maneuvers.length === 0) return;

    const firstPoint = maneuvers[0].point.floor_number;
    this.currentFloor.set(firstPoint);
    const path = fullPath[firstPoint + 1].flatMap((maneuver) => [maneuver.point.x_coordinate, maneuver.point.y_coordinate]);
    this.path.set(path);

    this.maneuvers.set(maneuvers);
    this.hasNextStep.set(true);

    setTimeout(() => {
      this.updateStep();
    }, 150);
  }

  protected get topManeuvers() {
    const currentIndex = this.currentManeuversIndex();
    return this.maneuvers()?.slice(currentIndex, currentIndex + 3) ?? [];
  }

  protected close() {
    this.navigationS.setNavigation = null;
    this.navigationS.setManuevers = null;

    this.router.navigate(['/map']).then();
  }

  private updateStep() {
    const maneuvers = this.maneuvers();
    if (!maneuvers) return;

    const currentManeuver = maneuvers[this.currentManeuversIndex()];

    const floor = currentManeuver.point.floor_number;
    this.currentFloor.set(floor);

    this.currentPosition.set({
      x: currentManeuver.point.x_coordinate,
      y: currentManeuver.point.y_coordinate
    });

    const path = this.fullPath()?.[floor + 1].flatMap((maneuver) => [maneuver.point.x_coordinate, maneuver.point.y_coordinate]) ?? null;
    this.path.set(path);
  }

  protected previousStep() {
    this.currentManeuversIndex.update((index) => {
      const newIndex = index - 1;
      this.hasNextStep.set(true);
      if (newIndex <= 0) {
        this.hasPreviousStep.set(false);
        return 0;
      }
      return newIndex;
    });

    this.updateStep();
  }

  protected nextStep() {
    this.currentManeuversIndex.update((index) => {
      const maneuvers = this.maneuvers();
      if (!maneuvers) return index;

      const newIndex = index + 1;
      this.hasPreviousStep.set(true);
      if (newIndex >= maneuvers.length - 1) {
        this.hasNextStep.set(false);
        return maneuvers.length - 1;
      }
      return newIndex;
    });

    this.updateStep();
  }

  protected centerToCurrentPosition() {
    const position = this.currentPosition();
    if (!position) return;

    this.updateStep();
  }
}
