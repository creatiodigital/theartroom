#!/usr/bin/env node
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { existsSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const spacesDir = resolve(__dirname, '..', 'public', 'assets', 'spaces');
const models = ['classic.glb', 'modern.glb'];

/**
 * Format file size in human-readable format
 */
function formatSize(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

/**
 * Compress a GLB model using gltf-transform CLI with KTX2 UASTC encoding.
 * Requires:
 * - ktx (KTX-Software) installed on the system
 */
async function compressModel(filename) {
  const filePath = resolve(spacesDir, filename);
  const backupPath = resolve(spacesDir, `${filename}.backup`);
  
  console.log(`\nProcessing: ${filename}`);
  
  if (!existsSync(filePath)) {
    console.error(`✗ File not found: ${filePath}`);
    return;
  }

  const originalSize = statSync(filePath).size;
  console.log(`  Original size: ${formatSize(originalSize)}`);

  try {
    // Create a backup first
    console.log(`  Creating backup...`);
    execSync(`cp "${filePath}" "${backupPath}"`, { stdio: 'pipe' });

    // Use gltf-transform CLI to compress textures to KTX2 with UASTC
    console.log(`  Compressing textures with UASTC...`);
    execSync(
      `npx @gltf-transform/cli uastc "${filePath}" "${filePath}" --level 2 --zstd 18`,
      { 
        stdio: 'inherit',
        cwd: spacesDir
      }
    );

    const newSize = statSync(filePath).size;
    const reduction = ((originalSize - newSize) / originalSize * 100).toFixed(1);
    console.log(`  New size: ${formatSize(newSize)} (${reduction}% reduction)`);
    console.log(`✓ Compressed: ${filename}`);
    
    // Remove backup on success
    if (existsSync(backupPath)) {
      execSync(`rm "${backupPath}"`, { stdio: 'pipe' });
    }
  } catch (error) {
    console.error(`✗ Failed to compress ${filename}:`, error.message);
    
    // Restore backup on failure
    if (existsSync(backupPath)) {
      console.log(`  Restoring backup...`);
      execSync(`mv "${backupPath}" "${filePath}"`, { stdio: 'pipe' });
    }
  }
}

(async () => {
  console.log('Starting KTX2 compression with UASTC...');
  console.log('Models directory:', spacesDir);
  console.log('\nNote: This requires ktx CLI tool to be installed on your system.');
  
  // Check if ktx is available
  try {
    execSync('which ktx', { stdio: 'pipe' });
    console.log('✓ ktx CLI found');
  } catch {
    console.error('✗ ktx CLI not found. Please install KTX-Software:');
    console.error('  brew install ktx (on macOS)');
    console.error('  Or download from: https://github.com/KhronosGroup/KTX-Software/releases');
    process.exit(1);
  }

  for (const model of models) {
    await compressModel(model);
  }

  console.log('\n✓ All models processed!');
})();
