import { Component, effect, signal, viewChild } from '@angular/core';
import { CoreShapeComponent, NgKonvaEventObject, StageComponent } from "ng2-konva";
import Konva from "konva";
import { Exit, Floors, MapService, Point, Room } from '@services/map.service';
import { Tooltip } from "@modules/tooltip/component/tooltip";
import { TooltipMapDirective } from "@modules/tooltip/directive/tooltip-map";
import { Chip } from "@modules/chip/chip";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faArrowLeft, faArrowRight, faArrowUp, faFlagCheckered, faLocationDot, faSearch, faStairs } from "@fortawesome/free-solid-svg-icons";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatRipple } from "@angular/material/core";
import { Maneuver, Navigation } from "@services/navigation";
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
  private lastPinchDistance : number | null = null;
  private lastPinchScale : number | null = null;

  protected readonly map = viewChild.required<StageComponent>('map');


  private readonly fullPath = signal<Maneuver[][] | null>(null);
  protected readonly selectedStorey = signal<Floors>(Floors.FIRST);
  protected readonly points = signal<Point[] | null>(null);
  protected readonly selectedPoint = signal<Point | null>(null);
  protected readonly startingPlaceSuggestions = signal<Suggestion[] | null>(null);
  protected readonly destinationPlaceSuggestions = signal<Suggestion[] | null>(null);
  protected readonly path = signal<number[] | null>(null);
  protected readonly maneuvers = signal<Maneuver[] | null>(null);

  protected readonly faSearch = faSearch;
  protected readonly faLocationDot = faLocationDot;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faStairs = faStairs;
  protected readonly faArrowLeft = faArrowLeft;
  protected readonly faFlagCheckered = faFlagCheckered;
  protected readonly faArrowRight = faArrowRight;

  protected navigationForm = new FormGroup({
    startingPlace    : new FormControl('', [Validators.required]),
    destinationPlace : new FormControl('', [Validators.required]),
  });

  protected readonly mapConfig : ContainerConfig = {
    width     : 350,
    height    : 300,
    draggable : true,
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

  constructor(private mapS : MapService, private navigationS : Navigation) {
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

      if (this.fullPath()) {
        const filteredPath = this.fullPath()![this.selectedStorey() + 1]; // Floors enum starts at -1
        this.path.set(filteredPath.flatMap(p => [p.point.x_coordinate, p.point.y_coordinate]));
      }

      if (!pointsFromStorey) {
        this.mapS.getAllPoints.subscribe(() => {
          const pointsFromStoreyAfterFetch = this.mapS.getPointsFromStorey(this.selectedStorey());
          this.points.set(pointsFromStoreyAfterFetch);
        });
      }
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

  private getFlagsFromQuery(query : string) : 'room' | 'connector' | 'exit' | null {
    const match = new RegExp('^(sala|wyjście|klatka schodowa)\\s+', 'i').exec(query);
    if (!match) return null;

    const flag = match[1].toLowerCase();

    if (flag === 'sala') {
      return 'room';
    } else if (flag === 'wyjście') {
      return 'exit';
    } else if (flag === 'klatka schodowa') {
      return 'connector';
    }
    return null;
  }

  private getSuggestions(query : string, flags : 'room' | 'connector' | 'exit' | null) : Suggestion[] {
    const cleanedQuery = query.replace(/^(sala|wyjście|klatka schodowa)\s+/i, '').trim();
    return this.mapS.getPlaceSuggestions(cleanedQuery).map(point => {
      let name : string;
      if (point instanceof Room && (flags === null || flags === 'room')) {
        name = point.room_number;
      } else if (point instanceof Exit && (flags === null || flags === 'exit')) {
        name = point.exit_name;
      } else if (!(point instanceof Room) && !(point instanceof Exit) && (flags === null || flags === 'connector')) {
        name = `S${ point.id }`;
      } else {
        name = '';
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


    if (this.getStartingPlace.trim() === this.getDestinationPlace.trim() && this.getStartingPlace.trim() !== '') {
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

  private getPinchDistance(event : TouchEvent) : number {
    const [touch1, touch2] = [event.touches[0], event.touches[1]];
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  protected getDestinationPlaceSuggestions() {
    if (this.getDestinationPlace.length === 0) {
      this.destinationPlaceSuggestions.set(null);
      return;
    }

    this.setInputsErrorState();

    const suggestions = this.getSuggestions(this.getDestinationPlace, this.getFlagsFromQuery(this.getDestinationPlace));
    this.destinationPlaceSuggestions.set(suggestions);
  }

  protected getStartingPlaceSuggestions() {
    if (this.getStartingPlace.length === 0) {
      this.startingPlaceSuggestions.set(null);
      return;
    }
    this.setInputsErrorState();

    const suggestions = this.getSuggestions(this.getStartingPlace, this.getFlagsFromQuery(this.getStartingPlace));
    this.startingPlaceSuggestions.set(suggestions);
  }

  protected selectStartingPlaceSuggestion(suggestion : Suggestion) {
    this.navigationForm.get('startingPlace')?.setValue(suggestion.name);
    setTimeout(() => {
      this.startingPlaceSuggestions.set(null);
      this.checkIfCanNavigate();
    }, 150);
    this.setInputsErrorState();
  }

  protected selectDestinationPlaceSuggestion(suggestion : Suggestion) {
    this.navigationForm.get('destinationPlace')?.setValue(suggestion.name);
    setTimeout(() => {
      this.destinationPlaceSuggestions.set(null);
      this.checkIfCanNavigate();
    }, 150);
    this.setInputsErrorState();
  }

  protected clearStartingPlaceSuggestions() {
    this.startingPlaceSuggestions.set(null);
  }

  protected clearDestinationPlaceSuggestions() {
    this.destinationPlaceSuggestions.set(null);
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
    console.log('Pinch move detected', event);
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

  protected checkIfCanNavigate() {
    const { startingPlace, destinationPlace } = this.navigationForm.value;

    if (!startingPlace || !destinationPlace)
      return;

    if (startingPlace.trim() === destinationPlace.trim())
      return;


    const startPoint = this.mapS.getPointFromQuery(startingPlace);
    const endPoint = this.mapS.getPointFromQuery(destinationPlace);

    if (!startPoint || !endPoint)
      return;

    this.navigationS.navigate(startPoint, endPoint).subscribe((path) => {
      console.log("Received path:", path);

      const maneuversList = path?.maneuvers!;
      const orderList = path?.order!;

      if (!path) {
        this.fullPath.set(null);
        this.path.set(null);
        this.maneuvers.set(null);
        return;
      }

      this.fullPath.set(path.maneuvers);


      const sortedManeuvers = orderList.map((index) => {
        return maneuversList[index];
      });

      this.maneuvers.set(sortedManeuvers.flat());

      const filteredPath = path.maneuvers[this.selectedStorey() + 1]; // Floors enum starts at -1

      this.path.set(filteredPath.flatMap(p => [p.point.x_coordinate, p.point.y_coordinate]));
    });
  }

  protected setAsStaringPlace(point : Point) {
    const placeName = point instanceof Room ? point.room_number : point instanceof Exit ? point.exit_name : `S${ point.id }`;
    this.navigationForm.get('startingPlace')?.setValue(placeName);
    this.checkIfCanNavigate();
  }

  protected setAsDestinationPlace(point : Point) {
    const placeName = point instanceof Room ? point.room_number : point instanceof Exit ? point.exit_name : `S${ point.id }`;
    this.navigationForm.get('destinationPlace')?.setValue(placeName);
    this.checkIfCanNavigate();
  }
}
