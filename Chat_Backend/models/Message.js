import mongoose from "mongoose";
import { getSignedUrlFromStorage } from "../utils/storage.js";

const ObjectId = mongoose.Schema.Types.ObjectId;

const MessageSchema = new mongoose.Schema({
  conversation: { type: ObjectId, ref: "Conversation", required: true },
  sender: { type: ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["text", "image", "video", "file", "call", "system"], required: true },

  // text mesajı
  text: {type:String},

  // medya bilgileri
  media_key: { type: String, default: "" },
  media_url: { type: String, default: "" },
  media_url_expiresAt: { type: Date, default: null },
  mimetype: String,
  size: Number,
  media_duration: Number,

  // call info
  call_info: mongoose.Schema.Types.Mixed,

  // teslim ve okuma bilgileri
  deliveredTo: [
    {
      user: { type: ObjectId, ref: "User", index: true },
      at: { type: Date, default: Date.now }
    }
  ],
  readBy: [
    {
      user: { type: ObjectId, ref: "User", index: true },
      at: { type: Date, default: Date.now }
    }
  ]
}, { timestamps: true, versionKey: false });

// 🔎 Indexler
MessageSchema.index({ conversation: 1, _id: 1 });
MessageSchema.index({ conversation: 1, createdAt: 1 });
MessageSchema.index({ conversation: 1, "deliveredTo.user": 1 });
MessageSchema.index({ conversation: 1, "readBy.user": 1 });


// ✅ Presigned url kontrol eden method
MessageSchema.methods.getMediaUrl = async function () {
  const now = new Date();
  if (this.media_url && this.media_url_expiresAt && this.media_url_expiresAt > now) {
    return this.media_url; // hala geçerli
  }

  if (!this.media_key) return null; // medya yok

  // yeni presigned url üret
  const newUrl = await getSignedUrlFromStorage(this.media_key);
  this.media_url = newUrl;
  this.media_url_expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 10 dk geçerli
  await this.save();

  return newUrl;
};


// ✅ JSON’a dönüştürülürken otomatik media_url ekle
MessageSchema.set("toJSON", {
  transform: function (doc, ret) {
    delete ret.media_key;          // frontend görmesin
    return ret;
  }
});

export default mongoose.model("Message", MessageSchema);
