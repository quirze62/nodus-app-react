import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertNoteSchema, insertMessageSchema, insertFollowSchema } from "@shared/schema";
import { WebSocketServer } from "ws";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Add a health check endpoint
  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: "/ws" // Specify path to avoid conflicts with Vite HMR
  });
  
  wss.on("connection", (ws) => {
    console.log("WebSocket connection established");
    
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log("WebSocket message received:", data);
        // Handle various message types here
        // This could be used for real-time note updates, messages, etc.
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
    
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
    
    ws.on("close", () => {
      console.log("WebSocket connection closed");
    });
  });
  
  wss.on("error", (error) => {
    console.error("WebSocket server error:", error);
  });

  // User routes
  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUserByUsername = await storage.getUserByUsername(userData.username);
      if (existingUserByUsername) {
        return res.status(409).json({ message: "Username already exists" });
      }
      
      const existingUserByPublicKey = await storage.getUserByPublicKey(userData.publicKey);
      if (existingUserByPublicKey) {
        return res.status(409).json({ message: "Public key already exists" });
      }
      
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      res.status(400).json({ message: "Invalid user data", error: String(error) });
    }
  });

  app.get("/api/users/:id", async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    // Don't return the private key in the response
    const { privateKey, nsec, ...userWithoutPrivateKey } = user;
    res.json(userWithoutPrivateKey);
  });

  app.patch("/api/users/:id", async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    try {
      const updateData = insertUserSchema.partial().parse(req.body);
      const updatedUser = await storage.updateUser(userId, updateData);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return the private key in the response
      const { privateKey, nsec, ...userWithoutPrivateKey } = updatedUser;
      res.json(userWithoutPrivateKey);
    } catch (error) {
      res.status(400).json({ message: "Invalid update data", error: String(error) });
    }
  });

  // Note routes
  app.post("/api/notes", async (req: Request, res: Response) => {
    try {
      const noteData = insertNoteSchema.parse(req.body);
      const user = await storage.getUser(noteData.userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const note = await storage.createNote(noteData);
      
      // Notify connected clients about the new note
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({ type: "NEW_NOTE", data: note }));
        }
      });
      
      res.status(201).json(note);
    } catch (error) {
      res.status(400).json({ message: "Invalid note data", error: String(error) });
    }
  });

  app.get("/api/notes", async (_req: Request, res: Response) => {
    const notes = await storage.getNotes();
    res.json(notes);
  });

  app.get("/api/users/:id/notes", async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const notes = await storage.getNotesByUser(userId);
    res.json(notes);
  });

  // Message routes
  app.post("/api/messages", async (req: Request, res: Response) => {
    try {
      const messageData = insertMessageSchema.parse(req.body);
      
      const sender = await storage.getUser(messageData.senderId);
      if (!sender) {
        return res.status(404).json({ message: "Sender not found" });
      }
      
      const receiver = await storage.getUser(messageData.receiverId);
      if (!receiver) {
        return res.status(404).json({ message: "Receiver not found" });
      }
      
      const message = await storage.createMessage(messageData);
      
      // Notify receiver about the new message if they're connected
      wss.clients.forEach((client: any) => {
        if (client.userId === messageData.receiverId && client.readyState === 1) {
          client.send(JSON.stringify({ type: "NEW_MESSAGE", data: message }));
        }
      });
      
      res.status(201).json(message);
    } catch (error) {
      res.status(400).json({ message: "Invalid message data", error: String(error) });
    }
  });

  app.get("/api/messages/:user1Id/:user2Id", async (req: Request, res: Response) => {
    const user1Id = parseInt(req.params.user1Id);
    const user2Id = parseInt(req.params.user2Id);
    
    if (isNaN(user1Id) || isNaN(user2Id)) {
      return res.status(400).json({ message: "Invalid user IDs" });
    }
    
    const messages = await storage.getMessages(user1Id, user2Id);
    res.json(messages);
  });

  app.patch("/api/messages/:id/read", async (req: Request, res: Response) => {
    const messageId = parseInt(req.params.id);
    if (isNaN(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }
    
    const updatedMessage = await storage.markMessageAsRead(messageId);
    if (!updatedMessage) {
      return res.status(404).json({ message: "Message not found" });
    }
    
    res.json(updatedMessage);
  });

  // Follow routes
  app.post("/api/follows", async (req: Request, res: Response) => {
    try {
      const followData = insertFollowSchema.parse(req.body);
      
      const follower = await storage.getUser(followData.followerId);
      if (!follower) {
        return res.status(404).json({ message: "Follower not found" });
      }
      
      const following = await storage.getUser(followData.followingId);
      if (!following) {
        return res.status(404).json({ message: "User to follow not found" });
      }
      
      const follow = await storage.createFollow(followData);
      res.status(201).json(follow);
    } catch (error) {
      res.status(400).json({ message: "Invalid follow data", error: String(error) });
    }
  });

  app.delete("/api/follows/:followerId/:followingId", async (req: Request, res: Response) => {
    const followerId = parseInt(req.params.followerId);
    const followingId = parseInt(req.params.followingId);
    
    if (isNaN(followerId) || isNaN(followingId)) {
      return res.status(400).json({ message: "Invalid user IDs" });
    }
    
    await storage.deleteFollow(followerId, followingId);
    res.status(204).send();
  });

  app.get("/api/users/:id/followers", async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    const followers = await storage.getFollowers(userId);
    res.json(followers);
  });

  app.get("/api/users/:id/following", async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    
    const following = await storage.getFollowing(userId);
    res.json(following);
  });

  return httpServer;
}
