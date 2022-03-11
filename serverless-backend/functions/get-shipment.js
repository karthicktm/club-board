/*
 * Lambda function that implements the get shipment functionality
 */

const Log = require('@dazn/lambda-powertools-logger');
const { getShipmentData } = require('./helper/shipment');
const ShipmentDataNotFoundError = require('./lib/ShipmentDataNotFoundError');

module.exports.handler = async (event) => {
  const { shipmentId } = event.pathParameters;
  Log.debug('In the get-shipment handler with shipmentId ${shipmentId}');

  try {
    const response = await getShipmentData(shipmentId.toUpperCase());
    const shipmentData = JSON.parse(response);

    return {
      statusCode: 200,
      headers: {
                  "Access-Control-Allow-Headers" : "Content-Type",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
              },
      body: JSON.stringify(shipmentData),
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
