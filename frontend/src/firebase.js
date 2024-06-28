// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBOnS8UOhV3OzNEuwkcG1awLg-0F5BS07Y",
    authDomain: "jonetix-user-registratio-1f42d.firebaseapp.com",
    projectId: "jonetix-user-registratio-1f42d",
    storageBucket: "jonetix-user-registratio-1f42d.appspot.com",
    messagingSenderId: "913528661155",
    appId: "1:913528661155:web:489f379906314abe808b16"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };