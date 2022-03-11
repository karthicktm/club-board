/*
 * Lambda function that implements the create Vaccinebox functionality
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const dateFormat = require('dateformat');
const { addInsuranceClaimData } = require('./helper/shipment');
const ShipmentDataIntegrityError = require('./lib/ShipmentDataIntegrityError');

module.exports.handler = async (event) => {
  const {
     shipmentId, policyId, insuredValue
  } = JSON.parse(event.body);
  Log.debug(`In the addInsuranceClaimData with: shipmentId ${shipmentId} PolicyID ${policyId}`);
  try {
    const response = await addInsuranceClaimData(shipmentId, policyId, insuredValue);
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
    if (error instanceof ShipmentDataIntegrityError) {
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
