/*
 * Lambda function that implements the get Vaccinebox functionality
 */

const Log = require('@dazn/lambda-powertools-logger');
const { countShipments } = require('./helper/shipment');
const ShipmentDataNotFoundError = require('./lib/ShipmentDataNotFoundError');

module.exports.handler = async (event) => {
  Log.debug('In the notify-highRiskShipments handler');
  try {
    const response = await countShipments();
    const shipmentCount = JSON.parse(response);

    return {
      statusCode: 200,
      headers: {
                  "Access-Control-Allow-Headers" : "Content-Type",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
              },
      body: JSON.stringify(shipmentCount),
    };
  } catch (error) {
    if (error instanceof ShipmentDataNotFoundError) {
      return error.getHttpResponse();
    }
    Log.error('Error returned: ${error}');
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
