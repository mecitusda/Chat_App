import express from "express";
const router = express.Router();
import Call from "../models/Call.js"
import Conversation from "../models/Conversation.js";

// GET

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

router.get("/participants/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const calls = await Call.find({ participants: userId })
      .populate("caller_id", "username avatar")
      .populate("participants", "username avatar")
      .sort({ started_at: -1 });

    return res.json({ success: true, calls });
  } catch (err) {
    console.error("getUserCalls error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
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

// POST

router.post("/join", async (req, res) => {
  try {
    const { conversationId, callerId, callType } = req.body;

    const conv = await Conversation.findById(conversationId);
    if (!conv) {
      return res
        .status(404)
        .json({ success: false, message: "Conversation not found" });
    }

    if (conv.active_call) {
      const activeCall = await Call.findById(conv.active_call);
      if (activeCall && !activeCall.ended_at) {
        const participantIndex = activeCall.participants.findIndex(
          (p) => String(p.user) === String(callerId)
        );

        if (participantIndex >= 0) {
      
          activeCall.participants[participantIndex].left_at = null;
          activeCall.participants[participantIndex].joined_at = new Date();
        } else {

          activeCall.participants.push({
            user: callerId,
            direction: "incoming",
            joined_at: new Date(),
          });
        }

        await activeCall.save();
        return res.json({ success: true, call: activeCall });
      }
    }


    const newCall = await Call.create({
      conversation_id: conversationId,
      caller_id: callerId,
      participants: [
        {
          user: callerId,
          direction: "outgoing",
          joined_at: new Date(),
        },
      ],
      call_type: callType || "video",
      status: "ongoing",
    });

 
    conv.active_call = newCall._id;
    await conv.save();

    return res.json({ success: true, call: newCall });
  } catch (err) {
    console.error("joinCall error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error: " + err.message });
  }
});

router.post("/leave", async (req, res) => {
  try {
    const { callId, userId } = req.body;

    const call = await Call.findById(callId);
    if (!call) {
      return res.status(404).json({ success: false, message: "Call not found" });
    }


    const participant = call.participants.find(
      (p) => String(p.user) === String(userId)
    );

    if (participant) {

      if (!participant.left_at) {
        participant.left_at = new Date();
      }
    } else {

      call.participants.push({
        user: userId,
        direction: "incoming",
        joined_at: new Date(),
        left_at: new Date(),
      });
    }

    await call.save();

    const activeUsers = call.participants.filter((p) => !p.left_at);

    if (activeUsers.length === 0) {

      call.ended_at = new Date();
      call.duration = Math.max(
        0,
        Math.round((call.ended_at - call.started_at) / 1000)
      );


      const joinedUsers = call.participants.filter(
        (p) => String(p.user) !== String(call.caller_id)
      );
      call.status = joinedUsers.length === 0 ? "missed" : "ended";

      await call.save();

 
      await Conversation.updateOne(
        { active_call: callId },
        { $set: { active_call: null } }
      );
    }

    return res.json({ success: true, call });
  } catch (err) {
    console.error("leaveCall error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});


export default router;
