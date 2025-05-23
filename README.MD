# Rich Notes Extension for VS Code

A Visual Studio Code extension that allows you to create rich-text notes with inline images.

## Features

- Create `.note` files with rich text editing
- Insert images inline (not just markdown links)
- Right-click context menu to insert images
- Paste images directly with Ctrl+V
- Basic text formatting (bold, italic, underline)
- Auto-save functionality
- Images are automatically copied to workspace `/images` folder

## Installation & Setup

1. Clone or download this project
2. Open the project folder in VS Code
3. Open terminal and run:
   ```bash
   npm install
   npm run compile
   ```
4. Press `F5` to launch Extension Development Host
5. In the new VS Code window, create a new file with `.note` extension
6. Start editing your rich note!

## Usage

1. Create a new `.note` file or use Command Palette: "Rich Notes: Create New Note"
2. Use the toolbar buttons for formatting
3. Right-click anywhere to insert images
4. Images are automatically saved to `/images` folder in your workspace
5. Files are saved in JSON format containing both text and image references

## Keyboard Shortcuts

- `Ctrl+S` / `Cmd+S`: Save
- `Ctrl+B` / `Cmd+B`: Bold
- `Ctrl+I` / `Cmd+I`: Italic  
- `Ctrl+U` / `Cmd+U`: Underline

## File Format

Notes are saved as JSON files containing:
- `content`: HTML content of the note
- `images`: Object mapping image references
- `lastModified`: Timestamp of last modification
```

## Setup Instructions

1. **Create Project Folder:**
   ```bash
   mkdir vscode-rich-notes
   cd vscode-rich-notes
   ```

2. **Copy Files:** Copy all the files above into their respective folders according to the project structure.

3. **Install Dependencies:**
   ```bash
   npm install
   ```

4. **Compile TypeScript:**
   ```bash
   npm run compile
   ```

5. **Test the Extension:**
   - Open the project in VS Code
   - Press `F5` to launch Extension Development Host
   - In the new window, create a file with `.note` extension
   - Start using your rich note editor!

## Key Features Implemented

✅ Custom `.note` file type support
✅ Rich text editor with inline images  
✅ Right-click context menu for image insertion
✅ File picker for selecting images
✅ Automatic image copying to `/images` folder
✅ Paste image support with Ctrl+V
✅ Basic text formatting (bold, italic, underline)
✅ Auto-save functionality
✅ JSON-based file format for persistence

The extension creates a fully functional rich-text editor inside VS Code that handles images like a word processor, while maintaining compatibility with version control systems by storing everything in a structured JSON format.