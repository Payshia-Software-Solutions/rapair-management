const API_URL = 'api.php';

// Auth State Check
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/check-auth`);
        if (response.ok) {
            const data = await response.json();
            showDashboard(data.user);
        }
    } catch (err) {
        console.log('Not logged in');
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login_user').value;
    const password = document.getElementById('login_pass').value;
    const msg = document.getElementById('loginMessage');

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const result = await response.json();
        if (response.ok) {
            showDashboard(result.user);
        } else {
            msg.innerText = result.message;
        }
    } catch (err) {
        msg.innerText = 'Server error. Check DB connection.';
    }
});

function showDashboard(user) {
    document.getElementById('loginView').style.display = 'none';
    document.getElementById('dashboardView').style.display = 'flex';
    document.getElementById('currentAdmin').innerText = user;
    loadRequests();
}

async function logout() {
    await fetch(`${API_URL}/logout`);
    location.reload();
}

function showSection(section) {
    document.getElementById('sectionRequests').style.display = section === 'requests' ? 'block' : 'none';
    document.getElementById('sectionUsers').style.display = section === 'users' ? 'block' : 'none';
    document.getElementById('sectionTitle').innerText = section === 'requests' ? 'ERP Order Requests' : 'User Accounts';
    
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    event.currentTarget.classList.add('active');

    if (section === 'requests') loadRequests();
    if (section === 'users') loadUsers();
}

// Data Management
async function loadRequests() {
    const response = await fetch(`${API_URL}/admin/requests`);
    const result = await response.json();
    const tbody = document.getElementById('requestsTable');
    tbody.innerHTML = '';

    let total = 0;
    let pending = 0;

    result.data.forEach(req => {
        total++;
        if (req.status === 'Pending') pending++;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${req.company_name}</strong></td>
            <td>${req.contact_person}<br><span style="font-size:0.8rem; color:var(--text-muted)">${req.email}</span></td>
            <td>${req.package_type}</td>
            <td>${req.expected_users}</td>
            <td><span class="status-badge status-${req.status.toLowerCase()}">${req.status}</span></td>
            <td>${new Date(req.created_at).toLocaleDateString()}</td>
            <td>
                <div style="display:flex; gap:0.5rem">
                    <button onclick="updateStatus(${req.id}, 'Approved')" class="btn glass" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:#10b981">Approve</button>
                    <button onclick="updateStatus(${req.id}, 'Rejected')" class="btn glass" style="padding:0.25rem 0.5rem; font-size:0.75rem; color:#ef4444">Reject</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('statTotal').innerText = total;
    document.getElementById('statPending').innerText = pending;
}

async function updateStatus(id, status) {
    await fetch(`${API_URL}/admin/requests/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
    });
    loadRequests();
}

async function loadUsers() {
    const response = await fetch(`${API_URL}/admin/users`);
    const result = await response.json();
    const tbody = document.getElementById('usersTable');
    tbody.innerHTML = '';

    result.data.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.username}</td>
            <td>${user.full_name}</td>
            <td>${new Date(user.created_at).toLocaleString()}</td>
        `;
        tbody.appendChild(tr);
    });
}

document.getElementById('newUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
        username: document.getElementById('new_user').value,
        full_name: document.getElementById('new_full_name').value,
        password: document.getElementById('new_pass').value
    };

    const response = await fetch(`${API_URL}/admin/users/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (response.ok) {
        alert('Admin user created successfully');
        e.target.reset();
        loadUsers();
    } else {
        const result = await response.json();
        alert('Error: ' + result.message);
    }
});

// Init
checkAuth();
