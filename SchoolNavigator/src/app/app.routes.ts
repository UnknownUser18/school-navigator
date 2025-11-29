import { Routes } from '@angular/router';
import { Home } from "@components/home/home";

export const routes: Routes = [
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
    path : 'timetable',
    loadComponent : () => import('@components/timetable/timetable.component').then(m => m.TimetableComponent)
  },
  {
    path : 'timetable-creator',
    loadComponent : () => import('@components/timetable-creator/timetable-creator').then(m => m.TimetableCreator)
  },
  {
    path : 'map',
    loadComponent : () => import('@components/map/map').then(m => m.MapComponent)
  },
  {
    path: 'navigation',
    loadComponent : () => import('@components/navigation/navigation').then(m => m.NavigationComponent)
  },
  {
    path: 'settings',
    loadComponent : () => import('@components/settings/settings').then(m => m.Settings)
  }
];
