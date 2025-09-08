import mongoose from "mongoose";
const ObjectId = mongoose.Schema.Types.ObjectId
const MessageSchema = new mongoose.Schema({
  conversation: { type: ObjectId, ref: "Conversation", required: true },
  sender: { type: ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["text", "image", "video", "file", "call", "system"], required: true },
  text: String,
  media_key: String,
  mimetype: String,   // öneri
  size: Number,       // öneri
  media_duration: Number,
  call_info: mongoose.Schema.Types.Mixed,
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

MessageSchema.index({ conversation: 1, _id: 1 });
MessageSchema.index({ conversation: 1, createdAt: 1 });
MessageSchema.index({ conversation: 1, "deliveredTo.user": 1 });
MessageSchema.index({ conversation: 1, "readBy.user": 1 });
export default mongoose.model("Message", MessageSchema);
