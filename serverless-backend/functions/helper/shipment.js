/*
 * Helper utility that provides the implementation for interacting with QLDB
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const AWSXRay = require('aws-xray-sdk-core');
const dateFormat = require('dateformat');
AWSXRay.captureAWS(require('aws-sdk'));
const AWS = require("aws-sdk");
const { getQldbDriver } = require('./ConnectToLedger');
const ShipmentDataIntegrityError = require('../lib/ShipmentDataIntegrityError');
const ShipmentDataNotFoundError = require('../lib/ShipmentDataNotFoundError');
const SNS = new AWS.SNS();
/**
 * Check if an shipmentId already exists
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the Shipment.
 * @returns The number of records that exist for the shipmentId
 */
async function checkShipmentIdUnique(txn, shipmentId) {
  Log.debug('In checkShipmentIdUnique function');
  const query = 'SELECT shipmentId FROM Shipment AS b WHERE b.shipmentId = ?';
  let recordsReturned;
  await txn.execute(query, shipmentId).then((result) => {
    recordsReturned = result.getResultList().length;
    if (recordsReturned === 0) {
      Log.debug(`No records found for ${shipmentId}`);
    } else {
      Log.debug(`Record already exists for ${shipmentId}`);
    }
  });
  return recordsReturned;
}

/**
 * Insert the new Shipment to the Shipment table
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentDataDoc The JSON document containing the details to insert.
 * @returns The Result from executing the statement
 */
async function createVaccineboxShipment(txn, shipmentDataDoc) {
  Log.debug('In the createVaccineboxShipment function');
  const statement = 'INSERT INTO Shipment ?';
  return txn.execute(statement, shipmentDataDoc);
}

/**
 * Insert the new Shipment document to the Shipment table
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param batchId The document id of the document.
 * @param shipmentId The shipmentId of the Shipment.
 * @returns The Result from executing the statement
 */
async function addBatchId(txn, batchId, shipmentId) {
  Log.debug('In the addBatchId function');
  const statement = 'UPDATE Shipment as b SET b.batchId = ? WHERE b.shipmentId = ?';
  return txn.execute(statement, batchId, shipmentId);
}


/**
 * Creates a new Shipment record in the QLDB ledger.
 * @param vaccineName The name of the Vaccine.
 * @param shipmentId The shipmentId of the Shipment.
 * @param quantity The quantity of the Shipment .
 * @param destinationAddress The destinationAddress of the Shipment.
 * @param currentRole The destinationAddress of the Shipment.
 * @param event The event record to add to the document.
 * @returns The JSON record of the new Shipment record.
 */
const createNewShipment = async (vaccineName, shipmentId, quantity, policyId, insurer, insuredValue, wayBill, currentGeoLocation, shipmentTrackerEvent) => {
  Log.debug(`In createNewShipment function with: with: Vaccine Name ${vaccineName} shipmentId ${shipmentId}  Quantity ${quantity}`);

  let shipmentData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Check if the record already exists assuming ShipmentId unique for demo
    const recordsReturned = await checkShipmentIdUnique(txn, shipmentId);
    if (recordsReturned === 0) {
      let shippingDate = dateFormat(new Date(), 'isoDateTime');
      const shipmentDataDoc = [{
        vaccineName, shipmentId, quantity, shippingDate : shippingDate, temperatureExcursion: 0, humidityRangeViolation: 0, manufacturer : 'ABC-Manufacturer', currentRole : 'Manufacturer', currentOwner : 'ABC-Manufacturer', status : 'In-Transit',  policyId, insurer, insuredValue, claimId: 'NC', claimStatus : 'NA', claimRequestDate : 'NA', shipmentTrackerEvents: shipmentTrackerEvent, wayBill : wayBill, currentGeoLocation : currentGeoLocation,
      }];
      const result = await createVaccineboxShipment(txn, shipmentDataDoc);
      const docIdArray = result.getResultList();
      const batchId = docIdArray[0].get('documentId').stringValue();
      await addBatchId(txn, batchId.toUpperCase(), shipmentId);
      shipmentData = {
        vaccineName,
        shipmentId,
        batchId : batchId.toUpperCase(),
        quantity,		
		manufacturer: 'ABC-Manufacturer',
		currentRole : 'Manufacturer',
		currentOwner : 'ABC-Manufacturer',
		status : 'In-Transit',
        temperatureExcursion: 0,
        humidityRangeViolation: 0,
        policyId,
        insurer,
        insuredValue,
        shipmentTrackerEvent,
        wayBill,
        currentGeoLocation,
      };
    } else {
      throw new ShipmentDataIntegrityError(400, `ShipmentData Integrity Error`, `ShipmentData record with ShipmentId ${shipmentId} already exists. No new record created`);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentData;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The ShipmentID to retrieve
 * @returns The Result from executing the statement
 */
async function getShipmentDataRecordByShipmentId(txn, shipmentId) {
  Log.debug('In getShipmentDataRecordByShipmentId function');
  const query = 'SELECT * FROM Shipment AS b WHERE b.shipmentId = ?';
  return txn.execute(query, shipmentId);
}

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The ShipmentID to retrieve
 * @returns The Result from executing the statement
 */
async function getRetailShipmentDataRecordByShipmentId(txn, shipmentId) {
  Log.debug('In getRetailShipmentDataRecordByShipmentId function');
  const query = 'SELECT * FROM RetailShipment AS b WHERE b.RetailShipmentId = ?';
  return txn.execute(query, shipmentId);
}


/**
 * Helper function to retrieve the current state of a ShipmentData record
 * @param shipmentId The shipmentId of the shipment to retrieve
 * @returns The JSON document to return to the client
 */
const getShipmentData = async (shipmentId) => {
  Log.debug(`In getShipmentData function with ShipmentId ${shipmentId}`);
  let shipmentData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
  const result = await getShipmentDataRecordByShipmentId(txn, shipmentId);
  const resultList = result.getResultList();

  if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentDat record with ShipmentId ${shipmentId} does not exist`);
  } else {
      shipmentData = JSON.stringify(resultList[0]);
  }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentData;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param party The Party to retrieve
 * @returns The Result from executing the statement
 */
async function getShipmentsByPartyFromLedger(txn, party) {
  Log.debug('In getShipmentsByPartyFromLedger function');
  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.status Status, sv.data.insurer Insurer, sv.data.policyId PolicyId, sv.data.claimStatus ClaimStatus, sv.data.claimId ClaimId, sv.data.claimRequestDate ClaimDate  FROM _ql_committed_Shipment AS sv WHERE  UPPER(sv.data.manufacturer) = ?';
  return txn.execute(query, party);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @returns The JSON document to return to the client
 */
const getShipmentsByParty = async (party) => {

  Log.debug(`In getShipmentsByParty function with Party${party}`);
  let shipmentData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    const result = await getShipmentsByPartyFromLedger(txn, party);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'Shipment Data Not Found Error', `Shipment Data record with Manufacturer ${party} does not exist`);
    } else {
      shipmentData = JSON.stringify(resultList);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentData;
};

/**
 * Helper function to update the document with new contact details
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document to update
 * @param currentRole The latest Owner Name to update
 * @param shipmentTrackerEvents The event to add to the document
 * @param currentOwner The currentOwner to update
 * @returns The Result from executing the statement
 */
async function addDeliveryUpdatedEvent(txn, shipmentId, currentOwner, currentRole, shipmentTrackerEvents) {
  Log.debug(`In the addDeliveryUpdatedEvent  `);
  const statement = 'UPDATE Shipment as b SET b.currentOwner = ?, b.currentRole = ?, b.shipmentTrackerEvents = ? WHERE b.shipmentId = ?';
  return txn.execute(statement, currentOwner, currentRole, shipmentTrackerEvents, shipmentId);
}

/**
 * Update the Shipment document with new Party/Owner details
 * @param shipmentId The shipmentId of the document to update
 * @param currentRole The updated currentRole
 * @param nextRole The updated nextRole
 * @param shipmentTrackerEvent The event to add
 * @returns A JSON document to return to the client
 */
const shipmentUpdate = async (shipmentId, currentOwner, currentRole, nextRole, shipmentTrackerEvent) => {
  Log.debug(`In shipmentUpdate function with ownerRole ${nextRole}`);

  let shipmentData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record

    const result = await getShipmentDataRecordByShipmentId(txn, shipmentId);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new ShipmentDataIntegrityError(400, 'ShipmentData Integrity Error', `Shipment record with ShipmentId ${shipmentId} does not exist`);
    } else {
      const originalShipmentData = JSON.stringify(resultList[0]);
      const newShipmentData = JSON.parse(originalShipmentData);
      const { shipmentTrackerEvents } = newShipmentData;
      shipmentTrackerEvents.unshift(shipmentTrackerEvent);
      await addDeliveryUpdatedEvent(txn, shipmentId, currentOwner, currentRole, shipmentTrackerEvents);
      shipmentData = {
        shipmentId,
        currentRole,
        nextRole,
        response: shipmentTrackerEvent.eventDesc,
      };
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentData;
};


/**
 * Insert the new data to the SensorData table
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sensorDataDoc The JSON document containing the details to insert.
 * @returns The Result from executing the statement
 */
 function insertSensorData(txn, sensorDataDoc) {
  Log.debug('In the insertSensorData function');
  const statement = 'INSERT INTO SensorData ?';
  return txn.execute(statement, sensorDataDoc);
}

/**
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document.
 * @param newTemperatureExcursion The newTemperatureExcursion
 * @returns The Result from executing the statement
 */
async function updateRating(txn, shipmentId, newTemperatureExcursion) {
  Log.debug('In the updateRating function');
  const statement = 'UPDATE Shipment as b SET b.temperatureExcursion = ? WHERE b.shipmentId = ?';
  return txn.execute(statement, newTemperatureExcursion, shipmentId);
}

/**
 * Helper function to update the document with new details
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document to update
 * @param deviceId The deviceId Name to update
 * @param newTemperatureExcursion The newTemperatureExcursion Name to update
 * @param event The event to add to the document

 * @returns The Result from executing the statement
 */
async function addSensorDataUpdatedEvent(txn, shipmentId, deviceId, newTemperatureExcursion) {
  Log.debug(`In the addSensorDataUpdatedEvent  `);
  const statement = 'UPDATE Shipment as b SET b.deviceId = ?, b.temperatureExcursion = ? WHERE b.shipmentId = ?';
  return txn.execute(statement, deviceId, newTemperatureExcursion, shipmentId);
}

/**
 * Creates a new Telemetry record in the QLDB ledger.
 * @param shipmentId The shipmentId of the shipment.
 * @param deviceId The deviceId of the shipment.
 * @param telemetry The telemetry of the shipment.
 * @returns The JSON record of the new shipment record.
 */
const addSensorData = async (shipmentId, deviceId, telemetry) => {
  Log.debug(`In addSensorData function with Shipment ID ${shipmentId}`);

  let sensorData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    const result = await getShipmentDataRecordByShipmentId(txn, shipmentId);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new ShipmentDataIntegrityError(400, 'ShipmentData Integrity Error', `Shipment record with Shipment ID${shipmentId} does not exist`);
    } else {
      const originalShipmentData = JSON.stringify(resultList[0]);
      const newShipmentData = JSON.parse(originalShipmentData);
      const originalTemperatureExcursion = newShipmentData.temperatureExcursion;
      let newTemperatureExcursion = null;
      let newEventDesc = null;
      if (telemetry.temp >= -10) {
        newTemperatureExcursion = originalTemperatureExcursion + 1;
        newEventDesc = 'Abnormal sensor data';
      } else {
        newTemperatureExcursion = originalTemperatureExcursion;
        newEventDesc = 'Normal sensor data';
      }
      if (deviceId === 'undefined') {
        const deviceId = 'SIM-99999';
      }
      await addSensorDataSimulationEvent(txn, shipmentId, deviceId, newTemperatureExcursion);
      const temperature = telemetry.temp;
      const humidity = randomNumber(40, 80);
      const latitude = '12.9716° N';
      const longitude = '77.5946° E';
      const currentRole = newShipmentData.currentRole;
//      const currentOwner =  newShipmentData.events.eventOwner;
      const eventDate = dateFormat(new Date(), 'isoDateTime');

      const sensorDataDoc = [{
          shipmentId, deviceId, temperature, humidity, latitude, longitude, eventDate, currentRole, eventDate,
      }];
      await insertSensorData(txn, sensorDataDoc);
      sensorData = {
        shipmentId,
        deviceId,
        response: temperature,
      };
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return sensorData;
};

function randomNumber(min, max) {
    return Math.round((Math.random() * (max - min) + min));
}

/**
 * Helper function to update the document with new details
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document to update
 * @param deviceId The deviceId Name to update
 * @param newTemperatureExcursion The newTemperatureExcursion  to update
 * @param newHumidityRangeViolation The newHumidityRangeViolation  to update
 * @param latitude The latitude  to update
 * @param xaxis The latitude  to update
 * @param longitude The longitude  to update
 * @param yaxis The longitude  to update
 * @param newLocation The longitude  to
 * @returns The Result from executing the statement
 */
async function updateWholesaleShipment(txn, shipmentId, deviceId, newTemperatureExcursion, newHumidityRangeViolation, latitude, xaxis, longitude, yaxis, newLocation) {
  Log.debug(`In the addSensorDataSimulationEvent `);
  const statement = 'UPDATE Shipment as b SET b.deviceId = ?, b.temperatureExcursion = ?, b.humidityRangeViolation = ?, b.currentGeoLocation.latitude = ?, b.currentGeoLocation.xaxis = ?, b.currentGeoLocation.longitude = ?, b.currentGeoLocation.yaxis = ?, b.currentGeoLocation.location = ? WHERE b.shipmentId = ?';
  return txn.execute(statement, deviceId, newTemperatureExcursion, newHumidityRangeViolation, latitude, xaxis, longitude, yaxis, newLocation, shipmentId);
}

/**
 * Helper function to update the document with new details
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document to update
 * @param deviceId The deviceId Name to update
 * @param newTemperatureExcursion The newTemperatureExcursion  to update
 * @param newHumidityRangeViolation The newHumidityRangeViolation  to update
 * @param latitude The latitude  to update
 * @param xaxis The latitude  to update
 * @param longitude The longitude  to update
 * @param yaxis The longitude  to update
 * @param newLocation The longitude  to
 * @returns The Result from executing the statement
 */
async function updateRetailShipment(txn, shipmentId, deviceId, newTemperatureExcursion, newHumidityRangeViolation, latitude, xaxis, longitude, yaxis, newLocation) {
  Log.debug(`In the addSensorDataSimulationEvent `);
  const statement = 'UPDATE RetailShipment as b SET b.deviceId = ?, b.temperatureExcursion = ?, b.humidityRangeViolation = ?, b.currentGeoLocation.latitude = ?, b.currentGeoLocation.xaxis = ?, b.currentGeoLocation.longitude = ?, b.currentGeoLocation.yaxis = ?, b.currentGeoLocation.location = ? WHERE b.RetailShipmentId = ?';
  return txn.execute(statement, deviceId, newTemperatureExcursion, newHumidityRangeViolation, latitude, xaxis, longitude, yaxis, newLocation, shipmentId);
}

/**
 * Creates a new Telemetry record in the QLDB ledger.
 * @param shipmentId The shipmentId of the shipment.
 * @param deviceId The deviceId of the shipment.
 * @param telemetry The telemetry of the shipment.
 * @returns The JSON record of the new shipment record.
 */
const addSensorDataSimulation = async (shipmentId, deviceId, telemetry) => {
  Log.debug(`In addSensorDataSimulation function with Shipment ID ${shipmentId}`);

  let sensorData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
     let result = null;
     let resultList = null;
      var retailCheck = shipmentId.substr(0, 2);
      if( retailCheck.toUpperCase() ==='RS') {
         result = await getRetailShipmentDataRecordByShipmentId(txn, shipmentId);
         resultList = result.getResultList();
      } else {
         result = await getShipmentDataRecordByShipmentId(txn, shipmentId);
         resultList = result.getResultList();
      }
    if (resultList.length === 0) {
      throw new ShipmentDataIntegrityError(400, 'ShipmentData Integrity Error', `Shipment record with Shipment ID${shipmentId} does not exist`);
    } else {
      const originalShipmentData = JSON.stringify(resultList[0]);
      const newShipmentData = JSON.parse(originalShipmentData);
      const originalTemperatureExcursion = newShipmentData.temperatureExcursion;
      const originalRangeViolationCount = newShipmentData.humidityRangeViolation;
      const currentRole = newShipmentData.currentRole;
      const currentOwner =  newShipmentData.currentOwner;
      const eventDate = dateFormat(new Date(), 'isoDateTime');
      const tempHash = deviceId.concat(new Date().toISOString()).concat(telemetry.temp);
      let newTemperatureExcursion = null;
      let newEventDesc = null;
      if (telemetry.temp >= -10) {
        newTemperatureExcursion = originalTemperatureExcursion + 1;
        newEventDesc = 'Abnormal sensor data';
        await snsPublisher(shipmentId, deviceId, telemetry, tempHash);
      } else {
        newTemperatureExcursion = originalTemperatureExcursion;
        newEventDesc = 'Normal sensor data';
      }
      if (typeof deviceId === 'undefined') {
        const deviceId = 'SIM-99999';
      }
      const temperature = telemetry.temp;
      const humidity = randomNumber(30, 70);
      let lati = telemetry.latitude;
      let xaxis = null;
      if (typeof lati === "undefined") {
          Log.debug(`In addSensorDataSimulation  Latitude-1  ${lati}`);
          lati = newShipmentData.currentGeoLocation.latitude;
          xaxis = newShipmentData.currentGeoLocation.latitude;
          var nalg = lati.search("°");
          if(nalg !== -1) {
		    xaxis = Number(lati.slice(0, nalg));
	      } else {
		    xaxis = Number(lati);
	      }
          var nalg = lati.search("W");
          if(nalg !== -1) {
                xaxis = Math.abs(xaxis) * -1
          }
      } else {
          Log.debug(`In addSensorDataSimulation  Latitude-2  ${lati}`);
          var nalg = lati.search("°");
          if(nalg !== -1) {
                xaxis = Number(lati.slice(0, nalg));
            } else {
                xaxis = Number(lati);
            }
          var nalg = lati.search("S");
          if(nalg !== -1) {
                xaxis = Math.abs(xaxis) * -1
          }
      }
      let long = telemetry.longitude;
      let yaxis = null;
      if (typeof long === "undefined") {
          long = newShipmentData.currentGeoLocation.longitude;
          yaxis = newShipmentData.currentGeoLocation.longitude;
          var nalg = long.search("°");
          if(nalg !== -1) {
                yaxis = Number(long.slice(0, nalg));
            } else {
                yaxis = Number(long);
            }
          var nalg = long.search("W");
          if(nalg !== -1) {
                yaxis = Math.abs(yaxis) * -1
          }
       } else {
          var nalg = long.search("°");
          if(nalg !== -1) {
                yaxis = Number(long.slice(0, nalg));
            } else {
                yaxis = Number(long);
            }
          var nalg = long.search("W");
          if(nalg !== -1) {
                yaxis = Math.abs(yaxis) * -1
          }
       }
      let newLocation = telemetry.location;
      if (typeof newLocation === "undefined") {
            newLocation = newShipmentData.currentGeoLocation.location;
      }
      let newHumidityRangeViolation = 0 ;
      if (humidity >= 70) {
            newHumidityRangeViolation = originalRangeViolationCount + 1;
      } else {
            newHumidityRangeViolation = originalRangeViolationCount;
      }
      if( retailCheck.toUpperCase() ==='RS') {
            await updateRetailShipment(txn, shipmentId, deviceId, newTemperatureExcursion, newHumidityRangeViolation, lati, xaxis, long, yaxis, newLocation );
      } else {
            await updateWholesaleShipment(txn, shipmentId, deviceId, newTemperatureExcursion, newHumidityRangeViolation, lati, xaxis, long, yaxis, newLocation );
      }
      const sensorDataDoc = [{
          shipmentId, deviceId, temperature, humidity, lati, long, eventDate, currentRole, currentOwner, eventDate, newLocation, tempHash
      }];
      await insertSensorData(txn, sensorDataDoc);
      sensorData = {
        shipmentId,
        deviceId,
        response: temperature,
      };
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return sensorData;
};


function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @returns The Result from executing the statement
 */
async function getSensorDataAlert(txn, shipmentId) {
  Log.debug('In getSensorDataByShipmentId function');
//  const query = 'select sdh.metadata.txTime DateTime, sdh.data.deviceId SensorID, sdh.data.temp, sdh.data.humidity, sdh.data.longitude, sdh.data.latitude, sdh.data.location,sdh.data.currentRole CurrentOwner  FROM history(SensorData) AS sdh WHERE sdh.data.shipmentId = ?';
  const query = 'SELECT sd.data.shipmentId, sd.data.deviceId, sd.data.temperature, sd.metadata.txTime, sd.hash Hash  FROM _ql_committed_SensorData AS sd where sd.data.shipmentId = ?';
  return txn.execute(query, shipmentId);
}

/**
 * Helper function to retrieve Sensor Data record
 * @param shipmentId The shipmentId of the shipment to retrieve
 * @returns The JSON document to return to the client
 */
const getSensorData = async () => {
  Log.debug(`In getSensorData function `);

  let sensorData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    const result = await getSensorDataAlert(txn);
    const resultList = result.getResultList();
    const sortedShipments =  resultList.sort(custom_sort_sensorData);
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'SensorData Not Found Error', `High Risk SensorData record does not exist`);
    } else {
      sensorData = JSON.stringify(resultList[0]);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return sensorData;
};

/**
 * Insert the new Claim Data to the Claim table
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param claimDataDoc The JSON document containing the details to insert.
 * @returns The Result from executing the statement
 */
async function insertClaimData(txn, claimDataDoc) {
  Log.debug('In the insertClaimData function');
  const statement = 'INSERT INTO Claim ?';
  return txn.execute(statement, claimDataDoc);
}

/**
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document to update
 * @param claimId The claimId Name to update
 * @param ClaimStatus The claimId Name to update
 * @param ClaimRequestDate The claimId Name to update
 * @returns The Result from executing the statement
 */
async function addClaimDataUpdated(txn, shipmentId, claimId, ClaimStatus, ClaimRequestDate ) {
  Log.debug(`In the addClaimDataUpdated  `);
  const statement = 'UPDATE Shipment as b SET b.claimId = ?, b.claimStatus = ?, claimRequestDate = ?  WHERE b.shipmentId = ?';
  return txn.execute(statement, claimId, ClaimStatus, ClaimRequestDate, shipmentId);
}

/**
 * Creates a new Claim record in the QLDB ledger.
 * @param ShipmentId The ShipmentId of the Vaccinebox.
 * @param ClaimId  of the Vaccinebox.
 * @returns The JSON record of the new Vaccinebox reecord.
 */
const addInsuranceClaimData = async (ShipmentId, PolicyId, insuredValue) => {
  Log.debug(`In addInsuranceClaimData function with Shipment ${ShipmentId}`);

  let insuranceClaimData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record

    const result = await getShipmentDataRecordByShipmentId(txn, ShipmentId);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new ShipmentDataIntegrityError(400, 'ShipmentData Integrity Error', `Shipment record with ShipmentId ${ShipmentId} does not exist`);
    } else {
      let ClaimId = 'CLM-'.concat(PolicyId);
      let ClaimStatus = 'Pending';
      let ClaimRequestDate = dateFormat(new Date(), 'isoDateTime');

      const originalVaccinebox = JSON.stringify(resultList[0]);
      const newVaccinebox = JSON.parse(originalVaccinebox);
      await addClaimDataUpdated(txn, ShipmentId, ClaimId, ClaimStatus, ClaimRequestDate );

      const claimDataDoc = {
          ShipmentId, PolicyId, ClaimId, ClaimRequestDate, ClaimStatus,
      };
      await insertClaimData(txn, claimDataDoc);
      insuranceClaimData = {
        ShipmentId,
        ClaimId,
        response: 'New claim request initiated',
      };
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return insuranceClaimData;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @returns The Result from executing the statement
 */
async function getClaimDataFromLedger(txn) {
  Log.debug('In getClaimDataFromLedger function');
//  const query = 'SELECT  sv.data.shipmentId ShipmentID, c.ClaimId, c.ClaimRequestDate ClaimRequestDate, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty,sv.data.wayBill.shipper Origin, sv.data.wayBill.wholesaler Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.riskRating RiskRate, sv.data.currentRole CurrentLocation FROM _ql_committed_Shipment AS sv,  Claim as c  WHERE  sv.data.shipmentId = c.ShipmentId';
//  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate ShippingDate, sv.data.insurer Insurer, sv.data.policyId PolicyId,  sv.data.claimId ClaimID, sv.data.claimRequestDate ClaimRequestDate, sv.data.claimStatus ClaimStatus, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.wayBill.shipper Origin, sv.data.wayBill.wholesaler Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentRole CurrentLocation, sv.data.currentGeoLocation GeoLocation FROM _ql_committed_Shipment AS sv';
  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate ShippingDate, sv.data.insurer Insurer, sv.data.policyId PolicyId,  sv.data.claimId ClaimID, sv.data.claimRequestDate ClaimRequestDate, sv.data.claimStatus ClaimStatus, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.wayBill.origin Origin, sv.data.wayBill.destination Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentGeoLocation.latitude Latitude, sv.data.currentGeoLocation.longitude Longitude, sv.data.currentGeoLocation.location Location,sv.data.currentGeoLocation.xaxis XAxis, sv.data.currentGeoLocation.yaxis YAxis FROM _ql_committed_Shipment AS sv';
  return txn.execute(query);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @returns The JSON document to return to the client
 */
const getClaimData = async () => {
  Log.debug(`In getClaimData function`);

  let claimData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    const result = await getClaimDataFromLedger(txn);
    const resultList = result.getResultList();
    const sortedShipments =  resultList.sort(custom_sort);
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
      claimData = JSON.stringify(sortedShipments);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return claimData;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param party The Party to retrieve
 * @returns The Result from executing the statement
 */
async function getShipmentLocationFromLedger(txn, party) {
  Log.debug('In getClaimDataFromLedger function');
//  const query = 'SELECT  sv.data.shipmentId ShipmentID, c.ClaimId, c.ClaimRequestDate ClaimRequestDate, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty,sv.data.wayBill.shipper Origin, sv.data.wayBill.wholesaler Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.riskRating RiskRate, sv.data.currentRole CurrentLocation FROM _ql_committed_Shipment AS sv,  Claim as c  WHERE  sv.data.shipmentId = c.ShipmentId';
//  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate ShippingDate, sv.data.insurer Insurer, sv.data.policyId PolicyId,  sv.data.claimId ClaimID, sv.data.claimRequestDate ClaimRequestDate, sv.data.claimStatus ClaimStatus, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.wayBill.shipper Origin, sv.data.wayBill.wholesaler Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentRole CurrentLocation, sv.data.currentGeoLocation GeoLocation FROM _ql_committed_Shipment AS sv';
  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate ShippingDate, sv.data.insurer Insurer, sv.data.policyId PolicyId,  sv.data.claimId ClaimID, sv.data.claimRequestDate ClaimRequestDate, sv.data.claimStatus ClaimStatus, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.wayBill.origin Origin, sv.data.wayBill.destination Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentGeoLocation.latitude Latitude, sv.data.currentGeoLocation.longitude Longitude, sv.data.currentGeoLocation.location Location,sv.data.currentGeoLocation.xaxis XAxis, sv.data.currentGeoLocation.yaxis YAxis FROM _ql_committed_Shipment AS sv WHERE UPPER(sv.data.manufacturer) = ?';
  return txn.execute(query, party);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @returns The JSON document to return to the client
 */
const getShipmentLocation = async (party) => {
  Log.debug(`In getClaimData function`);

  let claimData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    const result = await getShipmentLocationFromLedger(txn, party);
    const resultList = result.getResultList();
    const sortedShipments =  resultList.sort(custom_sort);
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
      claimData = JSON.stringify(sortedShipments);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return claimData;
};


function custom_sort(a, b) {
    return new Date(b.ShippingDate).getTime() - new Date(a.ShippingDate).getTime();
}

function custom_sort_claims(a, b) {
    return new Date(b.ClaimRequestDate).getTime() - new Date(a.ClaimRequestDate).getTime();
}

function custom_sort_sensorData(a, b) {
    return new Date(b.txTime).getTime() - new Date(a.txTime).getTime();
}

function custom_sort_AuditTrail(a, b) {
    return new Date(b.DateTime).getTime() - new Date(a.DateTime).getTime();
}
/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentDate
 * @returns The Result from executing the statement
 */
async function getRecentShipmentsFromLedger(txn, shipmentDate) {
  Log.debug('In getRecentShipmentsFromLedger function');
  const query = 'select shipmentId ShipmentId, shippingDate ShippingDate from Shipment where  shippingDate != ?';
//  const query = 'select shipmentId ShipmentId, shippingDate ShippingDate from Shipment';
  return txn.execute(query, shipmentDate);
}

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param masterID
 * @returns The Result from executing the statement
 */
async function getRetailsShipmentsFromLedger(txn, masterID) {
  Log.debug('In getRetailsShipmentsFromLedger function');
  const query = 'SELECT rs.RetailShipmentId ShipmentId, rs.shippingDate ShippingDate FROM _ql_committed_Shipment AS sv, RetailShipment AS rs WHERE   sv.data.shipmentId = rs.MasterShipmentId AND UPPER(sv.data.shipmentId) =  ? ';
  return txn.execute(query, masterID);
}

/**
 * Helper function to retrieve recent shipment records
 * @returns The JSON document to return to the client
 */
const getRecentShipments = async () => {
  Log.debug(`In getRecentShipments function`);

  let recentShipments;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    let shipmentDate  = '';
    const result = await getRecentShipmentsFromLedger(txn, shipmentDate);
    const resultList = result.getResultList();
    const sortedShipments =  resultList.sort(custom_sort);
    var recentShipmentIDs = [];
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record does not exist`);
    } else {
        for (var ShipmentId in sortedShipments) {
            recentShipmentIDs.push(sortedShipments[ShipmentId]["ShipmentId"]);
            const masterID = sortedShipments[ShipmentId]["ShipmentId"];
            const retailShipmentResult = await getRetailsShipmentsFromLedger(txn, masterID);
            const retailResultList = retailShipmentResult.getResultList();
            const sortedRetailShipments =  retailResultList.sort(custom_sort);
            for (var ShipmentId in sortedRetailShipments) {
                recentShipmentIDs.push(sortedRetailShipments[ShipmentId]["ShipmentId"]);
            }
            Log.info(`Master ShipmentId : ${masterID}`);
        }
      recentShipments = JSON.stringify(recentShipmentIDs.slice(0, 10));
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return recentShipments;
};


/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The document id of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getShipmentMovementsByShipmentId(txn, shipmentId) {
  Log.debug('In getShipmentMovementsByShipmentId function');
  //const query = 'SELECT  sh.data.shipmentId ShipmentID, sh.data.shippingDate ShippingDate,  sh.data.status Status, sh.data.manufacturer, sh.data.vaccineName VaccineName, sh.data.currentOwner CurrentOwner,  sh.data.events  FROM history(Shipment) AS sh WHERE sh.data.shipmentId= ? AND sh.data.events[0].eventType !=? ';
  const query = 'SELECT  s.shipmentId ShipmentID, s.status Status, s.manufacturer, s.vaccineName VaccineName, s.currentRole CurrentOwner, s.shipmentTrackerEvents  FROM Shipment AS s WHERE s.shipmentId= ? ';
  return txn.execute(query, shipmentId);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @param shipmentId The shipmentId of the VaccineBox to retrieve
 * @returns The JSON document to return to the client
 */
const getShipmentMovements = async (shipmentId) => {
  Log.debug(`In getShipmentMovements function with ShipmentId ${shipmentId}`);

  let shipmentMovements;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    let eventType = 'SENSOR_REPORT' ;
    const result = await getShipmentMovementsByShipmentId(txn, shipmentId);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with ShipmentId ${shipmentId} does not exist`);
    } else {
      shipmentMovements = JSON.stringify(resultList);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentMovements;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document to retrieve
 * @returns The Result from executing the statement
 */
 function getAuditTrailByShipmentId(txn, shipmentId) {
  Log.debug('In getAuditTrailByShipmentId function');
//  const query = 'SELECT s.shipmentTrackerEvents  FROM Shipment AS s WHERE s.shipmentId= ? ';
  const query = 'select sdh.data.shipmentId ShipmentID, sdh.metadata.txTime DateTime, sdh.data.currentOwner CurrentOwner, sdh.data.currentRole CurrentRole, sdh.data.deviceId,  sdh.data.temperature Temperature, sdh.data.humidity Humidity, sdh.data.latitude Latitude, sdh.data.longitude Longitude, sdh.data.newLocation, sdh.hash Hash, sdh.data.tempHash TempHash from _ql_committed_SensorData AS sdh WHERE sdh.data.shipmentId =?';
  return txn.execute(query, shipmentId);
}

/**
 * Helper function to retrieve Sensor Data Audit Trail record
 * @param shipmentId The shipmentId of the Audit Trail to retrieve
 * @returns The JSON document to return to the client
 */
const getAuditTrail = async (shipmentId) => {
  Log.debug(`In getAuditTrail function with shipmentId ${shipmentId}`);

  let auditTrail;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    let eventType = 'SENSOR_REPORT' ;
    const result = await getAuditTrailByShipmentId(txn, shipmentId);
    const resultList = result.getResultList();
    const sortedShipments =  resultList.sort(custom_sort_AuditTrail);
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'Sensor data not found error', `Sensor dara record with shipmentId ${shipmentId} does not exist`);
    } else {
      auditTrail = JSON.stringify(sortedShipments);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return auditTrail;
};


/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getTemperatureGraphByShipmentId(txn, shipmentId) {
  Log.debug('In getTemperatureGraphByShipmentId function');
  const query = 'select sdv.metadata.txTime, sdv.data.temperature Temperature from _ql_committed_SensorData AS sdv WHERE sdv.data.shipmentId = ?';
  return txn.execute(query, shipmentId);
}

/**
 * Helper function to retrieve Sensor Data Audit Trail record
 * @param shipmentId The shipmentId of the Audit Trail to retrieve
 * @returns The JSON document to return to the client
 */
const getTemperatureGraph = async (shipmentId) => {
  Log.debug(`In getTemperatureGraph function with shipmentId ${shipmentId}`);

  let temperatureGraph;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    const result = await getTemperatureGraphByShipmentId(txn, shipmentId);
    const resultList = result.getResultList();
    const sortedShipments =  resultList.sort(custom_sort_sensorData);
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'Sensor data not found error', `Sensor dara record with shipmentId ${shipmentId} does not exist`);
    } else {
      temperatureGraph = JSON.stringify(sortedShipments.slice(0, 10));
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return temperatureGraph;
};


/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The shipmentId of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getHumidityGraphByShipmentId(txn, shipmentId) {
  Log.debug('In getHumidityGraphByShipmentId function');
  const query = 'select sdv.metadata.txTime, sdv.data.humidity Humidity from _ql_committed_SensorData AS sdv WHERE sdv.data.shipmentId = ?';
  return txn.execute(query, shipmentId);
}

/**
 * Helper function to retrieve Sensor Data Audit Trail record
 * @param shipmentId The shipmentId of the Audit Trail to retrieve
 * @returns The JSON document to return to the client
 */
const getHumidityGraph = async (shipmentId) => {
  Log.debug(`In getAuditTrail function with shipmentId ${shipmentId}`);

  let humidityGraph;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    const result = await getHumidityGraphByShipmentId(txn, shipmentId);
    const resultList = result.getResultList();
    const sortedShipments =  resultList.sort(custom_sort_sensorData);
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'Sensor data not found error', `Sensor dara record with shipmentId ${shipmentId} does not exist`);
    } else {
      humidityGraph = JSON.stringify(sortedShipments.slice(0, 10));
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return humidityGraph;
};


/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @returns The Result from executing the statement
 */
async function getHighRiskShipmentsFromLedger(txn) {
  Log.debug('In getHighRiskShipmentsFromLedger function');
//  const query = 'SELECT  sv.data.shipmentId ShipmentID, c.ClaimId, c.ClaimRequestDate ClaimRequestDate, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty,sv.data.wayBill.shipper Origin, sv.data.wayBill.wholesaler Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.riskRating RiskRate, sv.data.currentRole CurrentLocation FROM _ql_committed_Shipment AS sv,  Claim as c  WHERE  sv.data.shipmentId = c.ShipmentId';
  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate ShippingDate, sv.data.policyId PolicyId,  sv.data.claimId ClaimID, sv.data.claimRequestDate ClaimRequestDate, sv.data.claimStatus ClaimStatus, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.wayBill.origin Origin, sv.data.wayBill.destination Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentRole CurrentLocation FROM _ql_committed_Shipment AS sv WHERE sv.data.temperatureExcursion >= 3';
  return txn.execute(query);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @returns The JSON document to return to the client
 */
const getHighRiskShipments = async () => {
  Log.debug(`In getHighRiskShipments function`);
  let claimData;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
      const result = await getHighRiskShipmentsFromLedger(txn);
      const resultList = result.getResultList();
      const sortedShipments =  resultList.sort(custom_sort);
      if (resultList.length === 0) {
          throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
      } else {
          claimData = JSON.stringify(sortedShipments);
      }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return claimData;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param party The Party to retrieve
 * @returns The Result from executing the statement
 */
async function getHighRiskShipmentsFromLedgerByParty(txn, party) {
  Log.debug('In getHighRiskShipmentsFromLedger function');
//  const query = 'SELECT  sv.data.shipmentId ShipmentID, c.ClaimId, c.ClaimRequestDate ClaimRequestDate, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty,sv.data.wayBill.shipper Origin, sv.data.wayBill.wholesaler Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.riskRating RiskRate, sv.data.currentRole CurrentLocation FROM _ql_committed_Shipment AS sv,  Claim as c  WHERE  sv.data.shipmentId = c.ShipmentId';
  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate ShippingDate, sv.data.policyId PolicyId,  sv.data.claimId ClaimID, sv.data.claimRequestDate ClaimRequestDate, sv.data.claimStatus ClaimStatus, sv.data.manufacturer Manufacturer,  sv.data.insurer Insurer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.wayBill.origin Origin, sv.data.wayBill.destination Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentRole CurrentLocation FROM _ql_committed_Shipment AS sv WHERE sv.data.temperatureExcursion >= 3 AND  UPPER(sv.data.manufacturer) = ?';
  return txn.execute(query, party);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @returns The JSON document to return to the client
 */
const getHighRiskShipmentsByParty = async (party) => {
  Log.debug(`In getHighRiskShipments function`);
  let claimData;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
      const result = await getHighRiskShipmentsFromLedgerByParty(txn, party);
      const resultList = result.getResultList();
      const sortedShipments =  resultList.sort(custom_sort);
      if (resultList.length === 0) {
          throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
      } else {
          claimData = JSON.stringify(sortedShipments);
      }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return claimData;
};

/**
 * Helper function to  notify HighRisk Shipments
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @returns The Result from executing the statement
 */
async function getHighRiskShipmentCountFromLedger(txn) {
  Log.debug('In getHighRiskShipmentCountFromLedger function');
//  const query = 'SELECT  sv.data.shipmentId ShipmentID, c.ClaimId, c.ClaimRequestDate ClaimRequestDate, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty,sv.data.wayBill.shipper Origin, sv.data.wayBill.wholesaler Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.riskRating RiskRate, sv.data.currentRole CurrentLocation FROM _ql_committed_Shipment AS sv,  Claim as c  WHERE  sv.data.shipmentId = c.ShipmentId';
  const query = 'SELECT count(*) AS HighRisk FROM _ql_committed_Shipment AS sv WHERE sv.data.temperatureExcursion >= 3';
  return txn.execute(query);
}

/**
 * Helper function to  notify HighRisk Shipments
 * @returns The JSON document to return to the client
 */
const notifyHighRiskShipments = async () => {
  Log.debug(`In getHighRiskShipments function`);
  let highRisk = null;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    const result = await getHighRiskShipmentCountFromLedger(txn);
    const resultList = result.getResultList();
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
      highRisk = JSON.stringify(resultList[0]);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return highRisk;
};

/**
 * Helper function to retrieve Shipment count
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @returns The Result from executing the statement
 */
async function getShipmentCountFromLedger(txn) {
  Log.debug('In getShipmentCountFromLedger function');
  const query = 'SELECT count(*) AS ShipmentCount FROM _ql_committed_Shipment';
  return txn.execute(query);
}

/**
 * Helper function to retrieve Shipment count
 * @returns The JSON document to return to the client
 */
const countShipments = async () => {
  Log.debug(`In countShipments function`);
  let shipmentCount = null;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    const result = await getShipmentCountFromLedger(txn);
    const resultList = result.getResultList();
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
      shipmentCount = JSON.stringify(resultList[0]);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentCount;
};

/**
 * Helper function to retrieve Shipment count
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param party The Party to retrieve
 * @returns The Result from executing the statement
 */
async function getShipmentCountFromLedgerByParty(txn, party) {
  Log.debug('In getShipmentCountFromLedger function');
  const query = 'SELECT count(*) AS ShipmentCount FROM _ql_committed_Shipment as sv WHERE  UPPER(sv.data.manufacturer) = ?';
  return txn.execute(query, party);
}

/**
 * Helper function to retrieve Shipment count
 * @returns The JSON document to return to the client
 */
const countShipmentsByParty = async (party) => {
  Log.debug(`In countShipments function`);
  let shipmentCount = null;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    const result = await getShipmentCountFromLedgerByParty(txn, party);
    const resultList = result.getResultList();
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
      shipmentCount = JSON.stringify(resultList[0]);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentCount;
};


/**
 * Helper function to retrieve Claims count
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param claimFlag
 * @returns The Result from executing the statement
 */
async function getClaimCountFromLedger(txn, claimFlag) {
  Log.debug('In getShipmentCountFromLedger function');
  const query = 'SELECT count(*) AS ClaimCount FROM _ql_committed_Shipment AS sv WHERE UPPER(sv.data.claimId) != ?';
  return txn.execute(query, claimFlag);
}

/**
 * Helper function to retrieve Claims count
 * @returns The JSON document to return to the client
 */
const countClaims = async () => {
  Log.debug(`In countClaims function`);
  let claimCount = null;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    let claimFlag = 'NC' ;
    const result = await getClaimCountFromLedger(txn, claimFlag);
    const resultList = result.getResultList();
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
      claimCount = JSON.stringify(resultList[0]);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return claimCount;
};


/**
 * Helper function to retrieve Claims count
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param claimFlag
 * @param party The Party to retrieve
 * @returns The Result from executing the statement
 */
async function getClaimCountFromLedgerByParty(txn, claimFlag, party) {
  Log.debug('In getShipmentCountFromLedger function');
  const query = 'SELECT count(*) AS ClaimCount FROM _ql_committed_Shipment AS sv WHERE UPPER(sv.data.claimId) != ? AND UPPER(sv.data.manufacturer) = ?';
  return txn.execute(query, claimFlag, party);
}

/**
 * Helper function to retrieve Claims count
 * @returns The JSON document to return to the client
 */
const countClaimsByParty = async (party) => {
  Log.debug(`In countClaims function`);
  let claimCount = null;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    let claimFlag = 'NC' ;
    const result = await getClaimCountFromLedgerByParty(txn, claimFlag, party);
    const resultList = result.getResultList();
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
      claimCount = JSON.stringify(resultList[0]);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return claimCount;
};

/**
 * Helper function to retrieve Recent Claim records
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param claimFlag
 * @returns The Result from executing the statement
 */
async function getRecentClaimsFromLedger(txn, claimFlag) {
  Log.debug('In getRecentClaimsFromLedger function');
  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate ShippingDate, sv.data.insurer Insurer, sv.data.policyId PolicyId,  sv.data.claimId ClaimID, sv.data.claimRequestDate ClaimRequestDate, sv.data.claimStatus ClaimStatus, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.wayBill.origin Origin, sv.data.wayBill.destination Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentRole CurrentLocation, sv.data.currentGeoLocation GeoLocation FROM _ql_committed_Shipment AS sv WHERE UPPER(sv.data.claimId) != ?';
  return txn.execute(query, claimFlag);
}

/**
 * Helper function to retrieve Recent Claim records
 * @returns The JSON document to return to the client
 */
const getRecentClaims = async () => {
  Log.debug(`In getRecentClaims function`);
  let recentClaims;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    let claimFlag = 'NC' ;
    const result = await getRecentClaimsFromLedger(txn, claimFlag);
    const resultList = result.getResultList();
    const sortedClaims =  resultList.sort(custom_sort_claims);
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
       recentClaims = JSON.stringify(sortedClaims.slice(0, 3));
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return recentClaims;
};

/**
 * Helper function to retrieve Recent Claim records
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param claimFlag
 * @param party The Party to retrieve
 * @returns The Result from executing the statement
 */
async function getRecentClaimsFromLedgerByParty(txn, claimFlag, party) {
  Log.debug('In getRecentClaimsFromLedger function');
  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.shippingDate ShippingDate, sv.data.insurer Insurer, sv.data.policyId PolicyId,  sv.data.claimId ClaimID, sv.data.claimRequestDate ClaimRequestDate, sv.data.claimStatus ClaimStatus, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.wayBill.origin Origin, sv.data.wayBill.destination Destination, sv.data.insuredValue InsuredValue, sv.data.status Status, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentRole CurrentLocation, sv.data.currentGeoLocation GeoLocation FROM _ql_committed_Shipment AS sv WHERE UPPER(sv.data.claimId) != ? AND UPPER(sv.data.manufacturer) = ?';
  return txn.execute(query, claimFlag, party);
}

/**
 * Helper function to retrieve Recent Claim records
 * @returns The JSON document to return to the client
 */
const getRecentClaimsByParty = async (party) => {
  Log.debug(`In getRecentClaims function`);
  let recentClaims;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    let claimFlag = 'NC' ;
    const result = await getRecentClaimsFromLedgerByParty(txn, claimFlag, party);
    const resultList = result.getResultList();
    const sortedClaims =  resultList.sort(custom_sort_claims);
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
       recentClaims = JSON.stringify(sortedClaims.slice(0, 3));
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return recentClaims;
};

/**
 * Helper function to retrieve Graph Info
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @returns The Result from executing the statement
 */
async function getGraphInfoFromLedger(txn) {
  Log.debug('In getGraphInfoFromLedger function');
  const query = 'SELECT sv.data.shipmentId ShipmentId, sv.data.temperatureExcursion TemperatureAlert, sv.data.currentGeoLocation.latitude Latitude, sv.data.currentGeoLocation.longitude Longitude, sv.data.currentGeoLocation.xaxis XAxis, sv.data.currentGeoLocation.yaxis YAxis, sv.data.currentGeoLocation.location Location FROM _ql_committed_Shipment AS sv ';
  return txn.execute(query);
}

/**
 * Helper function to retrieve Graph Info
 * @returns The JSON document to return to the client
 */
const getGraphInfo = async () => {
  Log.debug(`In getGraphInfo function`);
  let graphInfo;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    const result = await getGraphInfoFromLedger(txn);
    const resultList = result.getResultList();
    if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentData record with shipmentId ${shipmentId} does not exist`);
    } else {
      graphInfo = JSON.stringify(resultList);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return graphInfo;
};

/**
 * Check if an shipmentId already exists
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param RetailShipmentId The shipmentId of the Shipment.
 * @returns The number of records that exist for the shipmentId
 */
async function checkRetailShipmentIdUnique(txn, RetailShipmentId) {
  Log.debug('In checkRetailShipmentIdUnique function');
  const query = 'SELECT RetailShipmentId FROM RetailShipment AS b WHERE b.RetailShipmentId = ?';
  let recordsReturned;
  await txn.execute(query, RetailShipmentId).then((result) => {
    recordsReturned = result.getResultList().length;
    if (recordsReturned === 0) {
      Log.debug(`No records found for ${RetailShipmentId}`);
    } else {
      Log.debug(`Record already exists for ${RetailShipmentId}`);
    }
  });
  return recordsReturned;
}

/**
 * Insert the new Shipment to the Shipment table
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentDataDoc The JSON document containing the details to insert.
 * @returns The Result from executing the statement
 */
async function createVaccineboxRetailShipment(txn, retailShipmentDataDoc) {
  Log.debug('In the createVaccineboxRetailShipment function');
  const statement = 'INSERT INTO RetailShipment ?';
  return txn.execute(statement, retailShipmentDataDoc);
}


/**
 * Creates a new Shipment record in the QLDB ledger.
 * @param vaccineName The name of the Vaccine.
 * @param shipmentId The shipmentId of the Shipment.
 * @param quantity The quantity of the Shipment .
 * @param destinationAddress The destinationAddress of the Shipment.
 * @param currentRole The destinationAddress of the Shipment.
 * @param event The event record to add to the document.
 * @returns The JSON record of the new Shipment record.
 */
const createNewRetailShipment = async (RetailShipmentId, RetailQuantity, WayBill, MasterShipmentId) => {
  Log.debug(`In createNewRetailShipment function with: with: RetailShipmentId ${RetailShipmentId} RetailQuantity ${RetailQuantity}  MasterShipmentId ${MasterShipmentId}`);

  let retailShipmentData;
  const currentGeoLocation = { latitude : '12.9716° N', xaxis : 12.9716, longitude : '77.5946° E', yaxis : 77.5946, location: 'CA'};
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Check if the record already exists assuming ShipmentId unique for demo
    const recordsReturned = await checkRetailShipmentIdUnique(txn, RetailShipmentId);
    if (recordsReturned === 0) {
        const result = await getShipmentDataRecordByShipmentId(txn, MasterShipmentId);
        const resultList = result.getResultList();
        if (resultList.length === 0) {
          throw new ShipmentDataNotFoundError(400, 'Origin ShipmentData Not Found Error', `ShipmentDat record with ShipmentId ${shipmentId} does not exist`);
        } else {
          let shippingDate = dateFormat(new Date(), 'isoDateTime');
          const retailShipmentDataDoc = [{
            RetailShipmentId, RetailQuantity, currentGeoLocation, WayBill, MasterShipmentId, temperatureExcursion: 0, humidityRangeViolation: 0, wholesaler : 'ABC-Wholesaler', currentRole : 'Wholesaler', currentOwner : 'ABC-Wholesaler', status : 'In-Transit', shippingDate : shippingDate,
          }];
          const result = await createVaccineboxRetailShipment(txn, retailShipmentDataDoc);
          retailShipmentData = {
            RetailShipmentId,
            RetailQuantity,
            status : 'In-Transit',
            shippingDate : shippingDate,
            WayBill,
          };
        }
    } else {
      throw new ShipmentDataIntegrityError(400, `ShipmentData Integrity Error`, `ShipmentData record with ShipmentId ${shipmentId} already exists. No new record created`);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return retailShipmentData;
};

/**
 * Helper function to retrieve Master Shipments by shipment Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The document id of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getOriginShipmentsByShipmentId(txn, shipmentId) {
  Log.debug('In getOriginShipmentsByShipmentId function');
  //const query = 'SELECT  sh.data.shipmentId ShipmentID, sh.data.shippingDate ShippingDate,  sh.data.status Status, sh.data.manufacturer, sh.data.vaccineName VaccineName, sh.data.currentOwner CurrentOwner,  sh.data.events  FROM history(Shipment) AS sh WHERE sh.data.shipmentId= ? AND sh.data.events[0].eventType !=? ';
 // const query = 'SELECT  s.shipmentId, s.batchId, s.deviceId, s.wayBill RootLeg FROM Shipment AS s WHERE s.shipmentId= ? ';
  const query = 'SELECT  s.data.shipmentId ShipmentId, s.data.batchId BatchId, s.data.deviceId DeviceId, s.data.wayBill.origin Origin, s.data.wayBill.originRole originRole, s.data.wayBill.originAddress originAddress, s.data.wayBill.destination destination,  s.data.wayBill.destinationRole destinationRole, s.data.wayBill.destinationAddress destinationAddress, s.data.wayBill.logistics Logistics FROM  _ql_committed_Shipment AS s WHERE s.data.shipmentId= ?';
  return txn.execute(query, shipmentId);
}
/**
 * Helper function to retrieve Retailer Shipments by shipment Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The ShipmentID to retrieve
 * @returns The Result from executing the statement
 */
async function getRetailerShipmentsByShipmentId(txn, shipmentId) {
  Log.debug('In getShipmentDataRecordByShipmentId function');
//  const query = 'SELECT s.shipmentId, s.deviceId, s.batchId, s.wayBill RootLeg, rs.data AS ChildLeg FROM _ql_committed_RetailShipment AS rs, Shipment AS s WHERE s.shipmentId = ? AND  s.shipmentId = rs.data.MasterShipmentId';
  const query = 'SELECT rs.data.RetailShipmentId AS RetailShipmentId, rs.data.RetailQuantity RetailQuantity, rs.data.WayBill.origin Origin, rs.data.WayBill.originRole originRole, rs.data.WayBill.originAddress originAddress, rs.data.WayBill.destination destination,  rs.data.WayBill.destinationRole destinationRole, rs.data.WayBill.destinationAddress destinationAddress, rs.data.WayBill.logistics Logistics, rs.data.status Status, 	rs.data.deliveryDate DeliveryDate, rs.data.MasterShipmentId MasterShipmentId FROM _ql_committed_RetailShipment AS rs, Shipment AS s WHERE s.shipmentId = ? AND  s.shipmentId = rs.data.MasterShipmentId';
  return txn.execute(query, shipmentId);
}

/**
 * Helper function to retrieve Retailer Shipments
 * @param shipmentId The shipmentId of the shipment to retrieve
 * @returns The JSON document to return to the client
 */
const getTrackingProvenance = async (shipmentId) => {
  Log.debug(`In getRetailerShipments function with ShipmentId ${shipmentId}`);
  let retailerShipments;
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
  const legShipmentresult = await getOriginShipmentsByShipmentId(txn, shipmentId);
  const legShipmentResultList = legShipmentresult.getResultList();
  if (legShipmentResultList.length === 0) {
        throw new ShipmentDataNotFoundError(400, 'Shipment Not Found Error', `ShipmentDat record with ShipmentId ${shipmentId} does not exist`);
  } else {
        retailerShipments = legShipmentResultList[0];
        var jsonStr = '{"OriginLeg": "","Childlegs":[]}';
        var obj = JSON.parse(jsonStr);
//        obj['OriginLegs'].push(retailerShipments);
        obj.OriginLeg = retailerShipments ;
        const result = await getRetailerShipmentsByShipmentId(txn, shipmentId);
        const resultList = result.getResultList();
        if (resultList.length !== 0) {
            for (var i in resultList) {
               obj['Childlegs'].push(resultList[i]);
            }
        }
          retailerShipments =  JSON.stringify(obj);
  }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return retailerShipments;

};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param shipmentId The ShipmentID to retrieve
 * @returns The Result from executing the statement
 */
async function getShipmentRouteByShipmentId(txn, shipmentId) {
  Log.debug('In getShipmentRouteByShipmentId function');
  const query = 'SELECT  sv.data.shipmentId ShipmentID, sv.data.currentGeoLocation, ts.legs  FROM _ql_committed_Shipment AS sv, TransitRoute AS ts WHERE  UPPER(sv.data.shipmentId) = ?  AND sv.data.routeNo = ts.routeNo';
  return txn.execute(query, shipmentId);
}

/**
 * Helper function to retrieve the current state of a ShipmentData record
 * @param shipmentId The shipmentId of the shipment to retrieve
 * @returns The JSON document to return to the client
 */
const getShipmentRoute = async (shipmentId) => {
  Log.debug(`In getShipmentData function with ShipmentId ${shipmentId}`);
  let shipmentData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
  const result = await getShipmentRouteByShipmentId(txn, shipmentId);
  const resultList = result.getResultList();

  if (resultList.length === 0) {
      throw new ShipmentDataNotFoundError(400, 'ShipmentData Not Found Error', `ShipmentDat record with ShipmentId ${shipmentId} does not exist`);
  } else {
      shipmentData = JSON.stringify(resultList[0]);
  }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentData;
};

 function snsPublisher(shipmentId, deviceId, telemetry, hash) {
    console.log('Starting function');
    var jsonStr = '{"shipmentID": "","temperature":"","hash":""}';
    var jsonObj = JSON.parse(jsonStr);
    jsonObj.shipmentID = shipmentId ;
    jsonObj.temperature = telemetry.temp ;
    jsonObj.hash = hash;
    Log.debug(`In snsPublisher function with Hash ${hash}`);
    if( telemetry.temp >= -10) {
      Log.debug(`In snsPublisher Temp ${telemetry.temp}`);
        SNS.publish({
            Message: JSON.stringify(jsonObj),
            TopicArn: 'arn:aws:sns:us-east-1:125396772501:EricSNS'
        }, function(err, data) {
            if (err) {
                console.log(err.stack);
                return;
            }
            console.log('push sent');
            console.log(data);
        });
    }
};



module.exports = {
  createNewShipment,
  getShipmentData,
  shipmentUpdate,
  addSensorData,
  getSensorData,
  getShipmentMovements,
  getAuditTrail,
  addInsuranceClaimData,
  getClaimData,
  getShipmentsByParty,
  getRecentShipments,
  addSensorDataSimulation,
  notifyHighRiskShipments,
  getHighRiskShipments,
  countShipments,
  countClaims,
  getRecentClaims,
  getGraphInfo,
  getTrackingProvenance,
  createNewRetailShipment,
  countShipmentsByParty,
  countClaimsByParty,
  getRecentClaimsByParty,
  getHighRiskShipmentsByParty,
  getShipmentLocation,
  getShipmentRoute,
  getTemperatureGraph,
  getHumidityGraph,
};
