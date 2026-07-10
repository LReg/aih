import { Routes } from '@angular/router';
import {LoginComponent} from "./components/login/login.component";
import {RegisterComponent} from "./components/register/register.component";
import {HomeComponent} from "./components/home/home.component";
import {GameComponent} from "./components/game/game.component";
import {LobbyComponent} from "./components/lobby/lobby.component";
import {isLoggedIn} from "./security/IsLoggedIn";

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'register',
    component: RegisterComponent,
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
    path: '**',
    redirectTo: '',
  }
];
