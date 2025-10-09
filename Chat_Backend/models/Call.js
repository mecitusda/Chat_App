import mongoose from "mongoose";

const ParticipantSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  direction:  { type: String, enum: ["incoming", "outgoing"], required: true },
  joined_at:  { type: Date, default: Date.now },
  left_at:    { type: Date },
}, { _id: false });

const CallSchema = new mongoose.Schema({
  conversation_id: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
  caller_id:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  participants:    [ParticipantSchema], // 👈 Artık direction kişi bazlı
  call_type:       { type: String, enum: ["audio", "video"], required: true },
  started_at:      { type: Date, default: Date.now },
  ended_at:        Date,
  duration:        { type: Number, default: 0 },
  status:          { type: String, enum: ["ongoing", "missed", "ended"], default: "ongoing" },
});

export default mongoose.model("Call", CallSchema);
