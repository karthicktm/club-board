import { Component, ElementRef, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChartDataSets } from 'chart.js';
import { Label } from 'ng2-charts';
import { ShipmentService } from 'src/shipment.service';

@Component({
  selector: 'app-shipment-details',
  templateUrl: './shipment-details.component.html',
  styleUrls: ['./shipment-details.component.css']
})
export class ShipmentDetailsComponent implements OnInit {
  public shipmentId;
  public details;
  public ledgerDetails;
  lineChartData: ChartDataSets[] = [
    { data: [65, 59, 80, 81, 56, 55, 40]}
  ];

  //Labels shown on the x-axis
  lineChartLabels: Label[];

  constructor(
    private shipmentService: ShipmentService,
    private elementRef:ElementRef,
    private route: ActivatedRoute) { }

  ngOnInit(): void {
    this.shipmentId = this.route.snapshot.paramMap.get('id');
    this.getShipmentDetails();
    this.getLedgerDetails();
  }

  public getShipmentDetails() {
    
    this.shipmentService.getShipmentDetails(this.shipmentId).subscribe({
      next: (data) => {
        this.details = data;
        
      },
      error: (error) => {
        // Do something to handle error
      },
    });

  }

  public getLedgerDetails() {
    let values;
    this.shipmentService.getLedgerDetails(this.shipmentId).subscribe({
      next: (response) => {
        this.ledgerDetails = response;
        response.map(data=>{
          this.lineChartLabels.push(data.Hash);
          values.push(data.Temperature);
        });

      },
      error: (error) => {
        // Do something to handle error
      },
    });
    this.lineChartData[1].data = values;
  }

  public click(event) {
    let ledgerDetailsTab = this.elementRef.nativeElement.querySelector('.ledgerDetailsTab');
    let shippingDetailsTab = this.elementRef.nativeElement.querySelector('.shippingDetailsTab');
    if(event=='shipment') {
     ledgerDetailsTab.style.display = 'none';
     shippingDetailsTab.style.display = 'block';
    } else {
      shippingDetailsTab.style.display = 'none';
      ledgerDetailsTab.style.display = 'block';
    }
  }
}
