const express = require('express');
const nacl = require('tweetnacl');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const BN = require('bn.js');
const naclUtil = require('tweetnacl-util');
const { ec: EC } = require('elliptic');
const redis = require('redis');
const db = require("./firebase");
const { addDoc, collection } = require("firebase/firestore");

// Create an instance of the express application
const app=express();
const cors = require("cors");
app.use(cors());
app.use(bodyParser.json());

// instance for memorystore
const client = redis.createClient({
  host: '10.46.99.131',
  port: 6378
});

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
let clientPublicKeys = null;
let serverPubKey = null;
let serverPrivKey = null;
app.post('/sendKey', async (req, res) => {
  console.log(req.body);
  
  // step0: Generate server's ECDH key pair
  const serverECDH = crypto.createECDH('secp256k1');
  serverECDH.generateKeys();
  const serverPublicKeyBase64 = serverECDH.getPublicKey().toString('base64');
  const serverPrivateKeyBase64 = serverECDH.getPrivateKey().toString('base64');
  console.log("testing server ecdh in base 64")
  console.log(serverPublicKeyBase64);
  console.log(serverPrivateKeyBase64);
  serverPubKey = serverPublicKeyBase64;
  serverPrivKey = serverPrivateKeyBase64;

  //step1: convert the keys' JWK format into a format suitable for database storage
  const clientECDH = req.body.ecdhPublicKey;
  const clientECDHBase64 = convertKeyToBase64(clientECDH);
  console.log("testing client ecdh in base 64");
  console.log(clientECDHBase64);
  clientPublicKeys = clientECDHBase64;

  //step2: storing data into database
  const username = req.body.username;
  const email = req.body.email;
  console.log("testing client data");
  console.log(username);
  console.log(email);

  // store username and email
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      username: username,
      email: email,
      ecdh_client: serverPubKey,
      ecdh_server: clientPublicKeys
    });
  } catch (error) {
    console.error(error);
  }


  // Example key format: user:email
  // const key = `user:${email}`;

  // client.hmset(key, {
  //   username: username,
  //   email: email
  // }, (err, reply) => {
  //   if (err) {
  //     console.error('Error storing data:', err);
  //     res.status(500).send('Error storing data');
  //   } else {
  //     console.log('Data stored successfully:', reply);
  //     res.send('Data stored successfully');
  //   }
  // });

  // Send the server's public key as the response
  res.json({
    serverPublicKey: serverPublicKeyBase64,
    //sharedSecret: sharedSecret // For testing only, do not send shared secrets in production
  });
  //return res.status(200).json({ serverPublicKey: Array.from(serverPubKey) });
  
  /*
    // Store the client's public key
    const clientPublicKey = new Uint8Array(req.body.clientPublicKey);
    clientPublicKeys.push(clientPublicKey);
    console.log(`Received user's ECDH public key`, clientPublicKey);
*/

});


const base64Encode = (str) => {
  return Buffer.from(str, 'utf8').toString('base64');
};

const convertKeyToBase64 = (key) => {
  // Concatenate x and y values
  const keyMaterial = `${key.x}.${key.y}`;
  // Convert to Base64
  return base64Encode(keyMaterial);
};
