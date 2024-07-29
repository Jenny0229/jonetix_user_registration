const express = require('express');
const db = require("./firebase");
const {generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse, generateAuthenticationOptions} = require('@simplewebauthn/server');
const { addDoc, collection, getDoc, query, where, getDocs, updateDoc, doc } = require("firebase/firestore");

const app=express();
const cors = require("cors");
app.use(cors());

const port=5001;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
app.use(express.json());

// Defining some constants that describe your "Relying Party" (RP) server to authenticators:
const rpName = 'Jonetix SimpleWebAuthn Example';
const rpID = 'localhost';
const origin = `http://${rpID}:5173`;

// Globals
let userPasskeys = [];
let currentOptions;
let client;
const passkeysRef = collection(db, 'passkeys');
const usersRef = collection(db, 'users');
let doc_id; // the id which we will update counter

// NOTE: firebase does not store Uint8 Arrays so convert to Base 64. But don't forget to convert back when fetch from DB

// ROUTES
app.get('/', (req, res) => {
  res.send('Welcome to the backend server!');
});

// ROUTES for Registration
app.post('/generate-registration-options', async (req, res) => {
  // Retrieve the user
  console.log('received', req.body);
  client = req.body;

  userPasskeys = [];

  const q = query(
    passkeysRef,
    where('user.name', '==', client.username),
    where('user.email', '==', client.email)
  );
  // Retrieve and process the data
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    querySnapshot.forEach((doc) => {
      userPasskeys.push(doc.data());
    });
  }

  try {
    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: client.username,
      attestatiƒonType: 'none',
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        // Optional
        transports: passkey.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
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
      const registrationInfo = {
        ...verification.registrationInfo,
        transports: req.body.response.transports,
      };

      const {
        credentialID,
        credentialPublicKey,
        counter,
        credentialDeviceType,
        credentialBackedUp,
        transports,
      } = registrationInfo;

      console.log("debugging regisInfo");
      console.log(registrationInfo);

      // Assuming user information is part of the currentOptions object
      const user = {
        ...currentOptions.user,
        email: client.email, // Ensure email is included
      };
      // Convert data from Uint8Array to Base64
      const base64CredentialPublicKey = Buffer.from(registrationInfo.credentialPublicKey).toString('base64');
      const base64AttestationObject = Buffer.from(registrationInfo.attestationObject).toString('base64');

      // Construct the new Passkey object
      const newPasskey = {
        user: user,
        webAuthnUserID: user.id,
        id: credentialID,
        publicKey: base64CredentialPublicKey,
        counter: counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: transports,
      };
      console.log("debugging passkeys");
      console.log(newPasskey);

      // Save registration information to the database
      
      try {
        const docRef = await addDoc(collection(db, 'users'), {
          registrationInfo: {
            fmt: registrationInfo.fmt,
            counter: registrationInfo.counter,
            aaguid: registrationInfo.aaguid,
            credentialID: registrationInfo.credentialID,
            credentialPublicKey: base64CredentialPublicKey, // changed to base64 for storage
            credentialType: registrationInfo.credentialType,
            attestationObject: base64AttestationObject,
            userVerified: registrationInfo.userVerified,
            credentialDeviceType: registrationInfo.credentialDeviceType,
            credentialBackedUp: registrationInfo.credentialBackedUp,
            origin: registrationInfo.origin,
            rpID: registrationInfo.rpID,
            //authenticatorExtensionResults: registrationInfo.authenticatorExtensionResults,
          },
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


// ROUTES for Authentication
// Endpoint for generateAuthenticationOptions
app.post('/generate-authentication-options', async (req, res) => {
  userPasskeys = [];
  // Retrieve the user
  console.log('received', req.body);
  client = req.body;

  try {
    // Retrieve any of the user's previously registered authenticators
    // search within firebase
    //const passkeysRef = collection(db, 'passkeys');
    const q = query(
      passkeysRef,
      where('user.name', '==', client.username),
      where('user.email', '==', client.email)
    );
    // Retrieve and process the data
    const querySnapshot = await getDocs(q);
  
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        userPasskeys.push(doc.data());
      });
    }

    const options = await generateAuthenticationOptions({
      rpID,
      // Require users to use a previously-registered authenticator
      allowCredentials: userPasskeys.map(passkey => ({
        id: passkey.id,
        transports: passkey.transports,
      })),
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


// ENDPOINT for verify authentication
app.post('/verify-authentication', async (req, res) => {
  console.log('Received verification request:', req.body);

  // get the specifc passkey the user selected for verification
  // Retrieve a passkey from the DB that should match the `id` in the returned credential
  try {
    // Retrieve the document with the specified ID from the 'passkeys' collection
    const q = query(
      passkeysRef,
      where('id', '==', req.body.id)
    );
    // Retrieve and process the data
    const querySnapshot = await getDocs(q);
    
    // Check if the document exists
    if (!querySnapshot.empty) {
      querySnapshot.forEach((doc) => {
        userPasskeys.push(doc.data());
        //passkeyDocRef = doc(db, 'passkeys', doc.id);
        doc_id = doc.id;
      });
      console.log('Passkey found:', userPasskeys);
    } else {
      console.log('No passkey found with this ID.');
    }
  } catch (error) {
    console.error('Error retrieving passkey:', error);
  }

  // give the correct document
  const docRef = doc(db, 'passkeys', doc_id);
  const docSnapshot = await getDoc(docRef);

  try {
    // Attempt to verify the registration response
    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: currentOptions.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      authenticator: {
        credentialID: docSnapshot.data().id,
        credentialPublicKey: Buffer.from(docSnapshot.data().publicKey, 'base64'),
        counter: docSnapshot.data().counter,
        transports: docSnapshot.data().transports,
      },
    });

    const { verified } = verification;
    console.log('Verification result:', verification);

    // If verification is successful, update the user's authenticator's counter property in the DB:
    if (verified) {
      console.log("---testing passkeyDocRef");
      console.log(docRef);
      const currentCounter = docSnapshot.data().counter;
      await updateDoc(docRef, {
        counter: currentCounter + 1
      });

      // update user's registrationInfo counter  
      const q = query(
        usersRef,
        where('registrationInfo.credentialID', '==', docSnapshot.data().id)
      );

      let userDocRef;
      let userCurrCounter;
      const querySnapshot = await getDocs(q);
      querySnapshot.forEach(async (userDoc) => {
        userDocRef = doc(db, 'users', userDoc.id);
        userCurrCounter = userDoc.data().registrationInfo.counter;
      });
      await updateDoc(userDocRef, {
        'registrationInfo.counter': userCurrCounter + 1
      });

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