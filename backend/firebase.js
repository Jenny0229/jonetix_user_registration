const { initializeApp } = require("firebase/app");
const { getFirestore } = require("firebase/firestore");

//TODO: generate permissions.json from firebase console
const serviceAccount = require("./permissions.json");


const app = initializeApp(serviceAccount);
const db = getFirestore(app);


module.exports = db;