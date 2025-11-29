import { Component, effect, signal } from '@angular/core';
import { Exit, Floors, MapService, Point, Room } from '@services/map.service';
import { Chip } from "@modules/chip/chip";
import { FaIconComponent } from "@fortawesome/angular-fontawesome";
import { faArrowDown, faArrowRight, faArrowUp, faChevronUp, faLocationDot, faSearch } from "@fortawesome/free-solid-svg-icons";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatRipple } from "@angular/material/core";
import { Maneuver, Navigation } from "@services/navigation";
import { MatBottomSheet } from "@angular/material/bottom-sheet";
import { BottomSheet } from "@modules/bottom-sheet/bottom-sheet";
import { MapContainer } from "@components/map-container/map-container";
import { ActivatedRoute, Router } from "@angular/router";

type Suggestion = {
  type : 'room' | 'exit' | 'staircase';
  id : number;
  name : string;
  description : string;
}

@Component({
  selector    : 'app-map',
  imports     : [
    Chip,
    FaIconComponent,
    FormsModule,
    MatRipple,
    ReactiveFormsModule,
    MapContainer,
  ],
  templateUrl : './map.html',
  styleUrl    : './map.scss',
})
export class MapComponent {
  private readonly fullPath = signal<Maneuver[][] | null>(null);

  protected readonly selectedStorey = signal<Floors>(Floors.FIRST);
  protected readonly points = signal<Point[] | null>(null);
  protected readonly startingPlaceSuggestions = signal<Suggestion[] | null>(null);
  protected readonly destinationPlaceSuggestions = signal<Suggestion[] | null>(null);
  protected readonly path = signal<number[] | null>(null);
  protected readonly maneuvers = signal<Maneuver[] | null>(null);
  protected readonly showParameters = signal<boolean>(true);

  protected readonly faSearch = faSearch;
  protected readonly faLocationDot = faLocationDot;
  protected readonly faChevronUp = faChevronUp;
  protected readonly faArrowRight = faArrowRight;
  protected readonly faArrowUp = faArrowUp;
  protected readonly faArrowDown = faArrowDown;

  protected navigationForm = new FormGroup({
    startingPlace    : new FormControl('', [Validators.required]),
    destinationPlace : new FormControl('', [Validators.required]),
  });


  protected readonly floors = [
    { label : 'Piwnica', value : Floors.UNDERGROUND, ariaLabel : 'Przejdź do piwnicy' },
    { label : 'Parter', value : Floors.GROUND, ariaLabel : 'Przejdź do parteru' },
    { label : 'Piętro 1', value : Floors.FIRST, ariaLabel : 'Przejdź do pierwszego piętra' },
    { label : 'Piętro 2', value : Floors.SECOND, ariaLabel : 'Przejdź do drugiego piętra' },
    { label : 'Piętro 3', value : Floors.THIRD, ariaLabel : 'Przejdź do trzeciego piętra' },
  ];

  constructor(private mapS : MapService,
              private navigationS : Navigation,
              private matBottomSheet : MatBottomSheet,
              private router : Router,
              private route : ActivatedRoute) {
    this.route.queryParams.subscribe(params => {
      const roomQuery = params['room'];
      if (!roomQuery) return;

      const roomPoint = this.mapS.getPointFromQuery(roomQuery);
      if (!roomPoint) return;

      this.navigationForm.get('destinationPlace')?.setValue(roomPoint instanceof Room ? roomPoint.room_number : roomPoint instanceof Exit ? roomPoint.exit_name : `S${ roomPoint.id }`);
      this.checkIfCanNavigate();
    })

    effect(() => {
      this.selectedStorey();

      const pointsFromStorey = this.mapS.getPointsFromStorey(this.selectedStorey());
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

  protected openBottomSheet() {
    this.matBottomSheet.open(BottomSheet, {
      data : {
        maneuvers : this.maneuvers(),
      },
    });
  }

  protected startNavigation() {
    this.navigationS.setNavigation = this.fullPath()!;
    this.navigationS.setManuevers = this.maneuvers()!;
    this.router.navigate(['/navigation']).then();
  }
}

