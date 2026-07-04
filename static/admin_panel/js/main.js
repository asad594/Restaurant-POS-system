/* ----------------------------------------------------
 * FOOD HEAVEN CUSTOM ADMIN PANEL VANILLA JAVASCRIPT
 * ---------------------------------------------------- */

// Global Helpers & State
const globalState = {
    activeDeleteId: null,
    activeDeleteType: null, // 'category' or 'menuitem'
    activeDeleteName: '',
    categoriesCache: [] // Cache for menu dropdowns
};

document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
});

// CSRF Token Helper
function getCSRFToken() {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === 'csrftoken=') {
                cookieValue = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    return cookieValue;
}

// ----------------------------------------------------
// UI HELPERS (SPINNER, TOAST, SIDEBAR)
// ----------------------------------------------------
function showSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'flex';
}

function hideSpinner() {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = 'none';
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'danger' ? 'danger' : ''} ${type === 'warning' ? 'warning' : ''}`;
    
    let iconClass = 'fa-circle-check';
    if (type === 'danger') iconClass = 'fa-circle-exclamation';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    
    toast.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);
}

function initSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const collapseBtn = document.getElementById('sidebar-collapse-btn');
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');

    if (collapseBtn && sidebar) {
        collapseBtn.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('mobile-active');
        });
        
        document.addEventListener('click', (e) => {
            if (sidebar.classList.contains('mobile-active') && !sidebar.contains(e.target) && e.target !== mobileToggle) {
                sidebar.classList.remove('mobile-active');
            }
        });
    }
}

// Form Field Validation Highlight Helper
function validateFormFields(formElement) {
    let isValid = true;
    const requiredInputs = formElement.querySelectorAll('[required]');
    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('invalid');
            isValid = false;
            
            input.addEventListener('input', function handler() {
                if (this.value.trim()) {
                    this.classList.remove('invalid');
                    this.removeEventListener('input', handler);
                }
            });
        } else {
            input.classList.remove('invalid');
        }
    });
    return isValid;
}

// Close Modal helper
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Open Modal helper
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// ----------------------------------------------------
// 1. DASHBOARD PAGE LOGIC
// ----------------------------------------------------
function initDashboardPage() {
    showSpinner();
    
    // Fetch stats metrics
    fetch('/api/dashboard/stats/')
        .then(res => res.json())
        .then(stats => {
            document.getElementById('stat-orders-today').textContent = stats.today_orders_count || 0;
            document.getElementById('stat-revenue-today').textContent = `Rs. ${parseFloat(stats.today_revenue || 0).toFixed(2)}`;
            
            // Fetch total categories count
            return fetch('/api/categories/?all=true');
        })
        .then(res => res.json())
        .then(categories => {
            document.getElementById('stat-categories').textContent = categories.length;
            
            // Fetch total menu items count
            return fetch('/api/menu-items/?all=true');
        })
        .then(res => res.json())
        .then(items => {
            document.getElementById('stat-menu-items').textContent = items.length;
            
            // Fetch recent orders
            return fetch('/api/orders/');
        })
        .then(res => res.json())
        .then(orders => {
            const tbody = document.getElementById('recent-orders-body');
            tbody.innerHTML = '';
            
            // Take first 10 orders
            const recent = orders.slice(0, 10);
            
            if (recent.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No orders placed today yet.</td></tr>';
                return;
            }

            recent.forEach(order => {
                const tr = document.createElement('tr');
                const time = new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const orderTotal = parseFloat(order.total_amount) * 1.05; // Subtotal + 5% GST tax

                tr.innerHTML = `
                    <td style="font-weight: 700;">#${order.id}</td>
                    <td>${order.table_number === 'Takeaway' || !order.table_number ? 'Takeaway' : `Table ${order.table_number}`}</td>
                    <td>${order.items.length} items</td>
                    <td style="font-weight: 600; color: var(--color-green);">Rs. ${orderTotal.toFixed(2)}</td>
                    <td><span class="badge badge-${order.status}">${order.status}</span></td>
                    <td style="color: var(--text-muted);">${time}</td>
                `;
                tbody.appendChild(tr);
            });
        })
        .catch(err => {
            console.error('Error loading dashboard statistics:', err);
            showToast('Failed to load metrics data', 'danger');
        })
        .finally(() => {
            hideSpinner();
        });

    // Quick Add Admin Modal Logic
    const addAdminBtn = document.getElementById('btn-quick-add-admin');
    const adminModal = document.getElementById('admin-user-modal');
    const adminForm = document.getElementById('admin-user-form');
    
    if (addAdminBtn && adminModal) {
        addAdminBtn.addEventListener('click', () => {
            adminForm.reset();
            openModal('admin-user-modal');
        });

        document.getElementById('admin-user-modal-close').addEventListener('click', () => closeModal('admin-user-modal'));
        document.getElementById('admin-user-modal-cancel').addEventListener('click', () => closeModal('admin-user-modal'));

        adminForm.addEventListener('submit', (e) => {
            e.preventDefault();

            if (!validateFormFields(adminForm)) {
                showToast('Please correct the highlighted fields', 'danger');
                return;
            }

            const username = document.getElementById('admin-username').value;
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;
            const isSuperuser = document.getElementById('admin-superuser').checked;

            if (password.length < 6) {
                showToast('Password must be at least 6 characters long', 'danger');
                return;
            }

            showSpinner();

            fetch('/api/users/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    is_staff: true,
                    is_superuser: isSuperuser
                })
            })
            .then(async res => {
                const data = await res.json();
                if (res.ok) {
                    showToast('Admin user created successfully!');
                    closeModal('admin-user-modal');
                } else {
                    let errMsg = 'Failed to create admin user';
                    if (data.username) errMsg = data.username[0];
                    showToast(errMsg, 'danger');
                }
            })
            .catch(err => {
                console.error('Error creating admin user:', err);
                showToast('Network error creating admin user', 'danger');
            })
            .finally(() => {
                hideSpinner();
            });
        });
    }
}

// ----------------------------------------------------
// 2. CATEGORIES PAGE LOGIC
// ----------------------------------------------------
function initCategoriesPage() {
    const modal = document.getElementById('category-modal');
    const form = document.getElementById('category-form');
    const imageInput = document.getElementById('category-image');
    const previewContainer = document.getElementById('category-image-preview-container');
    const previewImg = document.getElementById('category-image-preview');
    const deleteModal = document.getElementById('delete-modal');

    // Trigger Categories List loading
    loadCategoriesList();

    // Add Category button
    document.getElementById('btn-add-category').addEventListener('click', () => {
        form.reset();
        document.getElementById('category-id').value = '';
        document.getElementById('category-modal-title').textContent = 'Add New Category';
        previewContainer.style.display = 'none';
        previewImg.src = '';
        openModal('category-modal');
    });

    // Image Preview change handler
    if (imageInput) {
        imageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                previewContainer.style.display = 'none';
            }
        });
    }

    // Modal Close
    document.getElementById('category-modal-close').addEventListener('click', () => closeModal('category-modal'));
    document.getElementById('category-modal-cancel').addEventListener('click', () => closeModal('category-modal'));

    // Submit handler (handles both POST and PUT/PATCH)
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        if (!validateFormFields(form)) {
            showToast('Please correct the highlighted fields', 'danger');
            return;
        }

        const id = document.getElementById('category-id').value;
        const formData = new FormData(form);
        
        // Convert checkbox to true/false string for backend standard
        formData.set('is_active', document.getElementById('category-active').checked);

        // If editing and no new file was selected, remove the empty file key to avoid serializer issues
        if (id && (!imageInput.files || imageInput.files.length === 0)) {
            formData.delete('image');
        }

        showSpinner();
        const url = id ? `/api/categories/${id}/` : '/api/categories/';
        const method = id ? 'PATCH' : 'POST';

        fetch(url, {
            method: method,
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                showToast(id ? 'Category updated successfully!' : 'Category created successfully!');
                closeModal('category-modal');
                loadCategoriesList();
            } else {
                showToast(data.name || 'Failed to save category', 'danger');
            }
        })
        .catch(err => {
            console.error('Error saving category:', err);
            showToast('Failed to save category due to network error', 'danger');
        })
        .finally(() => {
            hideSpinner();
        });
    });

    // Delete Modal Controls
    document.getElementById('delete-modal-close').addEventListener('click', () => closeModal('delete-modal'));
    document.getElementById('delete-modal-cancel').addEventListener('click', () => closeModal('delete-modal'));
    document.getElementById('delete-modal-confirm').addEventListener('click', confirmDeleteCategory);

    // Check query params if we were redirected with Add Category quick link
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('add') === 'true') {
        document.getElementById('btn-add-category').click();
    }
}

function loadCategoriesList() {
    showSpinner();
    fetch('/api/categories/?all=true')
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('categories-table-body');
            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No categories available. Click "Add New Category" to create one.</td></tr>';
                return;
            }

            data.forEach(cat => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>
                        <img src="${cat.image || '/static/images/placeholder.png'}" class="thumbnail-img" alt="${cat.name}">
                    </td>
                    <td style="font-weight: 600;">${cat.name}</td>
                    <td>
                        <label class="toggle-switch">
                            <input type="checkbox" class="cat-status-toggle" data-id="${cat.id}" ${cat.is_active ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-icon edit-btn cat-edit-btn" data-id="${cat.id}" data-name="${cat.name}" data-active="${cat.is_active}" data-image="${cat.image || ''}">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-icon delete-btn cat-delete-btn" data-id="${cat.id}" data-name="${cat.name}">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Status Toggles handlers
            document.querySelectorAll('.cat-status-toggle').forEach(chk => {
                chk.addEventListener('change', function() {
                    toggleCategoryStatus(this.dataset.id, this.checked);
                });
            });

            // Edit buttons handlers
            document.querySelectorAll('.cat-edit-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.dataset.id;
                    const name = this.dataset.name;
                    const isActive = this.dataset.active === 'true';
                    const image = this.dataset.image;

                    document.getElementById('category-id').value = id;
                    document.getElementById('category-name').value = name;
                    document.getElementById('category-active').checked = isActive;
                    document.getElementById('category-modal-title').textContent = 'Edit Category';
                    
                    const previewContainer = document.getElementById('category-image-preview-container');
                    const previewImg = document.getElementById('category-image-preview');
                    if (image) {
                        previewImg.src = image;
                        previewContainer.style.display = 'block';
                    } else {
                        previewContainer.style.display = 'none';
                        previewImg.src = '';
                    }

                    openModal('category-modal');
                });
            });

            // Delete buttons handlers
            document.querySelectorAll('.cat-delete-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    globalState.activeDeleteId = this.dataset.id;
                    globalState.activeDeleteType = 'category';
                    globalState.activeDeleteName = this.dataset.name;
                    
                    document.getElementById('delete-item-type').textContent = 'category';
                    document.getElementById('delete-item-name').textContent = this.dataset.name;
                    openModal('delete-modal');
                });
            });
        })
        .catch(err => {
            console.error('Error loading categories:', err);
            showToast('Failed to load categories', 'danger');
        })
        .finally(() => {
            hideSpinner();
        });
}

function toggleCategoryStatus(id, isActive) {
    fetch(`/api/categories/${id}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ is_active: isActive })
    })
    .then(async res => {
        if (res.ok) {
            showToast(`Category status toggled to ${isActive ? 'active' : 'inactive'}`);
        } else {
            showToast('Failed to toggle category status', 'danger');
            loadCategoriesList(); // revert
        }
    })
    .catch(err => {
        console.error('Error toggling category status:', err);
        showToast('Network error toggling status', 'danger');
        loadCategoriesList(); // revert
    });
}

function confirmDeleteCategory() {
    if (globalState.activeDeleteType !== 'category' || !globalState.activeDeleteId) return;

    closeModal('delete-modal');
    showSpinner();

    fetch(`/api/categories/${globalState.activeDeleteId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': getCSRFToken()
        }
    })
    .then(async res => {
        if (res.ok) {
            showToast(`Category "${globalState.activeDeleteName}" deleted successfully`);
            loadCategoriesList();
        } else {
            showToast('Failed to delete category. Make sure it contains no menu items.', 'danger');
        }
    })
    .catch(err => {
        console.error('Error deleting category:', err);
        showToast('Error deleting category due to network issues', 'danger');
    })
    .finally(() => {
        hideSpinner();
    });
}

// ----------------------------------------------------
// 3. MENU ITEMS PAGE LOGIC
// ----------------------------------------------------
function initMenuItemsPage() {
    const gridContainer = document.getElementById('menu-items-grid-container');
    const tableContainer = document.getElementById('menu-items-table-container');
    const viewGridBtn = document.getElementById('view-grid-btn');
    const viewTableBtn = document.getElementById('view-table-btn');
    
    const filterCat = document.getElementById('filter-category');
    const modalSelectCat = document.getElementById('menu-item-category');
    
    const modal = document.getElementById('menu-item-modal');
    const form = document.getElementById('menu-item-form');
    const imageInput = document.getElementById('menu-item-image');
    const previewContainer = document.getElementById('menu-item-image-preview-container');
    const previewImg = document.getElementById('menu-item-image-preview');
    const deleteModal = document.getElementById('delete-modal');

    let currentViewMode = 'grid'; // 'grid' or 'table'

    // Load initial categories dropdown and then load menu items
    showSpinner();
    fetch('/api/categories/?all=true')
        .then(res => res.json())
        .then(categories => {
            globalState.categoriesCache = categories;
            
            // Populate filters dropdown
            filterCat.innerHTML = '<option value="all">All Categories</option>';
            modalSelectCat.innerHTML = '<option value="">-- Select Category --</option>';
            
            categories.forEach(cat => {
                // filter dropdown option
                const opt1 = document.createElement('option');
                opt1.value = cat.id;
                opt1.textContent = cat.name;
                filterCat.appendChild(opt1);

                // modal select option
                const opt2 = document.createElement('option');
                opt2.value = cat.id;
                opt2.textContent = cat.name;
                modalSelectCat.appendChild(opt2);
            });

            // Now load Menu Items list
            return loadMenuItemsList();
        })
        .finally(() => {
            hideSpinner();
        });

    // View toggles listeners
    viewGridBtn.addEventListener('click', () => {
        currentViewMode = 'grid';
        viewGridBtn.classList.add('active');
        viewTableBtn.classList.remove('active');
        gridContainer.style.display = 'grid';
        tableContainer.style.display = 'none';
    });

    viewTableBtn.addEventListener('click', () => {
        currentViewMode = 'table';
        viewTableBtn.classList.add('active');
        viewGridBtn.classList.remove('active');
        gridContainer.style.display = 'none';
        tableContainer.style.display = 'block';
    });

    // Filter Change listener
    filterCat.addEventListener('change', filterItemsByCategory);

    // Search input listener
    const searchInput = document.getElementById('search-menu-items');
    if (searchInput) {
        searchInput.addEventListener('input', filterItemsByCategory);
    }

    // Open add item modal
    document.getElementById('btn-add-item').addEventListener('click', () => {
        form.reset();
        document.getElementById('menu-item-id').value = '';
        document.getElementById('menu-item-modal-title').textContent = 'Add New Menu Item';
        previewContainer.style.display = 'none';
        previewImg.src = '';
        openModal('menu-item-modal');
    });

    // Image Preview change handler via FileReader API
    if (imageInput) {
        imageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    previewImg.src = e.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                previewContainer.style.display = 'none';
            }
        });
    }

    // Modal close controls
    document.getElementById('menu-item-modal-close').addEventListener('click', () => closeModal('menu-item-modal'));
    document.getElementById('menu-item-modal-cancel').addEventListener('click', () => closeModal('menu-item-modal'));

    // Submit handler
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!validateFormFields(form)) {
            showToast('Please correct the highlighted fields', 'danger');
            return;
        }

        const id = document.getElementById('menu-item-id').value;
        const formData = new FormData(form);
        
        // Convert checkbox state to true/false string
        formData.set('is_available', document.getElementById('menu-item-available').checked);

        // If editing and no new file was selected, remove the empty file key to avoid serializer issues
        if (id && (!imageInput.files || imageInput.files.length === 0)) {
            formData.delete('image');
        }

        showSpinner();
        const url = id ? `/api/menu-items/${id}/` : '/api/menu-items/';
        const method = id ? 'PATCH' : 'POST';

        fetch(url, {
            method: method,
            headers: {
                'X-CSRFToken': getCSRFToken()
            },
            body: formData
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                showToast(id ? 'Menu Item updated successfully!' : 'Menu Item created successfully!');
                closeModal('menu-item-modal');
                loadMenuItemsList();
            } else {
                showToast('Failed to save menu item. Check price format.', 'danger');
            }
        })
        .catch(err => {
            console.error('Error saving menu item:', err);
            showToast('Failed to save menu item due to network error', 'danger');
        })
        .finally(() => {
            hideSpinner();
        });
    });

    // Delete Confirm Modal Close
    document.getElementById('delete-modal-close').addEventListener('click', () => closeModal('delete-modal'));
    document.getElementById('delete-modal-cancel').addEventListener('click', () => closeModal('delete-modal'));
    document.getElementById('delete-modal-confirm').addEventListener('click', confirmDeleteMenuItem);

    // Check query params if redirected from Quick Actions Add button
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('add') === 'true') {
        document.getElementById('btn-add-item').click();
    }
}

function loadMenuItemsList() {
    showSpinner();
    return fetch('/api/menu-items/?all=true')
        .then(res => res.json())
        .then(data => {
            const gridContainer = document.getElementById('menu-items-grid-container');
            const tbody = document.getElementById('menu-items-table-body');
            
            gridContainer.innerHTML = '';
            tbody.innerHTML = '';

            if (data.length === 0) {
                const emptyHTML = '<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem;">No menu items found. Click "Add New Item" to create one.</div>';
                gridContainer.innerHTML = emptyHTML;
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No items.</td></tr>';
                return;
            }

            data.forEach(item => {
                const categoryObj = globalState.categoriesCache.find(c => c.id === item.category);
                const categoryName = categoryObj ? categoryObj.name : 'Unassigned';
                const formattedPrice = parseFloat(item.price).toFixed(2);

                // 1. Render Card for Grid
                const card = document.createElement('div');
                card.className = 'menu-item-card';
                card.dataset.id = item.id;
                card.dataset.category = item.category;
                card.innerHTML = `
                    <div class="card-img-wrapper">
                        <img src="${item.image || '/static/images/placeholder.png'}" class="card-img" alt="${item.name}">
                        <span class="card-badge">${categoryName}</span>
                    </div>
                    <div class="card-body">
                        <h4 class="card-item-name">${item.name}${item.size ? ` (${item.size})` : ''}</h4>
                        <p class="card-item-desc">${item.description || 'No description provided.'}</p>
                        <div class="card-footer-row">
                            <span class="card-price">Rs. ${formattedPrice}</span>
                            <label class="toggle-switch">
                                <input type="checkbox" class="item-status-toggle" data-id="${item.id}" ${item.is_available ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                        </div>
                        <div class="actions-cell" style="margin-top:0.75rem; justify-content: flex-end;">
                            <button class="btn-icon edit-btn item-edit-btn" data-id="${item.id}" data-name="${item.name}" data-category="${item.category}" data-size="${item.size || ''}" data-price="${item.price}" data-desc="${item.description || ''}" data-available="${item.is_available}" data-image="${item.image || ''}">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-icon delete-btn item-delete-btn" data-id="${item.id}" data-name="${item.name}">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </div>
                `;
                gridContainer.appendChild(card);

                // 2. Render Row for Table
                const tr = document.createElement('tr');
                tr.dataset.id = item.id;
                tr.dataset.category = item.category;
                tr.innerHTML = `
                    <td>
                        <img src="${item.image || '/static/images/placeholder.png'}" class="thumbnail-img" alt="${item.name}">
                    </td>
                    <td style="font-weight:600;">${item.name}${item.size ? ` (${item.size})` : ''}</td>
                    <td><span class="badge" style="background-color:rgba(165,94,234,0.15); color:#a55eea;">${categoryName}</span></td>
                    <td style="font-weight:700; color:var(--color-green);">Rs. ${formattedPrice}</td>
                    <td>
                        <label class="toggle-switch">
                            <input type="checkbox" class="item-status-toggle" data-id="${item.id}" ${item.is_available ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </td>
                    <td>
                        <div class="actions-cell">
                            <button class="btn-icon edit-btn item-edit-btn" data-id="${item.id}" data-name="${item.name}" data-category="${item.category}" data-size="${item.size || ''}" data-price="${item.price}" data-desc="${item.description || ''}" data-available="${item.is_available}" data-image="${item.image || ''}">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-icon delete-btn item-delete-btn" data-id="${item.id}" data-name="${item.name}">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Bind Availability Toggles
            document.querySelectorAll('.item-status-toggle').forEach(chk => {
                chk.addEventListener('change', function() {
                    toggleItemAvailability(this.dataset.id, this.checked);
                });
            });

            // Bind Edit Buttons
            document.querySelectorAll('.item-edit-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const id = this.dataset.id;
                    const name = this.dataset.name;
                    const category = this.dataset.category;
                    const size = this.dataset.size || '';
                    const price = this.dataset.price;
                    const desc = this.dataset.desc;
                    const isAvailable = this.dataset.available === 'true';
                    const image = this.dataset.image;

                    document.getElementById('menu-item-id').value = id;
                    document.getElementById('menu-item-category').value = category;
                    document.getElementById('menu-item-name').value = name;
                    document.getElementById('menu-item-size').value = size;
                    document.getElementById('menu-item-price').value = price;
                    document.getElementById('menu-item-desc').value = desc;
                    document.getElementById('menu-item-available').checked = isAvailable;
                    
                    document.getElementById('menu-item-modal-title').textContent = 'Edit Menu Item';
                    
                    const previewContainer = document.getElementById('menu-item-image-preview-container');
                    const previewImg = document.getElementById('menu-item-image-preview');
                    if (image) {
                        previewImg.src = image;
                        previewContainer.style.display = 'block';
                    } else {
                        previewContainer.style.display = 'none';
                        previewImg.src = '';
                    }

                    openModal('menu-item-modal');
                });
            });

            // Bind Delete Buttons
            document.querySelectorAll('.item-delete-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    globalState.activeDeleteId = this.dataset.id;
                    globalState.activeDeleteType = 'menuitem';
                    globalState.activeDeleteName = this.dataset.name;
                    
                    document.getElementById('delete-item-type').textContent = 'menu item';
                    document.getElementById('delete-item-name').textContent = this.dataset.name;
                    openModal('delete-modal');
                });
            });

            // Re-apply filters if active dropdown is selected
            filterItemsByCategory();
        })
        .catch(err => {
            console.error('Error loading menu items:', err);
            showToast('Failed to load menu items', 'danger');
        });
}

function filterItemsByCategory() {
    const selected = document.getElementById('filter-category').value;
    const searchInput = document.getElementById('search-menu-items');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const cards = document.querySelectorAll('.menu-item-card');
    const rows = document.querySelectorAll('#menu-items-table-body tr');

    // Filter Grid Cards
    cards.forEach(card => {
        const nameEl = card.querySelector('.card-item-name');
        const descEl = card.querySelector('.card-item-desc');
        const name = nameEl ? nameEl.textContent.toLowerCase() : '';
        const desc = descEl ? descEl.textContent.toLowerCase() : '';
        const matchesCategory = (selected === 'all' || card.dataset.category === selected);
        const matchesSearch = (!query || name.includes(query) || desc.includes(query));

        if (matchesCategory && matchesSearch) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });

    // Filter Table Rows
    rows.forEach(row => {
        const nameCell = row.cells[1];
        const name = nameCell ? nameCell.textContent.toLowerCase() : '';
        const matchesCategory = (selected === 'all' || row.dataset.category === selected);
        const matchesSearch = (!query || name.includes(query));

        if (matchesCategory && matchesSearch) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
}

function toggleItemAvailability(id, isAvailable) {
    fetch(`/api/menu-items/${id}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ is_available: isAvailable })
    })
    .then(async res => {
        if (res.ok) {
            showToast(`Item availability set to ${isAvailable ? 'available' : 'unavailable'}`);
            // Sync status switches (both card and row) in the page
            document.querySelectorAll(`.item-status-toggle[data-id="${id}"]`).forEach(chk => {
                chk.checked = isAvailable;
            });
        } else {
            showToast('Failed to toggle item availability', 'danger');
            loadMenuItemsList();
        }
    })
    .catch(err => {
        console.error('Error toggling item availability:', err);
        showToast('Network error toggling item availability', 'danger');
        loadMenuItemsList();
    });
}

function confirmDeleteMenuItem() {
    if (globalState.activeDeleteType !== 'menuitem' || !globalState.activeDeleteId) return;

    closeModal('delete-modal');
    showSpinner();

    fetch(`/api/menu-items/${globalState.activeDeleteId}/`, {
        method: 'DELETE',
        headers: {
            'X-CSRFToken': getCSRFToken()
        }
    })
    .then(async res => {
        if (res.ok) {
            showToast(`Item "${globalState.activeDeleteName}" deleted successfully`);
            loadMenuItemsList();
        } else {
            showToast('Failed to delete item', 'danger');
        }
    })
    .catch(err => {
        console.error('Error deleting menu item:', err);
        showToast('Error deleting item due to network issues', 'danger');
    })
    .finally(() => {
        hideSpinner();
    });
}

// ----------------------------------------------------
// 4. ORDERS PAGE LOGIC
// ----------------------------------------------------
let autoRefreshTimer = null;
let refreshSecondsLeft = 30;

function initOrdersPage() {
    loadOrdersList();

    // Bind Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterOrdersByBadge(this.dataset.status);
        });
    });

    // Start auto-refresh interval (30 seconds)
    startRefreshCountdown();
}

function startRefreshCountdown() {
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    
    refreshSecondsLeft = 30;
    const countdownEl = document.getElementById('refresh-countdown');
    if (countdownEl) countdownEl.textContent = refreshSecondsLeft;

    autoRefreshTimer = setInterval(() => {
        refreshSecondsLeft -= 1;
        if (countdownEl) countdownEl.textContent = refreshSecondsLeft;

        if (refreshSecondsLeft <= 0) {
            refreshSecondsLeft = 30;
            loadOrdersList();
        }
    }, 1000);
}

function loadOrdersList() {
    const tbody = document.getElementById('orders-table-body');
    
    return fetch('/api/orders/')
        .then(res => res.json())
        .then(orders => {
            tbody.innerHTML = '';

            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No orders placed yet.</td></tr>';
                return;
            }

            orders.forEach(order => {
                const tr = document.createElement('tr');
                tr.className = 'order-row';
                tr.dataset.id = order.id;
                tr.dataset.status = order.status;

                const time = new Date(order.created_at).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' });
                const orderSubtotal = parseFloat(order.total_amount);
                const orderTax = orderSubtotal * 0.05;
                const orderGrandTotal = orderSubtotal + orderTax;

                tr.innerHTML = `
                    <td class="toggle-expand-trigger"><i class="fa-solid fa-chevron-right accordion-toggle-icon"></i></td>
                    <td style="font-weight: 700;">#${order.id}</td>
                    <td>${order.table_number === 'Takeaway' || !order.table_number ? 'Takeaway' : `Table ${order.table_number}`}</td>
                    <td>${order.items.length} items</td>
                    <td style="font-weight: 600; color: var(--color-green);">Rs. ${orderGrandTotal.toFixed(2)}</td>
                    <td><span class="badge badge-${order.status}" id="status-badge-${order.id}">${order.status}</span></td>
                    <td style="color: var(--text-muted);">${time}</td>
                    <td>
                        <select class="select-status-inline order-status-select" data-id="${order.id}">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="preparing" ${order.status === 'preparing' ? 'selected' : ''}>Preparing</option>
                            <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                            <option value="served" ${order.status === 'served' ? 'selected' : ''}>Served</option>
                        </select>
                    </td>
                `;

                // Accordion details expanding block
                const detailTr = document.createElement('tr');
                detailTr.className = 'order-detail-row';
                detailTr.id = `details-${order.id}`;
                detailTr.style.display = 'none';
                
                detailTr.innerHTML = `
                    <td colspan="8" class="order-details-expanded">
                        <div class="details-wrapper">
                            <div>
                                <h4 class="details-title">Order Items Details</h4>
                                <div class="expand-items-list">
                                    ${order.items.map(item => `
                                        <div class="expand-item-row">
                                            <span>
                                                <span class="expand-item-name">${item.menu_item_detail ? item.menu_item_detail.name : 'Unknown Item'}</span>
                                                <span class="expand-item-qty">x${item.quantity}</span>
                                            </span>
                                            <span class="expand-item-price">Rs. ${(parseFloat(item.menu_item_detail ? item.menu_item_detail.price : 0) * item.quantity).toFixed(2)}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            <div>
                                <h4 class="details-title">Billing Aggregates</h4>
                                <div class="details-grid-info">
                                    <div class="info-label-val">
                                        <span>Subtotal:</span>
                                        <span>Rs. ${orderSubtotal.toFixed(2)}</span>
                                    </div>
                                    <div class="info-label-val">
                                        <span>GST Tax (5%):</span>
                                        <span>Rs. ${orderTax.toFixed(2)}</span>
                                    </div>
                                    <div class="info-label-val" style="border-top:1px dashed var(--border-color); padding-top:0.35rem; margin-top:0.35rem;">
                                        <span style="font-weight:700;">Grand Total:</span>
                                        <span style="font-weight:700; color:var(--color-green);">Rs. ${orderGrandTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </td>
                `;

                tbody.appendChild(tr);
                tbody.appendChild(detailTr);
            });

            // Accordion click bindings
            document.querySelectorAll('.toggle-expand-trigger').forEach(trigger => {
                trigger.addEventListener('click', function() {
                    const row = this.closest('.order-row');
                    const id = row.dataset.id;
                    const detailRow = document.getElementById(`details-${id}`);
                    
                    row.classList.toggle('expanded');
                    if (row.classList.contains('expanded')) {
                        detailRow.style.display = 'table-row';
                    } else {
                        detailRow.style.display = 'none';
                    }
                });
            });

            // Status select inline change bindings
            document.querySelectorAll('.order-status-select').forEach(sel => {
                sel.addEventListener('change', function() {
                    updateOrderStatus(this.dataset.id, this.value);
                });
            });

            // Re-apply filter badge
            const activeFilter = document.querySelector('.filter-btn.active').dataset.status;
            filterOrdersByBadge(activeFilter);
        })
        .catch(err => {
            console.error('Error fetching orders:', err);
            showToast('Failed to load orders', 'danger');
        });
}

function filterOrdersByBadge(statusFilter) {
    const rows = document.querySelectorAll('.order-row');
    rows.forEach(row => {
        const id = row.dataset.id;
        const detailsRow = document.getElementById(`details-${id}`);
        const status = row.dataset.status;

        if (statusFilter === 'all' || status === statusFilter) {
            row.style.display = 'table-row';
            // If the row was expanded previously, show details. Otherwise keep hidden.
            if (row.classList.contains('expanded')) {
                detailsRow.style.display = 'table-row';
            }
        } else {
            row.style.display = 'none';
            detailsRow.style.display = 'none';
        }
    });
}

function updateOrderStatus(id, newStatus) {
    showSpinner();
    fetch(`/api/orders/${id}/update-status/`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ status: newStatus })
    })
    .then(async res => {
        if (res.ok) {
            showToast(`Order #${id} status updated to: ${newStatus}`);
            // Update local row status state
            const row = document.querySelector(`.order-row[data-id="${id}"]`);
            if (row) {
                row.dataset.status = newStatus;
            }
            
            // Update badge text and class
            const badge = document.getElementById(`status-badge-${id}`);
            if (badge) {
                badge.textContent = newStatus;
                badge.className = `badge badge-${newStatus}`;
            }

            // Re-apply filters in case the status mismatch current filter
            const activeFilter = document.querySelector('.filter-btn.active').dataset.status;
            filterOrdersByBadge(activeFilter);
        } else {
            showToast('Failed to update status', 'danger');
            loadOrdersList(); // revert
        }
    })
    .catch(err => {
        console.error('Error updating order status:', err);
        showToast('Network error updating status', 'danger');
        loadOrdersList(); // revert
    })
    .finally(() => {
        hideSpinner();
    });
}

// ----------------------------------------------------
// 5. TABLES PAGE LOGIC
// ----------------------------------------------------
function initTablesPage() {
    loadTablesGrid();

    // Auto-refresh tables grid every 30 seconds without full page reload
    if (window.tableRefreshTimer) clearInterval(window.tableRefreshTimer);
    window.tableRefreshTimer = setInterval(() => {
        loadTablesGrid();
    }, 30000); // 30 seconds

    const form = document.getElementById('table-form');
    const modal = document.getElementById('table-modal');

    // Add Table Button
    document.getElementById('btn-add-table').addEventListener('click', () => {
        form.reset();
        document.getElementById('table-status').checked = true; // Free
        openModal('table-modal');
    });

    // Close Modal Controls
    document.getElementById('table-modal-close').addEventListener('click', () => closeModal('table-modal'));
    document.getElementById('table-modal-cancel').addEventListener('click', () => closeModal('table-modal'));

    // Submit handler (handles table creation)
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        if (!validateFormFields(form)) {
            showToast('Please correct the highlighted fields', 'danger');
            return;
        }

        const number = document.getElementById('table-number').value;
        const capacity = document.getElementById('table-capacity').value;
        const isFree = document.getElementById('table-status').checked;
        const statusVal = isFree ? 'free' : 'occupied';

        showSpinner();

        fetch('/api/tables/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCSRFToken()
            },
            body: JSON.stringify({
                number: parseInt(number),
                capacity: parseInt(capacity),
                status: statusVal
            })
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                showToast('Table added successfully!');
                closeModal('table-modal');
                loadTablesGrid();
            } else {
                showToast(data.number || 'Failed to create table. Number already exists.', 'danger');
            }
        })
        .catch(err => {
            console.error('Error creating table:', err);
            showToast('Failed to create table due to network error', 'danger');
        })
        .finally(() => {
            hideSpinner();
        });
    });
}

function loadTablesGrid() {
    showSpinner();
    fetch('/api/tables/')
        .then(res => res.json())
        .then(data => {
            const gridContainer = document.getElementById('tables-grid-container');
            gridContainer.innerHTML = '';

            if (data.length === 0) {
                gridContainer.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem;">No dining tables registered. Click "Add New Table".</div>';
                return;
            }

            data.forEach(table => {
                const card = document.createElement('div');
                card.className = `table-card ${table.status}`;
                card.dataset.id = table.id;
                card.dataset.status = table.status;

                card.innerHTML = `
                    <div class="table-icon-wrapper">
                        <i class="fa-solid fa-chair"></i>
                    </div>
                    <div class="table-number">Table ${table.number}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted); font-weight:500; display:flex; align-items:center; justify-content:center; gap:5px;">
                        <span>Capacity: ${table.capacity} seats</span>
                        <button class="edit-seats-btn" data-id="${table.id}" data-capacity="${table.capacity}" style="background:none; border:none; color:var(--color-green); cursor:pointer; padding:2px; display:inline-flex; align-items:center;" title="Edit Seating Capacity">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                    </div>
                    <div class="table-status-label">${table.status}</div>
                `;

                // Add click toggle listener
                card.addEventListener('click', () => {
                    const newStatus = card.dataset.status === 'free' ? 'occupied' : 'free';
                    toggleTableStatus(table.id, newStatus);
                });

                // Add capacity edit listener
                const editBtn = card.querySelector('.edit-seats-btn');
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Stop click from toggling status
                        const currentCap = parseInt(editBtn.dataset.capacity);
                        const newCapStr = prompt(`Enter new seating capacity for Table ${table.number}:`, currentCap);
                        if (newCapStr !== null) {
                            const newCap = parseInt(newCapStr);
                            if (isNaN(newCap) || newCap < 1 || newCap > 20) {
                                showToast("Please enter a valid capacity between 1 and 20.", "danger");
                            } else {
                                updateTableCapacity(table.id, newCap);
                            }
                        }
                    });
                }

                gridContainer.appendChild(card);
            });
        })
        .catch(err => {
            console.error('Error loading tables:', err);
            showToast('Failed to load tables', 'danger');
        })
        .finally(() => {
            hideSpinner();
        });
}

function toggleTableStatus(id, newStatus) {
    showSpinner();
    fetch(`/api/tables/${id}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ status: newStatus })
    })
    .then(async res => {
        if (res.ok) {
            showToast(`Table status toggled to ${newStatus}`);
            loadTablesGrid();
        } else {
            showToast('Failed to update table status', 'danger');
        }
    })
    .catch(err => {
        console.error('Error toggling table status:', err);
        showToast('Network error toggling table status', 'danger');
    })
    .finally(() => {
        hideSpinner();
    });
}

function updateTableCapacity(id, newCapacity) {
    showSpinner();
    fetch(`/api/tables/${id}/`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({ capacity: newCapacity })
    })
    .then(async res => {
        if (res.ok) {
            showToast(`Table capacity updated successfully`);
            loadTablesGrid();
        } else {
            showToast('Failed to update table capacity', 'danger');
        }
    })
    .catch(err => {
        console.error('Error updating table capacity:', err);
        showToast('Network error updating table capacity', 'danger');
    })
    .finally(() => {
        hideSpinner();
    });
}

// ----------------------------------------------------
// 6. PAYMENTS PAGE LOGIC
// ----------------------------------------------------
function initPaymentsPage() {
    loadPaymentsList();

    const startInput = document.getElementById('filter-start-date');
    const endInput = document.getElementById('filter-end-date');

    // Date change listeners
    startInput.addEventListener('change', filterPaymentsByDate);
    endInput.addEventListener('change', filterPaymentsByDate);

    // Clear filters button
    document.getElementById('btn-clear-date-filter').addEventListener('click', () => {
        startInput.value = '';
        endInput.value = '';
        filterPaymentsByDate();
    });
}

function loadPaymentsList() {
    showSpinner();
    fetch('/api/payments/')
        .then(res => res.json())
        .then(data => {
            const tbody = document.getElementById('payments-table-body');
            tbody.innerHTML = '';

            if (data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No payment logs recorded yet.</td></tr>';
                document.getElementById('payments-total-sum').textContent = 'Rs. 0.00';
                return;
            }

            data.forEach(payment => {
                const tr = document.createElement('tr');
                tr.className = 'payment-row';
                tr.dataset.timestamp = payment.timestamp; // keep ISO timestamp for date comparison
                
                const time = new Date(payment.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short', year: 'numeric' });
                const paid = parseFloat(payment.amount_paid);
                const change = parseFloat(payment.change_returned || 0);
                const earned = paid - change;

                tr.innerHTML = `
                    <td style="font-weight: 700;">#${payment.id}</td>
                    <td>Order #${payment.order}</td>
                    <td><span class="method-badge ${payment.method}">${payment.method}</span></td>
                    <td style="color: var(--text-muted);">Rs. ${paid.toFixed(2)}</td>
                    <td style="color: var(--text-muted);">Rs. ${change.toFixed(2)}</td>
                    <td style="font-weight: 600; color: var(--color-green);">Rs. ${earned.toFixed(2)}</td>
                    <td>${payment.cashier_name || 'N/A'}</td>
                    <td style="color: var(--text-muted);">${time}</td>
                `;
                tbody.appendChild(tr);
            });

            // Apply date filters initially (e.g. if inputs are pre-filled or empty)
            filterPaymentsByDate();
        })
        .catch(err => {
            console.error('Error loading payments list:', err);
            showToast('Failed to load payment logs', 'danger');
        })
        .finally(() => {
            hideSpinner();
        });
}

function filterPaymentsByDate() {
    const startVal = document.getElementById('filter-start-date').value;
    const endVal = document.getElementById('filter-end-date').value;
    const rows = document.querySelectorAll('.payment-row');

    rows.forEach(row => {
        const timestamp = new Date(row.dataset.timestamp);

        // Convert payment timestamp to local YYYY-MM-DD string
        // using local time methods so timezone offsets don't shift the date
        const localYear  = timestamp.getFullYear();
        const localMonth = ('0' + (timestamp.getMonth() + 1)).slice(-2);
        const localDay   = ('0' + timestamp.getDate()).slice(-2);
        const localDateStr = `${localYear}-${localMonth}-${localDay}`;

        let visible = true;
        if (startVal && localDateStr < startVal) visible = false;
        if (endVal   && localDateStr > endVal)   visible = false;

        row.style.display = visible ? 'table-row' : 'none';
    });

    // Re-calculate the filtered revenue sum
    calculateFilteredPaymentsTotal();
}

function calculateFilteredPaymentsTotal() {
    const rows = document.querySelectorAll('.payment-row');
    let totalRevenue = 0;

    rows.forEach(row => {
        if (row.style.display !== 'none') {
            // Earned is the 6th cell (index 5) - e.g. "Rs. 700.00"
            const cellText = row.cells[5].textContent;
            const val = parseFloat(cellText.replace('Rs. ', '')) || 0;
            totalRevenue += val;
        }
    });

    document.getElementById('payments-total-sum').textContent = `Rs. ${totalRevenue.toFixed(2)}`;
}
