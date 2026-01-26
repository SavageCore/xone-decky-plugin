/**
 * Screenshot cropping script for Xone Driver Manager
 *
 * Crops Steam Deck screenshots to show only the Decky plugin panel.
 *
 * Usage: pnpm run crop-screenshots
 *
 * Place raw Steam Deck screenshots in raw-screenshots/ folder.
 * Cropped images will be output to assets/ folder.
 */

import sharp from 'sharp'
import { readdirSync, existsSync, mkdirSync } from 'fs'
import { join, basename, extname, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Crop coordinates for 1280x800 Steam Deck screenshots
// These focus on the Decky plugin panel on the right side
const CROP_CONFIG = {
  left: 650, // Start from left edge of panel (including icon sidebar)
  top: 60, // Start below header/status bar completely
  width: 800, // Width of the cropped area (captures to right edge)
  height: 745 // Height to include footer with button prompts (800-55)
}

async function cropScreenshot (inputPath, outputPath) {
  try {
    const image = sharp(inputPath)
    const metadata = await image.metadata()

    console.log(`Processing: ${basename(inputPath)} (${metadata.width}x${metadata.height})`)

    // Adjust crop if image dimensions differ from expected
    let cropConfig = { ...CROP_CONFIG }

    // Handle different resolutions by scaling crop coordinates
    if (metadata.width !== 1280 || metadata.height !== 800) {
      const scaleX = metadata.width / 1280
      const scaleY = metadata.height / 800
      cropConfig = {
        left: Math.round(CROP_CONFIG.left * scaleX),
        top: Math.round(CROP_CONFIG.top * scaleY),
        width: Math.round(CROP_CONFIG.width * scaleX),
        height: Math.round(CROP_CONFIG.height * scaleY)
      }
      console.log(
        `  Scaled crop for ${metadata.width}x${metadata.height}: left=${cropConfig.left}, top=${cropConfig.top}, width=${cropConfig.width}, height=${cropConfig.height}`
      )
    }

    // Ensure crop doesn't exceed image bounds
    cropConfig.width = Math.min(cropConfig.width, metadata.width - cropConfig.left)
    cropConfig.height = Math.min(cropConfig.height, metadata.height - cropConfig.top)

    await image.extract(cropConfig).png().toFile(outputPath)

    console.log(`  Saved: ${basename(outputPath)}`)
    return true
  } catch (error) {
    console.error(`  Error processing ${basename(inputPath)}: ${error.message}`)
    return false
  }
}

async function main () {
  // Hardcoded paths
  const inputDir = join(__dirname, '..', 'raw-screenshots')
  const outputDir = join(__dirname, '..', 'assets')

  if (!existsSync(inputDir)) {
    console.error(`Error: Input directory not found: ${inputDir}`)
    console.log('Create raw-screenshots/ and add Steam Deck screenshots to crop.')
    process.exit(1)
  }

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }

  // Get all image files
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp']
  const files = readdirSync(inputDir).filter((file) =>
    imageExtensions.includes(extname(file).toLowerCase())
  )

  if (files.length === 0) {
    console.log('No image files found in input directory.')
    process.exit(0)
  }

  console.log(`Found ${files.length} image(s) to process\n`)
  console.log(
    `Crop config: left=${CROP_CONFIG.left}, top=${CROP_CONFIG.top}, width=${CROP_CONFIG.width}, height=${CROP_CONFIG.height}\n`
  )

  let successCount = 0
  for (const file of files) {
    const inputPath = join(inputDir, file)
    const outputName = basename(file, extname(file)) + '.png'
    const outputPath = join(outputDir, outputName)

    if (await cropScreenshot(inputPath, outputPath)) {
      successCount++
    }
  }

  console.log(`\nDone! ${successCount}/${files.length} images cropped successfully.`)
}

main().catch(console.error)
