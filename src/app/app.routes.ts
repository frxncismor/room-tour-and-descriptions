import { Routes } from '@angular/router';
import { ViewerComponent } from './components/viewer/viewer.component';

export const routes: Routes = [
  { path: '', component: ViewerComponent },
  { path: '**', redirectTo: '' }
];
