# Jervious

Jervious is a small, thoughtful AI workspace powered by Claude. Bring it a question, an unfinished idea, or a task you want to untangle.

## What’s inside

- **Three Claude personalities:** Spark for creative thinking, Focus for practical next steps, and Scholar for careful explanations.
- **Idea starters:** choose a prompt or use “Surprise me” to get unstuck.
- **Saved sparks:** bookmark a useful response, then copy or remove it from your personal idea jar.
- **Responsive workspace:** a custom glowing Jervious orb, warm visual theme, and mobile-friendly navigation.
- **Private API route:** Claude calls run on the server, so your API key is never sent to the browser.

## Run it in VS Code

1. Open this folder in VS Code.
2. Install Node.js 20.9 or newer if you do not already have it.
3. In the VS Code terminal, install the packages:

   ```bash
   pnpm install
   ```

4. Copy `.env.example` to `.env.local` and add an AI Gateway key:

   ```env
   AI_GATEWAY_API_KEY=your_key_here
   ```

   Create a key from [Vercel AI Gateway](https://vercel.com/ai-gateway). Keep `.env.local` private; Git ignores it.

5. Start Jervious:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

Without a key, the interface still opens, but sending a chat message returns a setup reminder. Saved sparks live in this browser only.

## Publish from VS Code to GitHub

1. Install Git for Windows if Git is not already available, then restart VS Code.
2. Sign in to GitHub from VS Code and install the **GitHub Pull Requests and Issues** extension if prompted.
3. Open **Source Control** and choose **Initialize Repository** if you have not already done so.
4. Review the files and confirm `.env.local` is not in the changes list.
5. Enter a commit message such as `Build Jervious AI workspace` and select **Commit**.
6. Choose **Publish to GitHub** and select whether the repository should be public or private.

## Put the app online

Jervious needs a server runtime for its Claude API route. For a live app, import the GitHub repository into Vercel, add `AI_GATEWAY_API_KEY` to the project’s environment variables, then deploy. A static GitHub Pages site cannot run the chat API route. If you make the app public, set a usage limit for your Gateway key or add sign-in and persistent rate limiting before inviting broad traffic.

## Change the Claude model

The model is set in `app/api/chat/route.ts`:

```ts
model: "anthropic/claude-sonnet-5.5"
```

Change that model identifier to another Claude model available through AI Gateway.

