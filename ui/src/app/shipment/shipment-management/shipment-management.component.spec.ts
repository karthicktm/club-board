import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShipmentManagementComponent } from './shipment-management.component';

describe('ShipmentManagementComponent', () => {
  let component: ShipmentManagementComponent;
  let fixture: ComponentFixture<ShipmentManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ShipmentManagementComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ShipmentManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
