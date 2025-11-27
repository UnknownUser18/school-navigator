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

  private readonly navigation = signal<Maneuver[][] | null>(null);
  private readonly maneuvers = signal<Maneuver[] | null>(null);

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
    for (let i = 1 ; i < path.length ; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      if (curr.floor_number !== prev.floor_number) {
        throw new Error("Not implemented: multi-floor maneuvers");
      }
      const dx = curr.x_coordinate - prev.x_coordinate;
      const dy = curr.y_coordinate - prev.y_coordinate;
      const distance = Math.sqrt(dx * dx + dy * dy) / 100;
      let instruction : 'straight' | 'left' | 'right' = 'straight';
      if (i > 1) {
        const prevPrev = path[i - 2];
        const pdx = prev.x_coordinate - prevPrev.x_coordinate;
        const pdy = prev.y_coordinate - prevPrev.y_coordinate;
        // Wektory kierunku
        const v1 = { x : pdx, y : pdy };
        const v2 = { x : dx, y : dy };
        // Sprawdź czy kierunek się zmienił
        if (v1.x * v2.y - v1.y * v2.x !== 0) { // iloczyn wektorowy != 0 => skręt
          // Określ lewo/prawo przez znak iloczynu wektorowego
          const cross = v1.x * v2.y - v1.y * v2.x;
          instruction = cross > 0 ? 'left' : 'right';
        }
      }
      if (instruction === 'straight' && i < path.length - 1) {
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
   * Znajduje łańcuch connectorów prowadzący przez wszystkie piętra pośrednie,
   * wybierając taki, który rzeczywiście prowadzi do piętra docelowego.
   * Używa BFS po grafie connectorów.
   */
  private findConnectorChain(from: Point, to: Point): Connector[] | null {
    if (from.floor_number === to.floor_number) return [];
    const all = this.points();
    if (!all) return null;
    const connectors = all.filter(connector => 'up_stair_id' in connector || 'down_stair_id' in connector) as Connector[];
    const connectorsByFloor = new Map<number, Connector[]>();
    for (const c of connectors) {
      const arr = connectorsByFloor.get(c.floor_number) || [];
      arr.push(c);
      connectorsByFloor.set(c.floor_number, arr);
    }
    const step = from.floor_number < to.floor_number ? 1 : -1;
    // BFS: węzeł = connector, ścieżka = tablica connectorów
    const startConnectors = connectorsByFloor.get(from.floor_number);
    const endConnectors = connectorsByFloor.get(to.floor_number);
    if (!startConnectors || !endConnectors) return null;

    // BFS kolejka: [ścieżka, ostatni connector]
    type PathNode = { path: Connector[], last: Connector };
    const queue: PathNode[] = [];
    const visited = new Set<string>(); // connectorId+floor
    for (const c of startConnectors) {
      queue.push({ path: [c], last: c });
      visited.add(`${c.id}:${c.floor_number}`);
    }
    let bestPath: Connector[] | null = null;
    let minStartDist = Infinity;
    while (queue.length > 0) {
      const { path, last } = queue.shift()!;
      if (last.floor_number === to.floor_number) {
        // Zakończ jeśli dotarliśmy na piętro docelowe
        // Wybierz najbliższy connector do punktu docelowego
        const dx = last.x_coordinate - to.x_coordinate;
        const dy = last.y_coordinate - to.y_coordinate;
        const dist = dx * dx + dy * dy;
        if (dist < minStartDist) {
          minStartDist = dist;
          bestPath = [...path];
        }
        continue;
      }
      // Szukaj powiązanych connectorów na następnym piętrze
      const nextFloor = last.floor_number + step;
      const nextConnectors = connectorsByFloor.get(nextFloor);
      if (!nextConnectors) continue;
      for (const nc of nextConnectors) {
        let connected = false;
        if (step === 1 && 'down_stair_id' in nc && nc.down_stair_id === last.id) connected = true;
        if (step === -1 && 'up_stair_id' in nc && nc.up_stair_id === last.id) connected = true;
        if (connected) {
          const key = `${nc.id}:${nc.floor_number}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ path: [...path, nc], last: nc });
          }
        }
      }
    }
    return bestPath;
  }

  public navigate(from : Point, to : Point) : Observable<{
    maneuvers : Maneuver[][],
    order : number[]
  } | null> {
    this.points.set(this.mapS.getAllCachedPoints);
    if (!this.points()) return of(null);

    const floorArray : Maneuver[][] = new Array(5).fill([]);

    if (from.floor_number === to.floor_number) {

      return this.navigateSingleFloor$(from, to).pipe( // +1 bo piętra od -1 do 3
        map(maneuvers => {
          if (!maneuvers) return null;
          floorArray[from.floor_number + 1] = maneuvers;

          return {
            maneuvers : floorArray,
            order     : [from.floor_number + 1]
          };
        })
      );
    }
    // Znajdź łańcuch connectorów przez wszystkie piętra
    const connectorChain = this.findConnectorChain(from, to);

    if (!connectorChain || connectorChain.length === 0) return of(null);
    const points : Point[] = [from, ...connectorChain, to];
    const segments : Observable<Maneuver[] | null>[] = [];
    const orderArray : number[] = [];
    for (let i = 0 ; i < points.length - 1 ; i++) {
      if (points[i].floor_number !== points[i + 1].floor_number) {
        const floorChangeManeuver = new Maneuver(
          points[i].floor_number < points[i + 1].floor_number ? 'up' : 'down',
          0.05,
          points[i] // zabij mnie
        );
        segments.push(of([floorChangeManeuver]));
        orderArray.push(points[i + 1].floor_number + 1);
        continue;
      }
      segments.push(this.navigateSingleFloor$(points[i], points[i + 1]));
      orderArray.push(points[i + 1].floor_number + 1);
    }
    const order = Array.from(new Set(orderArray)); // Unikalne piętra w kolejności występowania
    const manuevers = forkJoin(segments).pipe(
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
    return manuevers.pipe(
      map(maneuversPerFloor => {
        if (!maneuversPerFloor) return null;
        return {
          maneuvers : maneuversPerFloor,
          order     : order
        };
      })
    );
  }

  public set setNavigation(path : Maneuver[][] | null) {
    this.navigation.set(path);
  }

  public get getNavigation() : Maneuver[][] | null {
    return this.navigation();
  }

  public set setManuevers(path : Maneuver[] | null) {
    this.maneuvers.set(path);
  }

  public get getManuevers() : Maneuver[] | null {
    return this.maneuvers();
  }
}