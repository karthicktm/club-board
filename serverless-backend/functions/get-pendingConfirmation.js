/*
 * Lambda function that implements the get Vaccinebox functionality
 */

const Log = require('@dazn/lambda-powertools-logger');
const { getTelemetryHistory } = require('./helper/vaccinebox');
const VaccineboxNotFoundError = require('./lib/VaccineboxNotFoundError');

module.exports.handler = async (event) => {
  const { sku } = event.pathParameters;
  Log.debug('In the get-telemetryhistory handler with sku ${sku}');

  try {
    const response = await getTelemetryHistory(sku.toUpperCase());
    const telemetryHistory = JSON.parse(response);

    return {
      statusCode: 200,
      body: JSON.stringify(telemetryHistory),
    };
  } catch (error) {
    if (error instanceof VaccineboxNotFoundError) {
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
