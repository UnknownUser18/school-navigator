import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { isPlatformBrowser } from "@angular/common";
import { catchError, map, of } from "rxjs";
import { environment } from "../../environments/environment";

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
  public neighbours? : number[];

  constructor(id : number, x : number, y : number, floor_number : Floors, description? : string, neighbours? : string) {
    this.id = id;
    this.x_coordinate = x;
    this.y_coordinate = y;
    this.floor_number = floor_number;
    this.description = description || '';

    this.neighbours = neighbours ? new Array<number>() : undefined;
    if (neighbours) {
      const neighbourIds = neighbours.split(',').map(idStr => parseInt(idStr.trim(), 10));
      this.neighbours!.push(...neighbourIds);
    }
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

  constructor(id : Point['id'], x : Point['x_coordinate'], y : Point['y_coordinate'], floor_number : Point['floor_number'], room_number : string, description? : string, neighbours? : string) {
    super(id, x, y, floor_number, description, neighbours);
    this.room_number = room_number;
  }
}

export class Connector extends Point {
  public down_stair_id : Connector['id'] | null;
  public up_stair_id : Connector['id'] | null;

  constructor(id : Point['id'], x : Point['x_coordinate'], y : Point['y_coordinate'], floor_number : Point['floor_number'], down_stair_id : Connector['id'] | null, up_stair_id : Connector['id'] | null, description? : string, neighbours? : string) {
    super(id, x, y, floor_number, description, neighbours);
    this.down_stair_id = down_stair_id;
    this.up_stair_id = up_stair_id;
  }
}

export class Exit extends Point {
  public isEmergencyExit : boolean;
  public exit_name : string;

  constructor(id : Point['id'], x : Point['x_coordinate'], y : Point['y_coordinate'], floor_number : Point['floor_number'], isEmergencyExit : boolean, exit_name : string, description? : string, neighbours? : string) {
    super(id, x, y, floor_number, description, neighbours);
    this.isEmergencyExit = isEmergencyExit;
    this.exit_name = exit_name;
  }
}

export type AllPoints = (Room | Connector | Exit)[];

type CachePointsNames = 'points_underground' | 'points_ground' | 'points_first' | 'points_second' | 'points_third';

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
    return this.http.get<Packet>(`${ environment.apiUrl }/api/points/all`).pipe(
      map((res) => {
        if (res.status_code !== StatusCode.OK) {
          return null;
        }
        return res.data as [Room[], Connector[], Exit[]];
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
        return new Room(point.id, point.x_coordinate, point.y_coordinate, point.floor_number, point.room_number, point.description, point.neighbours as unknown as string);
      } else if ('exit_name' in point) {
        return new Exit(point.id, point.x_coordinate, point.y_coordinate, point.floor_number, (point as any).isEmergencyExit, (point as any).exit_name, point.description, point.neighbours as unknown as string);
      } else {
        return new Connector(point.id, point.x_coordinate, point.y_coordinate, point.floor_number, (point as any).down_stair_id, (point as any).up_stair_id, point.description, point.neighbours as unknown as string);
      }
    });
  }

  public get getAllCachedPoints() {
    const allPoints : AllPoints = [];
    this.cacheMap.forEach((cacheName) => {
      const pointsFromCache = this.getPointsFromCache(cacheName);
      if (pointsFromCache) {
        allPoints.push(...pointsFromCache);
      }
    });
    return allPoints;
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
        const { rooms, exits, connections } = data as unknown as { rooms : Room[], exits : Exit[], connections : Connector[] };
        [Floors.UNDERGROUND, Floors.GROUND, Floors.FIRST, Floors.SECOND, Floors.THIRD].forEach((floor) => {
          const pointsOnFloor : Point[] = [];
          rooms.filter(room => room.floor_number === floor).forEach(room => pointsOnFloor.push(room));
          connections.filter(connections => connections.floor_number === floor).forEach(connections => pointsOnFloor.push(connections));
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
      return point instanceof Connector && (`Schody ${ point.id }`.toLowerCase().includes(query.toLowerCase()));
    }) as AllPoints;
  }

  public getPointFromQuery(query : string) : Point | null {
    const points = [Floors.UNDERGROUND, Floors.GROUND, Floors.FIRST, Floors.SECOND, Floors.THIRD].flatMap((floor) => {
      const cachedPoints = this.getPointsFromCache(this.cacheMap.get(floor)!);
      if (!cachedPoints) {
        return [];
      }
      return cachedPoints;
    });

    for (const point of points) {
      if (point instanceof Room && point.room_number.toLowerCase() === query.toLowerCase()) {
        return point;
      } else if (point instanceof Exit && point.exit_name.toLowerCase() === query.toLowerCase()) {
        return point;
      } else if (point instanceof Connector && (`Schody ${ point.id }`.toLowerCase() === query.toLowerCase())) {
        return point;
      }
    }

    return null;
  }

  public getFloorGrid(floor : Floors) {
    const nameMap = new Map<Floors, string>([
      [Floors.UNDERGROUND, 'Underground'],
      [Floors.GROUND, 'Ground'],
      [Floors.FIRST, 'First'],
      [Floors.SECOND, 'Second'],
      [Floors.THIRD, 'Third'],
    ]);

    return this.http.get(`/assets/maps/${ nameMap.get(floor)! }Grid.json`).pipe(
      map((res) => res as number[][]),
      catchError(() => of(null))
    )
  }
}
