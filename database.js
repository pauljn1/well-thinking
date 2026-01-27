// js/database.js

// 1. Imports complets (Auth + Firestore + Outils de requête)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Ta configuration (Celle que tu m'as envoyée)
const firebaseConfig = {
  apiKey: "AIzaSyBZIPI67Aey0lOGUUHI-8ilWY1w4zJaXkg",
  authDomain: "diapodynamique.firebaseapp.com",
  projectId: "diapodynamique",
  storageBucket: "diapodynamique.firebasestorage.app",
  messagingSenderId: "654352766968",
  appId: "1:654352766968:web:2b2e4faf15bec9422ee80d",
  measurementId: "G-QBL1K655BN"
};

// Initialisation
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- FONCTIONS UTILISATEURS ---

export async function inscription(email, password) {
    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) {
        throw error;
    }
}

export async function connexion(email, password) {
    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) {
        throw error;
    }
}

export function deconnexion() {
    return signOut(auth);
}

export function surveillerSession(callback) {
    onAuthStateChanged(auth, callback);
}

// --- FONCTIONS PROJETS (SAUVEGARDE & CHARGEMENT) ---

export async function sauvegarderProjet(nomProjet, dataJson) {
    const user = auth.currentUser;
    if (!user) throw new Error("Tu dois être connecté pour sauvegarder !");

    // Création d'un ID unique
    const docId = user.uid + "_" + nomProjet.replace(/\s/g, '');

    await setDoc(doc(db, "projets", docId), {
        uid: user.uid, 
        auteur: user.email,
        nom: nomProjet,
        contenu: dataJson,
        updatedAt: new Date().toISOString() // Ajout de la date pour l'affichage
    });
}

export async function chargerProjet(nomProjet) {
    const user = auth.currentUser;
    if (!user) return null;

    const docId = user.uid + "_" + nomProjet.replace(/\s/g, '');
    const docSnap = await getDoc(doc(db, "projets", docId));

    if (docSnap.exists()) {
        return docSnap.data().contenu;
    } else {
        return null;
    }
}

// --- FONCTIONS MANQUANTES (C'est ça qui bloquait ta Home) ---

// Récupère la liste de tous les projets de l'utilisateur connecté
export async function recupererMesProjets() {
    const user = auth.currentUser;
    if (!user) return [];

    // On cherche dans la collection "projets" tous les documents où uid == ID de l'utilisateur
    const q = query(collection(db, "projets"), where("uid", "==", user.uid));
    const querySnapshot = await getDocs(q);
    
    let projets = [];
    querySnapshot.forEach((doc) => {
        // On récupère les données
        const data = doc.data();
        projets.push({ 
            firebaseId: doc.id, 
            name: data.nom,
            updatedAt: data.updatedAt || new Date().toISOString(),
            // On récupère les slides pour l'aperçu, ou un tableau vide si erreur
            slides: data.contenu && data.contenu.nodes ? [] : (data.contenu || []) // Adaptation selon ton format JSON
        });
    });
    return projets;
}

// Supprime un projet
export async function supprimerProjetCloud(firebaseId) {
     await deleteDoc(doc(db, "projets", firebaseId));
}