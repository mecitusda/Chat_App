import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
const connectDB = async () => {
    try {
        
        await mongoose.connect(`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@chatapp.fiil0y4.mongodb.net/chatapp?retryWrites=true&w=majority`, {
            useNewUrlParser: true,
            useUnifiedTopology: true
          });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
    }
};

export default connectDB();