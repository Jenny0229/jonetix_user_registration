import { useState } from 'react'
import './App.css'
import { FormControl, Input, InputLabel, Button } from '@mui/material';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import axios from 'axios';


function App() {
  const [message, setMessage] = useState("");
  // raw TS
  const [time, setTime] = useState(null);
  // 8B TS (useful with digital signature)
  const [eightByteTs, setEightByteTs] = useState(null);
  // 32B SHA256 TS (useful with AES 256)
  const [encryptTs, setEncryptTs] = useState(null);

  const [encryptMsg, setEncryptMsg] = useState(null);
  const [encryptkey, setEncryptKey] = useState(null); //AES
  const [iv, setIV] = useState(null); 
  const [ecdhPublicKey, setEcdhPublicKey] = useState(null);
  const [ecdhPrivateKey, setEcdhPrivateKey] = useState(null);
  const [otherPartyPublicKey, setOtherPartyPublicKey] = useState(null);
  const [sharedSecret, setSharedSecret] = useState(null);

  const [publicKey, setPublicKey] = useState(null); //signature
  const [privateKey, setPrivateKey] = useState(null);//signature
  const [curve, setCurve] = useState(null);
  const [sig, setSig] = useState(null);

  // generate client's keys when component unmounts
  useEffect(() => {
    // generate ECDH key pair
    const { publicKey, privateKey } = nacl.box.keyPair();
    setEcdhPublicKey(publicKey);
    setEcdhPrivateKey(privateKey);

    // Generate ECDSA key pair 
    generateKeyPair(curve, 'ECDSA').then(keyPair => {
      setPrivateKey(keyPair.privateKey);
      setPublicKey(keyPair.publicKey);
    }).catch(error => {
      console.error('Error generating key pair:', error);
    });
  }, []); 

  
  const handleSubmit = async (e) => {
    e.preventDefault();

    // step 1: process timestamp
    handleTime();

    // step 2: get the other party's public key backend api
    const requestBody = {
      clientPublicKey: Array.from(publicKey),
    };
    const response = await axios.get('http://localhost:5001/exchange', requestBody);
    setOtherPartyPublicKey(new Uint8Array(response.data.serverPublicKey));

    // step 3: perform ECDH key exchange
    const sharedKey = performKeyExchange(privateKey, otherPublicKey);
    setSharedSecret(sharedKey); 

    // step 4: encrypting the message with sharedSecret key
    const encrypted = handleEncrypt();
    setEncryptMsg(encrypted);

    // step 5: perform signing 
    setSig(await signMessage(privateKey));

  };

  // process all the timestamp stuff
  const handleTime = async () => {
    setTime(await new Date().getTime());
    setEightByteTs(await getTimeByteArray(time));
    const prngArray = getRandomByteArray();
    const concatenatedArray = concatArrays(eightByteTs, prngArray);
    setEncryptTs(await getSHA256Hash(concatenatedArray));
  }


  // encryption
  const handleEncrypt = async () => {
    setEncryptKey(await generateKey());
    setIV(generateIV(encryptTs));
    const encrypted = await encrypt();
    return encrypted;
  };

  // truncate the first 16 byte of the 32 byte TS-enhanced random number to be the IV for EAS-256 GCM
  const generateIV = (num) => {
    return num.slice(0, 16);
  };

  // generate encryption key
  const generateKey = async () => {
    return window.crypto.subtle.generateKey(
      {
        name: 'AES-GCM',
        length: 256,
      },
      true, // extractable
      ['encrypt', 'decrypt']
    );
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
  const decrypt = async () => {
    if(!runVerification()){
      console.log('Verification Failed');
      return;
    }
    console.log('Verification Succeeded');
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      encryptkey,
      encryptMsg
    );
    return ab2str(decrypted);
  };


// can create ECDSA with Secp256k1 curve
const generateKeyPair = async () => {
    return window.crypto.subtle.generateKey(
      {
        name: algorithm,
        namedCurve: "K-256", // Secp256k1 curve
      },
      true,
      ["sign", "verify"]
    );
};

// Function to perform ECDH key exchange
const performKeyExchange = (privateKey, otherPublicKey) => {
  // Perform ECDH key exchange using tweetnacl
  const sharedKey = nacl.box.before(otherPublicKey, privateKey);
  return sharedKey;
};

// sign the message: taking SHA256 of the message with the 8B TS, 
// then converting that to a 32B-BigInteger modulo N (of the ECC256 curve parameter N).
const signMessage = async (privateKey) => {
  const msgBuffer = new TextEncoder().encode(message);
  const tsBuffer = eightByteTs;

  // Concatenate message with the 8-byte timestamp
  const concatenated = new Uint8Array([...msgBuffer, ...tsBuffer]);

  // Hash the concatenated message and timestamp using SHA-256
  const hash = await sha256(concatenated);

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
    return crypto.randomBytes(32); // Generate 32 random bytes
  };

  // concatenate the 8-byte time array with the 32-byte random array
  const concatArrays = (timeArray, prngArray) => {
    const concatenatedArray = new Uint8Array(timeArray.length + prngArray.length);
    concatenatedArray.set(timeArray, 0);
    concatenatedArray.set(prngArray, timeArray.length);
    return concatenatedArray;
  };

  // get the SHA-256 hash of the concatenated array in 32 Byte
  const getSHA256Hash = (array) => {
    return crypto.createHash('sha256').update(array).digest();
  };
  

  return (
    <>
      <FormControl defaultValue="" required onSubmit={handleSubmit}>
        <InputLabel>Message</InputLabel>
        <Input 
          placeholder="Write your message here" 
          onChange={(e) => setMessage(e.target.value)}
        />
        <Button type="submit">Submit</Button>
      </FormControl>
    </>
  )
}

export default App
