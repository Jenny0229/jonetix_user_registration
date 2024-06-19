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

    // Store the client's public key
    const clientPublicKey = new Uint8Array(req.body.clientPublicKey);
    clientPublicKeys.push(clientPublicKey);

    // Send the server's public key as the response
    res.status(200).json({ serverPublicKey: Array.from(serverKeyPair.publicKey) });
});


// Endpoint to verify signature
app.post('/verify-signature', async (req, res) => {
    const { message, timestamp, signature, publicKey } = req.body;

    try {
        // Concatenate the message with the 8-byte timestamp
        const msgBuffer = Buffer.from(message, 'utf8');
        const tsBuffer = Buffer.from(timestamp, 'hex');
        const concatenated = Buffer.concat([msgBuffer, tsBuffer]);

        // Hash the concatenated message and timestamp using SHA-256
        const hash = crypto.createHash('sha256').update(concatenated).digest();

        // Convert the hash to a 32-byte BigInteger modulo N
        const ECC_N = new BN('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 16);
        const modHashBuffer = toBigIntegerModN(hash, ECC_N);

        // Decode the public key (assuming it's in Base64)
        const publicKeyBuffer = Buffer.from(publicKey, 'base64');
        const keyObject = crypto.createPublicKey({
            key: publicKeyBuffer,
            format: 'der',
            type: 'spki'
        });

        // Verify the signature
        const isVerified = crypto.verify(
            'sha256',
            modHashBuffer,
            {
                key: keyObject,
                dsaEncoding: 'ieee-p1363'
            },
            Buffer.from(signature, 'base64')
        );

        if (isVerified) {
            res.status(200).json({ success: true, message: 'Signature is valid.' });
        } else {
            res.status(400).json({ success: false, message: 'Signature is invalid.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
