#!/usr/bin/env bun
import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

async function optimizeLogo() {
  const inputPath = join(process.cwd(), 'public/logo.png');
  const outputPath = join(process.cwd(), 'public/logo.webp');

  console.log('📸 Optimizing logo...');

  const inputStats = statSync(inputPath);
  console.log(`Original size: ${(inputStats.size / 1024).toFixed(2)} KB`);

  // Convert to WebP with quality optimization
  await sharp(inputPath)
    .resize(512, 512, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .webp({
      quality: 90,
      alphaQuality: 100,
      effort: 6
    })
    .toFile(outputPath);

  const outputStats = statSync(outputPath);
  console.log(`Optimized size: ${(outputStats.size / 1024).toFixed(2)} KB`);
  console.log(`Savings: ${((1 - outputStats.size / inputStats.size) * 100).toFixed(1)}%`);
  console.log('✅ Logo optimization complete!');
}

optimizeLogo().catch(console.error);
