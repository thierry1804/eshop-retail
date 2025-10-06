#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

console.log('🔧 Configuration du fichier .env pour TikTok Live Server');
console.log('');

// Vérifier si le fichier .env existe déjà
if (fs.existsSync(envPath)) {
  console.log('✅ Le fichier .env existe déjà');
  console.log('📄 Contenu actuel:');
  console.log('─'.repeat(50));
  console.log(fs.readFileSync(envPath, 'utf8'));
  console.log('─'.repeat(50));
  console.log('');
  console.log('💡 Si vous voulez le modifier, éditez le fichier:', envPath);
  process.exit(0);
}

// Lire le fichier d'exemple
if (!fs.existsSync(envExamplePath)) {
  console.error('❌ Le fichier env.example n\'existe pas');
  process.exit(1);
}

const envExample = fs.readFileSync(envExamplePath, 'utf8');

// Demander le nom d'utilisateur TikTok
console.log('📱 Configuration du nom d\'utilisateur TikTok');
console.log('');
console.log('ℹ️  Le nom d\'utilisateur doit être:');
console.log('   - Exact (sans @)');
console.log('   - Le nom d\'utilisateur public du compte TikTok');
console.log('   - Exemple: si l\'URL est @moncompte, utilisez "moncompte"');
console.log('');

// En mode interactif, on pourrait demander à l'utilisateur
// Pour l'instant, on crée un fichier avec un placeholder
const envContent = envExample.replace('ton_username_sans_@', 'VOTRE_USERNAME_ICI');

fs.writeFileSync(envPath, envContent);

console.log('✅ Fichier .env créé avec succès!');
console.log('📄 Fichier créé:', envPath);
console.log('');
console.log('⚠️  IMPORTANT: Éditez le fichier .env et remplacez "VOTRE_USERNAME_ICI" par votre vrai nom d\'utilisateur TikTok');
console.log('');
console.log('📋 Étapes suivantes:');
console.log('   1. Ouvrez le fichier .env');
console.log('   2. Remplacez "VOTRE_USERNAME_ICI" par votre nom d\'utilisateur TikTok');
console.log('   3. Redémarrez le serveur avec: npm run dev');
console.log('');
console.log('💡 Pour tester la connexion:');
console.log('   - Lancez un live sur votre compte TikTok');
console.log('   - Le serveur se connectera automatiquement');
console.log('   - Visitez http://localhost:3001/status pour voir le statut');
