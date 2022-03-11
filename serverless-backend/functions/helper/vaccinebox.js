/*
 * Helper utility that provides the implementation for interacting with QLDB
 * Sathish Kumar
 */

const Log = require('@dazn/lambda-powertools-logger');
const AWSXRay = require('aws-xray-sdk-core');
AWSXRay.captureAWS(require('aws-sdk'));
const { getQldbDriver } = require('./ConnectToLedger');
const VaccineboxIntegrityError = require('../lib/VaccineboxIntegrityError');
const VaccineboxNotFoundError = require('../lib/VaccineboxNotFoundError');

/**
 * Check if an SKU already exists
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sku The SKU of the VaccineBox.
 * @returns The number of records that exist for the SKU
 */
async function checkSKUUnique(txn, sku) {
  Log.debug('In checkSKUUnique function');
  const query = 'SELECT sku FROM Shipment AS b WHERE b.sku = ?';
  let recordsReturned;
  await txn.execute(query, sku).then((result) => {
    recordsReturned = result.getResultList().length;
    if (recordsReturned === 0) {
      Log.debug(`No records found for ${sku}`);
    } else {
      Log.debug(`Record already exists for ${sku}`);
    }
  });
  return recordsReturned;
}

/**
 * Insert the new vaccinebox to the VaccineBox table
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param vaccineboxDoc The JSON document containing the details to insert.
 * @returns The Result from executing the statement
 */
async function createVaccineboxShipment(txn, vaccineboxDoc) {
  Log.debug('In the createVaccineboxShipment function');
  const statement = 'INSERT INTO Shipment ?';
  return txn.execute(statement, vaccineboxDoc);
}

/**
 * Insert the new vaccinebox document to the vaccinebox table
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param skuid The document id of the document.
 * @param deviceid The Sensor deviceid to add to the document
 * @param sku The SKU of the Vaccinebox.
 * @returns The Result from executing the statement
 */
async function addSKUId(txn, deviceid, sku) {
  Log.debug('In the addSKUId function');
  const statement = 'UPDATE VaccineBox as b SET b.deviceid = ? WHERE b.sku = ?';
  return txn.execute(statement, deviceid, sku);
}

/**
 * Creates a new Vaccinebox record in the QLDB ledger.
 * @param vaccineName The name of the Vaccine.
 * @param sku The SKU of the Vaccinebox.
 * @param quantity The quantity of the Vaccinebox .
 * @param destinationAddress The destinationAddress of the Vaccinebox.
 * @param currentRole The destinationAddress of the Vaccinebox.
 * @param event The event record to add to the document.
 * @returns The JSON record of the new Vaccinebox reecord.
 */
const shipVaccinebox = async (vaccineName, sku, quantity, destinationAddress, event) => {
  Log.debug(`In shipVaccinebox function with: with: Vaccine Name ${vaccineName} sku ${sku}  Quantity ${quantity} Destination Address ${destinationAddress}`);

  let vaccinebox;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Check if the record already exists assuming SKU unique for demo
    const recordsReturned = await checkSKUUnique(txn, sku);
    if (recordsReturned === 0) {
      const vaccineboxDoc = [{
        vaccineName, sku, quantity, destinationAddress, riskRating: 0, manufacturer : 'Gilead Sciences', currentRole : 'Manufacturer', status : 'In-Transit',  events: event,
      }];
      // Create the record. This returns the unique document ID in an array as the result set
      const result = await createVaccineboxShipment(txn, vaccineboxDoc);
      const docIdArray = result.getResultList();
      const docId = docIdArray[0].get('documentId').stringValue();
      // Update the record to add the document ID as the deviceId in the payload
      await addSKUId(txn, docId.toUpperCase(), sku);
      vaccinebox = {
        vaccineName,
        sku,
        quantity,		
		destinationAddress,
		manufacturer: 'Gilead Sciences',
		currentRole : 'Manufacturer',
		status : 'In-Transit',
        riskRating: 0,
        event,
      };
    } else {
      throw new VaccineboxIntegrityError(400, `Vaccinebox Integrity Error`, `Vaccinebox record with SKU ${sku} already exists. No new record created`);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return vaccinebox;
};

/**
 * Helper function to get the latest revision of document by deviceid
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param deviceid The deviceid of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getVaccineboxRecordByDeviceId(txn, deviceid) {
  Log.debug(`In getVaccineboxRecordByDeviceId function`);
  const query = 'SELECT * FROM VaccineBox AS b WHERE b.deviceid = ?';
  return txn.execute(query, deviceid);
}

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sku The document id of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getVaccineboxRecordBySKU(txn, sku) {
  Log.debug('In getVaccineboxRecordBySKU function');
  const query = 'SELECT * FROM Shipment AS b WHERE b.sku = ?';
  return txn.execute(query, sku);
}

/**
 * Helper function to update the document with penalty points and event details
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param event The event to add to the document
 * @param sku The SKU of the document to update
 * @param currentOwner The currentOwner of the document to update
 * @param newRiskRating The newRiskRating of the document to update  
 * @returns The Result from executing the statement
 */
async function addEvent(txn, event, sku, currentOwner, newRiskRating) {
  Log.debug(`In the addEvent function with currentOwner ${currentOwner}`);
  const statement = 'UPDATE VaccineBox as b SET  b.currentOwner = ?,b.riskRating = ?, b.events = ? WHERE b.sku = ?';
  return txn.execute(statement, currentOwner, newRiskRating, event, sku);
 
}


/**
 * Update the Vaccinebox document with an Points Added or PointsRemoved event
 * @param sku The sku of the document to update
 * @param currentOwner The currentOwner of the document to update
 * @param event The event to add
 * @returns A JSON document to return to the client
 */
const updateVaccinebox = async (sku, currentOwner, eventInfo) => {
  Log.debug(`In updateVaccinebox function with sku ${sku} and eventInfo ${eventInfo}`);

  let vaccinebox;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record

    const result = await getVaccineboxRecordBySKU(txn, sku);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new VaccineboxIntegrityError(400, 'Vaccinebox Integrity Error', `Vaccinebox record with sku ${sku} does not exist`);
    } else {
      const originalVaccinebox = JSON.stringify(resultList[0]);
      const newVaccinebox = JSON.parse(originalVaccinebox);
      const originalRiskRating = newVaccinebox.riskRating;
      const owner = newVaccinebox.currentOwner;
 //     const updatedPoints = eventInfo.penaltyPoints;
      if (eventInfo.eventType === 'AssetTransfer' & currentOwner === undefined ) {
		throw new VaccineboxIntegrityError(400, 'Vaccinebox Integrity Error', `Vaccinebox ${sku} cannot update without currentOwner data`);
      }

      if (eventInfo.eventType === 'TelemetryUpdate' & eventInfo.temp === undefined ) {
		throw new VaccineboxIntegrityError(400, 'Vaccinebox Integrity Error', `Vaccinebox ${sku} cannot update without temperature data`);
      }

      if (currentOwner === undefined ) {
            currentOwner = owner;
      }

      let newRiskRating = null;
      if (eventInfo.temp >= 20) {
        newRiskRating = originalRiskRating + 5;
      } else {
        newRiskRating = originalRiskRating;
      }

      const { events } = newVaccinebox;
      events.unshift(eventInfo);
      await addEvent(txn, events, sku, currentOwner, newRiskRating);
      vaccinebox = {
        sku,
		currentOwner,
        riskRating: newRiskRating,
      };
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return vaccinebox;
};

/**
 * Helper function to update the document with new contact details
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sku The SKU of the document to update
 * @param currentRole The latest Owner Name to update
 * @param event The event to add to the document

 * @returns The Result from executing the statement
 */
async function addDeliveryUpdatedEvent(txn, sku, currentRole, event) {
  Log.debug(`In the addDeliveryUpdatedEvent  `);
  const statement = 'UPDATE Shipment as b SET b.currentRole = ?, b.events = ? WHERE b.sku = ?';
  return txn.execute(statement, currentRole, event, sku);
}


/**
 * Update the Shipment document with new Party/Owner details
 * @param sku The SKU of the document to update
 * @param currentRole The updated currentRole
 * @param nextRole The updated nextRole
 * @param eventInfo The event to add
 * @returns A JSON document to return to the client
 */
const shipmentUpdate = async (sku, currentRole, nextRole, eventInfo) => {
  Log.debug(`In shipmentUpdate function with ownerRole ${nextRole}`);

  let vaccinebox;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record

    const result = await getVaccineboxRecordBySKU(txn, sku);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new VaccineboxIntegrityError(400, 'Vaccinebox Integrity Error', `Shipment record with SKU ${sku} does not exist`);
    } else {
      const originalVaccinebox = JSON.stringify(resultList[0]);
      const newVaccinebox = JSON.parse(originalVaccinebox);
      const { events } = newVaccinebox;
      events.unshift(eventInfo);
      await addDeliveryUpdatedEvent(txn, sku, currentRole, events);
      vaccinebox = {
        sku,
        currentRole,
        nextRole,
        response: eventInfo.eventDesc,
      };
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return vaccinebox;
};


/**
 * Insert the new Telemetry to the SensorTelemetry table
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sensorDataDoc The JSON document containing the details to insert.
 * @returns The Result from executing the statement
 */
async function insertSensorData(txn, sensorDataDoc) {
  Log.debug('In the insertSensorData function');
  const statement = 'INSERT INTO SensorData ?';
  return txn.execute(statement, sensorDataDoc);
}

/**
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sku The document id of the document.
 * @param newRiskRating The newRiskRating
 * @returns The Result from executing the statement
 */
async function updateRating(txn, sku, newRiskRating) {
  Log.debug('In the updateRating function');
  const statement = 'UPDATE Shipment as b SET b.riskRating = ? WHERE b.sku = ?';
  return txn.execute(statement, newRiskRating, sku);
}

/**
 * Helper function to update the document with new contact details
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sku The SKU of the document to update
 * @param deviceId The deviceId Name to update
 * @param newRiskRating The newRiskRating Name to update
 * @param event The event to add to the document

 * @returns The Result from executing the statement
 */
async function addSensorDataUpdatedEvent(txn, sku, deviceId, newRiskRating, event) {
  Log.debug(`In the addSensorDataUpdatedEvent  `);
  const statement = 'UPDATE Shipment as b SET b.deviceId = ?, b.riskRating = ?, b.events = ? WHERE b.sku = ?';
  return txn.execute(statement, deviceId, newRiskRating, event, sku);
}



/**
 * Creates a new Telemetry record in the QLDB ledger.
 * @param sku The SKU of the Vaccinebox.
 * @param deviceId The quantity of the Vaccinebox.
 * @param eventInfo The eventInfo of the Vaccinebox.
 * @returns The JSON record of the new Vaccinebox reecord.
 */
const addSensorData = async (sku, deviceId, eventInfo) => {
  Log.debug(`In addSensorData function with Shipment ${deviceId}`);

  let sensorData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record

    const result = await getVaccineboxRecordBySKU(txn, sku);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new VaccineboxIntegrityError(400, 'Vaccinebox Integrity Error', `Shipment record with SKU ${sku} does not exist`);
    } else {
      const originalVaccinebox = JSON.stringify(resultList[0]);
      const newVaccinebox = JSON.parse(originalVaccinebox);
      const { events } = newVaccinebox;
      events.unshift(eventInfo);
      const originalRiskRating = newVaccinebox.riskRating;
      let newRiskRating = null;
      if (eventInfo.temp >= 20) {
        newRiskRating = originalRiskRating + 5;
      } else {
        newRiskRating = originalRiskRating;
      }
      await addSensorDataUpdatedEvent(txn, sku, deviceId, newRiskRating, events);

      let temp = eventInfo.temp;
      let humidity = eventInfo.humidity;
      let latitude = eventInfo.latitude;
      let longitude = eventInfo.longitude;
      let currentRole = newVaccinebox.currentRole;
            let location = eventInfo.location;
      const sensorDataDoc = [{
          sku, deviceId, temp, humidity, latitude, longitude, location, currentRole,
      }];
                 // Create the record. This returns the unique document ID in an array as the result set
      await insertSensorData(txn, sensorDataDoc);

      sensorData = {
        sku,
        deviceId,
        response: eventInfo.eventType,
      };
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return sensorData;
};


/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @param sku The SKU of the VaccineBox to retrieve
 * @returns The JSON document to return to the client
 */
const getVaccinebox = async (sku) => {
  Log.debug(`In getVaccinebox function with SKU ${sku}`);

  let vaccinebox;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    const result = await getVaccineboxRecordBySKU(txn, sku);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new VaccineboxNotFoundError(400, 'Vaccinebox Not Found Error', `VaccineBox record with SKU ${sku} does not exist`);
    } else {
      vaccinebox = JSON.stringify(resultList[0]);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return vaccinebox;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sku The document id of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getSensorDataBySKU(txn, sku) {
  Log.debug('In getSensorDataBySKU function');
  const query = 'select sdh.metadata.txTime DateTime, sdh.data.deviceId SensorID, sdh.data.temp, sdh.data.humidity, sdh.data.longitude, sdh.data.latitude, sdh.data.location,sdh.data.currentRole CurrentOwner  FROM history(SensorData) AS sdh WHERE sdh.data.sku = ?';
  return txn.execute(query, sku);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @param sku The SKU of the VaccineBox to retrieve
 * @returns The JSON document to return to the client
 */
const getSensorData = async (sku) => {
  Log.debug(`In getSensorData function with SKU ${sku}`);

  let sensorData;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    const result = await getSensorDataBySKU(txn, sku);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new VaccineboxNotFoundError(400, 'Vaccinebox Not Found Error', `Vaccinebox record with SKU ${sku} does not exist`);
    } else {
      sensorData = JSON.stringify(resultList);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return sensorData;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @returns The Result from executing the statement
 */
async function getClaimDataFromLedger(txn) {
  Log.debug('In getClaimDataFromLedger function');
  const query = 'SELECT  sv.data.sku ShipmentID, c.ClaimRequestDate ClaimRequestDate, sv.data.manufacturer Manufacturer, sv.data.vaccineName Vaccine, sv.data.quantity Qty, sv.data.status Status, sv.data.riskRating RiskRate, sv.data.currentRole CurrentLocation FROM _ql_committed_Shipment AS sv,  Claim as c  WHERE  sv.data.sku = c.ShipmentId';
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

    if (resultList.length === 0) {
      throw new VaccineboxNotFoundError(400, 'Vaccinebox Not Found Error', `Vaccinebox record with SKU ${sku} does not exist`);
    } else {
      claimData = JSON.stringify(resultList);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return claimData;
};


/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sku The document id of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getShipmentMovementsBySKU(txn, sku) {
  Log.debug('In getShipmentMovementsBySKU function');
  //const query = 'SELECT  sh.data.sku ShipmentID, sh.data.status Status, sh.data.manufacturer, sh.data.vaccineName VaccineName, sh.data.currentOwner CurrentOwner,  sh.data.events  FROM history(Shipment) AS sh WHERE sh.data.sku= ? AND sh.data.events[0].eventType !=? ';
  const query = 'SELECT  s.sku ShipmentID, s.status Status, s.manufacturer, s.vaccineName VaccineName, s.currentRole CurrentOwner, s.events  FROM Shipment AS s WHERE s.sku= ? ';
  return txn.execute(query, sku);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @param sku The SKU of the VaccineBox to retrieve
 * @returns The JSON document to return to the client
 */
const getShipmentMovements = async (sku) => {
  Log.debug(`In getShipmentMovements function with SKU ${sku}`);

  let shipmentMovements;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    let eventType = 'SENSOR_REPORT' ;
    const result = await getShipmentMovementsBySKU(txn, sku);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new VaccineboxNotFoundError(400, 'Vaccinebox Not Found Error', `Vaccinebox record with SKU ${sku} does not exist`);
    } else {
      shipmentMovements = JSON.stringify(resultList);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return shipmentMovements;
};

/**
 * Helper function to get the latest revision of document by document Id
 * @param txn The {@linkcode TransactionExecutor} for lambda execute.
 * @param sku The document id of the document to retrieve
 * @returns The Result from executing the statement
 */
async function getAuditTrailBySKU(txn, sku) {
  Log.debug('In getAuditTrailBySKU function');
  const query = 'SELECT s.events  FROM Shipment AS s WHERE s.sku= ? ';
  return txn.execute(query, sku);
}

/**
 * Helper function to retrieve the current state of a VaccineBox record
 * @param sku The SKU of the VaccineBox to retrieve
 * @returns The JSON document to return to the client
 */
const getAuditTrail = async (sku) => {
  Log.debug(`In getAuditTrail function with SKU ${sku}`);

  let auditTrail;
  // Get a QLDB Driver instance
  const qldbDriver = await getQldbDriver();
  await qldbDriver.executeLambda(async (txn) => {
    // Get the current record
    let eventType = 'SENSOR_REPORT' ;
    const result = await getAuditTrailBySKU(txn, sku);
    const resultList = result.getResultList();

    if (resultList.length === 0) {
      throw new VaccineboxNotFoundError(400, 'Shipment Not Found Error', `Shipment record with SKU ${sku} does not exist`);
    } else {
      auditTrail = JSON.stringify(resultList);
    }
  }, () => Log.info('Retrying due to OCC conflict...'));
  return auditTrail;
};


module.exports = {
  shipVaccinebox,
  getVaccinebox,
  shipmentUpdate,
  getShipmentMovements,
  addSensorData,
  getSensorData,
  getClaimData,
  getAuditTrail,
  updateVaccinebox,
};
