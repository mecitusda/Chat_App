import mongoose from "mongoose";
import { getSignedUrlFromStorage } from "../utils/storage.js";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  about: {type: String,require: false, default:"Sadece acil aramalar."},
  password_hash: { type: String, required: true },
  avatar: {
    key:{ type: String, default: "" },
    url: { type: String, default: "" },
    url_expiresAt: { type: Date, default: null }
  },
  phone: { type: String, require:true},
  status: { type: String, enum: ["Online", "Offline", "Busy"], default: "Offline" },
  last_seen: { type: Date, default: Date.now },
  settings: {
    theme: { type: String, enum: ["light", "dark"], default: "light" },
    notifications: { type: Boolean, default: true },
    chatBgImage: {type: String, default: null },
    chatBgColor : {type: String, default: "#1C1C1C"  },
  },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  friend_requests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  verifyCode: { type: String }, // 6 haneli kod
  verifyCodeExpires: { type: Date }, // kod geçerlilik süresi
  emailVerified: {type: Boolean }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });
  
UserSchema.set("toJSON", {
  transform: async function (doc, ret) {
    if (doc.getAvatarUrl) {
      const avatarUrl = await doc.getAvatarUrl();
      ret.avatar.url = avatarUrl;
    }
    return ret;
  }
});



UserSchema.methods.getAvatarUrl = async function () {
  const now = new Date();
  if (this.avatar.url && this.avatar.url_expiresAt && this.avatar.url_expiresAt > now) {
    return this.avatar.url; // hala geçerli
  }

  if (!this.avatar.key) return null; // avatar yok
  // yeni presigned url üret
  const newUrl = await getSignedUrlFromStorage(this.avatar.key);

  this.avatar.url = newUrl;
  this.avatar.url_expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 10 dk geçerli
  await this.save();
  return {url:newUrl,url_expiresAt:this.avatar.url_expiresAt};
};

UserSchema.set("toJSON", {
  transform: function (doc, ret) {
    // avatar bazen string olarak geliyor, güvenli hale getirelim
    if (!ret.avatar || typeof ret.avatar !== "object") {
      ret.avatar = {};
    }

    // sadece gerekli alanları bırak
    if (ret.avatar.url) {
      ret.avatar = {
        url: ret.avatar.url,
        url_expiresAt: ret.avatar.url_expiresAt || null,
      };
    } else {
      ret.avatar = null;
    }

    return ret;
  },
});


UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("User", UserSchema);