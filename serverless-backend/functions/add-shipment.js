/*
 * Lambda function that implements the Create new Shipment functionality
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { createNewShipment } = require('./helper/shipment');
const ShipmentDataIntegrityError = require('./lib/ShipmentDataIntegrityError');

module.exports.handler = async (event) => {
  const {
    vaccineName, shipmentId, quantity, policyId, insurer, insuredValue, wayBill
  } = JSON.parse(event.body);
  Log.debug(`In the create new shipment handler with: Vaccine Name ${vaccineName} shipmentId ${shipmentId} Quantity ${quantity} `);

  try {
    const shipmentTrackerEvent = [{ eventOwner : 'ABC-Manufacturer', eventRole : 'Manufacturer', eventType: 'SHIPPING',  eventDesc: 'Left Facility', sensorCondition: 'Active, normal readings',  eventDate: dateFormat(new Date(), 'isoDateTime') }];
//    const wayBill = { manufacturer : 'ABC Manufacturer', logistics: 'ABC Logistics',  wholesaler: 'ABC Wholesaler', };
//    const wayBill = { origin : 'ABC Manufacturer', originRole : 'Manufacturer', originAddress : "50 Avenue, TX US", destination : 'ABC Wholesaler', destinationRole :'Wholesaler', destinationAddress : '50 ',  logistics: 'ABC Logistics', };
    const currentGeoLocation = { latitude : '12.9716° N', xaxis : 12.9716, longitude : '77.5946° E', yaxis : 77.5946, location: 'CA'};
    const response = await createNewShipment(
      vaccineName, shipmentId, quantity, policyId, insurer, insuredValue, wayBill, currentGeoLocation, shipmentTrackerEvent,
    );
    return {
      statusCode: 200,
      headers: {
                  "Access-Control-Allow-Headers" : "Content-Type",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
              },
      body: JSON.stringify(response),
    };
  } catch (error) {
    if (error instanceof ShipmentDataIntegrityError) {
      return error.getHttpResponse();
    }
    Log.error(`Error returned: ${error}`);
    const errorBody = {
      status: 500,
      title: error.name,
      detail: error.message,
    };
    return {
      statusCode: 500,
      body: JSON.stringify(errorBody),
    };
  }
};
