import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { isPlatformBrowser } from "@angular/common";

/**
 * @enum Storey
 * Enum representing different storeys (floors) of a building.
 */
export enum Storey {
  UNDERGROUND = -1,
  GROUND,
  FIRST,
  SECOND,
  THIRD,
}

export class Point {
  public id : number;
  public x : number;
  public y : number;
  public storey : Storey;
  public isEmergencyExit : boolean;

  constructor(id : number, x : number, y : number, storey : Storey, isEmergencyExit : boolean = false) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.storey = storey;
    this.isEmergencyExit = isEmergencyExit;
  }
}

export interface Packet {
  status : 'success' | 'error';
  message : string;
  timestamp : string;
  data : unknown;
}

type CachePointsNames = 'points_underground' | 'points_ground' | 'points_first' | 'points_second' | 'points_third';


@Injectable({
  providedIn : 'root',
})
export class MapService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  constructor() {}

  private fetchPointsFromDB() {
    this.http.get<Packet>(`points/getAll`)
  }

  private getPointsFromCache(name : CachePointsNames) {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Cannot access localStorage on the server side.');
    }

    const pointsData = localStorage.getItem(name);
    if (!pointsData) {
      return null;
    }

    return JSON.parse(pointsData) as Point[];
  }

  public getPointsFromStorey(storey : Storey) {
    const map : Record<Storey, CachePointsNames> = {
      [Storey.UNDERGROUND] : 'points_underground',
      [Storey.GROUND]      : 'points_ground',
      [Storey.FIRST]       : 'points_first',
      [Storey.SECOND]      : 'points_second',
      [Storey.THIRD]       : 'points_third',
    };

    return this.getPointsFromCache(map[storey]);
  }
}
