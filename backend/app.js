const express = require('express');
const db = require("./firebase");
const {generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, generateAuthenticationOptions} = require('@simplewebauthn/server');
const { addDoc, collection } = require("firebase/firestore");

const app=express();
const cors = require("cors");
app.use(cors());

const port=5001;

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
const origin = `https://${rpID}:5001`;

const currentRegistrationOptions = new Map();
let currentOptions;
let body;

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
app.get('/generate-registration-options', async (req, res) => {
  // Retrieve the user
  const user = req.body;

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.username,
    // Don't prompt users for additional information about the authenticator
    // (Recommended for smoother UX)
    attestationType: 'none',
    // See "Guiding use of authenticators via authenticatorSelection" below
    authenticatorSelection: {
      // Defaults
      residentKey: 'preferred',
      userVerification: 'preferred',
      // Optional
      authenticatorAttachment: 'platform',
    },
  });

  // Remember these options for the user
  currentRegistrationOptions.set(user, options);

  return options;
});


// Endpoint for verifyRegistrationResponse
app.post('/verify-registration', async (req, res) => {
  body = req.body.body;

  // Retrieve the logged-in user
  const user = req.body.user;
  // Get `options.challenge` that was saved above
  currentOptions = currentRegistrationOptions.get(user);
  
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge: currentOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch (error) {
    console.error(error);
    return res.status(400).send({ error: error.message });
  }

  const { verified } = verification;
  return { verified };

});



// Endpoint to send user data
app.post('/send-data', async (req, res) => {
  console.log(req.body);

  const { registrationInfo } = req.body.body; // = verification
  const {
    credentialID,
    credentialPublicKey,
    counter,
    credentialDeviceType,
    credentialBackedUp,
  } = registrationInfo;

  const user = req.body.user;

  const newPasskey = new Passkey(
    // `user` here is from Step 2
    user,
    // Created by `generateRegistrationOptions()` in Step 1
    currentOptions.user.id,
    // A unique identifier for the credential
    credentialID,
    // The public key bytes, used for subsequent authentication signature verification
    credentialPublicKey,
    // The number of times the authenticator has been used on this site so far
    counter,
    // Whether the passkey is single-device or multi-device
    credentialDeviceType,
    // Whether the passkey has been backed up in some way
    credentialBackedUp,
    // `body` here is from Step 2
    body.response.transports,
  );

  // save registrationInfo to database
  try {
    const docRef = await addDoc(collection(db, 'users'), {
      registrationInfo: registrationInfo,
      user: user,
    });
  } catch (error) {
    console.error(error);
  }

  // save passkey to database (users' primary key links to passkey table)
  // Save the authenticator info so that we can get it by user ID later
  try {
    const docRef = await addDoc(collection(db, 'passkeys'), newPasskey);
  } catch (error) {
    console.error(error);
  }

  return res.status(200).json();

});

