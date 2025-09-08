import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema({
  type: { type: String, enum: ["private", "group"], required: true },
  name: { type: String, default: "" },
  avatar: { type: String, default: "" },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      role: { type: String, enum: ["admin", "member"], default: "member" },
      joined_at: { type: Date, default: Date.now },
     // READ CURSOR:
      lastReadMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
      lastReadAt: { type: Date },
    }
  ],
  last_message: {
    message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    text: String,
    type: { type: String, enum: ["text", "image", "audio", "video", "call"] },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sent_at: Date,
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" }
  }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

ConversationSchema.index({ _id: 1, "members.user": 1 });

export default mongoose.model("Conversation", ConversationSchema);
