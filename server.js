const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Ollama API endpoint
const OLLAMA_API = "http://localhost:11434/api/generate";

// Health check endpoint
app.get("/health", async (req, res) => {
	try {
		// Check if Ollama is running
		const ollamaResponse = await axios.get(
			"http://localhost:11434/api/version"
		);
		res.json({
			status: "ok",
			ollama: {
				version: ollamaResponse.data.version,
				status: "running",
			},
		});
	} catch (error) {
		res.status(500).json({
			status: "error",
			message: "Ollama server is not running",
			error: error.message,
		});
	}
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
	try {
		const { message } = req.body;

		// Get page context from the request
		const pageContext = req.body.pageContext || "";

		// Create a system prompt that includes the page context
		const systemPrompt = `You are Oracle, a helpful AI web assistant. You're helping a user navigate and understand web pages.
		You have access to the following website information:
		${pageContext}
		
		Instructions:
		1. Use the website structure and navigation to help users find what they're looking for
		2. If the user asks about content, use the headings and main content to provide relevant information
		3. If the user needs to navigate somewhere, use the available links to guide them
		4. Keep your answers concise, helpful, and relevant to the user's query
		5. If you're not sure about something, say so and suggest what information might help`;

		console.log("Sending request to Ollama:", {
			model: "llama3.2",
			prompt: `${systemPrompt}\n\nUser: ${message}\nAssistant:`,
		});

		const response = await axios.post(OLLAMA_API, {
			model: "llama3.2",
			prompt: `${systemPrompt}\n\nUser: ${message}\nAssistant:`,
			stream: false,
			options: {
				temperature: 0.7,
				top_p: 0.9,
				max_tokens: 800, // Increased token limit to handle longer responses
			},
		});

		console.log("Received response from Ollama:", response.data);

		res.json({
			response: response.data.response.trim(),
		});
	} catch (error) {
		console.error("Error in /api/chat:", error);

		// Check if it's a connection error
		if (error.code === "ECONNREFUSED") {
			res.status(503).json({
				error:
					"Ollama server is not running. Please start Ollama with 'ollama serve'",
			});
		} else if (error.response && error.response.status === 404) {
			res.status(404).json({
				error: "Llama 3.2 model not found. Please run 'ollama pull llama3.2'",
			});
		} else {
			res.status(500).json({
				error: "Failed to get response from Ollama",
				details: error.message,
			});
		}
	}
});

// Start server
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
	console.log(`Health check available at http://localhost:${port}/health`);
});
