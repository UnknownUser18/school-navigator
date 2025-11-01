import { Injectable } from '@angular/core';

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

@Injectable({
  providedIn : 'root',
})
export class Map {

}
