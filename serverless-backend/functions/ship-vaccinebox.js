/*
 * Lambda function that implements the create Vaccinebox functionality
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { shipVaccinebox } = require('./helper/vaccinebox');
const VaccineboxIntegrityError = require('./lib/VaccineboxIntegrityError');

module.exports.handler = async (event) => {
  const {
    vaccineName, sku, quantity, destinationAddress,
  } = JSON.parse(event.body);
  Log.debug(`In the create vaccinebox handler with: Vaccine Name ${vaccineName} sku ${sku} Quantity ${quantity} Destination Address ${destinationAddress} `);

  try {
    const eventInfo = [{ eventOwner : 'Manufacturer', eventType: 'SHIPPING',  eventDesc: 'Left Facility', sensorCondition: 'Active, normal Readings',  eventDate: dateFormat(new Date(), 'isoDateTime') }];
    const response = await shipVaccinebox(
      vaccineName, sku, quantity, destinationAddress, eventInfo,
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
    if (error instanceof VaccineboxIntegrityError) {
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
