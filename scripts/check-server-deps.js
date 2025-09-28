import { existsSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const serverPath = join(projectRoot, 'server');

console.log('🔍 Vérification des dépendances du serveur TikTok...');

// Vérifier si le dossier server existe
if (!existsSync(serverPath)) {
  console.error('❌ Le dossier server n\'existe pas');
  process.exit(1);
}

// Vérifier si package.json du serveur existe
const serverPackageJson = join(serverPath, 'package.json');
if (!existsSync(serverPackageJson)) {
  console.error('❌ Le fichier server/package.json n\'existe pas');
  process.exit(1);
}

// Vérifier si node_modules du serveur existe
const serverNodeModules = join(serverPath, 'node_modules');
if (!existsSync(serverNodeModules)) {
  console.log('📦 Installation des dépendances du serveur...');
  try {
    execSync('npm install', { 
      cwd: serverPath, 
      stdio: 'inherit' 
    });
    console.log('✅ Dépendances du serveur installées');
  } catch (error) {
    console.error('❌ Erreur lors de l\'installation des dépendances du serveur:', error.message);
    process.exit(1);
  }
} else {
  console.log('✅ Dépendances du serveur déjà installées');
}

// Vérifier si le fichier .env existe
const serverEnv = join(serverPath, '.env');
if (!existsSync(serverEnv)) {
  console.log('⚠️  Le fichier server/.env n\'existe pas');
  console.log('📝 Création du fichier .env à partir de env.example...');
  
  try {
    const envExample = join(serverPath, 'env.example');
    if (existsSync(envExample)) {
      copyFileSync(envExample, serverEnv);
      console.log('✅ Fichier .env créé');
      console.log('⚠️  Veuillez éditer server/.env avec vos paramètres TikTok');
    } else {
      console.error('❌ Le fichier env.example n\'existe pas');
    }
  } catch (error) {
    console.error('❌ Erreur lors de la création du fichier .env:', error.message);
  }
} else {
  console.log('✅ Fichier .env du serveur trouvé');
}

console.log('🚀 Serveur TikTok prêt à démarrer');
