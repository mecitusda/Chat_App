import mongoose from "mongoose";
import { getSignedUrlFromStorage } from "../utils/storage.js";
import { type } from "os";

const ConversationSchema = new mongoose.Schema({
  type: { type: String, enum: ["private", "group"], required: true },
  name: { type: String, default: "" },

  avatar: {
    key: { type: String, default: "" },
    url: { type: String, default: "" },
    url_expiresAt: { type: Date, default: null },
  },

  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      role: { type: String, enum: ["admin", "member"], default: "member" },
      joined_at: { type: Date, default: Date.now },
      lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
      lastReadAt: { type: Date },
      unread: { type:Number, default:0 }
    },
  ],

  last_message: {
    message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    text: String,
    type: { type: String, enum: ["text", "image", "audio", "video", "call"] },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sent_at: Date,
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
  },
  active_call: { type: mongoose.Schema.Types.ObjectId, ref: "Call", default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

ConversationSchema.index({ _id: 1, "members.user": 1 });


// ✅ Tek conversation için avatar kontrolü
ConversationSchema.methods.getAvatarUrl = async function () {
  const now = new Date();

  if (this.avatar.url && this.avatar.url_expiresAt && this.avatar.url_expiresAt > now) {
    return this.avatar.url;
  }

  if (!this.avatar.key) return null;

  const newUrl = await getSignedUrlFromStorage(this.avatar.key);

  this.avatar.url = newUrl;
  this.avatar.url_expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 10 dk
  await this.save();

  return this.avatar;
};


// ✅ Birden fazla conversation için helper
ConversationSchema.statics.refreshAvatars = async function (conversations) {
  const now = new Date();

  return Promise.all(conversations.map(async (conv) => {
    if (conv.avatar?.key) {
      if (!conv.avatar.url_expiresAt || new Date(conv.avatar.url_expiresAt) <= now) {
        const newUrl = await getSignedUrlFromStorage(conv.avatar.key);
        conv.avatar.url = newUrl;
        conv.avatar.url_expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await conv.save();
      }
    }
    return conv;
  }));
};


// ✅ JSON dönüşümünde gizleme
ConversationSchema.set("toJSON", {
  transform: function (doc, ret) {
    if (ret.avatar) {
      delete ret.avatar.key;
      delete ret.avatar.url_expiresAt;
    }
    return ret;
  }
});

export default mongoose.model("Conversation", ConversationSchema);
