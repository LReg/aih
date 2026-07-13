import { Routes, Router } from '@angular/router';
import { inject } from '@angular/core';
import {LoginComponent} from "./components/login/login.component";
import {RegisterComponent} from "./components/register/register.component";
import {HomeComponent} from "./components/home/home.component";
import {GameComponent} from "./components/game/game.component";
import {LobbyComponent} from "./components/lobby/lobby.component";
import {AdminStatsComponent} from "./components/admin-stats/admin-stats.component";
import {isLoggedIn} from "./security/IsLoggedIn";
import { environment } from '../environments/environment';

function registrationEnabled() {
  if (environment.features.registration) return true;
  return inject(Router).createUrlTree(['/login']);
}

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [registrationEnabled],
  },
  {
    path: '',
    component: HomeComponent,
    canActivate: [isLoggedIn],
  },
  {
    path: 'game/:gameId',
    component: GameComponent,
    canActivate: [isLoggedIn],
  },
  {
    path: 'lobby/:id',
    component: LobbyComponent,
    canActivate: [isLoggedIn],
  },
  {
    path: 'admin-stats',
    component: AdminStatsComponent,
  },
  {
    path: '**',
    redirectTo: '',
  }
];
