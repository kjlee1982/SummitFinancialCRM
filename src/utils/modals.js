/**
 * src/utils/modals.js
 * Standardized system for all Add/Edit forms and detail popups.
 */

export const modalManager = {
    /**
     * @param {string} title - The heading of the modal
     * @param {string} htmlContent - The form or content to display
     * @param {Function} onSave - Callback when the primary button is clicked
     */
    show(title, htmlContent, onSave) {
        const backdrop = document.getElementById('modal-backdrop');
        const content = document.getElementById('modal-content');

        content.innerHTML = `
            <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                <h3 class="text-xl font-bold text-gray-800">${title}</h3>
                <button id="modal-close" class="text-gray-400 hover:text-gray-600 transition-colors">
                    <i class="fa fa-times text-xl"></i>
                </button>
            </div>
            <div class="p-8">
                ${htmlContent}
                <div class="mt-8 flex justify-end gap-3">
                    <button id="modal-cancel" class="px-6 py-2.5 rounded-lg text-gray-500 font-semibold hover:bg-gray-100 transition-all">
                        Cancel
                    </button>
                    <button id="modal-submit" class="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all shadow-md">
                        Save Changes
                    </button>
                </div>
            </div>
        `;

        backdrop.classList.remove('hidden');
        backdrop.classList.add('flex');

        // Setup Listeners
        const close = () => {
            backdrop.classList.add('hidden');
            backdrop.classList.remove('flex');
        };

        content.querySelector('#modal-close').onclick = close;
        content.querySelector('#modal-cancel').onclick = close;
        
        content.querySelector('#modal-submit').onclick = () => {
            const formData = this.getFormData(content);
            onSave(formData);
            close();
        };
    },

    /**
     * Automatically extracts all input values into a JSON object
     */
    getFormData(container) {
        const data = {};
        container.querySelectorAll('input, select, textarea').forEach(el => {
            if (el.id) data[el.id] = el.value;
        });
        return data;
    }
};