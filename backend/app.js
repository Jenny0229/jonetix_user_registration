const express = require('express');
const nacl = require('tweetnacl');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const BN = require('bn.js');
const naclUtil = require('tweetnacl-util');
const { ec: EC } = require('elliptic');

// Create an instance of the express application
const app=express();
const cors = require("cors");
app.use(cors());
app.use(bodyParser.json());

// Specify a port number for the server
const port=5001;

const ec = new EC('secp256k1');

// Start the server and listen to the port
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Define a simple route to handle GET requests at the root URL
app.get('/', (req, res) => {
  res.send('Welcome to the ECDH key exchange server!');
});

// use middleware to parse json request bodies
app.use(express.json());


// Endpoint to exchange ECDH keys
let clientPublicKeys = [];
let serverPubKey = null;
let serverPrivKey = null;
app.post('/sendKey', (req) => {
  console.log(req);

  //step1: convert the keys' JWK format into a format suitable for database storage

  //step2: storing data into database

  
  /*
    // Store the client's public key
    const clientPublicKey = new Uint8Array(req.body.clientPublicKey);
    clientPublicKeys.push(clientPublicKey);
    console.log(`Received user's ECDH public key`, clientPublicKey);
*/

});
