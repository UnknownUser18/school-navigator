import { Component, effect, signal } from '@angular/core';
import { CoreShapeComponent, StageComponent } from "ng2-konva";
import Konva from "konva";
import { Exit, Floors, MapService, Point, Room } from '@services/map.service';
import { Tooltip } from "@modules/tooltip/component/tooltip";
import { TooltipMapDirective } from "@modules/tooltip/directive/tooltip-map";
import { Chip } from "@modules/chip/chip";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faLocationDot, faSearch } from "@fortawesome/free-solid-svg-icons";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatRipple } from "@angular/material/core";
import ContainerConfig = Konva.ContainerConfig;

type Suggestion = {
  type : 'room' | 'exit' | 'staircase';
  id : number;
  name : string;
  description : string;
}

@Component({
  selector    : 'app-map',
  imports     : [
    StageComponent,
    CoreShapeComponent,
    TooltipMapDirective,
    Tooltip,
    Chip,
    FaIconComponent,
    FormsModule,
    MatRipple,
    ReactiveFormsModule,
  ],
  templateUrl : './map.html',
  styleUrl    : './map.scss',
})
export class MapComponent {
  protected readonly selectedStorey = signal<Floors>(Floors.THIRD);
  protected readonly points = signal<Point[] | null>(null);
  protected readonly selectedPoint = signal<Point | null>(null);
  protected readonly startingPlaceSuggestions = signal<Suggestion[] | null>(null);
  protected readonly destinationPlaceSuggestions = signal<Suggestion[] | null>(null);

  protected readonly faSearch = faSearch;
  protected readonly faLocationDot = faLocationDot;

  protected navigationForm = new FormGroup({
    startingPlace    : new FormControl('', [Validators.required]),
    destinationPlace : new FormControl('', [Validators.required]),
  });

  protected readonly mapConfig : ContainerConfig = {
    width  : 350,
    height : 300,
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
    const mapImageRecord : Record<Floors, string> = {
      [Floors.UNDERGROUND] : 'Underground',
      [Floors.GROUND]      : 'Ground',
      [Floors.FIRST]       : 'First',
      [Floors.SECOND]      : 'Second',
      [Floors.THIRD]       : 'Third',
    };

    effect(() => {
      this.selectedStorey();
      // Use preloaded image from cache
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

  private getSuggestions(query : string) : Suggestion[] {
    return this.mapS.getPlaceSuggestions(query).map(point => {
      let name = '';
      if (point instanceof Room) {
        name = point.room_number;
      } else if (point instanceof Exit) {
        name = point.exit_name;
      }
      return {
        type        : point instanceof Room ? 'room' : point instanceof Exit ? 'exit' : 'staircase',
        id          : point.id,
        name        : name,
        description : point.description,
      } as Suggestion;
    });
  }

  private get getStartingPlace() : string {
    return this.navigationForm.get('startingPlace')?.value || '';
  }

  private get getDestinationPlace() : string {
    return this.navigationForm.get('destinationPlace')?.value || '';
  }

  private setInputsErrorState() {
    const startingPlaceControl = this.navigationForm.get('startingPlace');
    const destinationPlaceControl = this.navigationForm.get('destinationPlace');


    if (this.getStartingPlace.trim() === this.getDestinationPlace.trim()) {
      startingPlaceControl?.setErrors({ sameAsDestination : true });
      destinationPlaceControl?.setErrors({ sameAsStarting : true });
    } else {
      if (startingPlaceControl?.hasError('sameAsDestination')) {
        startingPlaceControl.updateValueAndValidity({ onlySelf : true, emitEvent : false });
      }
      if (destinationPlaceControl?.hasError('sameAsStarting')) {
        destinationPlaceControl.updateValueAndValidity({ onlySelf : true, emitEvent : false });
      }
    }
  }

  protected getDestinationPlaceSuggestions() {
    if (this.getDestinationPlace.length === 0) {
      this.destinationPlaceSuggestions.set(null);
      return;
    }

    this.setInputsErrorState();

    const suggestions = this.getSuggestions(this.getDestinationPlace);
    this.destinationPlaceSuggestions.set(suggestions);
  }

  protected getStartingPlaceSuggestions() {
    if (this.getStartingPlace.length === 0) {
      this.startingPlaceSuggestions.set(null);
      return;
    }
    this.setInputsErrorState();

    const suggestions = this.getSuggestions(this.getStartingPlace);
    this.startingPlaceSuggestions.set(suggestions);
  }

  protected selectStartingPlaceSuggestion(suggestion : Suggestion) {
    this.navigationForm.get('startingPlace')?.setValue(suggestion.name);
    setTimeout(() => {
      this.startingPlaceSuggestions.set(null);
    }, 150);
    this.setInputsErrorState();
  }

  protected selectDestinationPlaceSuggestion(suggestion : Suggestion) {
    this.navigationForm.get('destinationPlace')?.setValue(suggestion.name);
    setTimeout(() => {
      this.destinationPlaceSuggestions.set(null);
    }, 150);
    this.setInputsErrorState();
  }

  protected clearStartingPlaceSuggestions() {
    this.startingPlaceSuggestions.set(null);
  }

  protected clearDestinationPlaceSuggestions() {
    this.destinationPlaceSuggestions.set(null);
  }
}
