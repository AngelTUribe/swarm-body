import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'

    export default defineConfig({
      plugins: [react()],
      base: '/swarm-body/', 
      optimizeDeps: {
        exclude: ['@mediapipe/pose']
      }
    })
    ```

---

### Step 3: Install the Deployment Tool

We use the `gh-pages` package to automate the process of building your code and pushing it to a special "deployment" branch.

1.  **Install the package**:
    
```bash
    npm install gh-pages --save-dev
    ```

2.  **Add Scripts to `package.json`**: Open `package.json` and add these two lines inside the `"scripts"` object:
    
```json
    "scripts": {
      "dev": "vite",
      "build": "vite build",
      "lint": "eslint .",
      "preview": "vite preview",
      "predeploy": "npm run build",
      "deploy": "gh-pages -d dist"
    },
    ```

---

### Step 4: Deploy!

Run this command in your terminal:
```bash
npm run deploy