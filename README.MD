# 🎬 Zenith Stream

**Zenith Stream** is a **local media server** designed to manage your personal movie and TV show library with a modern, clean interface.

---

## 🚀 1. Installation and Initial Setup

When you first launch the application, you will be directed to the **Settings** page. To ensure the application functions correctly, follow these initial setup steps:

1. **Select Media Directory (Required):**
   - Click the **"Select"** button under `Media Directory`.
   - Choose the primary folder on your computer where your video files are or will be stored  
     _(e.g., `D:\MyMovies` or `Desktop\Archive`)_.
   - _Note: The application will not fully start until this directory is set._

2. **TMDB API Key (Recommended):**
   - Enter your TMDB API Key under `TMDB API Key` to automatically fetch covers, summaries, and ratings.
   - You may leave this blank if you prefer Manual Entry for all content.

3. **Save and Restart:**
   - Click **"Save and Restart"** to apply the changes.
   - The application will automatically relaunch.

---

## 📺 2. Adding Content to Your Library

From the Dashboard, click the **"Add Series"** button in the control panel.

### A. Fetch via Link (Automatic)

This is the fastest way to add content if you have the TMDB API Key configured.

1. Select the **"Fetch via Link"** tab.
2. Paste the **IMDb link** of the content  
   _(e.g., `https://www.imdb.com/title/tt11855470/`)_.
3. Click **"Find"** to retrieve metadata and artwork.
4. Confirm and click **"Add This Content"**.

### B. Manual Entry

Use this method if you do not have an API key or prefer to input details manually.

1. Select the **"Manual Entry"** tab.
2. Choose the **Content Type** _(Series or Movie)_.
3. Provide the **Content Title** and upload a **Cover Image** _(both required)_.
4. Click **"Save"**.

---

## 📂 3. Library Management

### Managing Episodes and Files

1. Click any series or movie card on the Dashboard to view details.
2. **Add/Select Season:**
   - For TV series, use season buttons to navigate,
   - or click **"+ New Season"** to create a new folder structure inside your Media Directory.
3. **Upload Files:**
   - Click **"☁️ Upload File"** and choose video files from your computer.
   - Files will be moved/copied into the correct location under your Media Directory.
4. **Deleting Content:**
   - Use the 🗑️ icon on the series card or next to an episode/season to permanently delete the content  
     **and its physical files** from your hard drive.

---

## 📱 4. Mobile Companion App

Zenith Stream includes a local server function that allows streaming to the mobile companion app, provided both devices are on the same Wi-Fi network.

### Connection Steps

1. Open **Settings** in the desktop application.
2. Go to the **Mobile Connection** section.
3. A **QR Code** and the local address (`http://[IP Address]:[Port]`) will appear.
4. Use the Zenith Stream Mobile app to scan the QR code and instantly connect.

### 📦 Mobile App Repository

Source code and installation instructions:

➡️ **https://github.com/Batunash/Zenith-Stream-Mobile**

---

## 🌐 5. Built-in Web Downloader (Advanced Video Sniffer)

Zenith Stream comes with a powerful, built-in "1DM-style" web browser that automatically detects and downloads streaming videos from websites.

### Key Features:

- **Universal Sniffer:** Automatically catches `m3u8` (HLS) and `.mp4` video streams playing in the browser.
- **Smart Subtitle Integration:** Detects separate subtitle files (SRT, VTT) and automatically embeds them into a single `.mkv` file, complete with correct language tags (e.g., Türkçe, English, Forced).
- **Background Downloads:** Leverages FFmpeg to silently compile streams in the background while you navigate to other pages or manage your library.
- **Bypass Restrictions:** Spoofs User-Agent, Origin, and Referer headers exactly as your browser sends them to seamlessly bypass 403 Forbidden errors and Hotlink protections.

### How to use:

1. Click **"Web Downloader (1DM)"** from the Dashboard control panel.
2. Enter any URL or Google search term in the address bar.
3. Play a video on a webpage. The built-in sniffer will instantly catch the video streams and subtitles.
4. Click **Download** on the green panel. The file will be compiled and can be moved to your Media Directory.

---

## ⚠️ Important Disclaimer

**Zenith Stream is a Video Library Management and Organization Tool.**

This software is **not** a content provider. It is designed solely for indexing, organizing, and streaming legal video files already present on the user's local computer.

The user is fully responsible for all content added to the library and must comply with relevant copyright laws.  
Zenith Stream does **not** endorse or condone the unauthorized distribution or viewing of copyrighted material.
