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

// Helper
const toBigIntegerModN = (hash, ECC_N) => {
    const bn = new BN(hash);
    return bn.mod(ECC_N).toArrayLike(Buffer, 'be', 32);
};

// Endpoint to exchange ECDH keys
let clientPublicKeys = [];
let serverPubKey = null;
let serverPrivKey = null;
app.post('/exchange', (req, res) => {
    // Generate the server's key pair
    const serverKeyPair = nacl.box.keyPair();
    console.log(`Generated server side ECDH key pair`);
    const serverPubKey = serverKeyPair.publicKey;
    const serverPrivKey = serverKeyPair.secretKey;

    // Store the client's public key
    const clientPublicKey = new Uint8Array(req.body.clientPublicKey);
    clientPublicKeys.push(clientPublicKey);
    console.log(`Received user's ECDH public key`, clientPublicKey);

    // Send the server's public key as the response
    res.status(200).json({ serverPublicKey: Array.from(serverPubKey) });
});

  //Endpoint to verify signature and decryption
app.post('/decryption', (req, res) => {
    const { message, signature, userPublicKey, time} = req.body;
    console.log( `Received Encrypted Message from User`, message);
    //console.log(`Received publickey from User`, userPublicKey);
    //console.log(time);
    //console.log(signature);
  
    const publicKey = base64UrlSafeToUint8Array(userPublicKey);
    const Time = base64UrlSafeToUint8Array(time);
    const msg = base64UrlSafeToUint8Array(message);
    const sig = base64UrlSafeToUint8Array(signature);
    //const N = base64UrlSafeToUint8Array(num);

    const isValid = verifySignature(publicKey, msg, Time, sig);
  
    if (!isValid) {
      return res.status(400).json({ message: 'Signature is invalid' });
    }
    console.log(`Signature Verification Succeeded`);
  /*
    // Decrypt the message if the signature is valid
    try {
      const derivedKey = calculateDerivedKey();
      const decryptedMessage = decryptMessage(Buffer.from(derivedKey, 'base64'), encryptMsg);
      res.status(200).json({ message: decryptedMessage });
    } catch (error) {
      res.status(400).json({ message: 'Decryption failed', error: error.message });
    }*/
  });



  const verifySignature = (publicKey, message, timestamp, signature) => {
    try {
      // Combine the message and timestamp
      const combined = new Uint8Array(message.length + timestamp.length);
      combined.set(message);
      combined.set(timestamp, message.length);
  
      // Convert publicKey Uint8Array to Hex
      const pubKeyHex = uint8ArrayToHex(publicKey);
      const key = ec.keyFromPublic(pubKeyHex, 'hex');
  
      // Hash the combined message and timestamp
      const hash = crypto.createHash('sha256').update(combined).digest();
      const hashBN = new BN(hash.toString('hex'), 16);
      const N = new BN('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 16); // Define N appropriately
      const obfuscated = hashBN.mod(N);
      const obfuscatedHex = obfuscated.toString('hex').padStart(64, '0');
  
      // Convert signature Uint8Array to Hex
      const signatureHex = uint8ArrayToHex(signature);
      const r = signatureHex.slice(0, 64);
      const s = signatureHex.slice(64, 128);
  
      // Debug output
      console.log('Combined:', combined);
      console.log('Hash:', hash);
      console.log('Obfuscated Hex:', obfuscatedHex);
      console.log('Signature Hex:', signatureHex);
      console.log('r:', r);
      console.log('s:', s);
  
      // Verify the signature
      const isValid = key.verify(obfuscatedHex, { r, s });
      return isValid;
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  };
  
  const calculateDerivedKey = () =>{
    const sharedSecret = nacl.box.before(clientPublicKeys[clientPublicKeys.length - 1], serverPrivKey);

    const derivedKey = crypto.createHmac('sha256', sharedSecret)
    .update('some salt') // Use a proper salt in a real application
    .digest();

    return derivedKey;
  };
  

  const decryptMessage = (key, encryptedMessage) => {
    const parts = encryptedMessage.split(':');
    const iv = Buffer.from(parts.shift(), 'base64');
    const authTag = Buffer.from(parts.shift(), 'base64');
    const encryptedText = parts.join(':');
  
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
  
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  };

  const base64UrlSafeToUint8Array = (base64UrlSafe) => {
    // Convert from base64 URL safe to base64
    let base64 = base64UrlSafe.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binaryString = Buffer.from(base64, 'base64').toString('binary');
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const uint8ArrayToHex = (uint8Array) => {
    return Array.from(uint8Array).map(b => b.toString(16).padStart(2, '0')).join('');
  };