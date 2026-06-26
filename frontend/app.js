const API_URL = '';
let socket;
let currentUser = null;
let currentContact = 'group';

// Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const authForm = document.getElementById('auth-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const authError = document.getElementById('auth-error');
const btnLogout = document.getElementById('btn-logout');

const myUsernameEl = document.getElementById('my-username');
const myAvatarEl = document.getElementById('my-avatar');
const currentContactNameEl = document.getElementById('current-contact-name');
const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const emptyChat = document.getElementById('empty-chat');

const privateContactsContainer = document.getElementById('private-contacts');

// Auth Handlers
btnRegister.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    if (!username || !password) return showError('Preencha os campos');

    try {
        const res = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            showError('Registro com sucesso. Faça login.', 'var(--success)');
        } else {
            showError(data.error);
        }
    } catch (err) {
        console.error('Register error:', err);
        showError('Erro no servidor: ' + err.message);
    }
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    try {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.username);
            initChat(data.username, data.token);
        } else {
            showError(data.error);
        }
    } catch (err) {
        console.error('Login error:', err);
        showError('Erro no servidor: ' + err.message);
    }
});

btnLogout.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    if (socket) socket.disconnect();
    showAuth();
});

function showError(msg, color = 'var(--danger)') {
    authError.style.color = color;
    authError.innerText = msg;
    setTimeout(() => authError.innerText = '', 3000);
}

// Chat Handlers
function initChat(username, token) {
    currentUser = username;
    authScreen.classList.add('hidden');
    authScreen.classList.remove('active');
    chatScreen.classList.remove('hidden');
    chatScreen.classList.add('active');
    
    myUsernameEl.innerText = username;
    myAvatarEl.innerText = username.charAt(0).toUpperCase();

    // Connect Socket.io
    socket = io({
        auth: { token },
        path: '/socket.io/',
        transports: ['websocket']
    });

    socket.on('connect', () => {
        console.log('Connected to WebSocket');
        loadUsers();
        loadHistory('group');
    });

    socket.on('receiveMessage', (msg) => {
        // Render msg if it belongs to current active chat
        if (currentContact === 'group' && msg.recipient === 'group') {
            appendMessage(msg);
        } else if (msg.recipient !== 'group') {
            // Private message. It belongs to active chat if sender is contact OR recipient is contact
            if (msg.sender === currentContact || msg.recipient === currentContact) {
                appendMessage(msg);
            }
        }
        scrollToBottom();
    });

    socket.on('connect_error', (err) => {
        console.error('Socket error:', err.message);
        btnLogout.click();
    });
}

// Switch Chat
document.querySelector('.contacts-list').addEventListener('click', (e) => {
    const contactEl = e.target.closest('.contact');
    if (!contactEl) return;
    
    document.querySelectorAll('.contact').forEach(c => c.classList.remove('active'));
    contactEl.classList.add('active');
    
    currentContact = contactEl.dataset.contact;
    if (currentContact === 'group') {
        currentContactNameEl.innerText = 'Chat Global';
    } else {
        currentContactNameEl.innerText = currentContact;
    }
    
    loadHistory(currentContact);
});

// Fetch all users and populate list
async function loadUsers() {
    try {
        const res = await fetch(`${API_URL}/api/auth/users`);
        if (res.ok) {
            const users = await res.json();
            privateContactsContainer.innerHTML = '';
            users.forEach(username => {
                if (username === currentUser) return; // Don't add self
                const div = document.createElement('div');
                div.className = 'contact';
                div.dataset.contact = username;
                div.innerHTML = `
                    <div class="avatar">${username.charAt(0).toUpperCase()}</div>
                    <div class="contact-info">
                        <span class="contact-name">${username}</span>
                        <span class="contact-status">Chat privado</span>
                    </div>
                `;
                privateContactsContainer.appendChild(div);
            });
        }
    } catch (err) {
        console.error('Failed to load users', err);
    }
}

// Load History
async function loadHistory(contact) {
    messagesContainer.innerHTML = '';
    
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/api/chat/history?contact=${contact}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const messages = await res.json();
            if (messages.length === 0) {
                emptyChat.classList.remove('hidden');
                messagesContainer.appendChild(emptyChat);
            } else {
                emptyChat.classList.add('hidden');
                messages.forEach(msg => appendMessage(msg));
                scrollToBottom();
            }
        }
    } catch (err) {
        console.error('Failed to load history');
    }
}

// Send Message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || !socket) return;
    
    socket.emit('sendMessage', {
        recipient: currentContact,
        content: text
    });
    
    messageInput.value = '';
});

function appendMessage(msg) {
    const div = document.createElement('div');
    const isMe = msg.sender === currentUser;
    div.className = `message ${isMe ? 'message-out' : 'message-in'}`;
    
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    div.innerHTML = `
        ${!isMe && currentContact === 'group' ? `<span class="msg-sender">${msg.sender}</span>` : ''}
        <span class="msg-content">${msg.content}</span>
        <span class="msg-time">${time}</span>
    `;
    
    // Remove empty state if it's there
    if (!emptyChat.classList.contains('hidden')) {
        emptyChat.classList.add('hidden');
        messagesContainer.innerHTML = '';
    }
    
    messagesContainer.appendChild(div);
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showAuth() {
    authScreen.classList.remove('hidden');
    chatScreen.classList.add('hidden');
}

// Check auto-login
window.onload = () => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('username');
    if (token && user) {
        initChat(user, token);
    }
};
