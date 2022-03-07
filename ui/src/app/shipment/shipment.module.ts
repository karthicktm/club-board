// tslint:disable:max-line-length
import { NgModule } from '@angular/core';
import { ShipmentManagementComponent } from './shipment-management/shipment-management.component';
import { ShipmentDetailsComponent } from './shipment-details/shipment-details.component';
import { ShipmentRoutingModule } from './shipment-routing.module';
import { BrowserModule } from '@angular/platform-browser';
import { ChartsModule } from 'ng2-charts';
/**
 * Module containing functionality related to managing Devices
 */
@NgModule({
  imports: [
    BrowserModule,
    ShipmentRoutingModule,   /* Routing modules declared last */
    ChartsModule
  ],
  declarations: [
    ShipmentManagementComponent,
    ShipmentDetailsComponent
  
  ],
  entryComponents: [ /* You need add dynamic elements here */
    
  ],
  providers: [
    
  ]
})
export class ShipmentModule { }
