// routes/auth.routes.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import User from "../models/Users.js";
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();

// Register
router.post("/register", async (req, res) => {
  try {
    console.log("girdi")
    const { username, email, password } = req.body;
    console.log(username, email, password);
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) return res.status(400).json({ error: "Kullanıcı zaten var" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password_hash: hashedPassword
    });

    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "Kullanıcı bulunamadı" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Şifre hatalı" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ success: true, token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.patch("/profile", /*auth,*/ async (req, res) => {
  try {
    const { user_id, username, about, avatar } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: "user_id gerekli" });

    const payload = {};
    if (typeof username === "string") payload.username = username.trim();
    if (typeof about === "string") payload.about = about.trim();
    if (typeof avatar === "string") payload.avatar = avatar;

    if (!Object.keys(payload).length) {
      return res.status(400).json({ success: false, message: "Güncellenecek alan yok" });
    }

    const updated = await User.findByIdAndUpdate(
      user_id,
      { $set: payload, $currentDate: { updated_at: true } },
      { new: true, projection: { password_hash: 0, __v: 0 } }
    );

    if (!updated) return res.status(404).json({ success: false, message: "Kullanıcı bulunamadı" });

    res.json({ success: true, user: updated });
  } catch (err) {
    console.error("profile patch error:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

router.put("/settings",async (req,res) => {
  const {theme, notifications, chatBgImage, chatBgColor, userId} = req.body;
  try{
    console.log("image:",chatBgImage)
    const user = await User.findByIdAndUpdate(userId,{
     $set: {
      "settings.chatBgImage": chatBgImage,
      "settings.chatBgColor": chatBgColor,
      "settings.notifications":notifications,
      "settings.theme":theme
    }
  },{new:true});
  
  if(!user){
    return res.json({error:"Ayarlar güncellenemedi."});
  }
  console.log("döndü:",user)

  res.json({
    success:true,
    user:{_id: user._id , settings: user.settings}
  })

  }catch(err){
    console.log("/settings API Error!")
    res.json({error:err.message})
  }

})

export default router;
