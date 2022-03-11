/*
 * Lambda function that implements the update contact functionality
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { shipmentUpdate } = require('./helper/shipment');
const ShipmentDataIntegrityError = require('./lib/ShipmentDataIntegrityError');

module.exports.handler = async (event) => {
  const {
     shipmentId, currentOwner, currentRole, nextRole, shipmentTrackerEvent,
  } = JSON.parse(event.body);
  Log.debug(`In the shipmentUpdate with: shipmentId ${shipmentId} deliverd from ${currentRole} To ${nextRole}`);
  shipmentTrackerEvent.eventOwner = currentOwner;
  shipmentTrackerEvent.eventRole = currentRole;
  shipmentTrackerEvent.sensorCondition = 'Active, normal readings';
  shipmentTrackerEvent.eventDate = dateFormat(new Date(), 'isoDateTime');
  shipmentTrackerEvent.nextRole = nextRole;
  try {
    const response = await shipmentUpdate(shipmentId, currentOwner, currentRole, nextRole, shipmentTrackerEvent);
    return {
      statusCode: 201,
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
