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
  },
  {
    path: 'settings',
    loadComponent : () => import('@components/settings/settings').then(m => m.Settings)
  },
  {
    path: 'navigation',
    loadComponent : () => import('@components/navigation/navigation').then(m => m.NavigationComponent)
  }
];
