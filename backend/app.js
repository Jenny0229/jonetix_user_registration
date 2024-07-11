const express = require('express');
const db = require("./firebase");
const {generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, generateAuthenticationOptions} = require('@simplewebauthn/server');
const { addDoc, collection } = require("firebase/firestore");

const app=express();
const cors = require("cors");
app.use(cors());

const port=5001;

//TO FIX: http vs https; why send data; 


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
app.use(express.json());

// Defining some constants that describe your "Relying Party" (RP) server to authenticators:
/**
 * Human-readable title for your website
 */
const rpName = 'Jonetix SimpleWebAuthn Example';
/**
 * A unique identifier for your website. 'localhost' is okay for
 * local dev
 */
const rpID = 'localhost';
/**
 * The URL at which registrations and authentications should occur.
 * 'http://localhost' and 'http://localhost:PORT' are also valid.
 * Do NOT include any trailing /
 */
const origin = `http://${rpID}:5173`;

let userPasskeys = [];

let currentOptions;
let user;

class Passkey {
  constructor(id, publicKey, user, webauthnUserID, counter, deviceType, backedUp, transports) {
    this.id = id; // Base64URLString
    this.publicKey = publicKey; // Uint8Array
    this.user = user; // UserModel
    this.webauthnUserID = webauthnUserID; // Base64URLString
    this.counter = counter; // number
    this.deviceType = deviceType; // CredentialDeviceType (string)
    this.backedUp = backedUp; // boolean
    this.transports = transports; // AuthenticatorTransportFuture[] (optional)
  }
}

// ROUTES
app.get('/', (req, res) => {
  res.send('Welcome to the backend server!');
});


// Endpoint for generateRegistrationOptions
app.post('/generate-registration-options', async (req, res) => {
  // Retrieve the user
  console.log('received', req.body);
  user = req.body;
  //console.log(user.username);

  try {
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.username,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        // Optional
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    // Remember these options for the user DB
    currentOptions = options;

    // Send the options as a JSON response
    res.json(options);
  } catch (error) {
    // If there's an error, send a 500 server error status code and the error message
    res.status(500).send({ error: error.message });
  }
});


// Endpoint for verifyRegistrationResponse
// Endpoint for verifyRegistrationResponse and to save registration data if verification is successful
app.post('/verify-registration', async (req, res) => {
  console.log('Received verification request:', req.body);

  try {
    // Attempt to verify the registration response
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: currentOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    const { verified } = verification;
    console.log('Verification result:', verification);

    // If verification is successful, proceed to save data to the database
    if (verified) {
      const registrationInfo = req.body; // Assuming registrationInfo structure matches the expected format
      const {
        credentialID,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports,
      } = registrationInfo;

      const user = currentOptions.user; // Assuming user information is part of the currentOptions object

      // Construct the new Passkey object
      const newPasskey = {
        userId: user.id,
        credentialID,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports,
      };

      // Save registration information to the database
      try {
        const docRef = await addDoc(collection(db, 'users'), {
          registrationInfo: registrationInfo,
          user: user,
        });
        console.log('User registration info saved:', docRef.id);
      } catch (error) {
        console.error('Error saving user registration info:', error);
      }

      // Save the Passkey object to the database
      try {
        const passkeyRef = await addDoc(collection(db, 'passkeys'), newPasskey);
        console.log('Passkey saved:', passkeyRef.id);
      } catch (error) {
        console.error('Error saving passkey:', error);
      }

      // Respond to the client that the verification and data saving were successful
      return res.status(200).json({ verified: true });
    } else {
      // If verification is not successful, respond accordingly
      console.log('Verification failed');
      return res.status(200).json({ verified: false });
    }
  } catch (error) {
    console.error('Verification failed with error:', error);
    return res.status(400).send({ error: error.message });
  }
});
