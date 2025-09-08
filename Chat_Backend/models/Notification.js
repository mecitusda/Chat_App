import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["message", "call"], required: true },
  data: { type: Object, default: {} },
  read: { type: Boolean, default: false }
}, { timestamps: { createdAt: "created_at" } });

NotificationSchema.index({ user_id: 1, read: 1 });

export default mongoose.model("Notification", NotificationSchema);
