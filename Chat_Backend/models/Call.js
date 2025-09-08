import mongoose from "mongoose";

const CallSchema = new mongoose.Schema({
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  caller_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  call_type: { type: String, enum: ["audio", "video"], required: true },
  started_at: { type: Date, default: Date.now },
  ended_at: Date,
  status: { type: String, enum: ["missed", "ended"], default: "ended" }
});

export default mongoose.model("Call", CallSchema);
