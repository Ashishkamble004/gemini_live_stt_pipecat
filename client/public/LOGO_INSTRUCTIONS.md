# How to Add Your Logo

## Steps to add your logo image:

1. **Add your logo file:**
   - Place your logo image file (e.g., `logo.png`) in this `/client/public/` folder
   - Supported formats: PNG, SVG, JPG

2. **Update the HTML:**
   - Open `/client/index.html`
   - Find the logo section (around line 27)
   - Uncomment the image logo line and comment out the text logo:

```html
<!-- Option 1: Using text logo (current) -->
<!-- 
<div class="logo-text" id="text-logo">
  <h1>AI Voice Assistant</h1>
  <p>Powered by Google's AI - Gemini</p>
</div>
-->

<!-- Option 2: Using image logo (uncomment and add your logo.png to /client/public/ folder) -->
<img src="/logo.png" alt="Logo" class="logo-image" id="logo-image" />
```

3. **Update the CSS (if needed):**
   - Open `/client/src/style.css`
   - Find the `.logo-image` style (around line 40)
   - Change `display: none;` to `display: block;`
   - Or the CSS will automatically show it when you uncomment the HTML

4. **Adjust logo size (optional):**
   - In `/client/src/style.css`, modify the `.logo-image` properties:
   ```css
   .logo-image {
     max-height: 60px;     /* Adjust height */
     max-width: 250px;      /* Adjust width */
     object-fit: contain;
     display: block;
   }
   ```

5. **Rebuild the project:**
   ```bash
   cd client
   npm run build
   ```

That's it! Your logo will now appear in the header.
