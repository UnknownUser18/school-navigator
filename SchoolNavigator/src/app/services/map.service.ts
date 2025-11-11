import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { isPlatformBrowser } from "@angular/common";
import { catchError, map, of } from "rxjs";

/**
 * @enum Floors
 * Enum representing different floors of a building.
 */
export enum Floors {
  UNDERGROUND = -1,
  GROUND,
  FIRST,
  SECOND,
  THIRD,
}

export enum StatusCode {
  OK = 200,
  CREATED = 201,
  UPDATED = 202,
  DELETED = 203,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
}

export class Point {
  public id : number;
  public x_coordinate : number;
  public y_coordinate : number;
  public floor_number : Floors;
  public description : string;

  constructor(id : number, x : number, y : number, floor_number : Floors, description? : string) {
    this.id = id;
    this.x_coordinate = x;
    this.y_coordinate = y;
    this.floor_number = floor_number;
    this.description = description || '';
  }
}

export interface Packet {
  status_code : StatusCode;
  message : string;
  timestamp : string;
  data : unknown;
}

export class Room extends Point {
  public room_number : string;

  constructor(id : Point['id'], x : Point['x_coordinate'], y : Point['y_coordinate'], floor_number : Point['floor_number'], room_number : string, description? : string) {
    super(id, x, y, floor_number, description);
    this.room_number = room_number;
  }
}

export class Staircase extends Point {
  public down_stair_id : Staircase['id'] | null;
  public up_stair_id : Staircase['id'] | null;

  constructor(id : Point['id'], x : Point['x_coordinate'], y : Point['y_coordinate'], floor_number : Point['floor_number'], down_stair_id : Staircase['id'] | null, up_stair_id : Staircase['id'] | null, description? : string) {
    super(id, x, y, floor_number, description);
    this.down_stair_id = down_stair_id;
    this.up_stair_id = up_stair_id;
  }
}

export class Exit extends Point {
  public isEmergencyExit : boolean;
  public exit_name : string;

  constructor(id : Point['id'], x : Point['x_coordinate'], y : Point['y_coordinate'], floor_number : Point['floor_number'], isEmergencyExit : boolean, exit_name : string, description? : string) {
    super(id, x, y, floor_number, description);
    this.isEmergencyExit = isEmergencyExit;
    this.exit_name = exit_name;
  }
}

type CachePointsNames = 'points_underground' | 'points_ground' | 'points_first' | 'points_second' | 'points_third';

type AllPoints = (Room | Staircase | Exit)[];

@Injectable({
  providedIn : 'root',
})
export class MapService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private readonly cacheMap = new Map<Floors, CachePointsNames>([
    [Floors.UNDERGROUND, 'points_underground'],
    [Floors.GROUND, 'points_ground'],
    [Floors.FIRST, 'points_first'],
    [Floors.SECOND, 'points_second'],
    [Floors.THIRD, 'points_third'],
  ]);

  constructor() {}

  private get fetchAllPointsFromDB() {
    return this.http.get<Packet>(`api/points/all`).pipe(
      map((res) => {
        if (res.status_code !== StatusCode.OK) {
          return null;
        }
        return res.data as [Room[], Staircase[], Exit[]];
      }),
      catchError(() => of(null))
    )
  }

  private getPointsFromCache(name : CachePointsNames) {
    if (!isPlatformBrowser(this.platformId)) {
      throw new Error('Cannot access localStorage on the server side.');
    }

    const pointsData = localStorage.getItem(name);
    if (!pointsData) {
      return null;
    }

    const pointsArray = JSON.parse(pointsData) as AllPoints;

    return pointsArray.map(point => {
      if ('room_number' in point) {
        return new Room(point.id, point.x_coordinate, point.y_coordinate, point.floor_number, point.room_number, point.description);
      } else if ('exit_name' in point) {
        return new Exit(point.id, point.x_coordinate, point.y_coordinate, point.floor_number, (point as any).isEmergencyExit, (point as any).exit_name, point.description);
      } else {
        return new Staircase(point.id, point.x_coordinate, point.y_coordinate, point.floor_number, (point as any).down_stair_id, (point as any).up_stair_id, point.description);
      }
    });
  }

  public getPointsFromStorey(floors : Floors) {
    const cacheName = this.cacheMap.get(floors);
    if (!cacheName) {
      return null;
    }

    return this.getPointsFromCache(cacheName);
  }

  public get getAllPoints() {
    return this.fetchAllPointsFromDB.pipe(
      map((data) => {
        if (!data) {
          return false;
        }
        const { rooms, exits, stairs } = data as unknown as { rooms : Room[], exits : Exit[], stairs : Staircase[] };
        [Floors.UNDERGROUND, Floors.GROUND, Floors.FIRST, Floors.SECOND, Floors.THIRD].forEach((floor) => {
          const pointsOnFloor : Point[] = [];
          rooms.filter(room => room.floor_number === floor).forEach(room => pointsOnFloor.push(room));
          stairs.filter(stairs => stairs.floor_number === floor).forEach(stairs => pointsOnFloor.push(stairs));
          exits.filter(exit => exit.floor_number === floor).forEach(exit => pointsOnFloor.push(exit));
          localStorage.setItem(this.cacheMap.get(floor)!, JSON.stringify(pointsOnFloor));
        });
        return true;
      })
    );
  }

  public getPlaceSuggestions(query : string) {

    const points = [Floors.UNDERGROUND, Floors.GROUND, Floors.FIRST, Floors.SECOND, Floors.THIRD].flatMap((floor) => {
      const cachedPoints = this.getPointsFromCache(this.cacheMap.get(floor)!);
      if (!cachedPoints) {
        return [];
      }
      return cachedPoints;
    });


    return points.filter((point) => {
      if (point instanceof Room) {
        return point.room_number.toLowerCase().includes(query.toLowerCase());
      } else if (point instanceof Exit) {
        return point.exit_name.toLowerCase().includes(query.toLowerCase());
      }
      return point instanceof Staircase && (`Schody ${ point.id }`.toLowerCase().includes(query.toLowerCase()));
    }) as AllPoints;
  }
}
