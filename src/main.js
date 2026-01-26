import { CodeGenerator } from './modules/generator.js';

// --- BOUCHON (STUB) ---
// En attendant que le binôme "Graphique" finisse son module,
// on utilise des données de test (Mock data).
const mockGraphData = {
    nodes: [
        { id: 1, type: 'start', content: 'Bienvenue dans la taverne !' },
        { id: 2, type: 'end', content: 'Au revoir.' }
    ],
    links: [
        { from: 1, to: 2 }
    ]
};

const btn = document.getElementById('btn-generate');
const output = document.getElementById('python-output');

btn.addEventListener('click', () => {
    console.log("Génération en cours...");
    
    // Appel du module de génération
    const generatedCode = CodeGenerator.generatePython(mockGraphData);
    
    // Affichage
    output.textContent = generatedCode;
    output.style.color = "#00ff00"; // Petit effet "hacker"
});