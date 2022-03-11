/*
 * Lambda function that implements the get Vaccinebox functionality
 */

const Log = require('@dazn/lambda-powertools-logger');
const { getHumidityGraph } = require('./helper/shipment');
const ShipmentDataIntegrityError = require('./lib/ShipmentDataIntegrityError');

module.exports.handler = async (event) => {
  const { shipmentId } = event.pathParameters;
  Log.debug('In the get-humidityGraph handler with shipmentId ${shipmentId}');

  try {
    const response = await getHumidityGraph(shipmentId.toUpperCase());
    const auditTrail = JSON.parse(response);

    return {
      statusCode: 200,
      headers: {
                  "Access-Control-Allow-Headers" : "Content-Type",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
              },
      body: JSON.stringify(auditTrail),
    };
  } catch (error) {
    if (error instanceof ShipmentDataIntegrityError) {
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
