import { Routes } from '@angular/router';
import {LoginComponent} from "./components/login/login.component";
import {HomeComponent} from "./components/home/home.component";
import {GameComponent} from "./components/game/game.component";
import {LobbyComponent} from "./components/lobby/lobby.component";
import {AdminStatsComponent} from "./components/admin-stats/admin-stats.component";
import {isLoggedIn} from "./security/IsLoggedIn";
import {isAdmin} from "./security/IsAdmin";
import {ProfileComponent} from "./components/profile/profile.component";

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [isLoggedIn],
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
    path: 'profile',
    component: ProfileComponent,
    canActivate: [isLoggedIn],
  },
  {
    path: 'admin-stats',
    component: AdminStatsComponent,
    canActivate: [isLoggedIn, isAdmin],
  },
  {
    path: '**',
    redirectTo: '',
  }
];
