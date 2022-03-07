import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'shipment', pathMatch: 'full'},

  // The following modules are loaded dynamically
  { path: 'shipment', loadChildren: 'app/shipment/shipment.module#ShipmentModule' },
  // when users visit invalid urls.
  { path: '**', redirectTo: '/shipment' }
];


/**
 * Provides routing configuration for the App module
 */
 @NgModule({
  imports: [RouterModule.forRoot(routes, {scrollPositionRestoration: 'top'})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
