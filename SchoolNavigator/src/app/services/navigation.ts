import { inject, Injectable, signal } from '@angular/core';
import { AllPoints, MapService, Point, Connector } from "@services/map.service";
import { Observable, of, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

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
  private readonly points = signal<AllPoints | null>(null);

  private mapS = inject(MapService);

  constructor() {}

  private computeCoordinate(coord : number) : number {
    return Math.floor(coord / Navigation.GRID_SCALE);
  }

  /**
   * Zwraca karę za bliskość ścian (skalowaną, ale ograniczoną do maxPenalty).
   */
  private wallPenalty(grid : number[][], x : number, y : number) : number {
    const penaltyPerWall = 0.5;
    const maxPenalty = 2;
    const rows = grid.length;
    const cols = grid[0].length;

    // Szukaj najbliższej ściany w promieniu 1, 2, 3, ... aż do max(rows, cols)
    for (let radius = 1 ; radius < Math.max(rows, cols) ; radius++) {
      for (let dx = -radius ; dx <= radius ; dx++) {
        for (let dy = -radius ; dy <= radius ; dy++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // tylko krawędź pierścienia
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (grid[ny][nx] !== 0) {
            // Kara maleje wraz z odległością od ściany
            return Math.max(maxPenalty - (radius - 1) * penaltyPerWall, 0);
          }
        }
      }
    }
    return 0;
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
        // Dodaj karę za bliskość ścian
        const penalty = this.wallPenalty(grid, neighbor.x, neighbor.y);
        const gScore = current.g + 1 + penalty;
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
  /**
   * Wyznacza manewry na jednym piętrze (od/do dowolnych punktów na tym piętrze) - asynchronicznie.
   */
  private navigateSingleFloor$(from : Point, to : Point) : Observable<Maneuver[] | null> {
    const fromGrid = {
      x : this.computeCoordinate(from.x_coordinate),
      y : this.computeCoordinate(from.y_coordinate)
    };
    const toGrid = {
      x : this.computeCoordinate(to.x_coordinate),
      y : this.computeCoordinate(to.y_coordinate)
    };

    return this.mapS.getFloorGrid(from.floor_number).pipe(
      map(grid => {
        if (!grid) return null;
        const rows = grid.length;
        const cols = grid[0].length;
        const inBounds = (x : number, y : number) => x >= 0 && y >= 0 && x < cols && y < rows;
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
        return this.generateManeuvers(pointsPath);
      })
    );
  }

  /**
   * Znajduje najkrótszy łańcuch connectorów prowadzący przez wszystkie piętra pośrednie.
   * Zwraca: tablicę connectorów (po jednym na każde piętro, w kolejności od startu do końca).
   */
  private findConnectorChain(from : Point, to : Point) : Connector[] | null {
    if (from.floor_number === to.floor_number) return [];

    const all = this.points();

    if (!all) return null;

    // Zbuduj mapę: piętro -> lista connectorów
    const connectorsByFloor = new Map<number, Connector[]>();

    const connectors = all.filter(connector => {
      return 'up_stair_id' in connector || 'down_stair_id' in connector;
    })

    for (const c of connectors) {
      const arr = connectorsByFloor.get(c.floor_number) || [];
      arr.push(c as Connector);
      connectorsByFloor.set(c.floor_number, arr);
    }

    // BFS po piętrach i connectorach
    type State = { floor : number, connector : Connector, path : Connector[] };
    const visited = new Set<string>();
    const queue : State[] = [];
    // Start: wszystkie connectory na piętrze startowym
    const startConnectors = connectorsByFloor.get(from.floor_number) || [];
    for (const c of startConnectors) {
      queue.push({ floor : from.floor_number, connector : c, path : [c] });
      visited.add(`${ from.floor_number }:${ c.up_stair_id || '' }:${ c.down_stair_id || '' }`);
    }
    while (queue.length > 0) {
      const { floor, connector, path } = queue.shift()!;
      // Czy jesteśmy na piętrze docelowym?
      if (connector.floor_number === to.floor_number) {
        return path;
      }
      // Szukaj połączeń na wyższe/niższe piętro
      for (const [nextFloor, nextConnectors] of connectorsByFloor.entries()) {
        if (nextFloor === floor) continue;
        for (const next of nextConnectors) {
          // Sprawdź czy connectory są połączone tym samym up_stair_id/down_stair_id

          const connUpId = connector.up_stair_id;
          const connId = connector.id;
          const connDownId = connector.down_stair_id;
          const nextId = next.id;
          const nextUpId = next.up_stair_id;
          const nextDownId = next.down_stair_id;

          if (!connUpId && !connDownId) continue;
          if (!nextUpId && !nextDownId) continue;

          if ((connUpId === nextId) || (connDownId === nextId) || (connId === nextUpId) || (connId === nextDownId)) {
            const key = `${ nextFloor }:${ next.up_stair_id || '' }:${ next.down_stair_id || '' }`;
            if (visited.has(key)) continue;
            visited.add(key);
            queue.push({ floor : nextFloor, connector : next, path : [...path, next] });
          }
        }
      }
    }
    return null;
  }

  /**
   * Publiczna nawigacja multi-floor: zwraca tablicę manewrów na każde piętro (Maneuver[][])
   */
  public navigate(from : Point, to : Point) : Observable<Maneuver[][] | null> {
    this.points.set(this.mapS.getAllCachedPoints);
    if (!this.points()) return of(null);

    const floorArray : Maneuver[][] = new Array(5).fill([]);

    if (from.floor_number === to.floor_number) {

      return this.navigateSingleFloor$(from, to).pipe( // +1 bo piętra od -1 do 3
        map(maneuvers => {
          if (!maneuvers) return null;
          floorArray[from.floor_number + 1] = maneuvers;

          return floorArray;
        })
      );
    }
    // Znajdź łańcuch connectorów przez wszystkie piętra
    const connectorChain = this.findConnectorChain(from, to);
    console.log(connectorChain);

    if (!connectorChain || connectorChain.length === 0) return of(null);
    // Zbuduj segmenty: start->c1, c1->c2, ..., cN->end
    const points : Point[] = [from, ...connectorChain, to];
    const segments : Observable<Maneuver[] | null>[] = [];
    for (let i = 0 ; i < points.length - 1 ; i++) {
      if (points[i].floor_number !== points[i + 1].floor_number) {
        // Create maneuvers for floor change
        const floorChangeManeuver = new Maneuver(
          points[i].floor_number < points[i + 1].floor_number ? 'up' : 'down',
          0.05,
          points[i + 1]
        );
        segments.push(of([floorChangeManeuver]));
        continue;
      }
      segments.push(this.navigateSingleFloor$(points[i], points[i + 1]));
    }




    return forkJoin(segments).pipe(
      map(results => {
        if (results.some(r => !r)) return null;
        // Każdy segment to osobna tablica manewrów
        console.log(results);
        const maneuversPerFloor : Maneuver[][] = floorArray.fill([]).map(() => []);
        // Mapuj segmenty do pięter (+1 bo piętra od -1 do 3)
        for (let i = 0 ; i < results.length ; i++) {
          const segmentManeuvers = results[i]!;
          const floor = points[i].floor_number + 1; // +1 bo piętra od -1 do 3
          maneuversPerFloor[floor] = maneuversPerFloor[floor].concat(segmentManeuvers);
        }
        return maneuversPerFloor;
      })
    );
  }
}