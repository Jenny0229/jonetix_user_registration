import { useState, useEffect } from 'react';
import { FormControl, InputLabel, Input, Button, Typography } from '@mui/material';
import axios from 'axios';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';



function Login() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [registrationSuccess, setRegistrationSuccess] =  useState(null);
  const [error, setError] = useState('');
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    return () => {
      // Clean up state when component unmounts
      setFlag(false);
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Submitting:', { username, email });
    

    // GET authentication options from the endpoint that calls
    // @simplewebauthn/server -> generateAuthenticationOptions()
    const userObj = { // equivalent to UserModel for Typescript
      //id: generateUniqueId(), // Unique identifier 
      username: username,
      email: email,
    }
    console.log(userObj);
    // pass in userObj since we are registering a new user
    const resp = await axios.post('http://localhost:5001/generate-authentication-options', userObj);

    console.log('received authentication options from server', resp.data);

    let asseResp;
    try {
      // Pass the options to the authenticator and wait for a response
      asseResp = await startAuthentication(resp.data);
    } catch (error) {
      // Some basic error handling
      if (error.name === 'InvalidStateError') {
        setError('Error: Authenticator was probably already registered by user');
      } else {
        setError(error.message);
      }

      throw error;
    }

    let verificationResp;
    // POST the response to the endpoint that calls
    // @simplewebauthn/server -> verifyAuthenticationResponse()
    try {
      verificationResp = await axios.post('http://localhost:5001/verify-authentication', asseResp);
    
      // Handle verification response as needed
      console.log('Verification response:', verificationResp.data);
    } catch (error) {
      setFlag(true);
      // Handle errors, e.g., network errors or server errors
      console.error('Verification failed:', error);
    }

    // Update in database for the logged in user
    if (verificationResp.data && verificationResp.data.verified) {
      setFlag(true);
      console.log('registration success');
      setRegistrationSuccess(true);
    }
  };

  return (
    <>
    
      <Typography variant="h4" component="h1" gutterBottom className="title">
        User Login
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
      {flag && (
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
      )}
      </div>

    </>
  );
}

export default Login;
