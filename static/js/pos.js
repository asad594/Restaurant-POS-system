// POS System JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Determine active page
    if (document.getElementById('pos-register-page')) {
        initPOSRegister();
    } else if (document.getElementById('kitchen-display-page')) {
        initKitchenDisplay();
    } else if (document.getElementById('analytics-dashboard-page')) {
        initAnalyticsDashboard();
    } else if (document.getElementById('bill-receipt-page')) {
        initBillReceipt();
    }
});

// Toast Notification Helper
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'danger' ? 'danger' : ''}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'danger' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

// ----------------------------------------------------
// 1. POS REGISTER PAGE LOGIC
// ----------------------------------------------------
function initPOSRegister() {
    let cart = [];
    let selectedCategory = null;
    let tablesList = [];
    let loadedMenuItems = [];

    const categoryContainer = document.getElementById('categories-list');
    const menuGrid = document.getElementById('menu-grid');
    const cartContainer = document.getElementById('cart-items-list');
    const tableSelect = document.getElementById('table-select');
    
    // Totals Elements
    const valSubtotal = document.getElementById('val-subtotal');
    const valTax = document.getElementById('val-tax');
    const valTotal = document.getElementById('val-total');
    
    // Action Buttons
    const btnPlaceOrder = document.getElementById('btn-place-order');
    const btnClearOrder = document.getElementById('btn-clear-order');

    // Payment Modal Elements
    const paymentModal = document.getElementById('payment-modal');
    const modalClose = document.getElementById('modal-close');
    const modalTotalAmount = document.getElementById('modal-total-amount');
    const btnMethodCash = document.getElementById('method-cash');
    const btnMethodCard = document.getElementById('method-card');
    const cashInputGroup = document.getElementById('cash-input-group');
    const cashReceivedInput = document.getElementById('cash-received');
    const changeAmountLabel = document.getElementById('change-amount');
    const btnSubmitPayment = document.getElementById('btn-submit-payment');
    
    let activePaymentMethod = 'cash';
    let currentPlacedOrderId = null;

    // Load Initial Data
    fetchTables();
    fetchCategories();
    fetchMenuItems();

    // Event Listeners
    btnClearOrder.addEventListener('click', clearCart);
    btnPlaceOrder.addEventListener('click', placeOrder);

    if (tableSelect) {
        tableSelect.addEventListener('change', () => {
            const tableId = tableSelect.value;
            if (tableId && tableId !== 'takeaway') {
                const selectedTable = tablesList.find(t => t.id === parseInt(tableId));
                if (selectedTable && selectedTable.status === 'occupied') {
                    showToast(`Table ${selectedTable.number} is occupied!`, 'danger');
                    tableSelect.value = '';
                }
            }
        });
    }

    // Search input listener
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderMenuItems();
        });
    }

    // Modal Events
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            paymentModal.classList.remove('active');
        });
    }

    if (btnMethodCash) {
        btnMethodCash.addEventListener('click', () => {
            activePaymentMethod = 'cash';
            btnMethodCash.classList.add('active');
            btnMethodCard.classList.remove('active');
            cashInputGroup.style.display = 'flex';
            calculateChange();
        });
    }

    if (btnMethodCard) {
        btnMethodCard.addEventListener('click', () => {
            activePaymentMethod = 'card';
            btnMethodCard.classList.add('active');
            btnMethodCash.classList.remove('active');
            cashInputGroup.style.display = 'none';
            changeAmountLabel.textContent = 'Rs. 0.00';
        });
    }

    if (cashReceivedInput) {
        cashReceivedInput.addEventListener('input', calculateChange);
    }

    if (btnSubmitPayment) {
        btnSubmitPayment.addEventListener('click', submitPayment);
    }

    // Fetch Tables
    function fetchTables() {
        fetch('/api/tables/')
            .then(res => res.json())
            .then(data => {
                tablesList = data;
                tableSelect.innerHTML = '<option value="">-- Choose Table / Takeaway --</option>';
                
                // Add Takeaway option
                const takeawayOption = document.createElement('option');
                takeawayOption.value = 'takeaway';
                takeawayOption.textContent = 'Takeaway';
                tableSelect.appendChild(takeawayOption);

                data.forEach(table => {
                    const option = document.createElement('option');
                    option.value = table.id;
                    option.textContent = `Table ${table.number} (${table.status.toUpperCase()})`;
                    tableSelect.appendChild(option);
                });
            })
            .catch(err => {
                console.error('Error fetching tables:', err);
                showToast('Failed to load tables', 'danger');
            });
    }

    // Fetch Categories
    function fetchCategories() {
        fetch('/api/categories/')
            .then(res => res.json())
            .then(data => {
                categoryContainer.innerHTML = '';
                
                // Add "All" Category
                const allBtn = document.createElement('button');
                allBtn.className = 'category-btn active';
                allBtn.innerHTML = `<i class="fa-solid fa-list"></i> <span>All</span>`;
                allBtn.addEventListener('click', () => {
                    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
                    allBtn.classList.add('active');
                    selectedCategory = null;
                    fetchMenuItems();
                });
                categoryContainer.appendChild(allBtn);

                // Add Category lists
                data.forEach(cat => {
                    const btn = document.createElement('button');
                    btn.className = 'category-btn';
                    btn.innerHTML = `
                        ${cat.image ? `<img src="${cat.image}" alt="${cat.name}">` : `<i class="fa-solid fa-utensils"></i>`}
                        <span>${cat.name}</span>
                    `;
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
                        btn.classList.add('active');
                        selectedCategory = cat.id;
                        fetchMenuItems(cat.id);
                    });
                    categoryContainer.appendChild(btn);
                });
            })
            .catch(err => {
                console.error('Error loading categories:', err);
                showToast('Failed to load categories', 'danger');
            });
    }

    // Fetch Menu Items
    function fetchMenuItems(catId = null) {
        let url = '/api/menu-items/';
        if (catId) {
            url += `?category=${catId}`;
        }
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                loadedMenuItems = data;
                renderMenuItems();
            })
            .catch(err => {
                console.error('Error loading items:', err);
                showToast('Failed to load menu items', 'danger');
            });
    }

    // Render Menu Items based on loadedMenuItems and search query
    function renderMenuItems() {
        const searchVal = document.getElementById('pos-search-input');
        const query = searchVal ? searchVal.value.toLowerCase().trim() : '';
        
        menuGrid.innerHTML = '';
        
        const filtered = loadedMenuItems.filter(item => {
            const name = item.name.toLowerCase();
            const desc = (item.description || '').toLowerCase();
            return !query || name.includes(query) || desc.includes(query);
        });

        if (filtered.length === 0) {
            menuGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No items found matching search.</div>`;
            return;
        }
        
        // Group items by name
        const groups = {};
        filtered.forEach(item => {
            if (!groups[item.name]) {
                groups[item.name] = [];
            }
            groups[item.name].push(item);
        });
        
        // Render groups
        Object.keys(groups).forEach(name => {
            const items = groups[name];
            // Sort items by size price ascending
            items.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
            
            const firstItem = items[0];
            const card = document.createElement('div');
            card.className = 'food-card';
            
            // Check if there are multiple sizes or if the single item has a defined size
            const hasSizes = items.length > 1 || (firstItem.size && firstItem.size !== '');
            
            let sizeSelectorHTML = '';
            if (hasSizes) {
                sizeSelectorHTML = `<div class="size-selector" style="display: flex; gap: 8px; margin: 8px 0; flex-wrap: wrap;">`;
                items.forEach((varItem, idx) => {
                    const sizeLabel = varItem.size || 'Standard';
                    sizeSelectorHTML += `
                        <button class="size-btn ${idx === 0 ? 'active' : ''}" 
                                data-id="${varItem.id}" 
                                data-price="${varItem.price}"
                                style="padding: 4px 10px; font-size: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; font-weight: 600; transition: all 0.2s ease;">
                            ${sizeLabel}
                        </button>
                    `;
                });
                sizeSelectorHTML += `</div>`;
            }
            
            card.innerHTML = `
                <div class="food-img-wrapper">
                    <img src="${firstItem.image || '/static/images/placeholder.png'}" class="food-img" alt="${firstItem.name}" loading="lazy">
                </div>
                <div class="food-info" style="display: flex; flex-direction: column; flex-grow: 1;">
                    <div class="food-name" style="font-weight: 700; font-size: 1.05rem;">${firstItem.name}</div>
                    <div class="food-desc" style="flex-grow: 1; font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">${firstItem.description}</div>
                    ${sizeSelectorHTML}
                    <div class="food-price-row" style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 8px;">
                        <div class="food-price" style="font-weight: 800; color: var(--accent-color); font-size: 1.1rem;">Rs. ${parseFloat(firstItem.price).toFixed(2)}</div>
                        <button class="food-add-btn" style="border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: var(--accent-color); color: #fff; border: none; cursor: pointer; transition: all 0.2s ease;"><i class="fa-solid fa-plus"></i></button>
                    </div>
                </div>
            `;
            
            menuGrid.appendChild(card);
            
            // Track the active item for this card
            let activeItem = firstItem;
            
            if (hasSizes) {
                const sizeButtons = card.querySelectorAll('.size-btn');
                
                // Style the active button initially
                const initialActiveBtn = card.querySelector('.size-btn.active');
                if (initialActiveBtn) {
                    initialActiveBtn.style.background = 'var(--accent-color)';
                    initialActiveBtn.style.borderColor = 'var(--accent-color)';
                }

                sizeButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent triggering card click
                        
                        sizeButtons.forEach(b => {
                            b.classList.remove('active');
                            b.style.background = 'rgba(255,255,255,0.05)';
                            b.style.borderColor = 'var(--border-color)';
                        });
                        btn.classList.add('active');
                        btn.style.background = 'var(--accent-color)';
                        btn.style.borderColor = 'var(--accent-color)';
                        
                        const selectedId = parseInt(btn.dataset.id);
                        activeItem = items.find(it => it.id === selectedId);
                        
                        // Update price display
                        const priceDisplay = card.querySelector('.food-price');
                        priceDisplay.textContent = `Rs. ${parseFloat(activeItem.price).toFixed(2)}`;
                    });
                });
            }
            
            // Add click listeners
            card.addEventListener('click', () => {
                addToCart(activeItem);
            });
            
            const addBtn = card.querySelector('.food-add-btn');
            if (addBtn) {
                addBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    addToCart(activeItem);
                });
            }
        });
    }

    // Add Item to Cart (with size variation check)
    function addToCart(item) {
        const displayName = (item.size && item.size !== '') ? `${item.name} (${item.size})` : item.name;
        
        const existingItem = cart.find(c => c.id === item.id);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({
                id: item.id,
                name: displayName,
                price: parseFloat(item.price),
                image: item.image,
                quantity: 1
            });
        }
        updateCartUI();
        showToast(`${displayName} added to cart`);
    }

    // Update Cart UI list
    function updateCartUI() {
        cartContainer.innerHTML = '';
        if (cart.length === 0) {
            cartContainer.innerHTML = `
                <div class="cart-empty">
                    <i class="fa-solid fa-basket-shopping"></i>
                    <span>Your cart is empty</span>
                </div>
            `;
            valSubtotal.textContent = 'Rs. 0.00';
            valTax.textContent = 'Rs. 0.00';
            valTotal.textContent = 'Rs. 0.00';
            return;
        }

        let subtotal = 0;

        cart.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;

            const cartEl = document.createElement('div');
            cartEl.className = 'cart-item';
            cartEl.innerHTML = `
                <img src="${item.image || '/static/images/placeholder.png'}" class="cart-item-img" alt="${item.name}">
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">Rs. ${itemTotal.toFixed(2)}</div>
                    <div class="cart-item-actions">
                        <div class="qty-controls">
                            <button class="qty-btn btn-minus" data-id="${item.id}"><i class="fa-solid fa-minus"></i></button>
                            <span class="qty-val">${item.quantity}</span>
                            <button class="qty-btn btn-plus" data-id="${item.id}"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <button class="remove-item-btn" data-id="${item.id}"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            `;
            cartContainer.appendChild(cartEl);
        });

        // Calculate Taxes (5% GST)
        const tax = subtotal * 0.05;
        const grandTotal = subtotal + tax;

        valSubtotal.textContent = `Rs. ${subtotal.toFixed(2)}`;
        valTax.textContent = `Rs. ${tax.toFixed(2)}`;
        valTotal.textContent = `Rs. ${grandTotal.toFixed(2)}`;

        // Attach listeners inside Cart items
        document.querySelectorAll('.btn-minus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                updateQty(parseInt(btn.dataset.id), -1);
            });
        });

        document.querySelectorAll('.btn-plus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                updateQty(parseInt(btn.dataset.id), 1);
            });
        });

        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromCart(parseInt(btn.dataset.id));
            });
        });
    }

    // Update Quantity
    function updateQty(itemId, amt) {
        const item = cart.find(c => c.id === itemId);
        if (item) {
            item.quantity += amt;
            if (item.quantity <= 0) {
                removeFromCart(itemId);
            } else {
                updateCartUI();
            }
        }
    }

    // Remove from Cart
    function removeFromCart(itemId) {
        cart = cart.filter(c => c.id !== itemId);
        updateCartUI();
    }

    // Clear Cart
    function clearCart() {
        if (cart.length === 0) return;
        cart = [];
        updateCartUI();
        showToast('Cart cleared', 'danger');
    }

    // Get CSRF Token
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

    // Place Order API
    function placeOrder() {
        const tableId = tableSelect.value;
        if (!tableId) {
            showToast('Please select a table or Takeaway', 'danger');
            return;
        }

        if (tableId && tableId !== 'takeaway') {
            const selectedTable = tablesList.find(t => t.id === parseInt(tableId));
            if (selectedTable && selectedTable.status === 'occupied') {
                showToast(`Table ${selectedTable.number} is occupied!`, 'danger');
                tableSelect.value = '';
                return;
            }
        }

        if (cart.length === 0) {
            showToast('Please add items to cart', 'danger');
            return;
        }

        const orderData = {
            table: tableId === 'takeaway' ? null : parseInt(tableId),
            items: cart.map(item => ({
                menu_item: item.id,
                quantity: item.quantity
            }))
        };

        const csrfToken = getCSRFToken();

        fetch('/api/orders/create/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(orderData)
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                currentPlacedOrderId = data.id;
                showToast('Order placed successfully!');
                
                // Refresh tables select dropdown status
                fetchTables();
                
                // Open Payment modal automatically
                openPaymentModal(data.total_amount);
                
                // Clear local cart
                cart = [];
                updateCartUI();
            } else {
                let errorMsg = 'Failed to place order';
                if (data.error) {
                    errorMsg = data.error;
                } else if (data.non_field_errors) {
                    errorMsg = data.non_field_errors.join(', ');
                } else if (typeof data === 'object') {
                    // Extract first error value from object
                    const keys = Object.keys(data);
                    if (keys.length > 0) {
                        const firstVal = data[keys[0]];
                        errorMsg = Array.isArray(firstVal) ? firstVal[0] : firstVal;
                    }
                }
                showToast(errorMsg, 'danger');
            }
        })
        .catch(err => {
            console.error('Error placing order:', err);
            showToast('Failed to place order due to network issue', 'danger');
        });
    }

    // Open Payment Modal
    function openPaymentModal(orderSubtotal) {
        const sub = parseFloat(orderSubtotal);
        const grandTotal = sub * 1.10;
        modalTotalAmount.textContent = `Rs. ${grandTotal.toFixed(2)}`;
        
        if (cashReceivedInput) {
            cashReceivedInput.value = grandTotal.toFixed(2);
        }
        
        activePaymentMethod = 'cash';
        if (btnMethodCash) {
            btnMethodCash.classList.add('active');
        }
        if (btnMethodCard) {
            btnMethodCard.classList.remove('active');
        }
        if (cashInputGroup) {
            cashInputGroup.style.display = 'flex';
        }
        
        calculateChange();
        paymentModal.classList.add('active');
    }

    // Calculate Change
    function calculateChange() {
        if (activePaymentMethod !== 'cash') return;
        
        const totalText = modalTotalAmount.textContent.replace('Rs. ', '');
        const grandTotal = parseFloat(totalText) || 0;
        const cashPaid = parseFloat(cashReceivedInput.value) || 0;
        
        const change = Math.max(0, cashPaid - grandTotal);
        changeAmountLabel.textContent = `Rs. ${change.toFixed(2)}`;
    }

    // Submit Payment API
    function submitPayment() {
        if (!currentPlacedOrderId) {
            showToast('No active order to pay', 'danger');
            return;
        }

        const totalText = modalTotalAmount.textContent.replace('Rs. ', '');
        const grandTotal = parseFloat(totalText) || 0;
        let cashPaid = grandTotal;

        if (activePaymentMethod === 'cash') {
            cashPaid = parseFloat(cashReceivedInput.value) || 0;
            if (cashPaid < grandTotal) {
                showToast('Amount paid is less than grand total', 'danger');
                return;
            }
        }

        const paymentData = {
            order: currentPlacedOrderId,
            method: activePaymentMethod,
            amount_paid: cashPaid
        };

        const csrfToken = getCSRFToken();

        fetch('/api/payments/process/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(paymentData)
        })
        .then(async res => {
            const data = await res.json();
            if (res.ok) {
                showToast('Payment processed successfully!');
                paymentModal.classList.remove('active');
                
                // Redirect to receipt view
                window.location.href = `/bill/${currentPlacedOrderId}/`;
            } else {
                showToast(data.error || 'Payment failed', 'danger');
            }
        })
        .catch(err => {
            console.error('Error processing payment:', err);
            showToast('Network error processing payment', 'danger');
        });
    }
}

// ----------------------------------------------------
// 2. KITCHEN DISPLAY LOGIC
// ----------------------------------------------------
function initKitchenDisplay() {
    const kitchenGrid = document.getElementById('kitchen-grid');
    if (!kitchenGrid) return;

    fetchKitchenOrders();
    
    // Auto-refresh every 10 seconds
    setInterval(fetchKitchenOrders, 10000);

    function fetchKitchenOrders() {
        fetch('/api/orders/kitchen/')
            .then(res => res.json())
            .then(data => {
                kitchenGrid.innerHTML = '';
                if (data.length === 0) {
                    kitchenGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem; font-size: 1.25rem;">
                        <i class="fa-solid fa-circle-check" style="font-size: 3rem; color: var(--accent-color); display: block; margin-bottom: 1rem;"></i>
                        All caught up! No active orders.
                    </div>`;
                    return;
                }

                data.forEach(order => {
                    const elapsed = calculateTimeElapsed(order.created_at);
                    
                    const card = document.createElement('div');
                    card.className = 'order-card';
                    card.innerHTML = `
                        <div class="order-card-header">
                            <span class="order-card-table">${order.table_number === 'Takeaway' || !order.table_number ? 'Takeaway' : `Table ${order.table_number}`}</span>
                            <span class="badge badge-${order.status}">${order.status}</span>
                        </div>
                        <div class="order-card-time"><i class="fa-regular fa-clock"></i> Placed: ${elapsed} ago</div>
                        <div class="order-card-items">
                            ${order.items.map(item => `
                                <div class="order-card-item">
                                    <span>${item.menu_item_detail ? item.menu_item_detail.name + (item.menu_item_detail.size ? ` (${item.menu_item_detail.size})` : '') : 'Unknown Item'}</span>
                                    <span class="order-card-item-qty">x${item.quantity}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="order-card-footer">
                            ${order.status === 'pending' ? `
                                <button class="btn btn-primary btn-sm btn-action-preparing" data-id="${order.id}">Preparing</button>
                            ` : ''}
                            ${order.status === 'preparing' ? `
                                <button class="btn btn-primary btn-sm btn-action-ready" data-id="${order.id}">Ready to Serve</button>
                            ` : ''}
                        </div>
                    `;
                    kitchenGrid.appendChild(card);
                });

                // Attach Action Listeners
                document.querySelectorAll('.btn-action-preparing').forEach(btn => {
                    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.id, 'preparing'));
                });
                document.querySelectorAll('.btn-action-ready').forEach(btn => {
                    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.id, 'ready'));
                });
            })
            .catch(err => {
                console.error('Error fetching kitchen orders:', err);
            });
    }

    function calculateTimeElapsed(createdAt) {
        const diffMs = new Date() - new Date(createdAt);
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins <= 0) return 'Just now';
        return `${diffMins} min`;
    }

    function updateOrderStatus(orderId, newStatus) {
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

        fetch(`/api/orders/${orderId}/update-status/`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': cookieValue
            },
            body: JSON.stringify({ status: newStatus })
        })
        .then(res => {
            if (res.ok) {
                showToast(`Order #${orderId} marked as ${newStatus}`);
                fetchKitchenOrders();
            } else {
                showToast('Failed to update status', 'danger');
            }
        })
        .catch(err => {
            console.error('Error updating status:', err);
            showToast('Error updating status', 'danger');
        });
    }
}

// ----------------------------------------------------
// 3. BILL RECEIPT LOGIC
// ----------------------------------------------------
function initBillReceipt() {
    const btnPrint = document.getElementById('btn-print-bill');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }
}

// ----------------------------------------------------
// 4. ANALYTICS DASHBOARD LOGIC
// ----------------------------------------------------
function initAnalyticsDashboard() {
    const todaySalesEl = document.getElementById('today-sales');
    const todayOrdersEl = document.getElementById('today-orders');
    const topItemsBody = document.getElementById('top-items-body');

    fetch('/api/dashboard/stats/')
        .then(res => res.json())
        .then(data => {
            // Update Card Stats
            if (todaySalesEl) todaySalesEl.textContent = `Rs. ${parseFloat(data.today_revenue).toFixed(2)}`;
            if (todayOrdersEl) todayOrdersEl.textContent = data.today_orders_count;

            // Update Top Items Table
            if (topItemsBody) {
                topItemsBody.innerHTML = '';
                if (data.top_selling_items.length === 0) {
                    topItemsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No sales data yet today.</td></tr>`;
                } else {
                    data.top_selling_items.forEach((item, index) => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${index + 1}</td>
                            <td style="font-weight: 600;">${item.name}</td>
                            <td>${item.quantity}</td>
                            <td style="color: var(--accent-color); font-weight: 700;">Rs. ${parseFloat(item.revenue).toFixed(2)}</td>
                        `;
                        topItemsBody.appendChild(tr);
                    });
                }
            }

            // Render Chart.js
            renderRevenueChart(data.daily_revenue);
        })
        .catch(err => {
            console.error('Error fetching dashboard stats:', err);
            showToast('Failed to load dashboard metrics', 'danger');
        });

    function renderRevenueChart(chartData) {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        // Dynamically load Chart.js script from CDN if it doesn't exist yet
        if (typeof Chart === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => buildChart(ctx, chartData);
            document.head.appendChild(script);
        } else {
            buildChart(ctx, chartData);
        }
    }

    function buildChart(ctx, chartData) {
        const labels = chartData.map(d => d.date);
        const revenues = chartData.map(d => d.revenue);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (Rs.)',
                    data: revenues,
                    backgroundColor: 'rgba(0, 184, 148, 0.4)',
                    borderColor: 'rgba(0, 184, 148, 1)',
                    borderWidth: 2,
                    borderRadius: 6,
                    hoverBackgroundColor: 'rgba(0, 184, 148, 0.7)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#a0a0b0',
                            font: {
                                family: "'Inter', sans-serif"
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#a0a0b0',
                            font: {
                                family: "'Inter', sans-serif"
                            },
                            callback: function(value) {
                                return 'Rs. ' + value;
                            }
                        }
                    }
                }
            }
        });
    }
}
