**Goals**:

* Fix likes, reposts, and comments with proper authentication and error handling.  
* Stabilize relay connections in Replit.  
* Resolve TypeScript errors.  
* Add basic clustering for Matryoshka testing.

**Step 1: Fix Social Interactions**

**Objective**: Ensure likes (kind 7), reposts (kind 6), and comments (kind 1 with reply tags) publish successfully.

* **Tasks**:  
  * **Update** useNodusPosts.ts: Add commentPost, error handling, and signer checks:  
  * javascript

// client/src/hooks/useNodusPosts.ts  
import { useNDK, useSubscribe } from '@nostr-dev-kit/ndk-react';  
import { useState, useEffect } from 'react';  
import { NDKEvent } from '@nostr-dev-kit/ndk';  
import { DB } from '@/lib/db';

interface Post extends NDKEvent {  
  id: string;  
  pubkey: string;  
  content: string;  
  created\_at: number;  
  tags: string\[\]\[\];  
}

export function useNodusPosts() {  
  const { ndk } \= useNDK();  
  const \[verifiedPosts, setVerifiedPosts\] \= useState\<Post\[\]\>(\[\]);  
  const \[error, setError\] \= useState\<string | null\>(null);  
  const db \= new DB();  
  const { events } \= useSubscribe({  
    filter: { kinds: \[1\], limit: 50 },  
    enabled: \!\!ndk  
  });

  useEffect(() \=\> {  
    const filterPosts \= async () \=\> {  
      const verified: Post\[\] \= \[\];  
      for (const event of events) {  
        const verified \= await db.isNip05Verified(event.pubkey, ndk);  
        if (verified) verified.push(event as Post);  
      }  
      setVerifiedPosts(verified);  
    };  
    filterPosts().catch(err \=\> setError('Failed to filter posts: ' \+ err.message));  
  }, \[events, ndk\]);

  const createPost \= async (content: string) \=\> {  
    if (\!ndk || \!ndk.signer) {  
      setError('Please log in to post');  
      return false;  
    }  
    try {  
      const event \= new NDKEvent(ndk);  
      event.kind \= 1;  
      event.content \= content;  
      event.created\_at \= Math.floor(Date.now() / 1000);  
      event.tags \= \[\['cluster', 'city1'\]\];  
      await event.sign();  
      await ndk.publish(event);  
      return true;  
    } catch (err) {  
      setError('Failed to post: ' \+ err.message);  
      return false;  
    }  
  };

  const likePost \= async (postId: string, pubkey: string) \=\> {  
    if (\!ndk || \!ndk.signer) {  
      setError('Please log in to like');  
      return false;  
    }  
    try {  
      const event \= new NDKEvent(ndk);  
      event.kind \= 7;  
      event.content \= '+';  
      event.tags \= \[\['e', postId\], \['p', pubkey\]\];  
      await event.sign();  
      await ndk.publish(event);  
      return true;  
    } catch (err) {  
      setError('Failed to like: ' \+ err.message);  
      return false;  
    }  
  };

  const repostPost \= async (postId: string, pubkey: string) \=\> {  
    if (\!ndk || \!ndk.signer) {  
      setError('Please log in to repost');  
      return false;  
    }  
    try {  
      const event \= new NDKEvent(ndk);  
      event.kind \= 6;  
      event.tags \= \[\['e', postId\], \['p', pubkey\]\];  
      await event.sign();  
      await ndk.publish(event);  
      return true;  
    } catch (err) {  
      setError('Failed to repost: ' \+ err.message);  
      return false;  
    }  
  };

  const commentPost \= async (postId: string, pubkey: string, content: string) \=\> {  
    if (\!ndk || \!ndk.signer) {  
      setError('Please log in to comment');  
      return false;  
    }  
    try {  
      const event \= new NDKEvent(ndk);  
      event.kind \= 1;  
      event.content \= content;  
      event.created\_at \= Math.floor(Date.now() / 1000);  
      event.tags \= \[\['e', postId, '', 'reply'\], \['p', pubkey\], \['cluster', 'city1'\]\];  
      await event.sign();  
      await ndk.publish(event);  
      return true;  
    } catch (err) {  
      setError('Failed to comment: ' \+ err.message);  
      return false;  
    }  
  };

  return { posts: verifiedPosts, createPost, likePost, repostPost, commentPost, error };

* }  
  * **Update** PostCard.tsx: Add comment functionality, loading states, and error feedback:  
  * javascript

// client/src/components/feed/PostCard.tsx  
import { useNodusPosts } from '@/hooks/useNodusPosts';  
import { useState } from 'react';  
import { NDKEvent } from '@nostr-dev-kit/ndk';

interface Post extends NDKEvent {  
  id: string;  
  pubkey: string;  
  content: string;  
  created\_at: number;  
  tags: string\[\]\[\];  
}

export const PostCard \= ({ post }: { post: Post }) \=\> {  
  const { likePost, repostPost, commentPost, error } \= useNodusPosts();  
  const \[isCommenting, setIsCommenting\] \= useState(false);  
  const \[commentContent, setCommentContent\] \= useState('');  
  const \[isLoading, setIsLoading\] \= useState(false);

  const handleLike \= async () \=\> {  
    setIsLoading(true);  
    const success \= await likePost(post.id, post.pubkey);  
    setIsLoading(false);  
    if (success) alert('Liked\!');  
  };

  const handleRepost \= async () \=\> {  
    setIsLoading(true);  
    const success \= await repostPost(post.id, post.pubkey);  
    setIsLoading(false);  
    if (success) alert('Reposted\!');  
  };

  const handleCommentSubmit \= async () \=\> {  
    if (\!commentContent.trim()) return;  
    setIsLoading(true);  
    const success \= await commentPost(post.id, post.pubkey, commentContent);  
    setIsLoading(false);  
    if (success) {  
      setCommentContent('');  
      setIsCommenting(false);  
      alert('Comment posted\!');  
    }  
  };

  return (  
    \<div\>  
      {error && \<p style={{ color: 'red' }}\>{error}\</p\>}  
      \<p\>{post.content}\</p\>  
      \<button onClick={handleLike} disabled={isLoading}\>Like\</button\>  
      \<button onClick={handleRepost} disabled={isLoading}\>Repost\</button\>  
      \<button onClick={() \=\> setIsCommenting(\!isCommenting)}\>Comment\</button\>  
      {isCommenting && (  
        \<div\>  
          \<textarea  
            value={commentContent}  
            onChange={e \=\> setCommentContent(e.target.value)}  
            placeholder="Write a comment..."  
          /\>  
          \<button onClick={handleCommentSubmit} disabled={isLoading}\>  
            {isLoading ? 'Sending...' : 'Send'}  
          \</button\>  
        \</div\>  
      )}  
    \</div\>  
  );

* };  
  * **Update** db.ts: Cache NIP-05 verifications for performance:  
  * javascript

// client/src/lib/db.ts  
import { NDK } from '@nostr-dev-kit/ndk';

export class DB {  
  private cache \= new Map\<string, boolean\>();

  async isNip05Verified(pubkey: string, ndk: NDK): Promise\<boolean\> {  
    if (this.cache.has(pubkey)) return this.cache.get(pubkey)\!;  
    try {  
      const user \= await ndk.getUser({ pubkey });  
      const verified \= \!\!user.nip05;  
      this.cache.set(pubkey, verified);  
      return verified;  
    } catch (err) {  
      console.error('NIP-05 verification failed:', err);  
      return false;  
    }  
  }

* }  
* **Testing in Cursor**:  
  * Run npm install to ensure dependencies (@nostr-dev-kit/ndk, @nostr-dev-kit/ndk-react, ws, nostr-tools) are installed.  
  * Start the app locally (npm start) and test:  
    * Like a post (kind 7 event should publish).  
    * Repost a post (kind 6 event should publish).  
    * Comment on a post (kind 1 event with e and p tags should publish).  
  * Check console logs for EVENT publishes and errors (e.g., signer or relay issues).  
  * Verify UI feedback (loading states, success/error alerts).

**Step 2: Ensure Authentication**

**Objective**: Configure ndk.signer to enable event signing for social interactions.

* **Tasks**:  
  * **Update** AuthContext.tsx: Implement generateNewKeys and persist login state:  
  * javascript

// client/src/contexts/AuthContext.tsx  
import { createContext, useState, useEffect } from 'react';  
import { NDK, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';  
import { generateSecretKey, getPublicKey } from 'nostr-tools';

export const AuthContext \= createContext({});

export const AuthProvider \= ({ children, ndk }) \=\> {  
  const \[user, setUser\] \= useState(null);

  const loginWithPrivateKey \= async (privateKey: string) \=\> {  
    try {  
      const signer \= new NDKPrivateKeySigner(privateKey);  
      ndk.signer \= signer;  
      const user \= await signer.user();  
      setUser(user);  
      localStorage.setItem('nostr\_private\_key', privateKey);  
      return true;  
    } catch (err) {  
      console.error('Login failed:', err);  
      return false;  
    }  
  };

  const generateNewKeys \= async () \=\> {  
    try {  
      const privateKey \= generateSecretKey();  
      const publicKey \= getPublicKey(privateKey);  
      const signer \= new NDKPrivateKeySigner(privateKey);  
      ndk.signer \= signer;  
      const user \= await signer.user();  
      setUser(user);  
      localStorage.setItem('nostr\_private\_key', privateKey);  
      return { privateKey, publicKey };  
    } catch (err) {  
      console.error('Key generation failed:', err);  
      return null;  
    }  
  };

  useEffect(() \=\> {  
    const savedKey \= localStorage.getItem('nostr\_private\_key');  
    if (savedKey) loginWithPrivateKey(savedKey);  
  }, \[\]);

  return (  
    \<AuthContext.Provider value={{ ndk, user, loginWithPrivateKey, generateNewKeys }}\>  
      {children}  
    \</AuthContext.Provider\>  
  );

* };  
  * **Update** App.tsx: Integrate AuthProvider with NDKProvider:  
  * javascript

// client/src/App.tsx  
import { NDKProvider } from '@nostr-dev-kit/ndk-react';  
import { AuthProvider } from '@/contexts/AuthContext';  
import { Router } from '@/Router';  
import { WebSocket } from 'ws';

global.WebSocket \= WebSocket;

export const App \= () \=\> (  
  \<NDKProvider relayUrls={\[  
    'wss://relay.mynodus.com',  
    'wss://relay.damus.io',  
    'wss://relay.nostr.band',  
    'wss://nos.lol',  
    'wss://nostr.wine'  
  \]}\>  
    {({ ndk }) \=\> (  
      \<AuthProvider ndk={ndk}\>  
        \<Router /\>  
      \</AuthProvider\>  
    )}  
  \</NDKProvider\>

* );  
  * **Add Login UI** (if missing): Create a simple login component to test authentication:  
  * javascript

// client/src/components/Login.tsx  
import { useContext, useState } from 'react';  
import { AuthContext } from '@/contexts/AuthContext';

export const Login \= () \=\> {  
  const { loginWithPrivateKey, generateNewKeys } \= useContext(AuthContext);  
  const \[privateKey, setPrivateKey\] \= useState('');

  const handleLogin \= async () \=\> {  
    if (privateKey) await loginWithPrivateKey(privateKey);  
  };

  const handleGenerateKeys \= async () \=\> {  
    const keys \= await generateNewKeys();  
    if (keys) alert(\`Private Key: ${keys.privateKey}\\nPublic Key: ${keys.publicKey}\`);  
  };

  return (  
    \<div\>  
      \<input  
        type="text"  
        value={privateKey}  
        onChange={e \=\> setPrivateKey(e.target.value)}  
        placeholder="Enter private key"  
      /\>  
      \<button onClick={handleLogin}\>Login\</button\>  
      \<button onClick={handleGenerateKeys}\>Generate New Keys\</button\>  
    \</div\>  
  );

* };  
  * Add to Home.tsx or a dedicated login page:  
  * javascript

// client/src/pages/Home.tsx  
import { useContext } from 'react';  
import { AuthContext } from '@/contexts/AuthContext';  
import { useNodusPosts } from '@/hooks/useNodusPosts';  
import { PostCard } from '@/components/feed/PostCard';  
import { Login } from '@/components/Login';

export const Home \= () \=\> {  
  const { user } \= useContext(AuthContext);  
  const { posts } \= useNodusPosts();

  return (  
    \<div\>  
      \<h1\>Nodus Feed\</h1\>  
      {\!user && \<Login /\>}  
      {user && (  
        \<ul\>  
          {posts.map(post \=\> (  
            \<PostCard key={post.id} post={post} /\>  
          ))}  
        \</ul\>  
      )}  
    \</div\>  
  );

* };  
* **Testing in Cursor**:  
  * Generate a new keypair and log in.  
  * Verify that ndk.signer is set (console.log(ndk.signer)).  
  * Test likes, reposts, and comments to ensure signing works.  
  * Check for signer-related errors in the console.

**Step 3: Stabilize Relay Connections**

**Objective**: Ensure reliable connections, especially in Replit.

* **Tasks**:  
  * **Optimize** connectNDK: Prioritize reliable relays and add logging:  
  * javascript

// client/src/lib/ndk.ts  
import { NDK } from '@nostr-dev-kit/ndk';  
import { WebSocket } from 'ws';

global.WebSocket \= WebSocket;

export async function connectNDK(ndk: NDK, retries \= 3, timeout \= 5000\) {  
  const reliableRelays \= \['wss://relay.mynodus.com', 'wss://relay.damus.io'\];  
  for (let i \= 0; i \< retries; i++) {  
    try {  
      await ndk.connect(timeout);  
      const connected \= Array.from(ndk.pool.relays.entries())  
        .filter((\[\_, r\]) \=\> r.status \=== 1\)  
        .map((\[url\]) \=\> url);  
      console.log('NDK connected to relays:', connected);  
      if (connected.length \=== 0\) throw new Error('No relays connected');  
      return true;  
    } catch (error) {  
      console.error(\`NDK connection attempt ${i \+ 1} failed:\`, error);  
      if (i \=== retries \- 1\) {  
        console.error('Failed to connect NDK, falling back to reliable relays');  
        reliableRelays.forEach(url \=\> ndk.pool.addRelay(new NDK.NDKRelay(url)));  
        return false;  
      }  
      await new Promise(resolve \=\> setTimeout(resolve, 2000));  
    }  
  }

* }  
  * **Update** OfflineIndicator.tsx: Add reconnection trigger:  
  * javascript

useEffect(() \=\> {  
  if (\!ndk) return;  
  const checkStatus \= async () \=\> {  
    const connected \= Array.from(ndk.pool.relays.values()).some(r \=\> r.status \=== 1);  
    setIsOffline(\!connected);  
    if (\!connected) await connectNDK(ndk);  
  };  
  checkStatus();  
  const interval \= setInterval(checkStatus, 5000);  
  return () \=\> clearInterval(interval);

* }, \[ndk\]);  
* **Testing in Cursor**:  
  * Run the app and monitor ConnectionStatus for connected relays.  
  * Simulate network issues (e.g., disconnect Wi-Fi briefly) to test OfflineIndicator and reconnection.  
  * Verify that wss://relay.mynodus.com connects reliably.

**Step 4: Resolve TypeScript Errors**

**Objective**: Eliminate LSP errors for a clean codebase.

* **Tasks**:  
  * **Add Type Annotations**: In useNodusPosts.ts and PostCard.tsx, ensure NDKEvent types are used correctly.  
  * **Run TypeScript Check**:  
  * bash  
  * npx tsc \--noEmit  
  * Fix errors, e.g., add missing imports:  
  * javascript  
  * import { NDKEvent } from '@nostr-dev-kit/ndk';  
  * **Update** tsconfig.json (if needed): Ensure strict typing:  
  * json

{  
  "compilerOptions": {  
    "strict": true,  
    "esModuleInterop": true,  
    "baseUrl": "src",  
    "paths": { "@/\*": \["\*"\] }  
  }

* }  
* **Testing in Cursor**:  
  * Confirm no TypeScript errors in Cursor’s editor.  
  * Verify the app builds without issues (npm run build).

**Step 5: Push and Pull to Replit**

**Objective**: Deploy changes to Replit and test in the preview.

* **Tasks**:  
  * **Commit and Push from Cursor**:  
  * bash

git add .  
git commit \-m "Fix social interactions and stabilize relay connections"

* git push origin main  
  * **Pull in Replit**: In Replit’s shell:  
  * bash

git pull origin main  
npm install

* npm start  
  * **Test in Replit Preview**:  
    * Open the preview URL.  
    * Log in using a private key or generate a new keypair.  
    * Test:  
      * Liking a post (should show “Liked\!” alert).  
      * Reposting a post (should show “Reposted\!” alert).  
      * Commenting (form should close with “Comment posted\!” alert).  
    * Check ConnectionStatus for connected relays.  
    * Monitor console logs for errors (e.g., signer or relay issues).  
  * **Debug Replit Issues**:  
    * If relays fail, test individually:  
    * bash  
    * node \-e "const WebSocket \= require('ws'); const ws \= new WebSocket('wss://relay.mynodus.com'); ws.on('open', () \=\> { console.log('Connected'); ws.close(); }); ws.on('error', e \=\> console.error('Error:', e));"  
    * If interactions fail, add debug logs in useNodusPosts.ts:  
    * javascript  
    * console.log('Publishing event:', event);  
* **Testing in Replit**:  
  * Verify all social interactions work in the preview.  
  * Ensure OfflineIndicator shows when disconnected and reconnects automatically.  
  * Confirm no TypeScript errors in Replit’s editor.

**Step 6: Add Basic Clustering (Optional for Pilot)**

**Objective**: Test Matryoshka concepts with minimal changes.

* **Tasks**:  
  * **Tag Relays**: In App.tsx:  
  * javascript

useEffect(() \=\> {  
  if (ndk) {  
    ndk.pool.relays.forEach((relay, url) \=\> {  
      relay.metadata \= {  
        cluster: url \=== 'wss://relay.mynodus.com' ? 'city1' : 'neighborhood1',  
        isDoor: \['wss://relay.mynodus.com', 'wss://relay.damus.io'\].includes(url)  
      };  
    });  
  }

* }, \[ndk\]);  
  * **Route Through Door Relays**: In useNodusPosts.ts:  
  * javascript

const publishToDoorRelays \= async (event: NDKEvent) \=\> {  
  const doorRelays \= Array.from(ndk.pool.relays.values()).filter(r \=\> r.metadata?.isDoor && r.status \=== 1);  
  if (\!doorRelays.length) {  
    setError('No door relays available');  
    return false;  
  }  
  await Promise.all(doorRelays.map(r \=\> r.publish(event)));  
  return true;  
};

const createPost \= async (content: string) \=\> {  
  if (\!ndk || \!ndk.signer) {  
    setError('Please log in to post');  
    return false;  
  }  
  try {  
    const event \= new NDKEvent(ndk);  
    event.kind \= 1;  
    event.content \= content;  
    event.created\_at \= Math.floor(Date.now() / 1000);  
    event.tags \= \[\['cluster', 'city1'\]\];  
    await event.sign();  
    return await publishToDoorRelays(event);  
  } catch (err) {  
    setError('Failed to post: ' \+ err.message);  
    return false;  
  }

* };  
* **Testing in Cursor and Replit**:  
  * Verify that posts, likes, reposts, and comments publish to door relays only.  
  * Check ConnectionStatus to confirm cluster metadata.

---

**Recommendations for Cursor Agent**

* **Focus**: Prioritize fixing social interactions (Steps 1-2) to deliver a working pilot. Steps 3-4 ensure stability, and Step 5 handles Replit deployment. Step 6 is optional but recommended for Matryoshka testing.  
* **Environment Setup**:  
  * Clone the repo in Cursor: git clone https://github.com/quirze62/nodus-app-react.  
  * Install dependencies: npm install.  
  * Ensure ws and nostr-tools are installed for WebSocket polyfill and key generation.  
* **Debugging Tips**:  
  * Add console logs in useNodusPosts.ts to trace event publishing:  
  * javascript

console.log('Attempting to publish event:', event);  
await ndk.publish(event);

* console.log('Event published successfully');  
  * Check ndk.signer status: console.log('Signer:', ndk.signer).  
  * Monitor relay status: console.log('Connected relays:', Array.from(ndk.pool.relays.entries())).

**Post-Implementation Steps**

* **Verify in Cursor**:  
  * Run npm start and test all social interactions locally.  
  * Ensure no TypeScript errors (npx tsc \--noEmit).  
* **Push to GitHub**:  
  * Commit and push changes:  
  * bash

git add .  
git commit \-m "Fix social interactions and stabilize NDK implementation"

* git push origin main

