function byteArrayToBigInt(byteArray) {
    let hexString = '0x'; 
    byteArray.forEach(byte => {
        //toString: turn the byte base 16
        //padStart: if not 2 bits, make it 2 bits(One byte is 8 bits, so maximum ff in base 16) by adding a zero in the front
      hexString += byte.toString(16).padStart(2, '0');
    });
    return BigInt(hexString);
  }


function bigIntToByteArray(bigInt) {
//transfer the integer to base 16
let hexString = bigInt.toString(16);
// Ensure the hex string has an even number of characters
if (hexString.length % 2) {
    hexString = '0' + hexString;
}

const byteArray = [];
for (let i = 0; i < hexString.length; i += 2) {
    //parseInt: given a string and a base x, return an integer in base x
    byteArray.push(parseInt(hexString.slice(i, i + 2), 16));
}

return byteArray;
}

/*Base 64: 
    eg. hello
    01001000 01100101 01101100 01101100 01101111 //transform to binary using ASCII
    010010 000110 010101 101100 011011 000110 111= //group every 6 bits for base 64
    18 6 21 44 27 6 60 //to decimal
    SGVsbG8 //to base 64
*/

/*
ASCII: 0-127(one byte) A subset of UTF-8
UTF-8: unicode(maximum four bytes = 4*8=32bits) as long as we need; compatible with ASCII
UTF-16: either 2 bytes or 4 bytes)
*/


// Byte Array to Base 64 URL safe
function byteArrayToBase64URL(byteArray) {
    // Convert byte array to binary string
    let binaryString = '';
    byteArray.forEach(byte => {
      //fromCharCode: transformaing byte to UTF-16
      binaryString += String.fromCharCode(byte);
    });
  
    // Creates a Base64 string from a binary string(a string in which each character in the string is treated as a byte of binary data) i.e. hello -> SGVsbG8
    let base64String = btoa(binaryString);
  
    // Make the Base64 string URL safe
    let base64URL = base64String
      .replace(/\+/g, '-') // Replace + with -
      .replace(/\//g, '_') // Replace / with _
      .replace(/=+$/, ''); // Remove padding characters
  
    return base64URL;
  }

  const base64URLToByteArray = (base64URL) => {
    let base64String = base64URL
      .replace(/-/g, '+') // Replace - with +
      .replace(/_/g, '/'); // Replace _ with /
  
    // Add padding characters if necessary
    while (base64String.length % 4) {
      base64String += '=';
    }
  
    // Convert Base64 string to binary string using atob
    let binaryString = atob(base64String);
  
    // Convert binary string to byte array
    let byteArray = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      byteArray[i] = binaryString.charCodeAt(i);
    }
  
    return byteArray;
  };

  // Function to convert byte array to hexadecimal string
function byteArrayToHexString(byteArray) {
    return Array.from(byteArray)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  
  // Function to convert hexadecimal string to byte array
  function hexStringToByteArray(hexString) {
    let result = [];
    for (let i = 0; i < hexString.length; i += 2) {
      result.push(parseInt(hexString.substr(i, 2), 16));
    }
    return new Uint8Array(result);
  }