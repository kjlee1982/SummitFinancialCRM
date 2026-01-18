/**
 * src/utils/uploads.js
 * Handles file processing, Firebase Storage integration, and validation.
 */

import { stateManager } from '../state.js';

// Configuration
const MAX_FILE_SIZE_MB = 15;
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];

export const uploadManager = {
    
    /**
     * Main upload handler
     * @param {File} file - The file object from the input
     * @param {string} path - The storage path (e.g., 'deals/deal_123/docs')
     */
    async uploadFile(file, path) {
        // 1. Validation
        if (!this.validate(file)) return null;

        try {
            // Note: These Firebase functions are imported from your firebase.js config
            // const storageRef = ref(storage, `${path}/${file.name}`);
            
            console.log(`Uploading ${file.name} to ${path}...`);
            
            // Mocking the Firebase upload process for this structure:
            // const snapshot = await uploadBytes(storageRef, file);
            // const downloadURL = await getDownloadURL(snapshot.ref);

            const downloadURL = `https://firebasestorage.example.com/${path}/${file.name}`; // Mock URL

            // 2. Log the activity in the CRM
            stateManager.logActivity(`Uploaded document: ${file.name}`);

            return {
                name: file.name,
                url: downloadURL,
                type: file.type,
                size: file.size,
                uploadedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Failed to upload file. Check console for details.");
            return null;
        }
    },

    /**
     * Basic validation for size and type
     */
    validate(file) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            alert(`File too large. Max size is ${MAX_FILE_SIZE_MB}MB.`);
            return false;
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            alert("Unsupported file type. Please upload PDF, JPG, PNG, or Excel.");
            return false;
        }
        return true;
    },

    /**
     * Renders a standardized File Upload UI component
     */
    renderDropzone(containerId, onComplete) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 transition-colors cursor-pointer" id="drop-area">
                <i class="fa fa-cloud-upload-alt text-3xl text-gray-400 mb-3"></i>
                <p class="text-sm text-gray-600">Drag & drop files here or <span class="text-blue-600 font-bold">browse</span></p>
                <input type="file" id="file-input" class="hidden" multiple>
            </div>
            <div id="upload-progress-container" class="mt-4 hidden">
                <div class="w-full bg-gray-200 rounded-full h-1.5">
                    <div id="upload-progress-bar" class="bg-blue-600 h-1.5 rounded-full" style="width: 0%"></div>
                </div>
            </div>
        `;

        const input = container.querySelector('#file-input');
        const area = container.querySelector('#drop-area');

        area.onclick = () => input.click();
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                const result = await this.uploadFile(file, 'general_uploads');
                if (result) onComplete(result);
            }
        };
    }
};