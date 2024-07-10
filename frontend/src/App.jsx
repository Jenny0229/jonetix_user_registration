import { useState, useEffect } from 'react';
import './App.css';
import { FormControl, InputLabel, Input, Button, Typography } from '@mui/material';
import axios from 'axios';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';



function App() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [registrationSuccess, setRegistrationSuccess] =  useState(false);


  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting:', { username, email });
    

    // GET registration options from the endpoint that calls
    // @simplewebauthn/server -> generateRegistrationOptions()
    const userObj = { // equivalent to UserModel for Typescript
      id: generateUniqueId(), // Unique identifier 
      username: username,
      email: email,
    }
    // pass in userObj since we are registering a new user
    const resp = await axios.get('http://localhost:5001/generate-registration-options', userObj);

    let attResp;
    try {
      // Pass the options to the authenticator and wait for a response
      attResp = await startRegistration(await resp.json());
    } catch (error) {
      // Some basic error handling
      if (error.name === 'InvalidStateError') {
        elemError.innerText = 'Error: Authenticator was probably already registered by user';
      } else {
        elemError.innerText = error;
      }

      throw error;
    }


    // POST the response to the endpoint that calls
    // @simplewebauthn/server -> verifyRegistrationResponse()
    try {
      const requestBody = {
        user: userObj,
        body: JSON.stringify(attResp)
      };
    
      const verificationResp = await axios.post('http://localhost:5001/verify-registration', requestBody);
    
      // Handle verification response as needed
      console.log('Verification response:', verificationResp.data);
    } catch (error) {
      // Handle errors, e.g., network errors or server errors
      console.error('Verification failed:', error);
    }

    // Wait for the results of verification
    const verificationJSON = await verificationResp.json();
    // Update in database for the logged in user
    if (verificationJSON && verificationJSON.verified) {
      setRegistrationSuccess(true);
      const requestBody = {
        user: userObj,
        body: verificationResp
      };
      await axios.post('http://localhost:5001/send-data', requestBody);
    }
  };

  // generate random unique id for userObj (UserModel for Typescript)
  function generateUniqueId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 15);
  }
  

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
        <Button type="submit" variant="contained" color="secondary" className="button">
          Submit
        </Button>
      </form>

      <div>
      {registrationSuccess ? (
        <div>
          <h2>Success!</h2>
          <p>Verification successful!</p>
        </div>
      ) : (
        <div>
          <h2>Oh no, something went wrong!</h2>
        </div>
      )}
      </div>

    </>
  );
}

export default App;
