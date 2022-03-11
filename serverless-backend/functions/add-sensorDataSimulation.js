/*
 * Lambda function that implements the create Vaccinebox functionality
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { addSensorDataSimulation } = require('./helper/shipment');
const ShipmentDataIntegrityError = require('./lib/ShipmentDataIntegrityError');

module.exports.handler = async (event) => {
  const {
     shipmentId, deviceId, telemetry,
  } = JSON.parse(event.body);
  Log.debug(`In the addSensorDataSimulation with: Shipment ${shipmentId}`);
  try {
    const response = await addSensorDataSimulation(shipmentId, deviceId, telemetry);
    return {
      statusCode: 200,
      headers: {
                  "Access-Control-Allow-Headers" : "Content-Type",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "*"
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
