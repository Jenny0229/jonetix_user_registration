import { useState } from 'react'
import './App.css'
import { FormControl, Input, InputLabel, Button } from '@mui/material';
import crypto from 'crypto';


function App() {
  const [message, setMessage] = useState("");
  // raw TS
  const [time, setTime] = useState(null);
  // 8B TS (useful with digital signature)
  const [eightByteTs, setEightByteTs] = useState(null);
  // 32B SHA256 TS (useful with AES 256)
  const [encryptTs, setEncryptTs] = useState(null);

  // gets the current UTC time
  const handleSubmit = (e) => {
    e.preventDefault();
    const utcTime = new Date().getTime();
    const timeArray = getTimeByteArray(utcTime);
    const prngArray = getRandomByteArray();
    const concatenatedArray = concatArrays(timeArray, prngArray);
    const sha256Hash = getSHA256Hash(concatenatedArray);

    setTime(utcTime);
    setEightByteTs(timeArray);
    setEncryptTs(sha256Hash);
  };

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
