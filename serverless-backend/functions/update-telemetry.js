/*
 * Lambda function that implements the update Vaccinebox functionality
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { updateTelemetry } = require('./helper/vaccinebox');
const VaccineboxIntegrityError = require('./lib/VaccineboxIntegrityError');

module.exports.handler = async (event) => {
  const {
    telephone, postcode, email, eventInfo,
  } = JSON.parse(event.body);
  Log.debug('In the update Vaccinebox handler with: telephone ${telephone} postcode ${postcode} Email ${email} and eventInfo ${eventInfo}');
  eventInfo.eventDate = dateFormat(new Date(), 'isoDateTime');

  try {
    const response = await updateTelemetry(telephone, postcode, email, eventInfo);
    return {
      statusCode: 201,
      body: JSON.stringify(response),
    };
  } catch (error) {
    if (error instanceof VaccineboxIntegrityError) {
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
