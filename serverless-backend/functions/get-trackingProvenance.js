/*
 * Lambda function that implements the get shipment functionality
 */

const Log = require('@dazn/lambda-powertools-logger');
const { getTrackingProvenance } = require('./helper/shipment');
const ShipmentDataNotFoundError = require('./lib/ShipmentDataNotFoundError');

module.exports.handler = async (event) => {
  const { shipmentId } = event.pathParameters;
  Log.debug('In the get-retailerShipments handler with shipmentId ${shipmentId}');

  try {
    const response = await getTrackingProvenance(shipmentId.toUpperCase());
    const retailerShipments = JSON.parse(response);

    return {
      statusCode: 200,
      headers: {
                  "Access-Control-Allow-Headers" : "Content-Type",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
              },
      body: JSON.stringify(retailerShipments),
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
