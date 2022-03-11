/*
 * Lambda function that implements the create Vaccinebox functionality
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { addTelemetry } = require('./helper/vaccinebox');
const VaccineboxIntegrityError = require('./lib/VaccineboxIntegrityError');

module.exports.handler = async (event) => {
  const {
    sku, deviceId, temp, humidity, longitude, latitude,
  } = JSON.parse(event.body);
  Log.debug(`In the Add Telemetry handler with: SKU ${sku} Deviceid ${deviceId} Temperature ${temp} Humidity ${humidity} Longitude ${longitude} Latitude ${latitude}`);

  try {
//  const eventInfo = [{ eventType: 'AssetCreation',  eventName: 'VaccineboxShipmentCreated', eventDate: dateFormat(new Date(), 'isoDateTime') }];
    const response = await addTelemetry(
       sku, deviceId, temp, humidity, longitude, latitude,
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
