import express from "express";
const router = express.Router();
import Call from "../models/Call.js"


router.get("/conversationId/:id",  async (req, res) => {
  try {
    const call = await Call.findById(req.params.id).select("conversation_id");
    if (!call) return res.status(404).json({ success: false, message: "Call not found" });
    res.json({ success: true, conversationId:call.conversation_id});
  } catch (err) {
    console.error("GET /call/:id error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
})
router.get("/:id", async (req, res) => {
  try {
    const call = await Call.findById(req.params.id).select("conversation_id");
    if (!call) return res.status(404).json({ success: false, message: "Call not found" });
    res.json({ success: true, call});
  } catch (err) {
    console.error("GET /call/:id error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


export default router;
