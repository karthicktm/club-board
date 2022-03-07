import { Component, OnInit } from '@angular/core';
import { ShipmentService } from 'src/shipment.service';


@Component({
  selector: 'app-shipment-management',
  templateUrl: './shipment-management.component.html',
  styleUrls: ['./shipment-management.component.css']
})
export class ShipmentManagementComponent implements OnInit {
  public shipment;
  constructor(private shipmentService: ShipmentService) { }

  ngOnInit(): void {
    this.getAllShipmentData();
  }

  public getAllShipmentData() {
    this.shipmentService.getAllShipmentData().subscribe({
      next: (data) => {
        this.shipment = data;
      },
      error: (error) => {
        // Do something to handle error
      },
    });
  }


}
