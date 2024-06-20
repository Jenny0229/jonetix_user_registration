import { useState, useEffect } from 'react'
import './App.css'
import { FormControl, Input, InputLabel, Button } from '@mui/material';
import nacl from 'tweetnacl';
import axios from 'axios';
import BN from 'bn.js';

//import naclUtil from 'tweetnacl-util';


function App() {
  const [message, setMessage] = useState("");
  // raw TS
  const [time, setTime] = useState(null);
  // 8B TS (useful with digital signature)
  const [eightByteTs, setEightByteTs] = useState(null);
  // 32B SHA256 TS (useful with AES 256)
  const [encryptTs, setEncryptTs] = useState(null);

  const [ecdhPublicKey, setEcdhPublicKey] = useState(null);
  const [ecdhPrivateKey, setEcdhPrivateKey] = useState(null);
  const [otherPartyPublicKey, setOtherPartyPublicKey] = useState(null);
  const [sharedSecret, setSharedSecret] = useState(null);
  const [encryptMsg, setEncryptMsg] = useState(null);
  const [encryptkey, setEncryptKey] = useState(null); //AES
  const [iv, setIV] = useState(null); 
  

  const [publicSigKey, setSigPublicKey] = useState(null); //signature
  const [privateSigKey, setSigPrivateKey] = useState(null);//signature
  const [sig, setSig] = useState(null);

  // generate client's keys when component unmounts
  useEffect(() => {
    // generate ECDH key pair using Secp256k1
    const keyPair = nacl.box.keyPair();nacl.box.keyPair();
    console.log(`Generated personal ECDH public key:`, keyPair.publicKey);
    console.log(`Generated personal ECDH private key:`, keyPair.secretKey);
    setEcdhPrivateKey(new Uint8Array(keyPair.secretKey));
    setEcdhPublicKey(new Uint8Array(keyPair.publicKey));

    //Generate ECDSA key pair(uses Curve 25519 by default)
    generateKeyPairECDSA().then(keyPair => {
      setSigPrivateKey(keyPair.privateKey);
      console.log(`Generated personal ECDSA private key:`, keyPair.privateKey);
      setSigPublicKey(keyPair.publicKey);
      console.log(`Generated personal ECDSA public key:`, keyPair.publicKey);

    }).catch(error => {
      console.error('Error generating key pair:', error);
    });
  }, []); 

  const handleSubmit = async (e) => {
    e.preventDefault();

    console.log(`received user message:`, message);

    // step 1: process timestamp
    handleTime();

    // step 2: exchanging ECDH public key with server
    const requestBody1 = {
      clientPublicKey: Array.from(ecdhPublicKey),
    };
    const response = await axios.post('http://localhost:5001/exchange', requestBody1);
    const serverKey = new Uint8Array(response.data.serverPublicKey);
    setOtherPartyPublicKey(serverKey);

  };

  // finishes step 3 and start step 4
  useEffect(() => {
    if (otherPartyPublicKey) {
      console.log(`Received server public key:`, otherPartyPublicKey);

      // Step 3: Calculate the shared secret using my private key and server's public key
      const sharedSec = performKeyExchange();
      console.log(`Generated shared secret from user's private key and server's public key:`, sharedSec);
      setSharedSecret(sharedSec);

      // Step 4: Generate encryption key based on shared secret and encrypt the message
      handleEncrypt();

    }
  }, [otherPartyPublicKey]);

  // finishes step 4 and continue step 5 and 6
  useEffect(() => {
    if (sharedSecret && iv && encryptkey) {
      encrypt().then((encrypted) => {
        console.log(`The encrypted message is:`, encrypted);
        setEncryptMsg(encrypted);
        const base64String = arrayBufferToBase64(encrypted);
        console.log('In Base64 the encrypted message is:', base64String);
      }).catch(error => {
        console.error('Encryption failed:', error);
      });

  
      // step 5: perform signing
      signMessage(privateSigKey).then((signature) => {
        setSig(signature);
        console.log(`The generated signature is:` , sig);
      })

    // // step 6: sending message to server side and signature verification
    // const requestBody2 = {
    //   encryptMsg,
    //   sig,
    //   publicKey,
    //   time
    // };

    // try {
    //   const response = await axios.post('http://localhost:5001/verify-signature', requestBody2);
    //   setVerificationResponse(response.data.message);
    // } catch (error) {
    //   console.error('Error verifying signature:', error);
    //   setVerificationResponse('Signature verification failed');
    // }
    }
  }, [iv, encryptkey, sharedSecret]);
  

  // process all the timestamp stuff
  const handleTime = async () => {
    const currentTime = Date.now();
    setTime(currentTime);
    console.log(`The current timestamp is ${currentTime}`);
    const byteTime = getTimeByteArray(currentTime);
    setEightByteTs(byteTime);
    console.log(`the 8B-TS array is ${byteTime}`);
    const prngArray = getRandomByteArray();
    console.log(`the 32 Byte Random array is ${prngArray}`);
    const concatenatedArray = concatArrays(byteTime, prngArray);
    console.log(`the concatenated 40B TS + PRNG arry is ${concatenatedArray}`);
    getSHA256Hash(concatenatedArray).then(hashedArray => {
      console.log(`hashed to 32B:`, hashedArray);
      setEncryptTs(hashedArray);
    });
   
  }

  // encryption
  const handleEncrypt = async () => {
    console.log( `handling encryption`);
    const Keyyy = await generateKey();
    console.log( `Generated encryption key:`, Keyyy);
    setEncryptKey(Keyyy);
    const ivvv = await generateIV(encryptTs);
    console.log( `Generated Initialization Vector based on previous 32B Time + PRNG:`, ivvv);
    setIV(ivvv);
  };

  // truncate the first 16 byte of the 32 byte TS-enhanced random number to be the IV for EAS-256 GCM
  const generateIV = (num) => {
    return num.slice(0, 16);
  };

  // generating encryption key based on the shared secret from ECDH key exchange
  const generateKey = async () => {
    // Convert sharedSecret to a Uint8Array if it is not already
    const encoder = new TextEncoder();
    const data = encoder.encode(sharedSecret);

    // Compute SHA-256 hash
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);

    // Convert hashBuffer to CryptoKey object
    const derivedKey = await window.crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'AES-GCM' },
      false, // Whether the key is extractable
      ['encrypt', 'decrypt'] // Key usage
    );

    return derivedKey;
  };

  const encrypt = async () => {
    const encodedMessage = str2ab(message);
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      encryptkey,
      encodedMessage
    );
    return ciphertext;
  };

  // Converting the message to ArrayBuffer
  const str2ab = (str) => {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  };

  // decryption
  // const decrypt = async () => {
  //   if(!runVerification()){
  //     console.log('Verification Failed');
  //     return;
  //   }
  //   console.log('Verification Succeeded');
  //   const decrypted = await window.crypto.subtle.decrypt(
  //     {
  //       name: 'AES-GCM',
  //       iv: iv,
  //     },
  //     encryptkey,
  //     encryptMsg
  //   );
  //   return ab2str(decrypted);
  // };


// ECDSA with Secp256k1 curve
const generateKeyPairECDSA = async () => {
    return window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ["sign", "verify"]
    );
};

//Calculating shared secret
const performKeyExchange = () => {
  // Perform ECDH key exchange using tweetnacl
  const sharedKey = nacl.box.before(otherPartyPublicKey, ecdhPrivateKey);
  return sharedKey;
};


// sign the message: taking SHA256 of the message with the 8B TS, 
// then converting that to a 32B-BigInteger modulo N (of the ECC256 curve parameter N).
const signMessage = async () => {
  const msgBuffer = new TextEncoder().encode(message);
  const tsBuffer = eightByteTs;

  // Concatenate message with the 8-byte timestamp
  const concatenated = new Uint8Array([...msgBuffer, ...tsBuffer]);

  // Hash the concatenated message and timestamp using SHA-256
  const hash = await getSHA256Hash(concatenated);
  

  // Convert the hash to a 32-byte BigInteger modulo N
  const ECC_N = new BN('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 16);
  const modHashBuffer = toBigIntegerModN(hash, ECC_N);

  // Sign the modHashBuffer using ECDSA with the secp256k1 curve
  const signAlgorithm = {
    name: "ECDSA",
    hash: { name: "SHA-256" },
  };

  const signature = await window.crypto.subtle.sign(signAlgorithm, privateKey, modHashBuffer);
  return new Uint8Array(signature);
};
  
/*
  //transforming the format of public key (ECDSA)
  const importPublicKey = async () => {
    // Remove the PEM header/footer
    const pemHeader = "-----BEGIN PUBLIC KEY-----";
    const pemFooter = "-----END PUBLIC KEY-----";
    const pemContents = publicKey.substring(pemHeader.length, publicKey.length - pemFooter.length);
    const binaryDer = window.atob(pemContents);
    const binaryArray = new Uint8Array(binaryDer.length);
    for (let i = 0; i < binaryDer.length; i++) {
      binaryArray[i] = binaryDer.charCodeAt(i);
    }
  
    // Import the key
    return window.crypto.subtle.importKey(
      "spki",  // SubjectPublicKeyInfo structure
      binaryArray.buffer,
      {
        name: "ECDSA",       // Algorithm name
        namedCurve: curve  // Named curve for the key
      },
      true,     // Extractable (whether the key can be exported)
      ["verify"] // Usages (this key will be used for verifying signatures)
    );
  };

  const verifySignature = async (publicTransformed) => {
    const encoder = new TextEncoder();
    const encodedMessage = encoder.encode(encryptMsg);
  
    // Hash the message
    const hash = await crypto.subtle.digest("SHA-256", encodedMessage);
  
    // Verify the signature
    const isValid = await crypto.subtle.verify(
      {
        name: "ECDSA",
        hash: { name: "SHA-256" },
        namedCurve: curve  // Specify the curve here
      },
      publicTransformed,
      sig,
      hash
    );
  
    return isValid;
  };
  
  const runVerification = async () => {
    const publicTransformed = await importPublicKey(publicKey, curve);
    const isValid = await verifySignature(publicTransformed);
    return isValid;
  };
*/
// HELPER FUNCTIONS
// converts the current UTC time to an 8-byte array
  const getTimeByteArray = (time) => {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, BigInt(time), false); // Set BigUint64 in big-endian format
    return new Uint8Array(buffer);
  };

  // generate a 32-byte random number (satisfy PRNG)
  const getRandomByteArray = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array); // Generate 32 random bytes
    return array;
  };

  // concatenate the 8-byte time array with the 32-byte random array
  const concatArrays = (byteArray, prngArray) => {
    const concatenatedArray = new Uint8Array(byteArray.length + prngArray.length);
    concatenatedArray.set(byteArray, 0);
    concatenatedArray.set(prngArray, byteArray.length);
    return concatenatedArray;
  };

  // get the SHA-256 hash of the concatenated array in 32 Byte
  const getSHA256Hash = async (array) => {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', array);
    return new Uint8Array(hashBuffer);
  };
  
  // Convert ArrayBuffer to Base64 String
  const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  };
  const toBigIntegerModN = (hash, ECC_N) => {
    const bn = new BN(hash);
    return bn.mod(ECC_N).toArrayLike(Buffer, 'be', 32);
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <FormControl required>
          <InputLabel>Message</InputLabel>
          <Input 
            placeholder="Write your message here" 
            onChange={(e) => setMessage(e.target.value)}
          />
        </FormControl>
        <Button type="submit">Submit</Button>
      </form>
    </>
  )
}

export default App
