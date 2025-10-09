import express from "express"
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import "./config/db.js";
import { initRedis } from "./utils/redis.js";

const app = express();
app.use(express.json());


app.use(cors({
  origin: ["https://chat-app-website-vyth.onrender.com","http://localhost:5173","http://127.0.0.1:58143","https://qbh9xq6w-5173.euw.devtunnels.ms","https://qbh9xq6w-5000.euw.devtunnels.ms","http://localhost:5000","http://localhost:3500","https://qbh9xq6w-3500.euw.devtunnels.ms"],  // frontend adresini buraya yaz
  credentials: true,                  // istersen
}));

import fileRouter from './routes/file.routes.js';
import authRouter from './routes/auth.routes.js';
import conversationRouter from './routes/conversation.routes.js';
import callRouter from "./routes/call.routes.js"
app.use('/api/file', fileRouter);
app.use('/api/auth', authRouter);
app.use('/api/conversation', conversationRouter);
app.use('/api/call', callRouter)

initRedis().then(() => {
  app.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);
  });
});