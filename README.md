# Andrew Bluestone | Legal Malpractice Diagnostic Assistant

**A Retrieval-Augmented Generation (RAG) platform to diagnose legal malpractice queries based exclusively on New York case law and Andrew Bluestone's legal blog.**

This application leverages a modernized tech stack combining an optimized serverless vector database (Neon Postgres) with OpenAI's natural language and embedding models (`gpt-4o`, `text-embedding-3-small`). The front end provides a sleek, subscriber-ready interface built entirely with responsive, vanila HTML/CSS/JS glassmorphism.

---

## Architecture Overview

*   **Frontend**: A responsive Vanilla JS & CSS UI that queries the backend API.
*   **Backend Server**: A streamlined Node.js (Express) server acting as the bridge between subscribers and the RAG infrastructure.
*   **Vector Database**: Neon Postgres loaded with `pgvector` to store the thousands of tokenized embeddings of legal blog texts.
*   **AI Engine**: OpenAI's API.
    *   **Retrieval**: `text-embedding-3-small` generates 1536-dimensional query vectors and matches them using cosine similarity (`<=>`) in Neon.
    *   **Generation**: `gpt-4o` interprets the matched legal excerpts and diagnostically answers the subscriber.

---

## ⚙️ Configuration & Environment Variables

This application requires specific secrets to interact with the database and OpenAI. These secrets must be kept secure.

### 1. Local Configuration (Development)

For local testing, create a `.env` file at the root of your project:

```env
# Create a file named exactly: .env

# Your Neon PostgreSQL connection string
# Format: postgres://[user]:[password]@[endpoint]/[dbname]?sslmode=require
DATABASE_URL=postgres://your_neon_user:your_neon_password@ep-your-database-id.us-east-2.aws.neon.tech/neondb?sslmode=require

# Your OpenAI API key
OPENAI_API_KEY=sk-proj-your-actual-api-key-here...
```

**⚠️ SECURITY WARNING:** Never commit your `.env` file to your Git repository (It is excluded in the `.gitignore` file by default). Exposing these keys could lead to unexpected resource billing by malicious actors.

### 2. Live Hosting Configuration (Production)

If deploying to a service like Render, Railway, or Heroku, do **not** upload the `.env` file. Instead:

1. Navigate to the **Environment Variables** (or Config Vars) settings panel of your chosen host.
2. Manually add `DATABASE_URL` and `OPENAI_API_KEY` as your key/value pairs using the precise strings from your local `.env`.
3. The Node.js application is pre-configured to adapt by dynamically pulling `process.env.DATABASE_URL` during execution on the hosted machine.

---

## 🚀 Setup & Installation

1. **Clone the project:**
   Ensure you have [Node.js](https://nodejs.org/) installed on your machine.
   
2. **Install dependencies:**
   Run the following command in your terminal at the root of the project to install packages from `package.json`:
   ```bash
   npm install
   ```

3. **Start the application:**
   You can start the full stack (server and UI) simultaneously with:
   ```bash
   npm start
   ```

4. **Access the Application:**
   Open your browser and navigate to `http://localhost:3000`

---

## 🛠 Database Scripts & Tooling

While `npm start` runs the application for subscribers, there are additional utility scripts built for developers handling data ingestion.

*   **`node db.js`**: A quick diagnostic tool to verify the `.env` connection to Neon Postgres.
*   **`node backfill.js`**: A batching worker script that cycles through thousands of raw blog articles (in `bluestone_blog_pages`), embeds them via OpenAI, and saves the vectors back to the remote Neon DB. Contains back-off retry logic to circumvent rate limits.
*   **`node chunker.js`**: Subdivides massive raw text into 1,000 character 'chunks' with a 150 character sliding-window overlap, guaranteeing optimal semantic matching. Embeds these specific blocks into the `bluestone_blog_chunks` data table.
