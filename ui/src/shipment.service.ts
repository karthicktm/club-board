import { HttpClient} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class ShipmentService {
  public base_url = 'https://u28ib6v7hf.execute-api.us-east-1.amazonaws.com/v12/coldchain';
  constructor(
    private httpService: HttpClient,
  ) {
  }

  /**
   * Gets the list of all shipments
   */
  public getAllShipmentData(): Observable<any> {
    const url = this.base_url+ `/insurance/shipmentData`;
    return this.httpService.get<any>(url);
  }

   /**
   * Gets the sensor warning of all shipments
   */
  public getSensorWarning(): Observable<any> {
    const url = this.base_url+ `/vaccinebox/notifyHighRiskShipments`;
    return this.httpService.get<any>(url);
  }

  
  /**
   * Gets the temperature data and ledger report
   */
  public getLedgerDetails(shipmentId): Observable<any> {
    const url = this.base_url+ `/vaccinebox/report/sensorDataAuditTrail/${shipmentId}`;
    return this.httpService.get<any>(url);
  }

  /**
   * Gets the shipment details  and tracking details
   */
   public getShipmentDetails(shipmentId): Observable<any> {
    const url = this.base_url+ `/vaccinebox/shipment/${shipmentId}`;
    return this.httpService.get<any>(url);
  }

}
