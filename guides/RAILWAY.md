# Deploying Your Agent on Railway

This guide covers how to deploy an agent using Railway—a platform many developers prefer for quickly and easily deploying bots and agents. While this tutorial focuses on Railway, you can use any hosting provider that supports Node.js and environment variables.

**Alternative Platforms:**

- Heroku
- Fly.io
- Render
- Vercel

_Want to contribute a guide for another platform? We welcome pull requests!_

## Why Choose Railway?

Railway offers several advantages:

- Extremely fast deployment process
- Automatic updates on every commit or PR merged to your repository
- Simple configuration for Node.js applications
- Built-in support for volumes and databases

## Deployment Steps

### 1. Create a Railway Account

Sign up for an account at [Railway](https://railway.app/) if you don't already have one.

### 2. Start a New Project

From your Railway dashboard, click "New Project" and select "Empty Project" to begin with a clean slate.

![Railway New Project Screen](https://github.com/user-attachments/assets/42016550-0ab5-4c6b-a644-39d27746916f)

### 3. Import Your GitHub Repository

Click "Deploy from GitHub repo" and select the repository containing your agent code.

![Import GitHub Repository](https://github.com/user-attachments/assets/88305e11-0e8a-4a92-9bbf-d9fece23b42f)

### 4. Configure Volume Storage

Your XMTP agent will need persistent storage. Add a volume to your container:

1. Navigate to your service settings
2. Select the "Volumes" tab
3. Add a new volume and specify the mount path

![Adding a Volume](https://github.com/user-attachments/assets/85c45d1b-ee5b-469a-9c57-6e4a71c8bb92)

Use this code in your application to properly connect to the Railway volume:

```tsx
let volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".data/xmtp";
const dbPath = `${volumePath}/${signer.getAddress()}-${env}`;
if (fs && !fs.existsSync(volumePath)) {
  fs.mkdirSync(volumePath, { recursive: true });
}
```

### 5. Add a Database (Optional)

If your agent requires a database:

1. Right-click in your project dashboard
2. Select "New" → "Database" → Choose your preferred database (e.g., Redis)

![Adding a Database](https://github.com/user-attachments/assets/2ec83212-9b6b-45e8-b161-d58d554771d1)

### 6. Configure Environment Variables

1. Get the connection string for your database
   ![Get Redis Connection String](https://github.com/user-attachments/assets/0fbebe34-e09f-4bf7-bc8b-b43cbc2b7762)

2. Add the connection string and any other required environment variables to your service
   ![Environment Variables Editor](https://github.com/user-attachments/assets/4393b179-227e-4c7c-8313-165f191356ff)

### 7. Deploy Your Application

Once all configurations are set, Railway will automatically deploy your application. You can monitor the deployment process in the "Deployments" tab.

### 8. Share Your Agent (Optional)

Consider registering an [ENS domain](https://ens.domains/) for your agent to make it more accessible and professional.

## Example Railway Deployment

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/UCyz5b)
