// js/app.js
import { connexion, inscription, deconnexion, surveillerSession, sauvegarderProjet, chargerProjet } from './database.js';

// Données temporaires pour tester (ce sera remplacé par le vrai graphe plus tard)
let monScenario = {
    titre: "Test Projet",
    nodes: [{ id: 1, texte: "Début de l'histoire" }]
};

// --- GESTION DES BOUTONS ---

// Connexion
const btnLogin = document.getElementById('btn-login');
if(btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        try {
            await connexion(email, pass);
            alert("Connecté !");
        } catch (e) {
            alert("Erreur : " + e.message);
        }
    });
}

// Inscription
const btnSignup = document.getElementById('btn-signup');
if(btnSignup) {
    btnSignup.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        try {
            await inscription(email, pass);
            alert("Compte créé et connecté !");
        } catch (e) {
            alert("Erreur : " + e.message);
        }
    });
}

// Déconnexion
const btnLogout = document.getElementById('btn-logout');
if(btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await deconnexion();
        alert("Déconnecté");
    });
}

// Sauvegarder
const btnSave = document.getElementById('btn-save');
if(btnSave) {
    btnSave.addEventListener('click', async () => {
        try {
            // "MonScenario1" est le nom du fichier. Tu pourras mettre un champ input pour le choisir.
            await sauvegarderProjet("MonScenario1", monScenario);
            alert("Projet sauvegardé dans le cloud !");
        } catch (e) {
            alert("Erreur : " + e.message);
        }
    });
}

// Charger
const btnLoad = document.getElementById('btn-load');
if(btnLoad) {
    btnLoad.addEventListener('click', async () => {
        const data = await chargerProjet("MonScenario1");
        if (data) {
            monScenario = data;
            console.log("Données chargées :", monScenario);
            alert("Projet chargé ! Regarde la console (F12)");
        } else {
            alert("Aucune sauvegarde trouvée.");
        }
    });
}

// --- SURVEILLANCE DE L'ETAT ---
// Cette fonction s'exécute automatiquement quand l'utilisateur se connecte/déconnecte
surveillerSession((user) => {
    const infoUser = document.getElementById('user-info');
    if (user) {
        infoUser.innerText = "Connecté en tant que : " + user.email;
     // Ici on peut afficher les boutons de sauvegarde et cacher ceux de connexion    } else {
        infoUser.innerText = "Non connecté";
    }
});
