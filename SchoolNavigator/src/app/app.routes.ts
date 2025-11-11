import { Routes } from '@angular/router';
import { Home } from "@components/home/home";

export const routes: Routes = [
  {
    path : 'map',
    loadComponent : () => import('@components/map/map').then(m => m.MapComponent)
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
  {
    path: 'home',
    component : Home
  }
];
