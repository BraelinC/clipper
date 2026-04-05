import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const SILAS_CONVEX_URL = "https://aware-chinchilla-758.convex.cloud";
const SILAS_CONVEX_KEY = "prod:aware-chinchilla-758|eyJ2MiI6IjRkM2RmOWJhMGExMDQwYTJhNDNkZjA3OWJmNjcxYjc5In0=";

const http = httpRouter();

// Process edit message with local Qwen model
http.route({
  path: "/process-edit",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { editId, message } = body;

      if (!editId || !message) {
        return new Response(JSON.stringify({ error: "Missing editId or message" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get the edit and clip info
      const edit = await ctx.runQuery(api.edits.get, { editId });
      if (!edit) {
        return new Response(JSON.stringify({ error: "Edit not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Build context message with video URL
      const videoUrl = edit.clipUrl || edit.outputUrl;
      const contextMessage = videoUrl
        ? `[Video Edit Request]\nVideo URL: ${videoUrl}\nClip Title: ${edit.clipTitle}\n\nUser Request: ${message}`
        : `[Video Edit Request]\nClip Title: ${edit.clipTitle}\n\nUser Request: ${message}`;

      // Create conversation in Silas Chat with local model
      const createRes = await fetch(`${SILAS_CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Convex ${SILAS_CONVEX_KEY}`,
        },
        body: JSON.stringify({
          path: "conversations:create",
          args: { model: "local", title: `Clipper: ${edit.clipTitle}` },
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("Failed to create conversation:", errText);
        return new Response(JSON.stringify({ error: "Failed to create AI conversation" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const createData = await createRes.json();
      const conversationId = createData.value;

      // Send message to local model
      const sendRes = await fetch(`${SILAS_CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Convex ${SILAS_CONVEX_KEY}`,
        },
        body: JSON.stringify({
          path: "messages:send",
          args: {
            conversationId,
            content: contextMessage,
            role: "user",
          },
        }),
      });

      if (!sendRes.ok) {
        const errText = await sendRes.text();
        console.error("Failed to send message:", errText);
        return new Response(JSON.stringify({ error: "Failed to send to AI" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Return the conversation ID so we can poll for response
      return new Response(
        JSON.stringify({
          success: true,
          conversationId,
          editId,
          message: "Processing with local Qwen model",
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      console.error("Error processing edit:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// Poll for AI response and store it
http.route({
  path: "/poll-response",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { conversationId, editId } = body;

      if (!conversationId || !editId) {
        return new Response(JSON.stringify({ error: "Missing conversationId or editId" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get messages from Silas Chat
      const msgRes = await fetch(`${SILAS_CONVEX_URL}/api/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Convex ${SILAS_CONVEX_KEY}`,
        },
        body: JSON.stringify({
          path: "messages:list",
          args: { conversationId },
        }),
      });

      if (!msgRes.ok) {
        return new Response(JSON.stringify({ error: "Failed to fetch messages" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const msgData = await msgRes.json();
      const messages = msgData.value || [];

      // Find assistant response
      const assistantMsg = messages.find(
        (m: { role: string; content: string }) => m.role === "assistant"
      );

      if (!assistantMsg) {
        return new Response(
          JSON.stringify({ status: "pending", message: "Waiting for AI response" }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // Store the response in clipper's editMessages
      await ctx.runMutation(api.editMessages.respond, {
        editId,
        content: assistantMsg.content,
      });

      return new Response(
        JSON.stringify({
          status: "complete",
          response: assistantMsg.content,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (error) {
      console.error("Error polling response:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }),
});

// CORS preflight handler
http.route({
  path: "/process-edit",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

http.route({
  path: "/poll-response",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
