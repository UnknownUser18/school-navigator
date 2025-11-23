import { inject, Injectable, signal } from '@angular/core';
import { AllPoints, MapService, Point } from "@services/map.service";
import { Observable, of } from 'rxjs';
import { map as rxMap } from 'rxjs/operators';

export class Maneuver {
  public instruction : 'straight' | 'left' | 'right' | 'up' | 'down';
  public distance : number;
  public point : Point;

  constructor(instruction : 'straight' | 'left' | 'right' | 'up' | 'down', distance : number, point : Point) {
    this.instruction = instruction;
    this.distance = distance;
    this.point = point;
  }
}

type GridCoordinate = { x : number, y : number };


@Injectable({
  providedIn : 'root',
})
export class Navigation {
  private static readonly GRID_SCALE = 5;
  private static readonly MIN_DIST = 0;
  private readonly points = signal<AllPoints | null>(null);

  private mapS = inject(MapService);

  constructor() {}

  private computeCoordinate(coord : number) : number {
    return Math.floor(coord / Navigation.GRID_SCALE);
  }

  private aStar(grid : number[][], start : GridCoordinate, end : GridCoordinate) : GridCoordinate[] | null {
    type Node = { x : number, y : number, g : number, f : number, parent? : Node };

    const rows = grid.length;
    const cols = grid[0].length;

    const inBounds = (x : number, y : number) => x >= 0 && y >= 0 && x < cols && y < rows;
    const isWalkable = (x : number, y : number) => inBounds(x, y) && grid[y][x] === 0;
    const h = (x : number, y : number) => Math.abs(x - end.x) + Math.abs(y - end.y); // Manhattan

    const open : Node[] = [{ x : start.x, y : start.y, g : 0, f : h(start.x, start.y) }];
    const closed = new Set<string>();

    const nodeKey = (x : number, y : number) => `${ x },${ y }`;

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);

      const current = open.shift()!;

      if (current.x === end.x && current.y === end.y) {
        const path : GridCoordinate[] = [];
        let node : Node | undefined = current;

        while (node) {
          path.push({ x : node.x, y : node.y });
          node = node.parent;
        }

        return path.reverse();
      }

      closed.add(nodeKey(current.x, current.y));

      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        const nx = current.x + dx, ny = current.y + dy;

        if (!isWalkable(nx, ny) || closed.has(nodeKey(nx, ny))) continue;

        let g = current.g + 1;

        const existing = open.find(n => n.x === nx && n.y === ny);

        if (!existing) {
          open.push({ x : nx, y : ny, g, f : g + h(nx, ny), parent : current });
        } else if (g < existing.g) {
          existing.g = g;
          existing.f = g + h(nx, ny);
          existing.parent = current;
        }
      }
    }
    return null;
  }

  private generateManeuvers(path : Point[]) : Maneuver[] {
    if (path.length < 2) return [];

    const maneuvers : Maneuver[] = [];

    let prev = path[0];
    let prevDir : [number, number] | null = null; // [dx, dy]
    let prevFloor = prev.floor_number;

    let distance = 0;
    let shortTurnBuffer = 0; // licznik krótkich odcinków

    for (let i = 1 ; i < path.length ; i++) {
      const curr = path[i];

      // Zmiana piętra
      if (curr.floor_number !== prevFloor) {
        if (distance > 0 && prevDir)
          maneuvers.push(new Maneuver('straight', distance * Navigation.GRID_SCALE / 100, prev));

        maneuvers.push(new Maneuver(curr.floor_number > prevFloor ? 'up' : 'down', 0, curr));

        prevDir = null;
        distance = 0;
        shortTurnBuffer = 0;
        prevFloor = curr.floor_number;
        prev = curr;
        continue;
      }
      // Kierunek na tym samym piętrze
      const dx = curr.x_coordinate - prev.x_coordinate;
      const dy = curr.y_coordinate - prev.y_coordinate;

      const dir : [number, number] = [Math.sign(dx), Math.sign(dy)];

      if (prevDir === null) {
        prevDir = dir;
        distance = 1;
        shortTurnBuffer = 0;
      } else if (dir[0] === prevDir[0] && dir[1] === prevDir[1]) {
        distance++;
        shortTurnBuffer = 0;
      } else {
        // Jeśli odcinek jest bardzo krótki (np. 1 pole), ignoruj zmianę kierunku (nie generuj manewru)
        if (distance <= 1) {
          shortTurnBuffer++;
          // nie resetuj prevDir, nie generuj manewru
        } else {
          const straightDist = distance * Navigation.GRID_SCALE / 100;
          if (distance > 0 && straightDist >= Navigation.MIN_DIST)
            maneuvers.push(new Maneuver('straight', straightDist, prev));
          maneuvers.push(new Maneuver(this.getTurn(prevDir, dir), 0, prev));
          prevDir = dir;
          distance = 1;
          shortTurnBuffer = 0;
        }
      }
      prev = curr;
    }
    // Dodaj ostatni manewr jeśli wystarczająco długi
    const lastDist = distance * Navigation.GRID_SCALE / 100;
    if (distance > 0 && lastDist >= Navigation.MIN_DIST && prevDir)
      maneuvers.push(new Maneuver('straight', lastDist, prev));

    // Usuwanie powtarzających się i niepotrzebnych manewrów (jak wcześniej)
    const optimized : Maneuver[] = [];
    for (let i = 0 ; i < maneuvers.length ; i++) {
      const m = maneuvers[i];
      if (m.instruction === 'straight' && m.distance < Navigation.MIN_DIST) {
        if (i > 0 && (maneuvers[i - 1].instruction === 'left' || maneuvers[i - 1].instruction === 'right'))
          continue;
      }
      if (optimized.length > 0) {
        const prevM = optimized[optimized.length - 1];
        const previousInstruction = prevM.instruction;
        const currentInstruction = m.instruction;
        const isLeft = (instr : string) => instr === 'left';
        const isRight = (instr : string) => instr === 'right';
        const areTheySame = () => currentInstruction === previousInstruction;
        if ((isLeft(currentInstruction) || isRight(currentInstruction)) && (isLeft(previousInstruction) || isRight(previousInstruction)) && !areTheySame()) {
          optimized.pop();
          continue;
        }
        if ((isLeft(currentInstruction) || isRight(currentInstruction)) && areTheySame()) {
          continue;
        }
      }
      optimized.push(m);
    }
    return optimized;
  }

  private getTurn(prevDir : [number, number], newDir : [number, number]) : 'left' | 'right' {
    if (prevDir[0] === 1 && newDir[1] === 1) return 'right'; // prawo -> dół
    if (prevDir[0] === 1 && newDir[1] === -1) return 'left'; // prawo -> góra
    if (prevDir[0] === -1 && newDir[1] === 1) return 'left'; // lewo -> dół
    if (prevDir[0] === -1 && newDir[1] === -1) return 'right'; // lewo -> góra
    if (prevDir[1] === 1 && newDir[0] === 1) return 'left'; // dół -> prawo
    if (prevDir[1] === 1 && newDir[0] === -1) return 'right'; // dół -> lewo
    if (prevDir[1] === -1 && newDir[0] === 1) return 'right'; // góra -> prawo
    if (prevDir[1] === -1 && newDir[0] === -1) return 'left'; // góra -> lewo
    // fallback
    return 'right';
  }

  /**
   * Znajduje najbliższą wolną komórkę gridu (grid[y][x] === 0) od (x, y).
   * Zwraca {x, y} lub null jeśli nie znajdzie.
   */
  private findNearestWalkable(grid : number[][], x : number, y : number) : GridCoordinate | null {
    const rows = grid.length;
    const cols = grid[0].length;
    const inBounds = (x : number, y : number) => x >= 0 && y >= 0 && x < cols && y < rows;
    if (inBounds(x, y) && grid[y][x] === 0) return { x, y };
    // BFS do najbliższej wolnej komórki
    const visited = new Set<string>();
    const queue : { x : number, y : number }[] = [{ x, y }];
    visited.add(`${ x },${ y }`);
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    while (queue.length > 0) {
      const { x : cx, y : cy } = queue.shift()!;
      for (const [dx, dy] of directions) {
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny) || visited.has(`${ nx },${ ny }`)) continue;
        if (grid[ny][nx] === 0) return { x : nx, y : ny };
        queue.push({ x : nx, y : ny });
        visited.add(`${ nx },${ ny }`);
      }
    }
    return null;
  }

  public navigate(from : Point, to : Point) : Observable<Maneuver[] | null> {
    this.points.set(this.mapS.getAllCachedPoints);
    if (!this.points()) return of(null);

    const fromGrid = {
      x : this.computeCoordinate(from.x_coordinate),
      y : this.computeCoordinate(from.y_coordinate)
    };
    const toGrid = {
      x : this.computeCoordinate(to.x_coordinate),
      y : this.computeCoordinate(to.y_coordinate)
    };

    return this.mapS.getFloorGrid(from.floor_number).pipe(
      rxMap((grid) => {
        if (!grid) return null;
        const rows = grid.length;
        const cols = grid[0].length;
        const inBounds = (x : number, y : number) => {
          if (x < 0 || y < 0) return false;
          return x < cols && y < rows;
        };
        let start = fromGrid;
        let end = toGrid;
        if (!inBounds(start.x, start.y) || grid[start.y][start.x] !== 0) {
          const found = this.findNearestWalkable(grid, start.x, start.y);
          if (!found) return null;
          start = found;
        }
        if (!inBounds(end.x, end.y) || grid[end.y][end.x] !== 0) {
          const found = this.findNearestWalkable(grid, end.x, end.y);
          if (!found) return null;
          end = found;
        }
        let path = this.aStar(grid, start, end);
        if (!path) return null;
        // Generowanie ścieżki punktów na podstawie gridu
        const allPoints = this.points()!;
        const pointsPath : Point[] = [from, ...path.slice(1).map(({ x, y } : GridCoordinate) => {
          const px = x * Navigation.GRID_SCALE;
          const py = y * Navigation.GRID_SCALE;
          return (
            allPoints.find(p => this.computeCoordinate(p.x_coordinate) === x && this.computeCoordinate(p.y_coordinate) === y && p.floor_number === from.floor_number)
            || new Point(-1, px, py, from.floor_number)
          );
        })];
        return this.generateManeuvers(pointsPath);
      })
    );
  }
}
