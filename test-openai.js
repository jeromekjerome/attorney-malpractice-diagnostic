import 'dotenv/config';
import OpenAI from 'openai';

// We pull the key from your .env to make sure dotenv is working too
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function verifyOpenAI() {
    console.log("Checking OpenAI API Key...");
    try {
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: "Legal malpractice in New York",
        });

        if (response.data[0].embedding.length === 1536) {
            console.log("✅ Success! OpenAI is active.");
            console.log("Vector Dimension: 1536");
            console.log("First 3 numbers:", response.data[0].embedding.slice(0, 3));
        }
    } catch (err) {
        console.error("❌ OpenAI Test Failed!");
        console.error("Status:", err.status);
        console.error("Message:", err.message);

        if (err.status === 401) {
            console.log("Tip: Your API key is invalid. Check for extra spaces in .env.");
        } else if (err.status === 429) {
            console.log("Tip: You've hit a rate limit or have no credits on your account.");
        }
    }
}

verifyOpenAI();