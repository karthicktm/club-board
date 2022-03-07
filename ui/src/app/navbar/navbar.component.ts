import { Component, OnInit } from '@angular/core';
import { ShipmentService } from 'src/shipment.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  public sensorWarning;
  constructor(private shipmentService: ShipmentService) { }

  ngOnInit(): void {
    this.getSensorWarning();
  }

  public getSensorWarning() {
    this.shipmentService.getSensorWarning().subscribe({
      next: (data) => {
        this.sensorWarning = data;
      },
      error: (error) => {
        // Do something to handle error
      },
    });
  }
}
