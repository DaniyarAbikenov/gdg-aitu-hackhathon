import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCmjdUkxtPmDxlpPt8iqvtEzSoRAAAfuzk",
    authDomain: "gdg-hackathon-aitu.firebaseapp.com",
    projectId: "gdg-hackathon-aitu",
    storageBucket: "gdg-hackathon-aitu.firebasestorage.app",
    messagingSenderId: "56998693149",
    appId: "1:56998693149:web:f0efccb166d3d17c7339f4",
    measurementId: "G-RSE11PRH3X"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
