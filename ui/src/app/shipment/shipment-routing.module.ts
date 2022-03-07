import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ShipmentDetailsComponent } from './shipment-details/shipment-details.component';
import { ShipmentManagementComponent } from './shipment-management/shipment-management.component';

/**
 * Provides routing configuration for the shipment module
 */
@NgModule({
  imports: [RouterModule.forChild([
    { path: '', redirectTo: 'list', pathMatch: 'full'},
    { path: 'list', component: ShipmentManagementComponent },
    { path: 'details/:id', component: ShipmentDetailsComponent },
   
  ])],
  exports: [RouterModule]
})
export class ShipmentRoutingModule { }
