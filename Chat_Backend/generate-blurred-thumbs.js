const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");

const inputDir = path.join(__dirname, "../Chat_Project/public/backgrounds");
const outputDir = path.join(__dirname, "../Chat_Project/public/backgrounds/thumbs");

const generateBlurredThumbs = async () => {
  await fs.ensureDir(outputDir);
  const files = (await fs.readdir(inputDir)).filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  for (const file of files) {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file.replace(/\.(jpg|jpeg|png)/i, ".webp"));

    try {
      await sharp(inputPath)
        .resize(50, 50)
        .blur()
        .webp({ quality: 40 })
        .toFile(outputPath);
      console.log("✔️ Oluşturuldu:", file);
    } catch (err) {
      console.error("❌ Hata:", file, err.message);
    }
  }
};

generateBlurredThumbs();
