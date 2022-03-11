/*
 * Lambda function that implements the Create new Shipment functionality
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { createNewRetailShipment } = require('./helper/shipment');
const ShipmentDataIntegrityError = require('./lib/ShipmentDataIntegrityError');

module.exports.handler = async (event) => {
  const {
    RetailShipmentId, RetailQuantity, WayBill, MasterShipmentId
  } = JSON.parse(event.body);
  Log.debug(`In the create new shipment handler with: RetailShipmentId ${RetailShipmentId} Retail Quantity ${RetailQuantity} `);

  try {
//    const shipmentTrackerEvent = [{ eventOwner : 'ABC Manufacturer', eventRole : 'Manufacturer', eventType: 'SHIPPING',  eventDesc: 'Left Facility', sensorCondition: 'Active, normal readings',  eventDate: dateFormat(new Date(), 'isoDateTime') }];
//    const currentGeoLocation = { latitude : '12.9716° N', xaxis : 12.9716, longitude : '77.5946° E', yaxis : 77.5946, location: 'CA'};
    const response = await createNewRetailShipment(
      RetailShipmentId, RetailQuantity, WayBill, MasterShipmentId,
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
