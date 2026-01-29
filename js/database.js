// js/database.js

// 1. Importation des modules Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. Configuration de Firebase
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
        const contenu = data.contenu || {};
        
        // Les slides sont dans contenu.slides
        let slides = contenu.slides || [];
        
        // Firebase peut convertir les arrays en objets, on reconvertit si besoin
        if (slides && !Array.isArray(slides)) {
            slides = Object.values(slides);
        }
        
        // Pareil pour les elements de chaque slide
        slides = slides.map(slide => {
            if (slide && slide.elements && !Array.isArray(slide.elements)) {
                slide.elements = Object.values(slide.elements);
            }
            return slide;
        });
        
        projets.push({ 
            firebaseId: doc.id, 
            name: data.nom,
            updatedAt: data.updatedAt || new Date().toISOString(),
            slides: slides
        });
    });
    return projets;
}

// Supprime un projet
export async function supprimerProjetCloud(firebaseId) {
     await deleteDoc(doc(db, "projets", firebaseId));
}

// Renomme un projet (supprime l'ancien et crée un nouveau car l'ID contient le nom)
export async function renommerProjet(ancienFirebaseId, nouveauNom) {
    const user = auth.currentUser;
    if (!user) throw new Error("Tu dois être connecté !");
    
    // Récupérer l'ancien projet
    const ancienDoc = await getDoc(doc(db, "projets", ancienFirebaseId));
    if (!ancienDoc.exists()) throw new Error("Projet introuvable");
    
    const data = ancienDoc.data();
    
    // Créer le nouveau document avec le nouveau nom
    const nouveauDocId = user.uid + "_" + nouveauNom.replace(/\s/g, '');
    
    // Mettre à jour le nom dans le contenu aussi
    const contenu = data.contenu || {};
    contenu.name = nouveauNom;
    
    await setDoc(doc(db, "projets", nouveauDocId), {
        uid: user.uid,
        auteur: user.email,
        nom: nouveauNom,
        contenu: contenu,
        updatedAt: new Date().toISOString()
    });
    
    // Supprimer l'ancien document
    await deleteDoc(doc(db, "projets", ancienFirebaseId));
    
    return nouveauNom;
}
