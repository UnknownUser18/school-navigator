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
    const openMap = new Map<string, Node>();
    openMap.set(`${ start.x },${ start.y }`, open[0]);
    const closed = new Set<string>();
    const nodeKey = (x : number, y : number) => `${ x },${ y }`;

    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift()!;
      openMap.delete(nodeKey(current.x, current.y));
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
      const neighbors = [
        { x : current.x + 1, y : current.y },
        { x : current.x - 1, y : current.y },
        { x : current.x, y : current.y + 1 },
        { x : current.x, y : current.y - 1 },
      ];
      for (const neighbor of neighbors) {
        if (!isWalkable(neighbor.x, neighbor.y) || closed.has(nodeKey(neighbor.x, neighbor.y))) {
          continue;
        }
        const gScore = current.g + 1;
        const key = nodeKey(neighbor.x, neighbor.y);
        let neighborNode = openMap.get(key);
        if (!neighborNode) {
          neighborNode = { x : neighbor.x, y : neighbor.y, g : gScore, f : gScore + h(neighbor.x, neighbor.y), parent : current };
          open.push(neighborNode);
          openMap.set(key, neighborNode);
        } else if (gScore < neighborNode.g) {
          neighborNode.g = gScore;
          neighborNode.f = gScore + h(neighbor.x, neighbor.y);
          neighborNode.parent = current;
        }
      }
    }

    return null;
  }

  private generateManeuvers(path : Point[]) : Maneuver[] {
    if (path.length < 2) return [];

    const maneuvers : Maneuver[] = [];

    // Prosta implementacja generowania manewrów bez optymalizacji
    for (let i = 1 ; i < path.length ; i++) {
      const prev = path[i - 1];
      const curr = path[i];

      if (curr.floor_number !== prev.floor_number) {
        throw new Error("Not implemented: multi-floor maneuvers");
      }

      const dx = curr.x_coordinate - prev.x_coordinate;
      const dy = curr.y_coordinate - prev.y_coordinate;
      const distance = Math.sqrt(dx * dx + dy * dy) / 100;

      const dir : [number, number] = [Math.sign(dx), Math.sign(dy)];

      // Determine turn direction
      let instruction : 'straight' | 'left' | 'right' = 'straight';
      if (i > 1) {
        const prevPrev = path[i - 2];
        const pdx = prev.x_coordinate - prevPrev.x_coordinate;
        const pdy = prev.y_coordinate - prevPrev.y_coordinate;
        const prevDir : [number, number] = [Math.sign(pdx), Math.sign(pdy)];

        if (dir[0] !== prevDir[0] || dir[1] !== prevDir[1]) {
          instruction = this.getTurn(prevDir, dir);
        }
      }

      if (instruction === 'straight' && i < path.length - 1) {
        // Konsoliduj tylko jeśli to nie jest ostatni manewr na ścieżce
        const lastManeuver = maneuvers[maneuvers.length - 1];
        if (lastManeuver && lastManeuver.instruction === 'straight') {
          lastManeuver.distance += distance;
          continue;
        }
      }

      maneuvers.push(new Maneuver(instruction, distance, curr));
    }


    return maneuvers;
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
        const inBounds = (x : number, y : number) => x >= 0 && y >= 0 && x < cols && y < rows;
        let start = fromGrid;
        let end = toGrid;
        // Jeśli start lub end są poza gridem lub na ścianie, znajdź najbliższy wolny punkt
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
        // Jeśli start lub end są na ścianie i nie znaleziono wolnej komórki, nie generuj ścieżki
        if (!inBounds(start.x, start.y) || grid[start.y][start.x] !== 0) return null;
        if (!inBounds(end.x, end.y) || grid[end.y][end.x] !== 0) return null;
        let path = this.aStar(grid, start, end);
        if (!path || path.length === 0) return null;
        const allPoints = this.points()!;
        let pointsPath : Point[] = path.map(({ x, y } : GridCoordinate) => {
          const px = x * Navigation.GRID_SCALE;
          const py = y * Navigation.GRID_SCALE;
          return (
            allPoints.find(p => this.computeCoordinate(p.x_coordinate) === x && this.computeCoordinate(p.y_coordinate) === y && p.floor_number === from.floor_number)
            || new Point(-1, px, py, from.floor_number)
          );
        });
        // ZAWSZE doklejaj from na początek, jeśli nie pokrywa się z pierwszym punktem ścieżki
        if (pointsPath.length === 0 || pointsPath[0].x_coordinate !== from.x_coordinate || pointsPath[0].y_coordinate !== from.y_coordinate) {
          pointsPath = [from, ...pointsPath];
        }
        // ZAWSZE doklejaj to na koniec, jeśli nie pokrywa się z ostatnim punktem ścieżki
        if (pointsPath.length === 0 || pointsPath[pointsPath.length - 1].x_coordinate !== to.x_coordinate || pointsPath[pointsPath.length - 1].y_coordinate !== to.y_coordinate) {
          pointsPath = [...pointsPath, to];
        }
        return this.generateManeuvers(pointsPath);
      })
    );
  }

}