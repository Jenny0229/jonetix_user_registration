const express=require('express');
const nacl = require('tweetnacl');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const BN = require('bn.js');

// Create an instance of the express application
const app=express();
const cors = require("cors");
app.use(cors());
app.use(bodyParser.json());

// Specify a port number for the server
const port=5001;


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
app.post('/exchange', (req, res) => {
    // Generate the server's key pair
    const serverKeyPair = nacl.box.keyPair();
    console.log(`Generated server side ECDH key pair`);

    // Store the client's public key
    const clientPublicKey = new Uint8Array(req.body.clientPublicKey);
    clientPublicKeys.push(clientPublicKey);
    console.log(`Received user's ECDH public key`, clientPublicKey);

    // Send the server's public key as the response
    res.status(200).json({ serverPublicKey: Array.from(serverKeyPair.publicKey) });
});

/*
const verifySignature = (publicKey, message, timestamp, signature) => {
    const messageUint8 = naclUtil.decodeUTF8(message);
    const combined = new Uint8Array(messageUint8.length + timestamp.length);
    combined.set(messageUint8);
    combined.set(timestamp, messageUint8.length);
  
    const hash = crypto.createHash('sha256').update(combined).digest();
    const hashBigInt = BigInt('0x' + hash.toString('hex'));
    const obfuscated = bigInt.mod(hashBigInt, N);
    const obfuscatedUint8 = Uint8Array.from(obfuscated.toString(16).padStart(64, '0').match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  
    const signatureUint8 = naclUtil.decodeBase64(signature);
    return nacl.sign.detached.verify(obfuscatedUint8, signatureUint8, publicKey);
  };

  
// Endpoint to verify signature and decryption
app.post('/verify-and-decrypt', (req, res) => {
    const { encryptMsg, sig, publicKey, time} = req.body;
  
    const isValid = verifySignature(new Uint8Array(publicKey), encryptMsg, new Uint8Array(time), sig);
  
    if (!isValid) {
      return res.status(400).json({ message: 'Signature is invalid' });
    }
  
    // Decrypt the message if the signature is valid
    try {
      const decryptedMessage = decryptMessage(Buffer.from(derivedKey, 'base64'), encryptMsg);
      res.status(200).json({ message: decryptedMessage });
    } catch (error) {
      res.status(400).json({ message: 'Decryption failed', error: error.message });
    }
  });

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
  };*/
