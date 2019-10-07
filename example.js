const net = require('net');

const client = new net.Socket();
const Iso_8583 = require('iso_8583');

const log = require('./config/logger');
const helpers = require('./config/helpers');
//const config = require('../config/env');

//const host = config[process.env.NODE_ENV];

const timeout = 3000;
let retrying = false;
const hostAdress = '172.0.0.1';
const hostPort = 62000;
// Functions to handle client events
// connector

 //const json = new Iso_8583().setMetadata(staticMeta).getIsoJSON(buffer,{})

 //console.log(json)
function networkManagement_signon() {
  let new_signon = {
        0: '1804',
        7: '1005231800',
        11: '123456',
        24: '801',
        33: '101010',
        37: '123456789123',
        128: '00000000',
      };
 const staticMeta = 'ISO70100000';
 const isopack = new Iso_8583(new_signon);
 isopack.setMetadata(staticMeta);
// Create buffer that has static data
 const buffer = isopack.getBufferMessage();
 log.info('****** sending sign on ******');

 log.info(buffer)
 log.info(buffer.byteLength)
 log.info(buffer.toString())
 log.info("******************")
  log.info(new_signon);
   return client.write(buffer, () => {
        log.info('sign on Message write finish');

      });
}

function makeConnection() {

client.connect(11673, '127.0.5.1', function() {
   networkManagement_signon();
  });

}

function connectEventHandler() {
  log.info('***** connected ******');
  log.info({
    port: client.remotePort,
    host: client.remoteAddress,
  }, 'connected to switch postbridge');
  retrying = false;
}

function dataEventHandler() {
}

function endEventHandler() {
  // console.log('end');
}

function timeoutEventHandler() {
  // console.log('timeout');
}

function drainEventHandler(data) {
  const thisMti = data.slice(2, 6).toString();
  const iso = new Iso_8583().getIsoJSON(data);
  switch (thisMti) {
    case '1804':
      const new_0800_0810 = {
        0: '1814',
        39: '00',
        128: iso['128'],
      };
      helpers.attachDiTimeStamps(new_0800_0810);
      return client.write(new Iso_8583(new_0800_0810).getBufferMessage(), () => {
        log.info('Message write finish');
      });
    default:
      return false;
  }
}
function errorEventHandler(e) {
  log.error(`Connection error ${e.code}`);
  if (e.code === 'ECONNREFUSED') {
    log.error({ error: 'Remote Server Refused' });
    log.info(`Reconnecting... in ${timeout / 1000} Seconds`);
  } else if (e.code === 'EHOSTUNREACH') {
    log.error('could not reach postbridge node');
    log.info(`Reconnecting... in ${timeout / 1000} Seconds`);
  } else if (e.code === 'ETIMEDOUT') {
    // might want to set back up the connection
    log.error('EHOSTUNREACH error connection with postilion timed out...');
    log.info(`Reconnecting... in ${timeout / 1000} Seconds`);
  } else if (e.code === 'EPIPE') {
    log.error('the FIN has been sent from the other side');
    log.info(`Reconnecting... in ${timeout / 1000} Seconds`);
  } else {
    log.error(e.code);
    log.info(`Reconnecting... in ${timeout / 1000} Seconds`);
  }

  if (!retrying) {
    retrying = true;
  }
  setTimeout(makeConnection, timeout);
}
function closeEventHandler() {
  if (retrying) return false;
  log.error('Server closed');
  log.info(`Reconnecting... in ${timeout / 1000} Seconds`);
  if (!retrying) {
    retrying = true;
  }
  return setTimeout(makeConnection, timeout);
}
// Start Eevent Listeners
client.on('connect', connectEventHandler);
client.on('data', dataEventHandler);
client.on('end', endEventHandler);
client.on('timeout', timeoutEventHandler);
client.on('drain', drainEventHandler);
client.on('error', errorEventHandler);
client.on('close', closeEventHandler);

// Connect to remote server
log.info('***** connecting ******');
makeConnection();

module.exports = client;
