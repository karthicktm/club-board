/*
 * Lambda function that implements the get Vaccinebox functionality
 */

const Log = require('@dazn/lambda-powertools-logger');
const { getVaccinebox } = require('./helper/vaccinebox');
const VaccineboxNotFoundError = require('./lib/VaccineboxNotFoundError');

module.exports.handler = async (event) => {
  const { sku } = event.pathParameters;
  Log.debug('In the get-vaccinebox handler with sku ${sku}');

  try {
    const response = await getVaccinebox(sku.toUpperCase());
    const vaccinebox = JSON.parse(response);

    return {
      statusCode: 200,
      headers: {
                  "Access-Control-Allow-Headers" : "Content-Type",
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
              },
      body: JSON.stringify(vaccinebox),
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
