(function() {
    const vscode = acquireVsCodeApi();
    let currentContent = null;
    let isReady = false;
    let clipboard = { type: null, data: null }; // Internal clipboard for images
    
    const editor = document.getElementById('editor');
    const saveBtn = document.getElementById('save-btn');
    const boldBtn = document.getElementById('bold-btn');
    const italicBtn = document.getElementById('italic-btn');
    const underlineBtn = document.getElementById('underline-btn');
    const imageBtn = document.getElementById('image-btn');
    const status = document.getElementById('status');

    // Initialize editor
    function initializeEditor() {
        console.log('Initializing editor...');
        
        // Set up event listeners
        editor.addEventListener('input', handleInput);
        editor.addEventListener('paste', handlePaste);
        editor.addEventListener('contextmenu', handleContextMenu);
        editor.addEventListener('keydown', handleKeydown);
        
        // Toolbar buttons
        saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Save button clicked');
            saveDocument();
        });
        
        boldBtn.addEventListener('click', (e) => {
            e.preventDefault();
            formatText('bold');
        });
        
        italicBtn.addEventListener('click', (e) => {
            e.preventDefault();
            formatText('italic');
        });
        
        underlineBtn.addEventListener('click', (e) => {
            e.preventDefault();
            formatText('underline');
        });
        
        imageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Image button clicked');
            insertImage();
        });

        // Update toolbar state on selection change
        document.addEventListener('selectionchange', updateToolbarState);
        
        // Focus editor
        editor.focus();
        
        // Notify extension that webview is ready
        isReady = true;
        vscode.postMessage({ type: 'ready' });
        
        updateStatus('Editor ready');
        console.log('Editor initialized successfully');
    }

    function updateStatus(message) {
        if (status) {
            status.textContent = message;
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        }
    }

    function handleInput(e) {
        console.log('Content changed');
        updateStatus('Typing...');
        
        // Debounce saving
        clearTimeout(window.saveTimeout);
        window.saveTimeout = setTimeout(() => {
            autoSave();
        }, 2000);
    }

    function handlePaste(event) {
        console.log('Paste event triggered');
        const items = event.clipboardData?.items;
        
        if (!items) return;
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log('Paste item type:', item.type);
            
            if (item.type.indexOf('image') !== -1) {
                console.log('Image detected in paste');
                event.preventDefault();
                
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    
                    reader.onload = function(e) {
                        console.log('Image read successfully, sending to extension');
                        vscode.postMessage({
                            type: 'pasteImage',
                            imageData: e.target.result
                        });
                    };
                    
                    reader.onerror = function(e) {
                        console.error('Error reading image:', e);
                        updateStatus('Error reading pasted image');
                    };
                    
                    reader.readAsDataURL(file);
                }
                return;
            }
        }
    }

    function handleContextMenu(event) {
        event.preventDefault();
        console.log('Context menu requested');
        
        const selection = window.getSelection();
        const selectedElement = event.target;
        const isImage = selectedElement.tagName === 'IMG';
        const hasTextSelection = selection && selection.toString().trim().length > 0;
        
        showContextMenu(event.clientX, event.clientY, {
            isImage,
            hasTextSelection,
            selectedElement,
            selection
        });
    }

    function showContextMenu(x, y, context) {
        // Remove existing menu
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Insert Image option
        const insertImageItem = createMenuItem('🖼️ Insert Image', () => {
            console.log('Context menu insert image clicked');
            insertImage();
            menu.remove();
        });
        menu.appendChild(insertImageItem);

        // Separator
        menu.appendChild(createSeparator());

        if (context.hasTextSelection) {
            // Cut Text
            const cutTextItem = createMenuItem('✂️ Cut', () => {
                document.execCommand('cut');
                updateStatus('Text cut to clipboard');
                menu.remove();
            });
            menu.appendChild(cutTextItem);

            // Copy Text
            const copyTextItem = createMenuItem('📋 Copy', () => {
                document.execCommand('copy');
                updateStatus('Text copied to clipboard');
                menu.remove();
            });
            menu.appendChild(copyTextItem);
        }

        if (context.isImage) {
            // Copy Image
            const copyImageItem = createMenuItem('📷 Copy Image', () => {
                copyImage(context.selectedElement);
                menu.remove();
            });
            menu.appendChild(copyImageItem);

            // Cut Image
            const cutImageItem = createMenuItem('✂️ Cut Image', () => {
                cutImage(context.selectedElement);
                menu.remove();
            });
            menu.appendChild(cutImageItem);

            // Delete Image
            const deleteImageItem = createMenuItem('🗑️ Delete Image', () => {
                deleteImage(context.selectedElement);
                menu.remove();
            });
            menu.appendChild(deleteImageItem);

            // Separator
            menu.appendChild(createSeparator());
        }

        // Paste options
        if (clipboard.type === 'image') {
            const pasteImageItem = createMenuItem('📷 Paste Image', () => {
                pasteImage();
                menu.remove();
            });
            menu.appendChild(pasteImageItem);
        }

        const pasteTextItem = createMenuItem('📝 Paste', () => {
            document.execCommand('paste');
            updateStatus('Content pasted');
            menu.remove();
        });
        menu.appendChild(pasteTextItem);

        // Separator
        menu.appendChild(createSeparator());

        // Select All
        const selectAllItem = createMenuItem('🔄 Select All', () => {
            document.execCommand('selectAll');
            updateStatus('All content selected');
            menu.remove();
        });
        menu.appendChild(selectAllItem);

        document.body.appendChild(menu);

        // Adjust position if menu goes off screen
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }

        // Remove menu on click outside
        setTimeout(() => {
            const removeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', removeMenu);
                }
            };
            document.addEventListener('click', removeMenu);
        }, 0);
    }

    function createMenuItem(text, onClick) {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.innerHTML = text;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
        });
        return item;
    }

    function createSeparator() {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        separator.style.cssText = `
            height: 1px;
            background-color: var(--vscode-menu-separatorBackground, #454545);
            margin: 4px 0;
        `;
        return separator;
    }

    function copyImage(imgElement) {
        clipboard = {
            type: 'image',
            data: {
                src: imgElement.src,
                alt: imgElement.alt,
                outerHTML: imgElement.outerHTML
            }
        };
        updateStatus('Image copied');
        console.log('Image copied to internal clipboard');
    }

    function cutImage(imgElement) {
        copyImage(imgElement);
        deleteImage(imgElement);
        updateStatus('Image cut');
    }

    function deleteImage(imgElement) {
        const parent = imgElement.parentElement;
        imgElement.remove();
        
        // If parent paragraph is now empty, add a line break
        if (parent && parent.tagName === 'P' && parent.innerHTML.trim() === '') {
            parent.innerHTML = '<br>';
        }
        
        updateStatus('Image deleted');
        autoSave();
    }

    function pasteImage() {
        if (clipboard.type === 'image' && clipboard.data) {
            const selection = window.getSelection();
            let range;
            
            if (selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
            } else {
                range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
            }
            
            // Create new image element
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = clipboard.data.outerHTML;
            const newImg = tempDiv.firstChild;
            
            // Create paragraph wrapper
            const p = document.createElement('p');
            p.appendChild(newImg);
            
            // Insert the paragraph
            range.deleteContents();
            range.insertNode(p);
            
            // Create new paragraph after image
            const newP = document.createElement('p');
            newP.innerHTML = '<br>';
            p.parentNode.insertBefore(newP, p.nextSibling);
            
            // Move cursor to new paragraph
            const newRange = document.createRange();
            newRange.selectNodeContents(newP);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            editor.focus();
            updateStatus('Image pasted');
            autoSave();
        }
    }

    function handleKeydown(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 's':
                    event.preventDefault();
                    console.log('Ctrl+S pressed');
                    saveDocument();
                    break;
                case 'b':
                    event.preventDefault();
                    formatText('bold');
                    break;
                case 'i':
                    event.preventDefault();
                    formatText('italic');
                    break;
                case 'u':
                    event.preventDefault();
                    formatText('underline');
                    break;
                case 'x':
                    // Handle cut for images
                    const selection = window.getSelection();
                    if (selection.anchorNode && selection.anchorNode.nodeType === Node.ELEMENT_NODE) {
                        const selectedElement = selection.anchorNode.querySelector('img');
                        if (selectedElement) {
                            event.preventDefault();
                            cutImage(selectedElement);
                        }
                    }
                    break;
                case 'c':
                    // Handle copy for images
                    const copySelection = window.getSelection();
                    if (copySelection.anchorNode && copySelection.anchorNode.nodeType === Node.ELEMENT_NODE) {
                        const selectedElement = copySelection.anchorNode.querySelector('img');
                        if (selectedElement) {
                            event.preventDefault();
                            copyImage(selectedElement);
                        }
                    }
                    break;
                case 'v':
                    // Handle paste for images
                    if (clipboard.type === 'image') {
                        event.preventDefault();
                        pasteImage();
                    }
                    break;
            }
        }
        
        // Delete key for images
        if (event.key === 'Delete' || event.key === 'Backspace') {
            const selection = window.getSelection();
            if (selection.anchorNode && selection.anchorNode.nodeType === Node.ELEMENT_NODE) {
                const selectedElement = selection.anchorNode.querySelector('img');
                if (selectedElement) {
                    event.preventDefault();
                    deleteImage(selectedElement);
                }
            }
        }
    }

    function formatText(command) {
        console.log('Formatting text:', command);
        document.execCommand(command, false, null);
        editor.focus();
        updateToolbarState();
    }

    function updateToolbarState() {
        try {
            boldBtn.classList.toggle('active', document.queryCommandState('bold'));
            italicBtn.classList.toggle('active', document.queryCommandState('italic'));
            underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
        } catch (e) {
            console.warn('Error updating toolbar state:', e);
        }
    }

    function insertImage() {
        console.log('Insert image requested');
        updateStatus('Opening file picker...');
        
        vscode.postMessage({
            type: 'insertImage'
        });
    }

    function saveDocument() {
        console.log('Saving document...');
        updateStatus('Saving...');
        
        const content = {
            content: editor.innerHTML,
            images: extractImagePaths(),
            lastModified: new Date().toISOString()
        };

        console.log('Saving content:', content);

        vscode.postMessage({
            type: 'save',
            content: content
        });

        // Visual feedback
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '✅';
        saveBtn.disabled = true;
        
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }, 1500);
        
        updateStatus('Saved successfully');
    }

    function autoSave() {
        console.log('Auto-saving...');
        saveDocument();
    }

    function extractImagePaths() {
        const images = editor.querySelectorAll('img');
        const imagePaths = {};
        
        images.forEach((img, index) => {
            const src = img.getAttribute('src');
            if (src) {
                imagePaths[`image_${index}`] = src;
            }
        });
        
        return imagePaths;
    }

    function loadContent(content) {
        console.log('Loading content:', content);
        
        if (content && content.content) {
            editor.innerHTML = content.content;
        } else if (typeof content === 'string') {
            editor.innerHTML = content;
        } else {
            editor.innerHTML = '<p>Start typing your note here...</p>';
        }
        
        updateStatus('Content loaded');
    }

    function insertImageAtCursor(imageUri, imagePath) {
        console.log('Inserting image at cursor:', imagePath);
        
        try {
            const selection = window.getSelection();
            let range;
            
            if (selection.rangeCount > 0) {
                range = selection.getRangeAt(0);
            } else {
                // If no selection, insert at end
                range = document.createRange();
                range.selectNodeContents(editor);
                range.collapse(false);
            }
            
            // Create image element
            const img = document.createElement('img');
            img.src = imageUri;
            img.alt = imagePath;
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            img.style.margin = '8px 0';
            img.style.cursor = 'pointer';
            
            // Make image selectable for context menu operations
            img.addEventListener('click', function(e) {
                e.preventDefault();
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNode(this);
                selection.removeAllRanges();
                selection.addRange(range);
            });
            
            // Create a paragraph wrapper for the image
            const p = document.createElement('p');
            p.appendChild(img);
            
            // Insert the paragraph
            range.deleteContents();
            range.insertNode(p);
            
            // Create a new paragraph after the image
            const newP = document.createElement('p');
            newP.innerHTML = '<br>';
            p.parentNode.insertBefore(newP, p.nextSibling);
            
            // Move cursor to the new paragraph
            const newRange = document.createRange();
            newRange.selectNodeContents(newP);
            newRange.collapse(true);
            selection.removeAllRanges();
            selection.addRange(newRange);
            
            editor.focus();
            updateStatus('Image inserted successfully');
            
            // Auto-save after inserting image
            setTimeout(() => {
                autoSave();
            }, 500);
            
        } catch (error) {
            console.error('Error inserting image:', error);
            updateStatus('Error inserting image');
        }
    }

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        console.log('Received message:', message.type);
        
        switch (message.type) {
            case 'update':
                if (isReady) {
                    currentContent = message.content;
                    loadContent(message.content);
                }
                break;
            case 'insertImage':
                console.log('Inserting image:', message.imagePath);
                insertImageAtCursor(message.imageUri, message.imagePath);
                break;
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeEditor);
    } else {
        initializeEditor();
    }
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (window.saveTimeout) {
            clearTimeout(window.saveTimeout);
            // Force save before unload
            saveDocument();
        }
    });
})();