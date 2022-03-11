/*
 * Lambda function that implements the create Vaccinebox functionality
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { createVaccinebox } = require('./helper/vaccinebox');
const VaccineboxIntegrityError = require('./lib/VaccineboxIntegrityError');

module.exports.handler = async (event) => {
  const {
    vaccineName, sku, quantity, destinationAddress, validFromDate, validToDate, 
  } = JSON.parse(event.body);
  Log.debug(`In the create vaccinebox handler with: Vaccine Name ${vaccineName} sku ${sku} Quantity ${quantity} Destination Address ${destinationAddress} Validity from ${validFromDate} to ${validToDate}`);

  try {
    const eventInfo = [{ eventType: 'AssetCreation',  eventName: 'VaccineboxShipmentCreated', eventDate: dateFormat(new Date(), 'isoDateTime') }];
    const response = await createVaccinebox(
      vaccineName, sku, quantity, destinationAddress, validFromDate, validToDate, eventInfo,
    );
    return {
      statusCode: 201,
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
