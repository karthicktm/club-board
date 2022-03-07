import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { NavbarComponent } from './navbar/navbar.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ShipmentService } from 'src/shipment.service';
import { HttpClientModule } from '@angular/common/http';
import { ShipmentModule } from './shipment/shipment.module';
import { AppRoutingModule } from './app-routing.module';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    ShipmentModule,
    AppRoutingModule,
  ],
  providers: [ShipmentService],
  bootstrap: [AppComponent]
})
export class AppModule { }
