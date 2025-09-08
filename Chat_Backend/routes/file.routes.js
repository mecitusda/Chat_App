import express from "express";
import s3 from "../config/s3.js"; // senin config dosyan
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();


function generateUniqueFilename() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Basit benzersiz ID: rastgele 6 haneli hex sayı
  const uniqueId = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");

  return `${year}-${month}-${day} saat ${hours}.${minutes}.${seconds}_${uniqueId}`;
}



const fType = (data) => {
 return  data.startsWith("image/")
  ? "images"
  : data.startsWith("video/")
  ? "videos"
  : data.startsWith("audio/")
  ? "audios"
  : "files";
}


router.get("/presigned-url/profile", async (req, res) => {
  try {
    const { user_id , fileType } = req.query;
    if (!user_id || !fileType) {
      return res.status(400).json({ error: "Eksik parametre" });
    }

    const key = `profile-images/${user_id}/${fType(fileType)}/${generateUniqueFilename()}.${fileType.split("/")[1]}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 saniye geçerli
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.json({ uploadURL, fileUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "URL alınamadı" });
  }
});

router.get("/presigned-url/group", async (req, res) => {
  try {
    const { fileType, conversationId } = req.query;
    if (!fileType || !conversationId) {
      return res.status(400).json({ error: "Eksik parametre" });
    }
    const key = `group-images/${conversationId}/${fType(fileType)}/${generateUniqueFilename()}.${fileType.split("/")[1]}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 saniye geçerli
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    return res.json({ uploadURL, fileUrl });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "URL alınamadı" });
  }
});

router.get("/presigned-url/message", async (req, res) => {
  try {
    const { conversationId, fileType } = req.query;
    
    if (!conversationId || !fileType) {
      return res.status(400).json({ error: "Eksik parametre" });
    }
    const key = `conversations/${conversationId}/${fType(fileType)}/${generateUniqueFilename()}.${fileType.split("/")[1]}`;
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });
    const uploadURL = await getSignedUrl(s3, command, { expiresIn: 60 }); // 60 saniye geçerli
    const mediaKey = key;

    return res.json({ uploadURL, mediaKey });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "URL alınamadı" });
  }
});


router.get("/presigned-url/file", async (req, res) => {//bu routera yetki koyucazki herkes alamasın signature.hepsine koyulcak ama bu öncelikli
  const mediaKey = req.query.mediaKey;
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${mediaKey}`,
  });
  try{
     const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 saat geçerli
  return res.json({ url });
  }catch(error){
    console.error(error);
    return res.status(500).json({ error: "URL alınamadı" });
  }
});


// POST 

router.post("/presigned-url/files", async (req, res) => {//bu routera yetki koyucazki herkes alamasın signature.hepsine koyulcak ama bu öncelikli
  const {mediaKeys} = req.body;
  console.log(mediaKeys)
  try{
    const urls = await Promise.all(
  mediaKeys.map(async (media_key) => {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: media_key,
    });
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    return { media_key, media_url:url };
  })
);
     
  return res.json(urls);
  }catch(error){
    console.error(error);
    return res.status(500).json({ error: "URL alınamadı" });
  }
});


export default router;
