import { useState, useEffect } from 'react';
import './App.css';
import { FormControl, InputLabel, Input, Button, Typography } from '@mui/material';
import axios from 'axios';
import nacl from 'tweetnacl';

function App() {
  const [ecdhPublicKey, setEcdhPublicKey] = useState(null);
  const [ecdhPrivateKey, setEcdhPrivateKey] = useState(null);
  const [ecdsaPublicKey, setEcdsaPublicKey] = useState(null);
  const [ecdsaPrivateKey, setEcdsaPrivateKey] = useState(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

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

  const generateKeyPairECDH = async () => {
    return window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256" // Use the named curve 'P-256'
      },
      true, // Extractable
      ["deriveKey", "deriveBits"] // Key usages
    );
  }

  const exportKey = async (publicKey) => {
    try {
      const publicKeyJwk = await window.crypto.subtle.exportKey(
        "jwk",
        publicKey
      );
      console.log('Exported public key:', publicKeyJwk);
      return publicKeyJwk;
    } catch (error) {
      console.error('Error exporting public key:', error);
      throw error;
    }
  }

  const generateAndExportKeys = async () => {
    try {
      // Generate ECDH key pair
      const ecdhKeyPair = await generateKeyPairECDH();
      setEcdhPrivateKey(ecdhKeyPair.privateKey);
      setEcdhPublicKey(ecdhKeyPair.publicKey);
      console.log('Generated ECDH key pair:', ecdhKeyPair);

      // Generate ECDSA key pair
      const ecdsaKeyPair = await generateKeyPairECDSA();
      setEcdsaPrivateKey(ecdsaKeyPair.privateKey);
      setEcdsaPublicKey(ecdsaKeyPair.publicKey);
      console.log('Generated ECDSA key pair:', ecdsaKeyPair);

      // Export the public keys
      const exportedEcdhPublicKey = await exportKey(ecdhKeyPair.publicKey);
      const exportedEcdsaPublicKey = await exportKey(ecdsaKeyPair.publicKey);

      return {
        ecdhPublicKey: exportedEcdhPublicKey,
        ecdsaPublicKey: exportedEcdsaPublicKey
      };
    } catch (error) {
      console.error('Error generating and exporting keys:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting:', { username, email });

    try {
      //step1: generating two key pairs
      const keys = await generateAndExportKeys();

      //step2: sending two public keys to server together with username and email
      const data = {
        username,
        email,
        ecdhPublicKey: keys.ecdhPublicKey,
        ecdsaPublicKey: keys.ecdsaPublicKey
      };

      await axios.post('http://localhost:5001/sendKey', data);
      console.log('Public keys sent to server successfully');
    } catch (error) {
      console.error('Error sending public keys to server:', error);
    }
  };

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom className="title">
        New User Registration
      </Typography>
      <form onSubmit={handleSubmit} className="form">
        <FormControl required className="formControl">
          <InputLabel>Username</InputLabel>
          <Input
            placeholder="Enter your username"
            onChange={(e) => setUsername(e.target.value)}
          />
        </FormControl>
        <FormControl required className="formControl">
          <InputLabel>Email Address</InputLabel>
          <Input
            type="email"
            placeholder="Enter your email address"
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormControl>
        <Button type="submit" variant="contained" color="primary" className="button">
          Submit
        </Button>
      </form>
    </>
  );
}

export default App;
