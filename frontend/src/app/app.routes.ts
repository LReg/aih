import { Routes } from '@angular/router';
import {LoginComponent} from "./components/login/login.component";
import {HomeComponent} from "./components/home/home.component";
import {GameComponent} from "./components/game/game.component";
import {isLoggedIn} from "./security/IsLoggedIn";

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
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
    path: '**',
    redirectTo: '',
  }
];
