import { users, notes, messages, follows, type User, type InsertUser, type Note, type InsertNote, type Message, type InsertMessage, type Follow, type InsertFollow } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByPublicKey(publicKey: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  
  // Note methods
  getNotes(limit?: number, offset?: number): Promise<Note[]>;
  getNotesByUser(userId: number): Promise<Note[]>;
  createNote(note: InsertNote): Promise<Note>;
  
  // Message methods
  getMessages(userId1: number, userId2: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessageAsRead(id: number): Promise<Message | undefined>;
  
  // Follow methods
  getFollowers(userId: number): Promise<Follow[]>;
  getFollowing(userId: number): Promise<Follow[]>;
  createFollow(follow: InsertFollow): Promise<Follow>;
  deleteFollow(followerId: number, followingId: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private notes: Map<number, Note>;
  private messages: Map<number, Message>;
  private follows: Map<number, Follow>;
  private userIdCounter: number;
  private noteIdCounter: number;
  private messageIdCounter: number;
  private followIdCounter: number;

  constructor() {
    this.users = new Map();
    this.notes = new Map();
    this.messages = new Map();
    this.follows = new Map();
    this.userIdCounter = 1;
    this.noteIdCounter = 1;
    this.messageIdCounter = 1;
    this.followIdCounter = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getUserByPublicKey(publicKey: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.publicKey === publicKey,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const now = new Date();
    const user: User = { ...insertUser, id, createdAt: now };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updateData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Note methods
  async getNotes(limit: number = 20, offset: number = 0): Promise<Note[]> {
    const allNotes = Array.from(this.notes.values());
    // Sort by createdAt descending (newest first)
    allNotes.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return allNotes.slice(offset, offset + limit);
  }

  async getNotesByUser(userId: number): Promise<Note[]> {
    return Array.from(this.notes.values())
      .filter(note => note.userId === userId)
      .sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }

  async createNote(insertNote: InsertNote): Promise<Note> {
    const id = this.noteIdCounter++;
    const now = new Date();
    const note: Note = { ...insertNote, id, createdAt: now };
    this.notes.set(id, note);
    return note;
  }

  // Message methods
  async getMessages(userId1: number, userId2: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => 
        (message.senderId === userId1 && message.receiverId === userId2) ||
        (message.senderId === userId2 && message.receiverId === userId1)
      )
      .sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = this.messageIdCounter++;
    const now = new Date();
    const message: Message = { ...insertMessage, id, createdAt: now, readAt: null };
    this.messages.set(id, message);
    return message;
  }

  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updatedMessage = { ...message, readAt: new Date() };
    this.messages.set(id, updatedMessage);
    return updatedMessage;
  }

  // Follow methods
  async getFollowers(userId: number): Promise<Follow[]> {
    return Array.from(this.follows.values())
      .filter(follow => follow.followingId === userId);
  }

  async getFollowing(userId: number): Promise<Follow[]> {
    return Array.from(this.follows.values())
      .filter(follow => follow.followerId === userId);
  }

  async createFollow(insertFollow: InsertFollow): Promise<Follow> {
    const id = this.followIdCounter++;
    const now = new Date();
    const follow: Follow = { ...insertFollow, id, createdAt: now };
    this.follows.set(id, follow);
    return follow;
  }

  async deleteFollow(followerId: number, followingId: number): Promise<void> {
    const followToDelete = Array.from(this.follows.values()).find(
      follow => follow.followerId === followerId && follow.followingId === followingId
    );
    
    if (followToDelete) {
      this.follows.delete(followToDelete.id);
    }
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }
  
  async getUserByPublicKey(publicKey: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.publicKey, publicKey));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  async updateUser(id: number, updateData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async getNotes(limit: number = 20, offset: number = 0): Promise<Note[]> {
    return db
      .select()
      .from(notes)
      .limit(limit)
      .offset(offset)
      .orderBy(notes.createdAt, { direction: "desc" });
  }
  
  async getNotesByUser(userId: number): Promise<Note[]> {
    return db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(notes.createdAt, { direction: "desc" });
  }
  
  async createNote(insertNote: InsertNote): Promise<Note> {
    const [note] = await db
      .insert(notes)
      .values(insertNote)
      .returning();
    return note;
  }
  
  async getMessages(userId1: number, userId2: number): Promise<Message[]> {
    return db
      .select()
      .from(messages)
      .where(
        // Get messages where userId1 is sender and userId2 is receiver OR vice versa
        db.or(
          db.and(
            eq(messages.senderId, userId1),
            eq(messages.receiverId, userId2)
          ),
          db.and(
            eq(messages.senderId, userId2),
            eq(messages.receiverId, userId1)
          )
        )
      )
      .orderBy(messages.createdAt);
  }
  
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }
  
  async markMessageAsRead(id: number): Promise<Message | undefined> {
    const now = new Date();
    const [message] = await db
      .update(messages)
      .set({ readAt: now })
      .where(eq(messages.id, id))
      .returning();
    return message;
  }
  
  async getFollowers(userId: number): Promise<Follow[]> {
    return db
      .select()
      .from(follows)
      .where(eq(follows.followingId, userId));
  }
  
  async getFollowing(userId: number): Promise<Follow[]> {
    return db
      .select()
      .from(follows)
      .where(eq(follows.followerId, userId));
  }
  
  async createFollow(insertFollow: InsertFollow): Promise<Follow> {
    const [follow] = await db
      .insert(follows)
      .values(insertFollow)
      .returning();
    return follow;
  }
  
  async deleteFollow(followerId: number, followingId: number): Promise<void> {
    await db
      .delete(follows)
      .where(
        db.and(
          eq(follows.followerId, followerId),
          eq(follows.followingId, followingId)
        )
      );
  }
}

export const storage = new DatabaseStorage();