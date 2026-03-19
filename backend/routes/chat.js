const express = require("express");
const router = express.Router();
const { OpenAI } = require("openai");
const config = require("../config/config");

const openai = new OpenAI({
    apiKey: config.openai_api_key,
});

/** System prompt: restrict to Clini Seva clinic-related questions only */
const CLINI_SEVA_SYSTEM = `You are the assistant for Clini Seva, a clinic management product. You ONLY answer questions related to:
- Doctor appointments (booking, rescheduling, cancelling, availability)
- Patient management (adding patients, patient details, patient records)
- Clinic operations (services, timings, staff, consultations)
- General clinic or healthcare administration

Keep answers concise and helpful. If the user asks anything off-topic (e.g. general knowledge, recipes, coding, other domains), politely say: "I'm Clini Seva's assistant and I can only help with clinic-related questions—like doctor appointments, adding patients, or clinic operations. How can I help you with that?" Do not answer off-topic questions.`;

const MAX_HISTORY_MESSAGES = 10; // last N messages to send as context

function buildMessages(body) {
    const { message, history = [] } = body;
    const trimmed = Array.isArray(history) ? history.slice(-MAX_HISTORY_MESSAGES) : [];
    const messages = [
        { role: "system", content: CLINI_SEVA_SYSTEM },
        ...trimmed.map((m) => ({ role: m.role, content: m.content || "" })),
        { role: "user", content: message },
    ];
    return messages;
}

/** Non-streaming: single response */
const chat = async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: "message is required" });
    }
    try {
        const messages = buildMessages(req.body);
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages,
            max_tokens: 800,
        });
        const text = completion.choices[0]?.message?.content ?? "";
        res.json({ response: text });
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.error(`[ERROR] ${error.message}`);
    }
};

/** Streaming: real-time chunks (SSE) */
const chatStream = async (req, res) => {
    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: "message is required" });
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders && res.flushHeaders();

    try {
        const messages = buildMessages(req.body);
        const stream = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages,
            max_tokens: 800,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content ?? "";
            if (content) {
                res.write("data: " + JSON.stringify({ content }) + "\n\n");
                if (typeof res.flush === "function") res.flush();
            }
        }
        res.write("data: " + JSON.stringify({ done: true }) + "\n\n");
    } catch (error) {
        console.error(`[ERROR] ${error.message}`);
        res.write("data: " + JSON.stringify({ error: error.message }) + "\n\n");
    } finally {
        res.end();
    }
};

router.post("/", chat);
router.post("/stream", chatStream);

module.exports = router;
