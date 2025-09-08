import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  avatar: { type: String, default: "" },
  status: { type: String, enum: ["Online", "Offline", "Busy"], default: "Offline" },
  last_seen: { type: Date, default: Date.now },
  settings: {
    theme: { type: String, enum: ["light", "dark"], default: "light" },
    notifications: { type: Boolean, default: true }
  }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true });

export default mongoose.model("User", UserSchema);